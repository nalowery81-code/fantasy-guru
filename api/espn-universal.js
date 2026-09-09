import { scoreConsensusStats } from './league-scoring.js';

const POS={1:'QB',2:'RB',3:'WR',4:'TE',5:'K',16:'DEF'};
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const posNorm=p=>String(p||'').toUpperCase()==='DST'?'DEF':String(p||'').toUpperCase();

// ESPN raw fantasy stat ids -> Fantasy Guru normalized stat names.
const ESPN_TO_NORMALIZED={
  3:'pass_yds',4:'pass_tds',19:'pass_2pt',20:'pass_int',
  24:'rush_yds',25:'rush_tds',26:'rush_2pt',
  42:'rec_yds',43:'rec_tds',44:'rec_2pt',53:'rec',
  72:'fum_lost',
  74:'fgm_50p',77:'fgm_40_49',80:'fgm_under_40',85:'fgmiss',86:'xpm',88:'xpmiss',
  95:'dst_int',96:'dst_fum_rec',97:'dst_blk_kick',98:'dst_safety',99:'dst_sack'
};

function normalizedEspnStats(raw={}){
  const out={};
  for(const [id,val] of Object.entries(raw||{})){
    const key=ESPN_TO_NORMALIZED[Number(id)];
    if(key&&finite(val))out[key]=Number(val);
  }
  return out;
}
function findStat(p,{season,week,source,split}){
  const stats=Array.isArray(p?.stats)?p.stats:[];
  return stats.find(s=>Number(s?.seasonId)===Number(season)&&Number(s?.statSourceId)===Number(source)&&Number(s?.statSplitTypeId)===Number(split)&&(split!==1||Number(s?.scoringPeriodId)===Number(week))&&s?.stats&&typeof s.stats==='object')||null;
}
function scoreRow(context,row,position){
  if(!row)return null;
  const scored=scoreConsensusStats(context,normalizedEspnStats(row.stats||{}),position);
  return finite(scored?.points)?Number(scored.points):null;
}
async function sleeperPlayers(){
  try{
    const r=await fetch('https://api.sleeper.app/v1/players/nfl',{headers:{Accept:'application/json','User-Agent':'FantasyGuru/1.0'}});
    return r.ok?await r.json():{};
  }catch{return {}}
}
function sleeperIndexes(players={}){
  const byEspn=new Map(),byNamePos=new Map();
  for(const [sid,p] of Object.entries(players||{})){
    const espn=p?.espn_id!=null?String(p.espn_id):null;
    const name=p?.full_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ');
    const position=posNorm(p?.position);
    const rec={sleeper_id:String(sid),gsis_id:p?.gsis_id?String(p.gsis_id):null};
    if(espn)byEspn.set(espn,rec);
    if(name)byNamePos.set(norm(name)+'|'+position,rec);
  }
  return{byEspn,byNamePos};
}

export async function getUniversalEspnProjections(context){
  if(!context?.league?.season)throw new Error('League context missing');
  if(!process.env.ESPN_S2||!process.env.ESPN_SWID)throw new Error('ESPN credentials are not configured.');
  const season=String(context.league.season||'2026'),week=Number(context.current_week||1);
  // The authenticated ESPN league is only the transport for ESPN's player pool.
  // Raw projected/actual stats are rescored with the TARGET league's settings,
  // so the values are valid for either an ESPN-hosted or Sleeper-hosted league.
  const sourceLeagueId='1673474732';
  const base='https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/'+season+'/segments/0/leagues/'+sourceLeagueId;
  const filter=JSON.stringify({players:{limit:3000}});
  const headers={'Cookie':'espn_s2='+process.env.ESPN_S2+'; SWID='+process.env.ESPN_SWID,'Accept':'application/json','User-Agent':'Mozilla/5.0','x-fantasy-filter':filter};
  const [er,slPlayers]=await Promise.all([fetch(base+'?view=kona_player_info&scoringPeriodId='+week,{headers}),sleeperPlayers()]);
  const txt=await er.text();let data;try{data=JSON.parse(txt)}catch{throw new Error('ESPN player-pool response was not JSON')}
  if(!er.ok)throw new Error(data?.messages?.[0]||'ESPN projection feed failed');
  const slIdx=sleeperIndexes(slPlayers),players=[];
  for(const entry of data.players||[]){
    const p=entry?.playerPoolEntry?.player||entry?.player||{};
    const espnId=String(p.id||entry.id||'');
    const name=p.fullName||p.name||'';
    const position=POS[p.defaultPositionId]||posNorm(p.position||'');
    if(!espnId||!name||!position)continue;
    const ids=slIdx.byEspn.get(espnId)||slIdx.byNamePos.get(norm(name)+'|'+position)||{};
    const wk=findStat(p,{season,week,source:1,split:1});
    const proj=findStat(p,{season,week,source:1,split:0});
    const actual=findStat(p,{season,week,source:0,split:0});
    const weekly=scoreRow(context,wk,position),projectedSeason=scoreRow(context,proj,position),actualSeason=scoreRow(context,actual,position);
    const ros=finite(projectedSeason)&&finite(actualSeason)?Math.max(0,projectedSeason-actualSeason):null;
    players.push({name,position,espn_id:espnId,sleeper_id:ids.sleeper_id||null,gsis_id:ids.gsis_id||null,espn_weekly_points:weekly,espn_projected_season_points:projectedSeason,espn_actual_season_points:actualSeason,espn_ros_points:ros});
  }
  return{source:'ESPN raw projected stats rescored to target league rules',season,week,player_count:players.length,players};
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{return res.json(await getUniversalEspnProjections(req.body?.context))}
  catch(e){return res.status(500).json({error:e.message})}
}
