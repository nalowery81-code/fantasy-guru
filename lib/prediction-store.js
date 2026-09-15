// Durable prediction snapshot storage for Fantasy Guru.
// Uses Supabase REST from the server only; no browser credentials.
// Snapshot rows are immutable after first capture; grading updates only grade fields.

function config() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function headers(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function request(path, options = {}) {
  const c = config();
  if (!c) throw new Error('Prediction store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.');
  const res = await fetch(`${c.url}/rest/v1/${path}`, { ...options, headers: headers(c.key, options.headers) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Prediction store ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function toRecord(row) {
  if (!row) return null;
  return {
    key: row.snapshot_key,
    status: row.status,
    created_at: row.created_at,
    graded_at: row.graded_at,
    snapshot: row.snapshot,
    grade: row.grade
  };
}

export function predictionStoreConfigured() {
  return Boolean(config());
}

export async function savePredictionRecord(record) {
  const s = record?.snapshot;
  if (!record?.key || !s) throw new Error('Prediction record and snapshot are required.');
  const row = {
    snapshot_key: record.key,
    season: Number(s.season),
    week: Number(s.week),
    platform: String(s.platform || '').toLowerCase(),
    league_id: String(s.league_id || ''),
    engine_version: s.engine_version || null,
    status: 'PENDING',
    snapshot: s,
    grade: null,
    players_graded: 0,
    consensus_mae: null,
    created_at: record.created_at || s.created_at || new Date().toISOString(),
    graded_at: null,
    updated_at: new Date().toISOString()
  };
  const rows = await request('prediction_snapshots?on_conflict=snapshot_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(row)
  });
  return toRecord(rows?.[0] || null);
}

export async function savePredictionGrade(record) {
  if (!record?.key || !record?.grade) throw new Error('Graded prediction record is required.');
  const body = {
    status: 'GRADED',
    grade: record.grade,
    players_graded: Number(record.grade?.players_graded || 0),
    consensus_mae: record.grade?.mae ?? record.grade?.consensus_mae ?? null,
    graded_at: record.graded_at || record.grade?.graded_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const rows = await request(`prediction_snapshots?snapshot_key=eq.${encodeURIComponent(record.key)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body)
  });
  return toRecord(rows?.[0] || null);
}

export async function getPredictionRecord(key) {
  const rows = await request(`prediction_snapshots?select=*&snapshot_key=eq.${encodeURIComponent(key)}&limit=1`, { method: 'GET' });
  return toRecord(rows?.[0] || null);
}

export async function listPredictionRecords({ season, week, status, limit = 100 } = {}) {
  const q = new URLSearchParams();
  q.set('select', '*');
  q.set('order', 'season.desc,week.desc,created_at.desc');
  q.set('limit', String(Math.min(Math.max(Number(limit) || 100, 1), 500)));
  if (season != null) q.set('season', `eq.${Number(season)}`);
  if (week != null) q.set('week', `eq.${Number(week)}`);
  if (status) q.set('status', `eq.${String(status).toUpperCase()}`);
  const rows = await request(`prediction_snapshots?${q.toString()}`, { method: 'GET' });
  return (rows || []).map(toRecord);
}
