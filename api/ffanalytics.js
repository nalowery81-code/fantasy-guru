import { readFileSync } from 'node:fs';
const projections=JSON.parse(readFileSync(new URL('../data/ffanalytics_projections.json',import.meta.url),'utf8'));

const present=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const posNorm=p=>String(p||'').toUpperCase()==='DST'?'DEF':String(p||'').toUpperCase();

function cleanStats(stats={}){
  const out={};
  for(const [k,v] of Object.entries(stats||{})) if(present(v)) out[k]=Number(v);
  return out;
}

function normalizeRow(row={}){
  const gsisId=row.gsis_id?String(row.gsis_id):null;
  const sleeperId=row.sleeper_id?String(row.sleeper_id):null;
  const espnId=row.espn_id?String(row.espn_id):null;
  const name=row.name||row.player_name||null;
  const position=posNorm(row.position||row.pos||'');
  const legacyRos=present(row.ros_points)?Number(row.ros_points):present(row.projected_points)?Number(row.projected_points):null;
  const defaultScoring=present(row.default_scoring_points)?Number(row.default_scoring_points):legacyRos;
  const consensusStats=cleanStats(row.consensus_stats||{});
  const sourceCount=present(row.source_count)?Number(row.source_count):Array.isArray(row.sources)?row.sources.length:null;
  return {
    canonical_player_id:gsisId||sleeperId||(espnId?'espn:'+espnId:null)||(name?'name:'+norm(name)+'|'+position:null),
    gsis_id:gsisId,
    sleeper_id:sleeperId,
    espn_id:espnId,
    name,
    position,
    consensus_stats:consensusStats,
    stat_source_counts:row.stat_source_counts||{},
    default_scoring_points:defaultScoring,
    source_count:sourceCount,
    sources:Array.isArray(row.sources)?row.sources:[],
  };
}

export default function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  const rows=Array.isArray(projections?.players)?projections.players.map(normalizeRow):[];
  const rescorable=rows.filter(r=>Object.keys(r.consensus_stats).length>0);
  const legacy=rows.filter(r=>present(r.default_scoring_points));
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  return res.json({
    schema_version:projections?.schema_version||'1.0',
    season:projections?.season||2026,
    generated_at:projections?.generated_at||null,
    source:'ffanalytics',
    projection_type:projections?.projection_type||'unknown',
    scoring_basis:projections?.scoring_basis||null,
    averaging_rule:projections?.averaging_rule||null,
    ready:rescorable.length>0,
    player_count:rows.length,
    rescorable_player_count:rescorable.length,
    legacy_scored_player_count:legacy.length,
    working_sources:projections?.working_sources||[],
    failed_sources:projections?.failed_sources||[],
    players:rescorable.length?rescorable:[]
  });
}
