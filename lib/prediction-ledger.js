// Fantasy Guru prediction ledger
// Deterministic helpers for storing pre-game snapshots and grading them later.
// Storage is intentionally injected so this module works with a durable store
// when one is connected; do not treat serverless memory as durable persistence.

import { makePredictionSnapshot, gradePredictionSnapshot } from './evaluation-engine-v2.js';

const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

export function snapshotKey({ season, week, leagueId, platform }) {
  return [Number(season), Number(week), String(platform || '').toLowerCase(), String(leagueId || '')].join(':');
}

export function createPredictionRecord(input) {
  const snapshot = makePredictionSnapshot(input);
  snapshot.valuation_version = input?.valuation_version || null;
  snapshot.scoring_integrity = input?.scoring_integrity || null;
  return {
    key: snapshotKey(input),
    status: 'PENDING',
    created_at: snapshot.created_at,
    graded_at: null,
    snapshot,
    grade: null
  };
}

export function gradePredictionRecord(record, actuals = []) {
  if (!record?.snapshot) throw new Error('Prediction snapshot is required.');
  const grade = gradePredictionSnapshot(record.snapshot, actuals);
  return {
    ...record,
    status: grade.players_graded > 0 ? 'GRADED' : 'PENDING',
    graded_at: grade.players_graded > 0 ? grade.graded_at : null,
    grade
  };
}

export function summarizeGrades(records = []) {
  const graded = records.filter(r => r?.grade?.players_graded > 0);
  const sourceTotals = new Map();
  const positionTotals = new Map();
  let consensusAbs = 0, consensusN = 0;

  for (const r of graded) {
    for (const row of r.grade?.rows || []) {
      if (finite(row.absolute_error)) { consensusAbs += Number(row.absolute_error); consensusN++; }
      for (const source of ['espn','sleeper','ffanalytics']) {
        const projected = row.sources?.[source];
        if (!finite(projected) || !finite(row.actual_points)) continue;
        const prev = sourceTotals.get(source) || { n:0, abs:0 };
        prev.n++; prev.abs += Math.abs(Number(projected) - Number(row.actual_points));
        sourceTotals.set(source, prev);
      }
      const p = String(row.position || 'UNK');
      if (finite(row.absolute_error)) {
        const prev = positionTotals.get(p) || { n:0, abs:0 };
        prev.n++; prev.abs += Number(row.absolute_error);
        positionTotals.set(p, prev);
      }
    }
  }

  const pack = map => Object.fromEntries([...map.entries()].map(([k,v]) => [k, { n:v.n, mae:v.n ? Math.round((v.abs/v.n)*100)/100 : null }]));
  return {
    snapshots: records.length,
    graded_snapshots: graded.length,
    players_graded: consensusN,
    consensus_mae: consensusN ? Math.round((consensusAbs/consensusN)*100)/100 : null,
    source_accuracy: pack(sourceTotals),
    position_accuracy: pack(positionTotals),
    ready_for_weight_tuning: consensusN >= 100,
    note: consensusN >= 100 ? 'Enough baseline observations to begin reviewing source weights.' : 'Collect baseline data before changing source weights.'
  };
}
