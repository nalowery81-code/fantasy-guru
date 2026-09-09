const POS={1:'QB',2:'RB',3:'WR',4:'TE',5:'K',16:'DEF'};
const SLOT={0:'QB',2:'RB',4:'WR',6:'TE',7:'SUPER_FLEX',16:'DEF',17:'K',20:'BN',21:'IR',23:'FLEX'};
const starter=id=>![20,21].includes(Number(id));
const teamName=t=>[t.location,t.nickname].filter(Boolean).join(' ').trim()||t.name||t.abbrev||('Team '+t.id);
const record=t=>{const o=t.record?.overall||{};return{wins:o.wins||0,losses:o.losses||0,ties:o.ties||0}};
function player(e){const p=e?.playerPoolEntry?.player||e?.player||{};return{id:String(p.id||e?.playerId||''),name:p.fullName||p.name||('Player '+(p.id||'')),position:POS[p.defaultPositionId]||String(p.defaultPositionId||''),starter:starter(e?.lineupSlotId),lineup_slot:SLOT[e?.lineupSlotId]||String(e?.lineupSlotId??''),injury_status:p.injuryStatus||null}}
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
  const [mr,fr]=await Promise.all([
   fetch(base+'?view=mTeam&view=mRoster&view=mSettings&view=mMatchup&view=mStandings&view=mStatus',{headers}),
   fetch(base+'?view=kona_player_info&scoringPeriodId=1',{headers:{...headers,'x-fantasy-filter':filter}})
  ]);
  const mt=await mr.text(),ft=await fr.text();let data,free;
  try{data=JSON.parse(mt)}catch{return res.status(mr.status||500).json({error:'ESPN response was not JSON'})}
  try{free=JSON.parse(ft)}catch{free={players:[]}}
  if(!mr.ok)return res.status(mr.status).json({error:data?.messages?.[0]||'ESPN authentication failed'});
  const teams=(data.teams||[]).map(t=>({team:teamName(t),roster_id:t.id,record:record(t),waiver_position:t.waiverRank??null,players:(t.roster?.entries||[]).map(player)}));
  const me=teams.find(t=>Number(t.roster_id)===myTeamId);if(!me)return res.status(404).json({error:'ESPN team 15 not found'});
  const counts=data.settings?.rosterSettings?.lineupSlotCounts||{},positions=[];
  Object.entries(counts).forEach(([id,n])=>{for(let i=0;i<Number(n||0);i++)positions.push(SLOT[id]||('SLOT_'+id))});
  const available=(free.players||[]).slice(0,75).map(x=>{const p=x.player||x.playerPoolEntry?.player||{};return{id:String(p.id||''),name:p.fullName||p.name||'',position:POS[p.defaultPositionId]||'',injury_status:p.injuryStatus||null,percent_owned:p.ownership?.percentOwned??null,status:x.status||x.playerPoolEntry?.status||null}});
  res.json({platform:'ESPN',current_week:data.status?.currentScoringPeriod||1,league:{id:String(data.id||leagueId),name:data.settings?.name||'DGH Invitational 2026',season:String(data.seasonId||season),roster_positions:positions,scoring_settings:data.settings?.scoringSettings||{},scoring_summary:scoringSummary(data.settings),settings:data.settings||{}},my_team:{team:me.team,roster_id:me.roster_id,record:me.record,waiver_position:me.waiver_position,players:me.players},available_trending_players:available,league_teams:teams});
 }catch(e){res.status(500).json({error:e.message})}
}