import identityData from '../data/player_identity_map.json';

const cleanId=v=>{const s=String(v??'').trim();return s||null};
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const posNorm=p=>String(p||'').toUpperCase()==='DST'?'DEF':String(p||'').toUpperCase();

let cached=null;

export function getIdentityIndexes(){
  if(cached)return cached;
  const byCanonical=new Map(),bySleeper=new Map(),byEspn=new Map(),byGsis=new Map(),byNamePos=new Map();
  for(const row of Array.isArray(identityData?.players)?identityData.players:[]){
    const sleeperId=cleanId(row.sleeper_id),espnId=cleanId(row.espn_id),gsisId=cleanId(row.gsis_id);
    const canonical=gsisId||(sleeperId?`sleeper:${sleeperId}`:null)||(espnId?`espn:${espnId}`:null)||cleanId(row.canonical_player_id);
    const rec={...row,canonical_player_id:canonical,sleeper_id:sleeperId,espn_id:espnId,gsis_id:gsisId,position:posNorm(row.position)};
    if(rec.canonical_player_id)byCanonical.set(rec.canonical_player_id,rec);
    if(rec.sleeper_id)bySleeper.set(rec.sleeper_id,rec);
    if(rec.espn_id)byEspn.set(rec.espn_id,rec);
    if(rec.gsis_id)byGsis.set(rec.gsis_id,rec);
    if(rec.name)byNamePos.set(norm(rec.name)+'|'+rec.position,rec);
  }
  cached={byCanonical,bySleeper,byEspn,byGsis,byNamePos,player_count:Array.isArray(identityData?.players)?identityData.players.length:0,generated_at:identityData?.generated_at||null};
  return cached;
}

export function resolveIdentity(player={}){
  const idx=getIdentityIndexes();
  const position=posNorm(player.position||player.pos||'');
  const name=player.name||player.full_name||player.fullName||'';
  const sleeperId=cleanId(player.sleeper_id);
  const espnId=cleanId(player.espn_id);
  const gsisId=cleanId(player.gsis_id);
  const rawId=cleanId(player.id);
  let hit=null,method='unmapped';
  if(gsisId&&idx.byGsis.has(gsisId)){hit=idx.byGsis.get(gsisId);method='gsis_id'}
  else if(sleeperId&&idx.bySleeper.has(sleeperId)){hit=idx.bySleeper.get(sleeperId);method='sleeper_id'}
  else if(espnId&&idx.byEspn.has(espnId)){hit=idx.byEspn.get(espnId);method='espn_id'}
  else if(rawId&&idx.bySleeper.has(rawId)){hit=idx.bySleeper.get(rawId);method='sleeper_roster_id'}
  else if(rawId&&idx.byEspn.has(rawId)){hit=idx.byEspn.get(rawId);method='espn_roster_id'}
  else if(name&&position&&idx.byNamePos.has(norm(name)+'|'+position)){hit=idx.byNamePos.get(norm(name)+'|'+position);method='name_position_fallback'}
  if(!hit)return{canonical_player_id:gsisId||(sleeperId?`sleeper:${sleeperId}`:null)||(espnId?`espn:${espnId}`:null)||(rawId?`raw:${rawId}`:null),sleeper_id:sleeperId,espn_id:espnId,gsis_id:gsisId,id_match_method:method};
  return{canonical_player_id:hit.canonical_player_id,sleeper_id:hit.sleeper_id||sleeperId,espn_id:hit.espn_id||espnId,gsis_id:hit.gsis_id||gsisId,id_match_method:method,name:hit.name,position:hit.position,team:hit.team};
}

export function identityMapStatus(){
  const idx=getIdentityIndexes();
  return{ready:idx.player_count>0,player_count:idx.player_count,generated_at:idx.generated_at,source:identityData?.source||'Sleeper master player endpoint'};
}
