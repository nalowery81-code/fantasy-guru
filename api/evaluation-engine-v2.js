// Fantasy Guru Evaluation Engine v2
// Pure deterministic evaluation + self-testing helpers.
// This module intentionally does not replace valuation-engine.js yet.

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const avg = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const stdev = xs => {
  if (xs.length < 2) return 0;
  const m = avg(xs);
  return Math.sqrt(xs.reduce((s,x)=>s+((x-m)**2),0)/xs.length);
};
const pos = p => String(p || '').toUpperCase() === 'DST' ? 'DEF' : String(p || '').toUpperCase();

export const EVALUATION_V2_VERSION = '2.0.0';

export const DEFAULT_WEIGHTS = Object.freeze({
  start:   { weekly: .70, ros: .10, replacement: .10, confidence: .10 },
  waiver:  { weekly: .20, ros: .35, replacement: .20, confidence: .10, upside: .15 },
  trade:   { weekly: .10, ros: .45, replacement: .20, confidence: .10, market: .15 },
  roster:  { weekly: .25, ros: .40, replacement: .20, confidence: .15 }
});

function sourceValues(player, layer='weekly') {
  const keys = layer === 'weekly'
    ? ['espn_weekly_points','sleeper_weekly_points','ffanalytics_weekly_points']
    : ['espn_ros_points','sleeper_ros_points','ffanalytics_ros_points'];
  return keys.filter(k => finite(player?.[k])).map(k => Number(player[k]));
}

export function projectionConfidence(player, layer='weekly') {
  const vals = sourceValues(player, layer);
  if (!vals.length) return { score: 0, label: 'LOW', source_count: 0, spread: null, cv: null };
  const m = avg(vals);
  const sd = stdev(vals);
  const cv = Math.abs(m) > .01 ? sd / Math.abs(m) : 1;
  const sourceScore = vals.length === 3 ? 1 : vals.length === 2 ? .78 : .48;
  const agreementScore = clamp(1 - cv, 0, 1);
  const score = Math.round((sourceScore * .65 + agreementScore * .35) * 100);
  return {
    score,
    label: score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW',
    source_count: vals.length,
    spread: vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0,
    cv: Number(cv.toFixed(4))
  };
}

export function replacementBaselines(players=[], starterCounts={}) {
  const out = {};
  for (const p0 of POSITIONS) {
    const vals = players
      .filter(p => pos(p.position) === p0 && finite(p.ros_points))
      .map(p => Number(p.ros_points))
      .sort((a,b)=>b-a);
    const starters = Math.max(1, Number(starterCounts[p0] || 1));
    // Replacement level is the first player beyond the league's expected starters.
    const idx = Math.min(vals.length - 1, starters);
    out[p0] = vals.length ? vals[idx] : 0;
  }
  return out;
}

export function evaluatePlayer(player, { replacement={}, marketValue=null }={}) {
  const position = pos(player?.position);
  const weekly = finite(player?.weekly_points) ? Number(player.weekly_points) : null;
  const ros = finite(player?.ros_points) ? Number(player.ros_points) : null;
  const weeklyConfidence = projectionConfidence(player, 'weekly');
  const rosConfidence = projectionConfidence(player, 'ros');
  const baseline = finite(replacement[position]) ? Number(replacement[position]) : 0;
  const vor = ros === null ? null : ros - baseline;
  const upside = finite(player?.upside_score) ? clamp(player.upside_score, 0, 100) : 50;
  const market = finite(marketValue ?? player?.market_value) ? Number(marketValue ?? player.market_value) : null;

  return {
    version: EVALUATION_V2_VERSION,
    player_id: player?.canonical_player_id || player?.id || null,
    name: player?.name || '',
    position,
    weekly_points: weekly,
    ros_points: ros,
    replacement_level: baseline,
    value_over_replacement: vor,
    weekly_confidence: weeklyConfidence,
    ros_confidence: rosConfidence,
    upside_score: upside,
    market_value: market
  };
}

function zLike(value, scale) {
  if (!finite(value)) return 0;
  return clamp(Number(value) / scale, -2, 2) / 2; // roughly -1..1
}

export function decisionScore(evaluation, purpose='roster', weights=DEFAULT_WEIGHTS) {
  const w = weights[purpose] || weights.roster;
  const weekly = zLike(evaluation.weekly_points, 25);
  const ros = zLike(evaluation.ros_points, 250);
  const replacement = zLike(evaluation.value_over_replacement, 150);
  const confidence = ((evaluation.weekly_confidence?.score || 0) + (evaluation.ros_confidence?.score || 0)) / 200;
  const upside = (Number(evaluation.upside_score || 50) - 50) / 50;
  const market = finite(evaluation.market_value) ? zLike(evaluation.market_value, 100) : 0;
  const raw = (w.weekly||0)*weekly + (w.ros||0)*ros + (w.replacement||0)*replacement +
    (w.confidence||0)*confidence + (w.upside||0)*upside + (w.market||0)*market;
  return Math.round(raw * 1000) / 10; // readable score; ordering matters more than fake precision
}

