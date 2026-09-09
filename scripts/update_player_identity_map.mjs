const MASTER_URL='https://api.sleeper.app/v1/players/nfl';
const OUT='data/player_identity_map.json';
const POSITIONS=new Set(['QB','RB','WR','TE','K','DEF','DST']);

const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const posNorm=p=>String(p||'').toUpperCase()==='DST'?'DEF':String(p||'').toUpperCase();

const r=await fetch(MASTER_URL,{headers:{Accept:'application/json','User-Agent':'FantasyGuru/1.0'}});
if(!r.ok)throw new Error(`Sleeper master player endpoint failed: ${r.status}`);
const raw=await r.json();

const players=[];
for(const [sid,p] of Object.entries(raw||{})){
  const position=posNorm(p?.position);
  if(!POSITIONS.has(position))continue;
  const name=p?.full_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ').trim();
  if(!name)continue;
  const sleeperId=String(p?.player_id||sid||'')||null;
  const espnId=p?.espn_id!=null&&String(p.espn_id)!==''?String(p.espn_id):null;
  const gsisId=p?.gsis_id?String(p.gsis_id):null;
  const canonical=gsisId||(sleeperId?`sleeper:${sleeperId}`:null)||(espnId?`espn:${espnId}`:null);
  if(!canonical)continue;
  players.push({
    canonical_player_id:canonical,
    name,
    normalized_name:norm(name),
    position,
    team:p?.team||null,
    sleeper_id:sleeperId,
    espn_id:espnId,
    gsis_id:gsisId,
    status:p?.status||null,
    active:p?.active??null
  });
}
players.sort((a,b)=>a.name.localeCompare(b.name)||a.position.localeCompare(b.position));
const out={
  schema_version:'1.0',
  generated_at:new Date().toISOString(),
  source:'Sleeper master player endpoint',
  player_count:players.length,
  canonical_id_rule:'GSIS when available, otherwise Sleeper ID, otherwise ESPN ID',
  players
};
const fs=await import('node:fs');
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(`Wrote ${players.length} canonical player identity rows to ${OUT}`);
