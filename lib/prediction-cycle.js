// Automatic pre-game capture and post-game grading cycle.
// Runs opportunistically when Fantasy Guru already builds league rankings.
// It never changes projection math or recommendations.

import { createPredictionRecord, gradePredictionRecord, snapshotKey, summarizeGrades } from './prediction-ledger.js';
import { predictionStoreConfigured, savePredictionRecord, savePredictionGrade, getPredictionRecord, listPredictionRecords } from './prediction-store.js';

const TRACKED_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const pos = p => String(p || '').toUpperCase() === 'DST' ? 'DEF' : String(p || '').toUpperCase();
const WEEK_TTL_MS = 5 * 60 * 1000;
const weekCache = new Map();

function cycleMeta(context) {
  const season = Number(context?.league?.season);
  const week = Number(context?.current_week);
  const leagueId = String(context?.league?.id || '');
  const platform = String(context?.platform || '').toLowerCase();
  if (!Number.isFinite(season) || !Number.isFinite(week) || !leagueId || !platform) return null;
  return { season, week, leagueId, platform };
}

async function authoritativeCurrentWeek(meta) {
  const cacheKey = `${meta.platform}:${meta.leagueId}:${meta.season}`;
  const cached = weekCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < WEEK_TTL_MS) return cached.week;

  let week = null;
  if (meta.platform === 'sleeper') {
    const r = await fetch('https://api.sleeper.app/v1/state/nfl', { headers: { Accept: 'application/json', 'User-Agent': 'FantasyGuru/1.0' } });
    if (!r.ok) throw new Error(`Sleeper week check failed (${r.status}).`);
    const d = await r.json();
    if (finite(d?.week)) week = Number(d.week);
  } else if (meta.platform === 'espn') {
    if (!process.env.ESPN_S2 || !process.env.ESPN_SWID) throw new Error('ESPN credentials are unavailable for current-week verification.');
    const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${meta.season}/segments/0/leagues/${encodeURIComponent(meta.leagueId)}?view=mStatus`;
    const r = await fetch(url, {
      headers: {
        Cookie: `espn_s2=${process.env.ESPN_S2}; SWID=${process.env.ESPN_SWID}`,
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    if (!r.ok) throw new Error(`ESPN week check failed (${r.status}).`);
    const d = await r.json();
    if (finite(d?.status?.currentScoringPeriod)) week = Number(d.status.currentScoringPeriod);
  }

  if (!finite(week)) throw new Error('Could not verify the platform current week.');
  weekCache.set(cacheKey, { ts: Date.now(), week });
  return week;
}

function trackedPlayers(data) {
  const out = [];
  const seen = new Set();
  for (const team of data?.team_details || []) {
    for (const p of team?.players || []) {
      if (!TRACKED_POSITIONS.has(pos(p?.position)) || !finite(p?.weekly_points)) continue;
      const id = String(p?.canonical_player_id || p?.id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(p);
    }
  }
  return out;
}

function actualRows(data) {
  const out = [];
  const seen = new Set();
  for (const team of data?.team_details || []) {
    for (const p of team?.players || []) {
      if (!TRACKED_POSITIONS.has(pos(p?.position)) || !finite(p?.actual_weekly_points)) continue;
      const id = String(p?.canonical_player_id || p?.id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ player_id: id, actual_points: Number(p.actual_weekly_points) });
    }
  }
  return out;
}

async function historySummary(meta) {
  try {
    const records = await listPredictionRecords({
      season: meta.season,
      platform: meta.platform,
      leagueId: meta.leagueId,
      limit: 100
    });
    return {
      ...summarizeGrades(records),
      scope: { season: meta.season, platform: meta.platform, league_id: meta.leagueId }
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function withHistory(meta, payload) {
  return { ...payload, history: await historySummary(meta) };
}

export async function runPredictionCycle(context, data) {
  if (!predictionStoreConfigured()) {
    return { status: 'NOT_CONFIGURED', configured: false, note: 'Supabase server environment variables are not set.' };
  }

  const meta = cycleMeta(context);
  if (!meta) return { status: 'SKIPPED', configured: true, reason: 'League season/week/platform metadata is incomplete.' };

  // Ledger integrity rule: navigation to past/future analysis weeks is read-only.
  // Only the platform's authoritative current scoring week may create or grade a snapshot.
  let liveWeek;
  try {
    liveWeek = await authoritativeCurrentWeek(meta);
  } catch (e) {
    return withHistory(meta, {
      status: 'WEEK_UNVERIFIED',
      configured: true,
      selected_week: meta.week,
      note: `Prediction ledger paused because the platform current week could not be verified: ${e.message}`
    });
  }
  if (Number(meta.week) !== Number(liveWeek)) {
    return withHistory(meta, {
      status: 'VIEW_ONLY_WEEK',
      configured: true,
      selected_week: meta.week,
      live_week: liveWeek,
      note: `Week ${meta.week} is view-only. The prediction ledger only captures and grades the platform current week (Week ${liveWeek}).`
    });
  }

  const players = trackedPlayers(data);
  const actuals = actualRows(data);
  const key = snapshotKey(meta);
  let record = await getPredictionRecord(key);

  // Anti-hindsight rule: if any actual scoring data exists, never create a new snapshot.
  // Missing a week is preferable to contaminating the evaluation set with post-kickoff information.
  if (!record) {
    if (actuals.length > 0) {
      return withHistory(meta, {
        status: 'MISSED_PREGAME',
        configured: true,
        key,
        actual_players_seen: actuals.length,
        note: 'No clean pre-game snapshot existed before actual scoring data appeared.'
      });
    }
    if (!players.length) {
      return withHistory(meta, { status: 'SKIPPED', configured: true, key, reason: 'No tracked player projections are available.' });
    }

    const created = createPredictionRecord({ ...meta, players });
    const inserted = await savePredictionRecord(created);
    record = inserted || await getPredictionRecord(key) || created;
    return withHistory(meta, {
      status: 'CAPTURED',
      configured: true,
      key,
      players_snapshotted: record?.snapshot?.predictions?.length || players.length,
      locked: true
    });
  }

  if (!actuals.length) {
    return withHistory(meta, {
      status: 'LOCKED',
      configured: true,
      key,
      players_snapshotted: record?.snapshot?.predictions?.length || 0,
      locked: true
    });
  }

  const graded = gradePredictionRecord(record, actuals);
  if (!graded?.grade?.players_graded) {
    return withHistory(meta, { status: 'WAITING_FOR_MATCHES', configured: true, key, actual_players_seen: actuals.length });
  }

  const saved = await savePredictionGrade(graded);
  return withHistory(meta, {
    status: 'GRADED',
    configured: true,
    key,
    players_graded: saved?.grade?.players_graded || graded.grade.players_graded,
    consensus_mae: saved?.grade?.mae ?? graded.grade.mae ?? null,
    source_accuracy: saved?.grade?.source_accuracy || graded.grade.source_accuracy,
    note: 'The original pre-game snapshot remains immutable; only grading fields were updated.'
  });
}
