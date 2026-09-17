import { scoreConsensusStats } from '../lib/league-scoring.js';

const PLAYER_TTL=6*60*60*1000;
const STATS_TTL=15*60*1000;
const SCHEDULE_TTL=60*60*1000;
const NEWS_TTL=10*60*1000;
let playerCache={ts:0,data:null},newsCache={ts:0,data:[]};
const statsCache=new Map();
const scheduleCache=new Map();

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const n=v=>finite(v)?Number(v):0;
const upper=v=>String(v||'').toUpperCase();
const teamCode=t=>({WAS:'wsh',WSH:'wsh',JAC:'jax',JAX:'jax'}[upper(t)]||String(t||'').toLowerCase());

async function json(url){
  const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'FantasyGuru/1.0'}});
  if(!r.ok)throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function sleeperPlayers(){
  if(playerCache.data&&Date.now()-playerCache.ts<PLAYER_TTL)return playerCache.data;
  const data=await json('https://api.sleeper.app/v1/players/nfl');
  playerCache={ts:Date.now(),data:data&&typeof data==='object'?data:{}};
  return playerCache.data;
}

async function weeklyStats(season,week){
  const key=`${season}:${week}`,cached=statsCache.get(key);
  if(cached&&Date.now()-cached.ts<STATS_TTL)return cached.data;
  try{
    const data=await json(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`);
    statsCache.set(key,{ts:Date.now(),data});return data;
  }catch{
    const data={};statsCache.set(key,{ts:Date.now(),data});return data;
  }
}

async function teamSchedule(team,season){
  const key=`${team}:${season}`,cached=scheduleCache.get(key);
  if(cached&&Date.now()-cached.ts<SCHEDULE_TTL)return cached.data;
  try{
    const data=await json(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${encodeURIComponent(teamCode(team))}/schedule?season=${encodeURIComponent(season)}`);
    scheduleCache.set(key,{ts:Date.now(),data});return data;
  }catch{
    const data={events:[]};scheduleCache.set(key,{ts:Date.now(),data});return data;
  }
}

async function nflNews(){
  if(newsCache.data.length&&Date.now()-newsCache.ts<NEWS_TTL)return newsCache.data;
  try{
    const data=await json('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=75');
    const rows=Array.isArray(data?.articles)?data.articles:[];newsCache={ts:Date.now(),data:rows};return rows;
  }catch{return newsCache.data||[]}
}

function playerNews(rows=[],name=''){
  const full=String(name||'').trim().toLowerCase();
  if(!full)return[];
  return rows.filter(x=>`${x?.headline||''} ${x?.description||''} ${x?.story||''}`.toLowerCase().includes(full)).slice(0,4).map(x=>({headline:x?.headline||'NFL update',description:x?.description||'',published:x?.published||x?.lastModified||null,link:x?.links?.web?.href||null}));
}

function findStatRow(payload,sleeperId){
  if(!payload||!sleeperId)return null;
  if(Array.isArray(payload))return payload.find(x=>String(x?.player_id||x?.playerId||x?.id||'')===String(sleeperId))||null;
  if(payload[sleeperId])return payload[sleeperId];
  for(const [k,v] of Object.entries(payload))if(String(k)===String(sleeperId)||String(v?.player_id||v?.playerId||'')===String(sleeperId))return v;
  return null;
}

function normalizedSleeperStats(s={}){
  return {
    pass_yds:n(s.pass_yd),pass_tds:n(s.pass_td),pass_2pt:n(s.pass_2pt),pass_int:n(s.pass_int),
    rush_yds:n(s.rush_yd),rush_tds:n(s.rush_td),rush_2pt:n(s.rush_2pt),
    rec_yds:n(s.rec_yd),rec_tds:n(s.rec_td),rec_2pt:n(s.rec_2pt),rec:n(s.rec),
    fum_lost:n(s.fum_lost),fgm_50p:n(s.fgm_50p),fgm_40_49:n(s.fgm_40_49),
    fgm_0_19:n(s.fgm_0_19),fgm_20_29:n(s.fgm_20_29),fgm_30_39:n(s.fgm_30_39),
    fgmiss:n(s.fgmiss),xpm:n(s.xpm),xpmiss:n(s.xpmiss),
    dst_int:n(s.int),dst_fum_rec:n(s.fum_rec),dst_blk_kick:n(s.blk_kick),dst_safety:n(s.safe),dst_sack:n(s.sack)
  };
}

function statLine(s={},position=''){
  const p=upper(position),parts=[];
  if(p==='QB'){
    if(finite(s.pass_yd))parts.push(`${n(s.pass_yd)} pass yd`);
    if(finite(s.pass_td))parts.push(`${n(s.pass_td)} pass TD`);
    if(finite(s.pass_int)&&n(s.pass_int))parts.push(`${n(s.pass_int)} INT`);
    if(n(s.rush_yd)||n(s.rush_td))parts.push(`${n(s.rush_yd)} rush yd${n(s.rush_td)?`, ${n(s.rush_td)} rush TD`:''}`);
  }else if(['RB','WR','TE'].includes(p)){
    if(finite(s.rush_yd)&&(n(s.rush_yd)||p==='RB'))parts.push(`${n(s.rush_yd)} rush yd${n(s.rush_td)?`, ${n(s.rush_td)} rush TD`:''}`);
    if(finite(s.rec))parts.push(`${n(s.rec)} rec`);
    if(finite(s.rec_yd))parts.push(`${n(s.rec_yd)} rec yd${n(s.rec_td)?`, ${n(s.rec_td)} rec TD`:''}`);
  }else if(p==='K'){
    if(finite(s.fgm))parts.push(`${n(s.fgm)} FG`);if(finite(s.xpm))parts.push(`${n(s.xpm)} XP`);
  }else if(p==='DEF'){
    if(finite(s.sack))parts.push(`${n(s.sack)} sack`);if(finite(s.int))parts.push(`${n(s.int)} INT`);if(finite(s.fum_rec))parts.push(`${n(s.fum_rec)} FR`);
  }
  return parts.filter(Boolean).join(' · ')||'—';
}