export function comparePlayers(a, b, options={}) {
  const purpose = options.purpose || 'roster';
  const ea = evaluatePlayer(a, options);
  const eb = evaluatePlayer(b, options);
  const aScore = decisionScore(ea, purpose, options.weights);
  const bScore = decisionScore(eb, purpose, options.weights);
  const margin = Math.round(Math.abs(aScore-bScore)*10)/10;
  const confidence = margin >= 12 ? 'HIGH' : margin >= 5 ? 'MEDIUM' : 'LOW';
  return {
    version: EVALUATION_V2_VERSION,
    purpose,
    winner: aScore === bScore ? null : (aScore > bScore ? ea.player_id : eb.player_id),
    a: {...ea, decision_score:aScore},
    b: {...eb, decision_score:bScore},
    margin,
    confidence,
    hold: margin < 3
  };
}

// ---------- Self-testing ----------
// A snapshot is saved BEFORE games. Actuals are supplied only after games finish.
export function makePredictionSnapshot({season, week, leagueId, platform, players=[]}) {
  return {
    schema_version: 1,
    engine_version: EVALUATION_V2_VERSION,
    created_at: new Date().toISOString(),
    season: Number(season),
    week: Number(week),
    league_id: String(leagueId || ''),
    platform: String(platform || ''),
    predictions: players.map(p => ({
      player_id: p.canonical_player_id || p.id || null,
      name: p.name || '',
      position: pos(p.position),
      projected: finite(p.weekly_points) ? Number(p.weekly_points) : null,
      sources: {
        espn: finite(p.espn_weekly_points) ? Number(p.espn_weekly_points) : null,
        sleeper: finite(p.sleeper_weekly_points) ? Number(p.sleeper_weekly_points) : null,
        ffanalytics: finite(p.ffanalytics_weekly_points) ? Number(p.ffanalytics_weekly_points) : null
      },
      confidence: projectionConfidence(p, 'weekly')
    }))
  };
}

export function gradePredictionSnapshot(snapshot, actuals=[]) {
  const actualMap = new Map(actuals.map(a => [String(a.player_id || a.id || ''), Number(a.actual_points)]));
  const rows = [];
  const sourceErrors = { consensus:[], espn:[], sleeper:[], ffanalytics:[] };
  const positionErrors = {};

  for (const p of snapshot?.predictions || []) {
    const id = String(p.player_id || '');
    if (!actualMap.has(id) || !finite(p.projected)) continue;
    const actual = actualMap.get(id);
    const error = Number(p.projected) - actual;
    const abs = Math.abs(error);
    rows.push({...p, actual_points:actual, error, absolute_error:abs});
    sourceErrors.consensus.push(abs);
    positionErrors[p.position] ||= [];
    positionErrors[p.position].push(abs);
    for (const source of ['espn','sleeper','ffanalytics']) {
      if (finite(p.sources?.[source])) sourceErrors[source].push(Math.abs(Number(p.sources[source])-actual));
    }
  }

  const mae = xs => xs.length ? Math.round(avg(xs)*100)/100 : null;
  const byPosition = Object.fromEntries(Object.entries(positionErrors).map(([k,v]) => [k,{n:v.length,mae:mae(v)}]));
  const bySource = Object.fromEntries(Object.entries(sourceErrors).map(([k,v]) => [k,{n:v.length,mae:mae(v)}]));

  return {
    schema_version: 1,
    engine_version: snapshot?.engine_version || EVALUATION_V2_VERSION,
    season: snapshot?.season,
    week: snapshot?.week,
    graded_at: new Date().toISOString(),
    players_graded: rows.length,
    mae: mae(sourceErrors.consensus),
    source_accuracy: bySource,
    position_accuracy: byPosition,
    rows
  };
}

export function compareEngineGrades(currentGrade, challengerGrade) {
  const a = currentGrade?.mae;
  const b = challengerGrade?.mae;
  if (!finite(a) || !finite(b)) return { winner:null, improvement_pct:null, reason:'Not enough graded predictions.' };
  const improvement = Number(a) === 0 ? 0 : ((Number(a)-Number(b))/Number(a))*100;
  return {
    winner: Number(b) < Number(a) ? 'challenger' : Number(b) > Number(a) ? 'current' : 'tie',
    improvement_pct: Math.round(improvement*10)/10,
    current_mae: Number(a),
    challenger_mae: Number(b)
  };
}
