const FP_BASE='https://api.fantasypros.com/public/v2/json';
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const sum=a=>a.reduce((x,y)=>x+y,0);
const present=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const meanAvailable=(...v)=>{const a=v.filter(present).map(Number);return a.length?avg(a):null};
const pct=(n,d)=>d?Math.round(n/d*100):0;
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const posNorm=p=>String(p||'').toUpperCase()==='DST'?'DEF':String(p||'').toUpperCase();

function slotCounts(slots=[]){const c={};for(const s of slots)c[s]=(c[s]||0)+1;return c}
function eligible(pos,slot){if(slot===pos)return true;if(slot==='FLEX')return ['RB','WR','TE'].includes(pos);if(slot==='SUPER_FLEX')return ['QB','RB','WR','TE'].includes(pos);return false}
function startSlots(slots=[]){return slots.filter(s=>!['BN','IR'].includes(s))}
function optimize(players,slots,field){
 const used=new Set(),picks=[];
 const order=[...startSlots(slots)].sort((a,b)=>{const r={QB:1,SUPER_FLEX:2,TE:3,RB:4,WR:5,FLEX:6,DEF:7,K:8};return(r[a]||9)-(r[b]||9)});
 for(const slot of order){
  let best=null,bi=-1;
  players.forEach((p,i)=>{if(used.has(i)||!eligible(p.position,slot)||!present(p[field]))return;const v=Number(p[field]);if(!best||v>Number(best[field])){best=p;bi=i}});
  if(best){used.add(bi);picks.push({slot,player:best,value:Number(best[field])})}
 }
 return picks
}
function requiredPositionScore(players,pos,field,count){
 const vals=players.filter(p=>p.position===pos&&present(p[field])).map(p=>Number(p[field])).sort((a,b)=>b-a);
 const n=Math.max(1,count||1);if(vals.length<n)return null;return avg(vals.slice(0,n));
}
function rankMap(rows,key){const sorted=[...rows].filter(r=>present(r[key])).sort((a,b)=>b[key]-a[key]),m={};sorted.forEach((r,i)=>m[r.team]=i+1);return m}
function qualityLevel(n){return n>=95?'HIGH':n>=85?'GOOD':n>=70?'PRELIMINARY':'INSUFFICIENT'}
function scoringMode(context){const s=(context.league?.scoring_summary||[]).join(' ').toUpperCase();if(s.includes('HALF'))return'HALF';if(s.includes('PPR'))return'PPR';return'STD'}
function fpPoints(p,scoring){const st=p?.stats||{};if(scoring==='PPR'&&present(st.points_ppr))return Number(st.points_ppr);if(scoring==='HALF'&&present(st.points_half))return Number(st.points_half);if(present(st.points))return Number(st.points);return null}
async function fpGet(path,params,key){
 const u=new URL(FP_BASE+path);Object.entries(params||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});
 const r=await fetch(u,{headers:{'x-api-key':key,'Accept':'application/json'}});const text=await r.text();let d;try{d=JSON.parse(text)}catch{throw new Error('FantasyPros returned non-JSON data')};if(!r.ok)throw new Error(d?.message||d?.error||('FantasyPros API error '+r.status));return d;
}
function fpIndex(players=[],scoring='PPR'){
 const m=new Map();for(const p of players){const name=p.name||p.player_name||'',position=posNorm(p.position_id||p.player_position_id||p.position);const key=norm(name)+'|'+position;m.set(key,{name,position,points:fpPoints(p,scoring),raw:p})}return m;
}
function rankIndex(players=[]){const m=new Map();for(const p of players){const name=p.player_name||p.name||'',position=posNorm(p.player_position_id||p.position_id||p.position);const key=norm(name)+'|'+position;const rank=present(p.rank_ecr)?Number(p.rank_ecr):present(p.rank)?Number(p.rank):null;m.set(key,{rank,raw:p})}return m}
function findFP(map,p){return map.get(norm(p.name)+'|'+posNorm(p.position))||map.get(norm(p.name)+'|')||null}

