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
function requiredPositionScore(players,pos,field,count){const vals=players.filter(p=>p.position===pos&&present(p[field])).map(p=>Number(p[field])).sort((a,b)=>b-a);const n=Math.max(1,count||1);return vals.length<n?null:avg(vals.slice(0,n))}
function rankMap(rows,key){const sorted=[...rows].filter(r=>present(r[key])).sort((a,b)=>b[key]-a[key]),m={};sorted.forEach((r,i)=>m[r.team]=i+1);return m}
function qualityLevel(n){return n>=95?'HIGH':n>=85?'GOOD':n>=70?'PRELIMINARY':'INSUFFICIENT'}
function scoringMode(context){const s=(context.league?.scoring_summary||[]).join(' ').toUpperCase();if(s.includes('HALF'))return'HALF';if(s.includes('PPR'))return'PPR';return'STD'}
function sleeperPoints(row,scoring){const st=row?.stats||row||{};if(scoring==='PPR'&&present(st.pts_ppr))return Number(st.pts_ppr);if(scoring==='HALF'&&present(st.pts_half_ppr))return Number(st.pts_half_ppr);if(present(st.pts_std))return Number(st.pts_std);return null}
async function sleeperGetJson(url){const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'FantasyGuru/1.0'}});if(!r.ok)throw new Error('Sleeper projection API error '+r.status);return r.json()}
async function sleeperWeekly(season,week){const urls=['https://api.sleeper.app/projections/nfl/'+season+'/'+week+'?season_type=regular','https://api.sleeper.app/v1/projections/nfl/regular/'+season+'/'+week];for(const u of urls){try{const d=await sleeperGetJson(u);if(d&&((Array.isArray(d)&&d.length)||(!Array.isArray(d)&&Object.keys(d).length)))return d}catch{}}return {}}
async function sleeperPlayers(){try{return await sleeperGetJson('https://api.sleeper.app/v1/players/nfl')}catch{return {}}}
function sleeperIndexes(raw={},players={},scoring='PPR'){const byId=new Map(),byName=new Map();const rows=Array.isArray(raw)?raw:Object.entries(raw||{}).map(([id,v])=>({player_id:id,...(v||{})}));for(const row of rows){const id=String(row.player_id||row.player?.player_id||row.player?.id||'');const meta=players?.[id]||row.player||{};const name=meta.full_name||[meta.first_name,meta.last_name].filter(Boolean).join(' ')||row.player_name||row.name||'';const position=posNorm(meta.position||row.position||row.player_position);const points=sleeperPoints(row,scoring);const rec={id,name,position,points};if(id)byId.set(id,rec);if(name)byName.set(norm(name)+'|'+position,rec)}return{byId,byName}}
function findSleeper(idx,p){const id=String(p.id||'');return(idx.byId.get(id)&&idx.byId.get(id).position===posNorm(p.position)?idx.byId.get(id):null)||idx.byName.get(norm(p.name)+'|'+posNorm(p.position))||null}

