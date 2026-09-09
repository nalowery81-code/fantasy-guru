import { readFileSync } from 'node:fs';
import { scoreConsensusStats } from './league-scoring.js';
const projections=JSON.parse(readFileSync(new URL('../data/ffanalytics_projections.json',import.meta.url),'utf8'));

const present=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const posNorm=p=>String(p||'').toUpperCase()==='DST'?'DEF':String(p||'').toUpperCase();

function normalizeRow(row={}){
  const gsisId=row.gsis_id?String(row.gsis_id):null;
  const sleeperId=row.sleeper_id?String(row.sleeper_id):null;
  const espnId=row.espn_id?String(row.espn_id):null;
  const name=row.name||row.player_name||null;
  const position=posNorm(row.position||row.pos||'');
  return {
    canonical_player_id:gsisId||sleeperId||(espnId?'espn:'+espnId:null)||(name?'name:'+norm(name)+'|'+position:null),
    gsis_id:gsisId,sleeper_id:sleeperId,espn_id:espnId,name,position,
    consensus_stats:row.consensus_stats&&typeof row.consensus_stats==='object'?row.consensus_stats:{},
    stat_source_counts:row.stat_source_counts&&typeof row.stat_source_counts==='object'?row.stat_source_counts:{},
    source_count:present(row.source_count)?Number(row.source_count):Array.isArray(row.sources)?row.sources.length:null,
    sources:Array.isArray(row.sources)?row.sources:[]
  };
}

export default function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const {context}=req.body||{};
  if(!context?.league)return res.status(400).json({error:'League context missing'});
  const rows=Array.isArray(projections?.players)?projections.players.map(normalizeRow):[];
  const scored=rows.map(row=>{
    const score=scoreConsensusStats(context,row.consensus_stats,row.position);
    return {...row,projected_season_points:score.points,scoring_mode:score.scoring_mode,used_categories:score.used_categories,unsupported:score.unsupported};
  }).filter(r=>present(r.projected_season_points));
  const offense=scored.filter(r=>r.position!=='DEF'),defense=scored.filter(r=>r.position==='DEF');
  res.setHeader('Cache-Control','private, max-age=0, s-maxage=300');
  return res.json({
    schema_version:projections?.schema_version||'2.0',season:projections?.season||2026,generated_at:projections?.generated_at||null,
    source:'ffanalytics',ready:scored.length>0,platform:context.platform||null,
    scoring_basis:'ffanalytics equal-consensus projected stats scored with the selected league linear scoring rules',
    player_count:rows.length,scored_player_count:scored.length,offense_scored_count:offense.length,defense_scored_count:defense.length,
    note:'Nonlinear defense points/yard-allowed bracket scoring is excluded rather than estimated.',players:scored
  });
}