export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 try{
  const {context}=req.body||{};if(!context?.league_teams?.length)return res.status(400).json({error:'League context missing'});
  const key=process.env.FANTASYPROS_API_KEY;if(!key)return res.status(503).json({error:'FANTASYPROS_API_KEY is not configured.'});
  const season=String(context.league?.season||'2026'),week=Number(context.current_week||1),scoring=scoringMode(context),slots=context.league?.roster_positions||[],counts=slotCounts(slots);

  const [fpWeekly,fpRos,fpWeeklyRanks,fpRosRanks]=await Promise.all([
   fpGet('/nfl/'+season+'/projections',{week,positions:'QB:RB:WR:TE:DST:K',scoring},key),
   fpGet('/nfl/'+season+'/projections',{type:'ros',positions:'QB:RB:WR:TE:DST:K',scoring},key).catch(()=>({players:[]})),
   fpGet('/nfl/'+season+'/consensus-rankings',{position:'ALL',week,scoring},key).catch(()=>({players:[]})),
   fpGet('/nfl/'+season+'/consensus-rankings',{position:'ALL',type:'ROS',scoring},key).catch(()=>({players:[]}))
  ]);
  const wMap=fpIndex(fpWeekly.players||[],scoring),rMap=fpIndex(fpRos.players||[],scoring),wrMap=rankIndex(fpWeeklyRanks.players||[]),rrMap=rankIndex(fpRosRanks.players||[]);

  const researched=[];
  for(const t of context.league_teams){for(const p0 of t.players||[]){
   if(researched.some(x=>x.id===String(p0.id||'')&&x.name===p0.name))continue;
   const p={...p0,position:posNorm(p0.position)},wk=findFP(wMap,p),ros=findFP(rMap,p),wkr=findFP(wrMap,p),rr=findFP(rrMap,p);
   const espnWeekly=present(p0.espn_weekly_points)?Number(p0.espn_weekly_points):null;
   const fpWeeklyPts=wk&&present(wk.points)?Number(wk.points):null;
   const fpRosPts=ros&&present(ros.points)?Number(ros.points):null;
   const weekly=meanAvailable(espnWeekly,fpWeeklyPts);
   const weeklySources=[present(espnWeekly)?'ESPN':null,present(fpWeeklyPts)?'FantasyPros':null].filter(Boolean);
   const rosSources=[present(fpRosPts)?'FantasyPros':null].filter(Boolean);
   researched.push({
    id:String(p0.id||''),name:p0.name,position:p.position,injury_status:p0.injury_status||null,
    espn_weekly_points:espnWeekly,fantasypros_weekly_points:fpWeeklyPts,weekly_points:weekly,weekly_source_count:weeklySources.length,weekly_sources:weeklySources,
    fantasypros_ros_points:fpRosPts,ros_points:fpRosPts,ros_source_count:rosSources.length,ros_sources:rosSources,
    fantasypros_weekly_rank:wkr&&present(wkr.rank)?Number(wkr.rank):null,fantasypros_ros_rank:rr&&present(rr.rank)?Number(rr.rank):null,
    weekly_pos_rank:wkr&&present(wkr.rank)?Number(wkr.rank):null,ros_pos_rank:rr&&present(rr.rank)?Number(rr.rank):null
   });
  }}
  const byName=new Map(researched.map(x=>[norm(x.name)+'|'+x.position,x]));
  const getVal=p=>byName.get(norm(p.name)+'|'+posNorm(p.position))||null;

  const totalPlayers=researched.length,weeklyAny=pct(researched.filter(p=>present(p.weekly_points)).length,totalPlayers),weeklyTwo=pct(researched.filter(p=>p.weekly_source_count>=2).length,totalPlayers),rosAny=pct(researched.filter(p=>present(p.ros_points)).length,totalPlayers);
  const teamRows=context.league_teams.map(t=>{
   const ps=(t.players||[]).map(p=>({...p,position:posNorm(p.position),...(getVal(p)||{weekly_points:null,ros_points:null})}));
   const wOpt=optimize(ps,slots,'weekly_points'),rOpt=optimize(ps,slots,'ros_points'),required=startSlots(slots).length;
   const wComplete=wOpt.length===required,rComplete=rOpt.length===required;
   const wBench=ps.filter(p=>present(p.weekly_points)&&!wOpt.some(x=>x.player.name===p.name)).map(p=>Number(p.weekly_points)).sort((a,b)=>b-a).slice(0,4);
   const rBench=ps.filter(p=>present(p.ros_points)&&!rOpt.some(x=>x.player.name===p.name)).map(p=>Number(p.ros_points)).sort((a,b)=>b-a).slice(0,4);
   const qbc=Math.max(1,(counts.QB||0)+(counts.SUPER_FLEX||0));
   const weeklyStarterSum=wComplete?sum(wOpt.map(x=>x.value)):null,rosStarterSum=rComplete?sum(rOpt.map(x=>x.value)):null;
   return{team:t.team,weekly_complete:wComplete,ros_complete:rComplete,weekly_slots_filled:wOpt.length,ros_slots_filled:rOpt.length,required_slots:required,
    weekly_qb:requiredPositionScore(ps,'QB','weekly_points',qbc),weekly_rb:requiredPositionScore(ps,'RB','weekly_points',counts.RB||1),weekly_wr:requiredPositionScore(ps,'WR','weekly_points',counts.WR||1),weekly_te:requiredPositionScore(ps,'TE','weekly_points',counts.TE||1),
    ros_qb:requiredPositionScore(ps,'QB','ros_points',qbc),ros_rb:requiredPositionScore(ps,'RB','ros_points',counts.RB||1),ros_wr:requiredPositionScore(ps,'WR','ros_points',counts.WR||1),ros_te:requiredPositionScore(ps,'TE','ros_points',counts.TE||1),
    weekly_starters:weeklyStarterSum,ros_starters:rosStarterSum,weekly_depth:wBench.length?avg(wBench):null,ros_depth:rBench.length?avg(rBench):null,weekly_total:weeklyStarterSum,ros_total:rosStarterSum};
  });
  const weeklyStarterCoverage=pct(teamRows.reduce((n,r)=>n+r.weekly_slots_filled,0),teamRows.reduce((n,r)=>n+r.required_slots,0)),rosStarterCoverage=pct(teamRows.reduce((n,r)=>n+r.ros_slots_filled,0),teamRows.reduce((n,r)=>n+r.required_slots,0));
  const data_quality={weekly:{overall:weeklyAny,level:qualityLevel(weeklyAny),trusted_value_coverage:weeklyAny,two_source_consensus:weeklyTwo,starter_coverage:weeklyStarterCoverage},ros:{overall:rosAny,level:qualityLevel(rosAny),trusted_value_coverage:rosAny,two_source_consensus:0,starter_coverage:rosStarterCoverage}};

  const build=layer=>{
   const pre=layer==='weekly'?'weekly':'ros',quality=data_quality[layer],blocked=quality.starter_coverage<100||teamRows.some(r=>!r[pre+'_complete']);
   if(blocked){const incomplete=teamRows.filter(r=>!r[pre+'_complete']).map(r=>r.team+' ('+r[pre+'_slots_filled']+'/'+r.required_slots+' starter slots)').slice(0,8);return{blocked:true,my_ranks:null,power_rankings:[],my_explanation:null,data_quality:quality,message:'Power rankings withheld because one or more required starter slots do not have a trusted published value. '+(incomplete.length?'Incomplete teams: '+incomplete.join(', ')+'.':'')}}
   const ranks={qb:rankMap(teamRows,pre+'_qb'),rb:rankMap(teamRows,pre+'_rb'),wr:rankMap(teamRows,pre+'_wr'),te:rankMap(teamRows,pre+'_te'),starters:rankMap(teamRows,pre+'_starters'),overall:rankMap(teamRows,pre+'_total')};
   const sorted=[...teamRows].sort((a,b)=>b[pre+'_total']-a[pre+'_total']),my=context.my_team.team,mine=teamRows.find(r=>r.team===my),n=teamRows.length,leagueStarterAvg=avg(teamRows.map(r=>r[pre+'_starters'])),bullets=[];
   bullets.push('Your optimal starters rank #'+ranks.starters[my]+' of '+n+' ('+mine[pre+'_starters'].toFixed(1)+' vs league average '+leagueStarterAvg.toFixed(1)+').');
   bullets.push(layer==='weekly'?'Weekly player values are the straight average of available ESPN and FantasyPros published projections.':'ROS currently uses FantasyPros published rest-of-season projections directly; no AI-created player values are used.');
   return{blocked:false,data_quality:quality,my_ranks:{qb:ranks.qb[my],rb:ranks.rb[my],wr:ranks.wr[my],te:ranks.te[my],starters:ranks.starters[my],overall:ranks.overall[my]},my_explanation:{summary:(layer==='weekly'?'This week':'Rest of season')+', you rank #'+ranks.overall[my]+' of '+n+'.',bullets},power_rankings:sorted.map(r=>({team:r.team,score:Math.round(r[pre+'_total']*10)/10,data_quality:quality.overall,note:layer==='weekly'?'Optimal starter projection '+r.weekly_starters.toFixed(1)+(r.weekly_depth!==null?'; bench avg '+r.weekly_depth.toFixed(1):''):'ROS projected starter total '+r.ros_starters.toFixed(1)+(r.ros_depth!==null?'; bench avg '+r.ros_depth.toFixed(1):'')}))}
  };

  const myNames=new Set((context.my_team?.players||[]).map(p=>p.name));
  const player_audit=researched.filter(p=>myNames.has(p.name)).map(p=>({name:p.name,position:p.position,weekly_points:p.weekly_points,ros_points:p.ros_points,ros_ppg:p.ros_points,weekly_rank:p.weekly_pos_rank,ros_rank:p.ros_pos_rank,espn_weekly_points:p.espn_weekly_points,fantasypros_weekly_points:p.fantasypros_weekly_points,fantasypros_ros_points:p.fantasypros_ros_points,fantasypros_ros_ppg:p.fantasypros_ros_points,espn_ros_ppg:null,weekly_source_count:p.weekly_source_count,ros_source_count:p.ros_source_count,weekly_sources:p.weekly_sources,ros_sources:p.ros_sources,platform_status:p.injury_status}));
  return res.json({weekly:build('weekly'),ros:build('ros'),data_quality,player_audit,source_policy:{version:'2.0',valuation_sources:['ESPN published weekly projections when supplied by ESPN league data','FantasyPros API projections'],context_source:context.platform||'Platform',rule:'Fantasy Guru never invents a player projection. Weekly Guru value = arithmetic mean of available trusted published projections. One source is labeled single-source; zero sources stays NULL.'},method:'Direct-source SOP v2.0: no OpenAI projection research. FantasyPros is fetched through its API; ESPN weekly projections come directly from ESPN league data; code averages source numbers and ranks lineups deterministically.'});
 }catch(e){res.status(500).json({error:e.message})}
}
