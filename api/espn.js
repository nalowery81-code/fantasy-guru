const POS={1:'QB',2:'RB',3:'WR',4:'TE',5:'K',16:'DEF'};
const SLOT={0:'QB',2:'RB',4:'WR',6:'TE',7:'SUPER_FLEX',16:'DEF',17:'K',20:'BN',21:'IR',23:'FLEX'};
const starter=id=>![20,21].includes(Number(id));
const teamName=t=>[t.location,t.nickname].filter(Boolean).join(' ').trim()||t.name||t.abbrev||('Team '+t.id);
const record=t=>{const o=t.record?.overall||{};return{wins:o.wins||0,losses:o.losses||0,ties:o.ties||0}};
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function weeklyProjectedPoints(p,week){
 const stats=Array.isArray(p?.stats)?p.stats:[];
 const exact=stats.find(s=>Number(s?.statSourceId)===1&&Number(s?.statSplitTypeId)===1&&Number(s?.scoringPeriodId)===Number(week)&&finite(s?.appliedTotal));
 if(exact)return Number(exact.appliedTotal);
 const fallback=stats.find(s=>Number(s?.statSourceId)===1&&Number(s?.scoringPeriodId)===Number(week)&&finite(s?.appliedTotal));
 return fallback?Number(fallback.appliedTotal):null;
}
function seasonProjection(p,season){
 const stats=Array.isArray(p?.stats)?p.stats:[];
 const projected=stats.find(s=>Number(s?.seasonId)===Number(season)&&Number(s?.statSourceId)===1&&Number(s?.statSplitTypeId)===0&&finite(s?.appliedTotal));
 const actual=stats.find(s=>Number(s?.seasonId)===Number(season)&&Number(s?.statSourceId)===0&&Number(s?.statSplitTypeId)===0&&finite(s?.appliedTotal));
 const projectedTotal=projected?Number(projected.appliedTotal):null;
 const actualTotal=actual?Number(actual.appliedTotal):0;
 const ros=projectedTotal===null?null:Math.max(0,projectedTotal-actualTotal);
 return{projected_total:projectedTotal,actual_total:actualTotal,ros_points:ros};
}
function sleeperIdIndexes(players={}){
 const byEspn=new Map(),byNamePos=new Map();
 for(const [sleeperId,p] of Object.entries(players||{})){
  if(p?.espn_id!==undefined&&p?.espn_id!==null&&String(p.espn_id)!=='')byEspn.set(String(p.espn_id),{sleeper_id:String(sleeperId),gsis_id:p.gsis_id?String(p.gsis_id):null});
  const name=p?.full_name||[p?.first_name,p?.last_name].filter(Boolean).join(' '),pos=String(p?.position||'').toUpperCase()==='DST'?'DEF':String(p?.position||'').toUpperCase();
  if(name)byNamePos.set(norm(name)+'|'+pos,{sleeper_id:String(sleeperId),gsis_id:p.gsis_id?String(p.gsis_id):null});
 }
 return{byEspn,byNamePos};
}
function idsFor(p,idx){
 const espnId=String(p?.id||'');
 const pos=POS[p?.defaultPositionId]||String(p?.defaultPositionId||'');
 const name=p?.fullName||p?.name||'';
 const hit=idx?.byEspn?.get(espnId)||idx?.byNamePos?.get(norm(name)+'|'+pos)||null;
 return{espn_id:espnId||null,sleeper_id:hit?.sleeper_id||null,gsis_id:hit?.gsis_id||null};
}
function player(e,week,season,idIdx){
 const p=e?.playerPoolEntry?.player||e?.player||{},sp=seasonProjection(p,season),ids=idsFor(p,idIdx);
 return{
  id:String(p.id||e?.playerId||''),
  espn_id:ids.espn_id,
  sleeper_id:ids.sleeper_id,
  gsis_id:ids.gsis_id,
  name:p.fullName||p.name||('Player '+(p.id||'')),
  position:POS[p.defaultPositionId]||String(p.defaultPositionId||''),
  starter:starter(e?.lineupSlotId),
  lineup_slot:SLOT[e?.lineupSlotId]||String(e?.lineupSlotId??''),
  injury_status:p.injuryStatus||null,
  espn_weekly_points:weeklyProjectedPoints(p,week),
  espn_projected_season_points:sp.projected_total,
  espn_actual_season_points:sp.actual_total,
  espn_ros_points:sp.ros_points
 };
}
function scoringSummary(settings){
 const out=[],items=settings?.scoringSettings?.scoringItems||[];
 const map=new Map(items.map(x=>[x.statId,x.points]));
 const rec=map.get(53); if(rec!=null) out.push(rec===1?'Full PPR':rec===0.5?'Half PPR':rec+' PPR');
 const passTD=map.get(4); if(passTD!=null) out.push(passTD+'-pt passing TD');
 return out;
}
export default async function handler(req,res){
 const leagueId='1673474732',season='2026',myTeamId=15;
 if(!process.env.ESPN_S2||!process.env.ESPN_SWID)return res.status(500).json({error:'ESPN credentials are not configured.'});
 const base='https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/'+season+'/segments/0/leagues/'+leagueId;
 const headers={'Cookie':'espn_s2='+process.env.ESPN_S2+'; SWID='+process.env.ESPN_SWID,'Accept':'application/json','User-Agent':'Mozilla/5.0'};
 try{
  const filter=JSON.stringify({players:{filterStatus:{value:['FREEAGENT','WAIVERS']},limit:75,sortPercOwned:{sortPriority:1,sortAsc:false}}});
  const [mr,fr,sr]=await Promise.all([
   fetch(base+'?view=mTeam&view=mRoster&view=mSettings&view=mMatchup&view=mStandings&view=mStatus',{headers}),
   fetch(base+'?view=kona_player_info&scoringPeriodId=1',{headers:{...headers,'x-fantasy-filter':filter}}),
   fetch('https://api.sleeper.app/v1/players/nfl',{headers:{Accept:'application/json','User-Agent':'FantasyGuru/1.0'}}).catch(()=>null)
  ]);
  const mt=await mr.text(),ft=await fr.text();let data,free,sleeperPlayers={};
  try{data=JSON.parse(mt)}catch{return res.status(mr.status||500).json({error:'ESPN response was not JSON'})}
  try{free=JSON.parse(ft)}catch{free={players:[]}}
  if(sr?.ok){try{sleeperPlayers=await sr.json()}catch{sleeperPlayers={}}}
  if(!mr.ok)return res.status(mr.status).json({error:data?.messages?.[0]||'ESPN authentication failed'});
  const idIdx=sleeperIdIndexes(sleeperPlayers),currentWeek=data.status?.currentScoringPeriod||1,seasonId=Number(data.seasonId||season);
  const teams=(data.teams||[]).map(t=>({team:teamName(t),roster_id:t.id,record:record(t),waiver_position:t.waiverRank??null,players:(t.roster?.entries||[]).map(e=>player(e,currentWeek,seasonId,idIdx))}));
  const me=teams.find(t=>Number(t.roster_id)===myTeamId);if(!me)return res.status(404).json({error:'ESPN team 15 not found'});
  const counts=data.settings?.rosterSettings?.lineupSlotCounts||{},positions=[];
  Object.entries(counts).forEach(([id,n])=>{for(let i=0;i<Number(n||0);i++)positions.push(SLOT[id]||('SLOT_'+id))});
  const available=(free.players||[]).slice(0,75).map(x=>{const p=x.player||x.playerPoolEntry?.player||{},sp=seasonProjection(p,seasonId),ids=idsFor(p,idIdx);return{id:String(p.id||''),espn_id:ids.espn_id,sleeper_id:ids.sleeper_id,gsis_id:ids.gsis_id,name:p.fullName||p.name||'',position:POS[p.defaultPositionId]||'',injury_status:p.injuryStatus||null,percent_owned:p.ownership?.percentOwned??null,status:x.status||x.playerPoolEntry?.status||null,espn_weekly_points:weeklyProjectedPoints(p,currentWeek),espn_projected_season_points:sp.projected_total,espn_actual_season_points:sp.actual_total,espn_ros_points:sp.ros_points}});
  res.json({platform:'ESPN',current_week:currentWeek,league:{id:String(data.id||leagueId),name:data.settings?.name||'DGH Invitational 2026',season:String(seasonId),roster_positions:positions,scoring_settings:data.settings?.scoringSettings||{},scoring_summary:scoringSummary(data.settings),settings:data.settings||{}},my_team:{team:me.team,roster_id:me.roster_id,record:me.record,waiver_position:me.waiver_position,players:me.players},available_trending_players:available,league_teams:teams,id_mapping:{source:'Sleeper players dictionary',mapped_players:teams.reduce((n,t)=>n+t.players.filter(p=>p.sleeper_id||p.gsis_id).length,0),total_players:teams.reduce((n,t)=>n+t.players.length,0)},league_teams:teams});
 }catch(e){res.status(500).json({error:e.message})}
}
