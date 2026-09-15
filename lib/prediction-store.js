// Durable prediction snapshot storage for Fantasy Guru.
// Uses Supabase REST from the server only; no browser credentials.

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
    status: record.status || 'PENDING',
    snapshot: s,
    grade: record.grade || null,
    players_graded: Number(record.grade?.players_graded || 0),
    consensus_mae: record.grade?.consensus_mae ?? null,
    created_at: record.created_at || s.created_at || new Date().toISOString(),
    graded_at: record.graded_at || null,
    updated_at: new Date().toISOString()
  };
  return request('prediction_snapshots?on_conflict=snapshot_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row)
  });
}

export async function getPredictionRecord(key) {
  const rows = await request(`prediction_snapshots?snapshot_key=eq.${encodeURIComponent(key)}&limit=1`, { method: 'GET' });
  return rows?.[0] || null;
}

export async function listPredictionRecords({ season, week, status, limit = 100 } = {}) {
  const q = new URLSearchParams();
  q.set('select', '*');
  q.set('order', 'season.desc,week.desc,created_at.desc');
  q.set('limit', String(Math.min(Math.max(Number(limit) || 100, 1), 500)));
  if (season != null) q.set('season', `eq.${Number(season)}`);
  if (week != null) q.set('week', `eq.${Number(week)}`);
  if (status) q.set('status', `eq.${String(status).toUpperCase()}`);
  return request(`prediction_snapshots?${q.toString()}`, { method: 'GET' });
}