export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 try{
  const {context}=req.body||{};if(!context?.league_teams?.length)return res.status(400).json({error:'League context missing'});
  const season=String(context.league?.season||'2026'),week=Number(context.current_week||1),scoring=scoringMode(context),slots=context.league?.roster_positions||[],counts=slotCounts(slots);
  const [slWeeklyRaw,slPlayers]=await Promise.all([sleeperWeekly(season,week),sleeperPlayers()]);
  const slIdx=sleeperIndexes(slWeeklyRaw,slPlayers,scoring),researched=[];
  for(const t of context.league_teams){for(const p0 of t.players||[]){
   if(researched.some(x=>x.id===String(p0.id||'')&&x.name===p0.name))continue;
   const p={...p0,position:posNorm(p0.position)},sl=findSleeper(slIdx,p);
   const espnWeekly=present(p0.espn_weekly_points)?Number(p0.espn_weekly_points):null;
   const slWeeklyPts=sl&&present(sl.points)?Number(sl.points):null;
   const weekly=meanAvailable(espnWeekly,slWeeklyPts);
   const sources=[present(espnWeekly)?'ESPN':null,present(slWeeklyPts)?'Sleeper':null].filter(Boolean);
   researched.push({id:String(p0.id||''),name:p0.name,position:p.position,injury_status:p0.injury_status||null,espn_weekly_points:espnWeekly,sleeper_weekly_points:slWeeklyPts,weekly_points:weekly,weekly_source_count:sources.length,weekly_sources:sources});
  }}
  const byName=new Map(researched.map(x=>[norm(x.name)+'|'+x.position,x])),getVal=p=>byName.get(norm(p.name)+'|'+posNorm(p.position))||null;
  const total=researched.length,espnCoverage=pct(researched.filter(p=>present(p.espn_weekly_points)).length,total),sleeperCoverage=pct(researched.filter(p=>present(p.sleeper_weekly_points)).length,total),weeklyAny=pct(researched.filter(p=>present(p.weekly_points)).length,total),weeklyTwo=pct(researched.filter(p=>p.weekly_source_count>=2).length,total);
  const teamRows=context.league_teams.map(t=>{
   const ps=(t.players||[]).map(p=>({...p,position:posNorm(p.position),...(getVal(p)||{weekly_points:null})}));
   const wOpt=optimize(ps,slots,'weekly_points'),required=startSlots(slots).length,wComplete=wOpt.length===required;
   const wBench=ps.filter(p=>present(p.weekly_points)&&!wOpt.some(x=>x.player.name===p.name)).map(p=>Number(p.weekly_points)).sort((a,b)=>b-a).slice(0,4);
   const qbc=Math.max(1,(counts.QB||0)+(counts.SUPER_FLEX||0)),weeklyStarterSum=wComplete?sum(wOpt.map(x=>x.value)):null;
   return{team:t.team,weekly_complete:wComplete,weekly_slots_filled:wOpt.length,required_slots:required,weekly_qb:requiredPositionScore(ps,'QB','weekly_points',qbc),weekly_rb:requiredPositionScore(ps,'RB','weekly_points',counts.RB||1),weekly_wr:requiredPositionScore(ps,'WR','weekly_points',counts.WR||1),weekly_te:requiredPositionScore(ps,'TE','weekly_points',counts.TE||1),weekly_starters:weeklyStarterSum,weekly_depth:wBench.length?avg(wBench):null,weekly_total:weeklyStarterSum};
  });
  const weeklyStarterCoverage=pct(teamRows.reduce((n,r)=>n+r.weekly_slots_filled,0),teamRows.reduce((n,r)=>n+r.required_slots,0));
  const weeklyQuality={overall:weeklyAny,level:qualityLevel(weeklyAny),espn:espnCoverage,sleeper:sleeperCoverage,two_source_consensus:weeklyTwo,starter_coverage:weeklyStarterCoverage};
  const blocked=weeklyStarterCoverage<100||teamRows.some(r=>!r.weekly_complete);
  let weekly;
  if(blocked){const incomplete=teamRows.filter(r=>!r.weekly_complete).map(r=>r.team+' ('+r.weekly_slots_filled+'/'+r.required_slots+' starter slots)').slice(0,8);weekly={blocked:true,my_ranks:null,power_rankings:[],my_explanation:null,data_quality:weeklyQuality,message:'Power rankings withheld because one or more required starter slots do not have a trusted ESPN/Sleeper published weekly projection. '+(incomplete.length?'Incomplete teams: '+incomplete.join(', ')+'.':'')}}
  else{
   const ranks={qb:rankMap(teamRows,'weekly_qb'),rb:rankMap(teamRows,'weekly_rb'),wr:rankMap(teamRows,'weekly_wr'),te:rankMap(teamRows,'weekly_te'),starters:rankMap(teamRows,'weekly_starters'),overall:rankMap(teamRows,'weekly_total')};
   const sorted=[...teamRows].sort((a,b)=>b.weekly_total-a.weekly_total),my=context.my_team.team,mine=teamRows.find(r=>r.team===my),n=teamRows.length,leagueStarterAvg=avg(teamRows.map(r=>r.weekly_starters));
   weekly={blocked:false,data_quality:weeklyQuality,my_ranks:{qb:ranks.qb[my],rb:ranks.rb[my],wr:ranks.wr[my],te:ranks.te[my],starters:ranks.starters[my],overall:ranks.overall[my]},my_explanation:{summary:'This week, you rank #'+ranks.overall[my]+' of '+n+'.',bullets:['Your optimal starters rank #'+ranks.starters[my]+' of '+n+' ('+mine.weekly_starters.toFixed(1)+' vs league average '+leagueStarterAvg.toFixed(1)+').','Weekly values are the straight average of available ESPN and Sleeper published projections.']},power_rankings:sorted.map(r=>({team:r.team,score:Math.round(r.weekly_total*10)/10,data_quality:weeklyQuality.overall,note:'Optimal starter projection '+r.weekly_starters.toFixed(1)+(r.weekly_depth!==null?'; bench avg '+r.weekly_depth.toFixed(1):'')}))};
  }
  const rosQuality={overall:0,level:'UNAVAILABLE',espn:0,sleeper:0,two_source_consensus:0,starter_coverage:0};
  const ros={blocked:true,my_ranks:null,power_rankings:[],my_explanation:null,data_quality:rosQuality,message:'Rest-of-season rankings are temporarily unavailable under the free-source policy. FantasyPros was removed, and Fantasy Guru will not invent ROS values. We will add ROS again only when we have a reliable free published source.'};
  const myNames=new Set((context.my_team?.players||[]).map(p=>p.name));
  const player_audit=researched.filter(p=>myNames.has(p.name)).map(p=>({name:p.name,position:p.position,weekly_points:p.weekly_points,espn_weekly_points:p.espn_weekly_points,sleeper_weekly_points:p.sleeper_weekly_points,weekly_source_count:p.weekly_source_count,weekly_sources:p.weekly_sources,platform_status:p.injury_status,ros_points:null,ros_ppg:null}));
  return res.json({weekly,ros,data_quality:{weekly:weeklyQuality,ros:rosQuality},player_audit,source_policy:{version:'3.0-free',valuation_sources:['ESPN published weekly projections','Sleeper published weekly projections'],context_source:context.platform||'Platform',rule:'Fantasy Guru never invents a projection. Weekly Guru value = arithmetic mean of available ESPN and Sleeper published projections. ROS is withheld until a reliable free published source is available.'},method:'Free-source SOP v3.0: no FantasyPros and no OpenAI projection research. ESPN + Sleeper weekly only; deterministic ranking math.'});
 }catch(e){res.status(500).json({error:e.message})}
}
