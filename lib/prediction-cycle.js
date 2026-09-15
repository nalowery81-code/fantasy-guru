// Automatic pre-game capture and post-game grading cycle.
// Runs opportunistically when Fantasy Guru already builds league rankings.
// It never changes projection math or recommendations.

import { createPredictionRecord, gradePredictionRecord, snapshotKey } from './prediction-ledger.js';
import { predictionStoreConfigured, savePredictionRecord, savePredictionGrade, getPredictionRecord } from './prediction-store.js';

const TRACKED_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const pos = p => String(p || '').toUpperCase() === 'DST' ? 'DEF' : String(p || '').toUpperCase();

function cycleMeta(context) {
  const season = Number(context?.league?.season);
  const week = Number(context?.current_week);
  const leagueId = String(context?.league?.id || '');
  const platform = String(context?.platform || '').toLowerCase();
  if (!Number.isFinite(season) || !Number.isFinite(week) || !leagueId || !platform) return null;
  return { season, week, leagueId, platform };
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

export async function runPredictionCycle(context, data) {
  if (!predictionStoreConfigured()) {
    return { status: 'NOT_CONFIGURED', configured: false, note: 'Supabase server environment variables are not set.' };
  }

  const meta = cycleMeta(context);
  if (!meta) return { status: 'SKIPPED', configured: true, reason: 'League season/week/platform metadata is incomplete.' };

  const players = trackedPlayers(data);
  const actuals = actualRows(data);
  const key = snapshotKey(meta);
  let record = await getPredictionRecord(key);

  // Anti-hindsight rule: if any actual scoring data exists, never create a new snapshot.
  // Missing a week is preferable to contaminating the evaluation set with post-kickoff information.
  if (!record) {
    if (actuals.length > 0) {
      return {
        status: 'MISSED_PREGAME',
        configured: true,
        key,
        actual_players_seen: actuals.length,
        note: 'No clean pre-game snapshot existed before actual scoring data appeared.'
      };
    }
    if (!players.length) return { status: 'SKIPPED', configured: true, key, reason: 'No tracked player projections are available.' };

    const created = createPredictionRecord({ ...meta, players });
    const inserted = await savePredictionRecord(created);
    record = inserted || await getPredictionRecord(key) || created;
    return {
      status: 'CAPTURED',
      configured: true,
      key,
      players_snapshotted: record?.snapshot?.predictions?.length || players.length,
      locked: true
    };
  }

  if (!actuals.length) {
    return {
      status: 'LOCKED',
      configured: true,
      key,
      players_snapshotted: record?.snapshot?.predictions?.length || 0,
      locked: true
    };
  }

  const graded = gradePredictionRecord(record, actuals);
  if (!graded?.grade?.players_graded) {
    return { status: 'WAITING_FOR_MATCHES', configured: true, key, actual_players_seen: actuals.length };
  }

  const saved = await savePredictionGrade(graded);
  return {
    status: 'GRADED',
    configured: true,
    key,
    players_graded: saved?.grade?.players_graded || graded.grade.players_graded,
    consensus_mae: saved?.grade?.mae ?? graded.grade.mae ?? null,
    source_accuracy: saved?.grade?.source_accuracy || graded.grade.source_accuracy,
    note: 'The original pre-game snapshot remains immutable; only grading fields were updated.'
  };
}
