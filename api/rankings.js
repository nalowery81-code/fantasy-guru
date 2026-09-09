const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const sum=a=>a.reduce((x,y)=>x+y,0);
const present=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const meanAvailable=(...v)=>{const a=v.filter(present).map(Number);return a.length?avg(a):null};

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
 const n=Math.max(1,count||1);
 if(vals.length<n)return null;
 return avg(vals.slice(0,n));
}
function rankMap(rows,key){const sorted=[...rows].filter(r=>present(r[key])).sort((a,b)=>b[key]-a[key]),m={};sorted.forEach((r,i)=>m[r.team]=i+1);return m}
function pct(n,d){return d?Math.round(n/d*100):0}
function qualityLevel(n){return n>=95?'HIGH':n>=85?'GOOD':n>=70?'PRELIMINARY':'INSUFFICIENT'}

const playerSchema={
 type:'object',additionalProperties:false,
 properties:{players:{type:'array',items:{type:'object',additionalProperties:false,properties:{
  name:{type:'string'},
  espn_weekly_points:{type:['number','null']},fantasypros_weekly_points:{type:['number','null']},
  espn_weekly_rank:{type:['number','null']},fantasypros_weekly_rank:{type:['number','null']},
  espn_ros_ppg:{type:['number','null']},fantasypros_ros_ppg:{type:['number','null']},
  espn_ros_rank:{type:['number','null']},fantasypros_ros_rank:{type:['number','null']},
  consensus_weekly_points:{type:['number','null']},consensus_ros_ppg:{type:['number','null']},
  weekly_confidence:{type:'number'},ros_confidence:{type:'number'},
  espn_url:{type:['string','null']},fantasypros_url:{type:['string','null']},data_note:{type:'string'}
 },required:['name','espn_weekly_points','fantasypros_weekly_points','espn_weekly_rank','fantasypros_weekly_rank','espn_ros_ppg','fantasypros_ros_ppg','espn_ros_rank','fantasypros_ros_rank','consensus_weekly_points','consensus_ros_ppg','weekly_confidence','ros_confidence','espn_url','fantasypros_url','data_note']}}},required:['players']
};

