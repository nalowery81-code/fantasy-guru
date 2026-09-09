import projections from '../data/ffanalytics_projections.json' assert { type: 'json' };

const present=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const posNorm=p=>String(p||'').toUpperCase()==='DST'?'DEF':String(p||'').toUpperCase();

function normalizeRow(row={}){
  const gsisId=row.gsis_id?String(row.gsis_id):null;
  const sleeperId=row.sleeper_id?String(row.sleeper_id):null;
  const espnId=row.espn_id?String(row.espn_id):null;
  const name=row.name||row.player_name||null;
  const position=posNorm(row.position||row.pos||'');
  const rosPoints=present(row.ros_points)?Number(row.ros_points):present(row.projected_points)?Number(row.projected_points):null;
  const floor=present(row.floor)?Number(row.floor):null;
  const ceiling=present(row.ceiling)?Number(row.ceiling):null;
  const sourceCount=present(row.source_count)?Number(row.source_count):Array.isArray(row.sources)?row.sources.length:null;
  return {
    canonical_player_id: gsisId||sleeperId||(espnId?'espn:'+espnId:null)||(name?'name:'+norm(name)+'|'+position:null),
    gsis_id:gsisId,
    sleeper_id:sleeperId,
    espn_id:espnId,
    name,
    position,
    ros_points:rosPoints,
    floor,
    ceiling,
    source_count:sourceCount,
    sources:Array.isArray(row.sources)?row.sources:[],
  };
}

export default function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  const rows=Array.isArray(projections?.players)?projections.players.map(normalizeRow):[];
  const usable=rows.filter(r=>present(r.ros_points));
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  return res.json({
    schema_version:projections?.schema_version||'1.0',
    season:projections?.season||2026,
    generated_at:projections?.generated_at||null,
    source:'ffanalytics',
    projection_type:'rest_of_season',
    ready:usable.length>0,
    player_count:rows.length,
    usable_projection_count:usable.length,
    players:usable
  });
}