function normalizeSchedule(payload,team){
  const own=upper(team),out=[];
  for(const e of payload?.events||[]){
    const comp=e?.competitions?.[0],cs=comp?.competitors||[];
    const mine=cs.find(x=>upper(x?.team?.abbreviation)===own),opp=cs.find(x=>x!==mine);
    const week=Number(e?.week?.number||e?.week||0)||null;
    if(!week)continue;
    const completed=Boolean(e?.status?.type?.completed),state=e?.status?.type?.state||null;
    const mineScore=finite(mine?.score)?Number(mine.score):null,oppScore=finite(opp?.score)?Number(opp.score):null;
    let result=null;if(completed&&mineScore!==null&&oppScore!==null)result=`${mineScore>oppScore?'W':mineScore<oppScore?'L':'T'} ${mineScore}-${oppScore}`;
    out.push({week,date:e?.date||null,opponent:opp?.team?.abbreviation||null,home_away:mine?.homeAway||null,status:completed?'FINAL':state==='in'?'LIVE':'UPCOMING',result});
  }
  return out.sort((a,b)=>a.week-b.week);
}

function bioFromSleeper(p={},fallback={}){
  const fullName=p.full_name||((p.first_name||p.last_name)?`${p.first_name||''} ${p.last_name||''}`.trim():null)||fallback.name||null;
  return {
    name:fullName,team:p.team||fallback.team||null,position:p.position||fallback.position||null,number:p.number??null,
    age:p.age??null,height:p.height??null,weight:p.weight??null,experience:p.years_exp??p.yearsExperience??null,
    college:p.college??null,birth_date:p.birth_date??null,status:p.status??fallback.status??null,injury_status:p.injury_status??fallback.injury_status??null,
    sleeper_id:p.player_id||fallback.sleeper_id||null,espn_id:p.espn_id||fallback.espn_id||null,gsis_id:p.gsis_id||fallback.gsis_id||null
  };
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{
    const {player={},context={}}=req.body||{};
    const season=Number(context?.season||context?.league?.season||new Date().getFullYear());
    const currentWeek=Math.max(1,Math.min(18,Number(context?.current_week||context?.week||1)));
    const sleeperId=String(player?.sleeper_id||'');
    const master=await sleeperPlayers();
    let meta=sleeperId?master?.[sleeperId]:null;
    if(!meta&&player?.espn_id)meta=Object.values(master).find(x=>String(x?.espn_id||'')===String(player.espn_id))||null;
    if(!meta&&player?.name){const q=String(player.name).toLowerCase();meta=Object.values(master).find(x=>String(x?.full_name||'').toLowerCase()===q&&(!player.position||upper(x?.position)===upper(player.position)))||null}
    const bio=bioFromSleeper(meta||{},player),sid=String(bio.sleeper_id||sleeperId||'');
    const [scheduleRaw,newsRows]=await Promise.all([bio.team?teamSchedule(bio.team,season):Promise.resolve({events:[]}),nflNews()]);
    const schedule=normalizeSchedule(scheduleRaw,bio.team),news=playerNews(newsRows,bio.name||player.name);
    const history=[];
    for(let week=1;week<=currentWeek;week++){
      const payload=await weeklyStats(season,week),row=findStatRow(payload,sid);
      if(!row)continue;
      const scored=scoreConsensusStats(context,normalizedSleeperStats(row),bio.position||player.position||'');
      history.push({week,fantasy_points:finite(scored.points)?Math.round(Number(scored.points)*100)/100:null,stat_line:statLine(row,bio.position||player.position||''),raw_stats:row,scoring_mode:scored.scoring_mode,unsupported:scored.unsupported||[]});
    }
    const byWeek=new Map(history.map(x=>[x.week,x]));
    const seasonRows=schedule.map(s=>({...s,...(byWeek.get(s.week)||{}),guru_projection:s.week===currentWeek&&finite(player.weekly_points)?Number(player.weekly_points):null}));
    for(const h of history)if(!seasonRows.some(x=>x.week===h.week))seasonRows.push({...h,opponent:null,status:'FINAL',result:null,guru_projection:h.week===currentWeek&&finite(player.weekly_points)?Number(player.weekly_points):null});
    seasonRows.sort((a,b)=>a.week-b.week);
    return res.status(200).json({available:true,season,current_week:currentWeek,bio,schedule:seasonRows,history,news,source:{bio:'Sleeper master player feed',stats:'Sleeper weekly NFL stats',schedule:'ESPN NFL team schedule',news:'ESPN NFL news filtered to exact player name',fantasy_points:'League-specific Guru scoring rules'}});
  }catch(e){return res.status(200).json({available:false,error:e?.message||'Player profile enrichment failed',bio:null,schedule:[],history:[],news:[]})}
}