export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 try{
  const {context}=req.body||{};
  if(!context?.league_teams?.length)return res.status(400).json({error:'League context missing'});
  const slots=context.league?.roster_positions||[],counts=slotCounts(slots),allPlayers=[],seen=new Set();
  for(const t of context.league_teams){for(const p of t.players||[]){const key=(p.id||p.name)+'|'+p.position;if(seen.has(key))continue;seen.add(key);allPlayers.push({id:p.id||null,name:p.name,position:p.position,team:p.team||null,injury_status:p.injury_status||null})}}

  const instructions=[
   'You are the data-reconciliation layer for Fantasy Guru, not the team-ranking engine.',
   'CORE SOURCE POLICY: fantasy valuation inputs may come only from ESPN and FantasyPros. Sleeper data is supplied separately by the app for league/roster/status/market context.',
   'Do NOT use Rotoballer, CBS, Yahoo, Reddit, blogs, aggregators, or random fantasy sites for projections, rankings, or player value.',
   'Use ESPN for ESPN weekly projections/rankings and ESPN player outlook data when available.',
   'Use FantasyPros for weekly ECR/projections and rest-of-season ECR/projections when available.',
   'If a requested source value is not available, return null. Never turn missing data into zero.',
   'You may derive consensus_weekly_points or consensus_ros_ppg only from ESPN and FantasyPros information you found.',
   'Accuracy and traceability matter more than filling every field.',
   'All point values must reflect the supplied league scoring settings.',
   'The confidence fields are diagnostic only; application code calculates data quality and decides whether rankings are allowed.',
   'Include every supplied player exactly once and preserve each input player name exactly.'
  ].join('\n');

  async function researchBatch(batch,pos,batchNo,total){
   let lastError='unknown error';
   for(let attempt=1;attempt<=3;attempt++){
    try{
     const rr=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},body:JSON.stringify({
      model:'gpt-5.6-luna',reasoning:{effort:'low'},tools:[{type:'web_search',search_context_size:'medium'}],instructions,
      text:{format:{type:'json_schema',name:'player_projection_batch',strict:true,schema:playerSchema}},
      input:'CURRENT WEEK: '+context.current_week+'\nPOSITION GROUP: '+pos+'\nBATCH: '+batchNo+' of '+total+'\nLEAGUE SETTINGS:\n'+JSON.stringify({roster_positions:context.league?.roster_positions,scoring_settings:context.league?.scoring_settings,scoring_summary:context.league?.scoring_summary})+'\nPLAYERS:\n'+JSON.stringify(batch)+'\nValuation research is restricted to ESPN and FantasyPros only.',
      max_output_tokens:7000
     })});
     const d=await rr.json();if(!rr.ok)throw new Error(d?.error?.message||'OpenAI projection research failed');
     let text=d.output_text||'';if(!text&&Array.isArray(d.output))text=d.output.flatMap(x=>x.content||[]).map(x=>x.text||'').filter(Boolean).join('\n');
     const parsed=JSON.parse(text);if(!parsed?.players?.length)throw new Error('empty structured response');
     const inputNames=new Set(batch.map(x=>x.name)),returnedNames=new Set(parsed.players.map(x=>x.name));
     if(parsed.players.length!==batch.length||[...inputNames].some(n=>!returnedNames.has(n)))throw new Error('player list mismatch');
     return parsed.players.map(p=>{
      const weekly=meanAvailable(p.espn_weekly_points,p.fantasypros_weekly_points) ?? (present(p.consensus_weekly_points)?Number(p.consensus_weekly_points):null);
      const ros=meanAvailable(p.espn_ros_ppg,p.fantasypros_ros_ppg) ?? (present(p.consensus_ros_ppg)?Number(p.consensus_ros_ppg):null);
      const wrank=meanAvailable(p.espn_weekly_rank,p.fantasypros_weekly_rank);
      const rrank=meanAvailable(p.espn_ros_rank,p.fantasypros_ros_rank);
      return {...p,weekly_points:weekly,ros_ppg:ros,weekly_pos_rank:wrank,ros_pos_rank:rrank}
     });
    }catch(e){lastError=e.message||String(e);if(attempt<3)await new Promise(r=>setTimeout(r,350*attempt))}
   }
   throw new Error('Projection batch '+batchNo+' failed after 3 attempts: '+lastError);
  }

  const groups={};for(const p of allPlayers){const k=p.position||'OTHER';(groups[k]||(groups[k]=[])).push(p)}
  const batches=[];for(const [pos,arr] of Object.entries(groups)){for(let i=0;i<arr.length;i+=24)batches.push({pos,players:arr.slice(i,i+24)})}
  const researched=[];const concurrency=4;
  for(let i=0;i<batches.length;i+=concurrency){const group=batches.slice(i,i+concurrency);const out=await Promise.all(group.map((b,j)=>researchBatch(b.players,b.pos,i+j+1,batches.length)));for(const arr of out)researched.push(...arr)}
  const byName=new Map(researched.map(x=>[x.name,x]));

  const totalPlayers=researched.length;
  const weeklyEspn=pct(researched.filter(p=>present(p.espn_weekly_points)).length,totalPlayers);
  const weeklyFp=pct(researched.filter(p=>present(p.fantasypros_weekly_points)).length,totalPlayers);
  const rosEspn=pct(researched.filter(p=>present(p.espn_ros_ppg)).length,totalPlayers);
  const rosFp=pct(researched.filter(p=>present(p.fantasypros_ros_ppg)).length,totalPlayers);

  const teamRows=context.league_teams.map(t=>{
   const ps=(t.players||[]).map(p=>({...p,...(byName.get(p.name)||{weekly_points:null,weekly_pos_rank:null,ros_ppg:null,ros_pos_rank:null})}));
   const wOpt=optimize(ps,slots,'weekly_points'),rOpt=optimize(ps,slots,'ros_ppg');
   const required=startSlots(slots).length;
   const wComplete=wOpt.length===required,rComplete=rOpt.length===required;
   const wBench=ps.filter(p=>present(p.weekly_points)&&!wOpt.some(x=>x.player.name===p.name)).map(p=>Number(p.weekly_points)).sort((a,b)=>b-a).slice(0,4);
   const rBench=ps.filter(p=>present(p.ros_ppg)&&!rOpt.some(x=>x.player.name===p.name)).map(p=>Number(p.ros_ppg)).sort((a,b)=>b-a).slice(0,4);
   const qbc=Math.max(1,(counts.QB||0)+(counts.SUPER_FLEX||0));
   const weeklyStarterSum=wComplete?sum(wOpt.map(x=>x.value)):null,rosStarterSum=rComplete?sum(rOpt.map(x=>x.value)):null;
   const weeklyDepth=wBench.length?avg(wBench):null,rosDepth=rBench.length?avg(rBench):null;
   return{
    team:t.team,weekly_complete:wComplete,ros_complete:rComplete,weekly_slots_filled:wOpt.length,ros_slots_filled:rOpt.length,required_slots:required,
    weekly_qb:requiredPositionScore(ps,'QB','weekly_points',qbc),weekly_rb:requiredPositionScore(ps,'RB','weekly_points',counts.RB||1),weekly_wr:requiredPositionScore(ps,'WR','weekly_points',counts.WR||1),weekly_te:requiredPositionScore(ps,'TE','weekly_points',counts.TE||1),
    ros_qb:requiredPositionScore(ps,'QB','ros_ppg',qbc),ros_rb:requiredPositionScore(ps,'RB','ros_ppg',counts.RB||1),ros_wr:requiredPositionScore(ps,'WR','ros_ppg',counts.WR||1),ros_te:requiredPositionScore(ps,'TE','ros_ppg',counts.TE||1),
    weekly_starters:weeklyStarterSum,ros_starters:rosStarterSum,weekly_depth:weeklyDepth,ros_depth:rosDepth,
    weekly_total:wComplete?weeklyStarterSum+(weeklyDepth??0)*0.35:null,ros_total:rComplete?rosStarterSum+(rosDepth??0)*0.7:null
   }
  });

  const weeklyStarterCoverage=pct(teamRows.reduce((n,r)=>n+r.weekly_slots_filled,0),teamRows.reduce((n,r)=>n+r.required_slots,0));
  const rosStarterCoverage=pct(teamRows.reduce((n,r)=>n+r.ros_slots_filled,0),teamRows.reduce((n,r)=>n+r.required_slots,0));
  const weeklyQuality=Math.round((weeklyEspn+weeklyFp)/2),rosQuality=Math.round((rosEspn+rosFp)/2);
  const data_quality={
   weekly:{overall:weeklyQuality,level:qualityLevel(weeklyQuality),espn:weeklyEspn,fantasypros:weeklyFp,starter_coverage:weeklyStarterCoverage},
   ros:{overall:rosQuality,level:qualityLevel(rosQuality),espn:rosEspn,fantasypros:rosFp,starter_coverage:rosStarterCoverage}
  };

  const build=layer=>{
   const pre=layer==='weekly'?'weekly':'ros',quality=data_quality[layer];
   const blocked=quality.overall<70||quality.starter_coverage<100||teamRows.some(r=>!r[pre+'_complete']);
   if(blocked){
    const incomplete=teamRows.filter(r=>!r[pre+'_complete']).map(r=>r.team+' ('+r[pre+'_slots_filled']+'/'+r.required_slots+' starter slots)').slice(0,6);
    return{blocked:true,my_ranks:null,power_rankings:[],my_explanation:null,data_quality:quality,message:'Power rankings withheld because trusted data is incomplete. '+(quality.starter_coverage<100?'Required starter coverage is '+quality.starter_coverage+'%. ':'')+(quality.overall<70?'Trusted-source data quality is '+quality.overall+'%. ':'')+(incomplete.length?'Incomplete teams: '+incomplete.join(', ')+'.':'')};
   }
   const ranks={qb:rankMap(teamRows,pre+'_qb'),rb:rankMap(teamRows,pre+'_rb'),wr:rankMap(teamRows,pre+'_wr'),te:rankMap(teamRows,pre+'_te'),starters:rankMap(teamRows,pre+'_starters'),overall:rankMap(teamRows,pre+'_total')};
   const sorted=[...teamRows].sort((a,b)=>b[pre+'_total']-a[pre+'_total']),my=context.my_team.team,mine=teamRows.find(r=>r.team===my),n=teamRows.length;
   const leagueStarterAvg=avg(teamRows.map(r=>r[pre+'_starters'])),bullets=[],labels={qb:'QB',rb:'RB',wr:'WR',te:'TE'};
   for(const k of ['qb','rb','wr','te']){const rk=ranks[k][my];if(rk<=3)bullets.push(labels[k]+' is a major strength at #'+rk+' of '+n+'.')}
   for(const k of ['qb','rb','wr','te']){const rk=ranks[k][my];if(rk>=Math.max(4,n-3))bullets.push(labels[k]+' is the clearest weakness at #'+rk+' of '+n+'.')}
   bullets.push('Your optimal starters rank #'+ranks.starters[my]+' of '+n+' ('+mine[pre+'_starters'].toFixed(1)+' vs league average '+leagueStarterAvg.toFixed(1)+').');
   bullets.push('Data quality: '+quality.overall+'% ('+quality.level+'); required-starter coverage '+quality.starter_coverage+'%.');
   return{blocked:false,data_quality:quality,my_ranks:{qb:ranks.qb[my],rb:ranks.rb[my],wr:ranks.wr[my],te:ranks.te[my],starters:ranks.starters[my],overall:ranks.overall[my]},my_explanation:{summary:(layer==='weekly'?'This week':'Rest of season')+', you rank #'+ranks.overall[my]+' of '+n+'. Positional ranks use only required starters; bench depth does not alter the headline positional rank.',bullets},power_rankings:sorted.map(r=>({team:r.team,score:Math.round(r[pre+'_total']*10)/10,data_quality:quality.overall,note:layer==='weekly'?'Projected starter points '+r.weekly_starters.toFixed(1)+(r.weekly_depth!==null?'; bench strength '+r.weekly_depth.toFixed(1):'; bench data unavailable'):'ROS starter PPG '+r.ros_starters.toFixed(1)+(r.ros_depth!==null?'; bench PPG '+r.ros_depth.toFixed(1):'; bench data unavailable')}))}
  };

  const myNames=new Set((context.my_team?.players||[]).map(p=>p.name));
  const player_audit=researched.filter(p=>myNames.has(p.name)).map(p=>({name:p.name,position:allPlayers.find(x=>x.name===p.name)?.position||'',weekly_points:p.weekly_points,ros_ppg:p.ros_ppg,weekly_rank:p.weekly_pos_rank,ros_rank:p.ros_pos_rank,espn_weekly_points:p.espn_weekly_points??null,fantasypros_weekly_points:p.fantasypros_weekly_points??null,espn_ros_ppg:p.espn_ros_ppg??null,fantasypros_ros_ppg:p.fantasypros_ros_ppg??null,espn_weekly_rank:p.espn_weekly_rank??null,fantasypros_weekly_rank:p.fantasypros_weekly_rank??null,espn_ros_rank:p.espn_ros_rank??null,fantasypros_ros_rank:p.fantasypros_ros_rank??null,espn_url:p.espn_url||null,fantasypros_url:p.fantasypros_url||null,data_note:p.data_note||'',platform_status:allPlayers.find(x=>x.name===p.name)?.injury_status||null}));

  return res.json({weekly:build('weekly'),ros:build('ros'),data_quality,player_audit,source_policy:{version:'1.2',core_sources:['ESPN','FantasyPros','Sleeper/platform data'],valuation_sources:['ESPN','FantasyPros'],context_source:context.platform||'Platform',rule:'Missing data remains NULL, never zero. Power rankings require 100% required-starter coverage and at least 70% trusted-source data quality.'},method:'Three-source SOP v1.2: ESPN + FantasyPros valuation inputs, platform league context, deterministic roster math, hard data-quality gates, starter-only positional rankings.'})
 }catch(e){res.status(500).json({error:e.message})}
}