const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const sum=a=>a.reduce((x,y)=>x+y,0);
const nums=a=>a.map(Number).filter(Number.isFinite);
const meanAvailable=(...v)=>{const a=nums(v.filter(x=>x!==null&&x!==undefined&&x!==''));return a.length?avg(a):null};

function slotCounts(slots=[]){const c={};for(const s of slots)c[s]=(c[s]||0)+1;return c}
function eligible(pos,slot){if(slot===pos)return true;if(slot==='FLEX')return ['RB','WR','TE'].includes(pos);if(slot==='SUPER_FLEX')return ['QB','RB','WR','TE'].includes(pos);return false}
function optimize(players,slots,field){
 const used=new Set(),picks=[];
 const startSlots=slots.filter(s=>!['BN','IR'].includes(s));
 const order=[...startSlots].sort((a,b)=>{const r={QB:1,SUPER_FLEX:2,TE:3,RB:4,WR:5,FLEX:6,DEF:7,K:8};return(r[a]||9)-(r[b]||9)});
 for(const slot of order){
  let best=null,bi=-1;
  players.forEach((p,i)=>{if(used.has(i)||!eligible(p.position,slot))return;const v=Number(p[field]||0);if(!best||v>Number(best[field]||0)){best=p;bi=i}});
  if(best){used.add(bi);picks.push({slot,player:best,value:Number(best[field]||0)})}
 }
 return picks
}
function positionScore(players,pos,field,count){
 const vals=players.filter(p=>p.position===pos).map(p=>Number(p[field]||0)).sort((a,b)=>b-a);
 if(!vals.length)return 0;
 const n=Math.max(1,count||1),starters=vals.slice(0,n),depth=vals.slice(n,n+2);
 return avg(starters)*0.9+avg(depth)*0.1
}
function rankMap(rows,key){const sorted=[...rows].sort((a,b)=>b[key]-a[key]),m={};sorted.forEach((r,i)=>m[r.team]=i+1);return m}

const playerSchema={
 type:'object',additionalProperties:false,
 properties:{
  players:{type:'array',items:{type:'object',additionalProperties:false,properties:{
   name:{type:'string'},
   espn_weekly_points:{type:['number','null']},fantasypros_weekly_points:{type:['number','null']},
   espn_weekly_rank:{type:['number','null']},fantasypros_weekly_rank:{type:['number','null']},
   espn_ros_ppg:{type:['number','null']},fantasypros_ros_ppg:{type:['number','null']},
   espn_ros_rank:{type:['number','null']},fantasypros_ros_rank:{type:['number','null']},
   consensus_weekly_points:{type:['number','null']},consensus_ros_ppg:{type:['number','null']},
   weekly_confidence:{type:'number'},ros_confidence:{type:'number'},
   espn_url:{type:['string','null']},fantasypros_url:{type:['string','null']},data_note:{type:'string'}
  },required:['name','espn_weekly_points','fantasypros_weekly_points','espn_weekly_rank','fantasypros_weekly_rank','espn_ros_ppg','fantasypros_ros_ppg','espn_ros_rank','fantasypros_ros_rank','consensus_weekly_points','consensus_ros_ppg','weekly_confidence','ros_confidence','espn_url','fantasypros_url','data_note']}}
 },required:['players']
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
   'If a requested source value is not available, return null. Do not fabricate a source-specific number.',
   'You may derive consensus_weekly_points or consensus_ros_ppg only from ESPN and FantasyPros information you found.',
   'Accuracy and traceability matter more than filling every field.',
   'All point values must reflect the supplied league scoring settings.',
   'Confidence must be 35-95 and should fall when ESPN and FantasyPros disagree or data is missing.',
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
     const d=await rr.json();
     if(!rr.ok)throw new Error(d?.error?.message||'OpenAI projection research failed');
     let text=d.output_text||'';
     if(!text&&Array.isArray(d.output))text=d.output.flatMap(x=>x.content||[]).map(x=>x.text||'').filter(Boolean).join('\n');
     const parsed=JSON.parse(text);
     if(!parsed?.players?.length)throw new Error('empty structured response');
     const inputNames=new Set(batch.map(x=>x.name));
     const returnedNames=new Set(parsed.players.map(x=>x.name));
     if(parsed.players.length!==batch.length||[...inputNames].some(n=>!returnedNames.has(n)))throw new Error('player list mismatch');
     return parsed.players.map(p=>{
      const weekly=meanAvailable(p.espn_weekly_points,p.fantasypros_weekly_points) ?? Number(p.consensus_weekly_points||0);
      const ros=meanAvailable(p.espn_ros_ppg,p.fantasypros_ros_ppg) ?? Number(p.consensus_ros_ppg||0);
      const wrank=meanAvailable(p.espn_weekly_rank,p.fantasypros_weekly_rank) ?? 999;
      const rrank=meanAvailable(p.espn_ros_rank,p.fantasypros_ros_rank) ?? 999;
      return {...p,weekly_points:Number(weekly||0),ros_ppg:Number(ros||0),weekly_pos_rank:Number(wrank||999),ros_pos_rank:Number(rrank||999),weekly_confidence:Math.max(35,Math.min(95,Number(p.weekly_confidence||55))),ros_confidence:Math.max(35,Math.min(95,Number(p.ros_confidence||55)))}
     });
    }catch(e){lastError=e.message||String(e);if(attempt<3)await new Promise(r=>setTimeout(r,350*attempt))}
   }
   throw new Error('Projection batch '+batchNo+' failed after 3 attempts: '+lastError);
  }

  const groups={};for(const p of allPlayers){const k=p.position||'OTHER';(groups[k]||(groups[k]=[])).push(p)}
  const batches=[];for(const [pos,arr] of Object.entries(groups)){for(let i=0;i<arr.length;i+=24)batches.push({pos,players:arr.slice(i,i+24)})}
  const researched=[];
  const concurrency=4;
  for(let i=0;i<batches.length;i+=concurrency){const group=batches.slice(i,i+concurrency);const out=await Promise.all(group.map((b,j)=>researchBatch(b.players,b.pos,i+j+1,batches.length)));for(const arr of out)researched.push(...arr)}
  const byName=new Map(researched.map(x=>[x.name,x]));

  const teamRows=context.league_teams.map(t=>{
   const ps=(t.players||[]).map(p=>({...p,...(byName.get(p.name)||{weekly_points:0,weekly_pos_rank:999,ros_ppg:0,ros_pos_rank:999,weekly_confidence:35,ros_confidence:35})}));
   const wOpt=optimize(ps,slots,'weekly_points'),rOpt=optimize(ps,slots,'ros_ppg');
   const wBench=ps.filter(p=>!wOpt.some(x=>x.player.name===p.name)).map(p=>Number(p.weekly_points||0)).sort((a,b)=>b-a).slice(0,4);
   const rBench=ps.filter(p=>!rOpt.some(x=>x.player.name===p.name)).map(p=>Number(p.ros_ppg||0)).sort((a,b)=>b-a).slice(0,4);
   const qbc=Math.max(1,(counts.QB||0)+(counts.SUPER_FLEX||0));
   const weeklyStarterSum=sum(wOpt.map(x=>x.value)),rosStarterSum=sum(rOpt.map(x=>x.value));
   const weeklyDepth=avg(wBench),rosDepth=avg(rBench);
   return{team:t.team,weekly_qb:positionScore(ps,'QB','weekly_points',qbc),weekly_rb:positionScore(ps,'RB','weekly_points',counts.RB||1),weekly_wr:positionScore(ps,'WR','weekly_points',counts.WR||1),weekly_te:positionScore(ps,'TE','weekly_points',counts.TE||1),ros_qb:positionScore(ps,'QB','ros_ppg',qbc),ros_rb:positionScore(ps,'RB','ros_ppg',counts.RB||1),ros_wr:positionScore(ps,'WR','ros_ppg',counts.WR||1),ros_te:positionScore(ps,'TE','ros_ppg',counts.TE||1),weekly_starters:weeklyStarterSum,ros_starters:rosStarterSum,weekly_depth:weeklyDepth,ros_depth:rosDepth,weekly_conf:avg(ps.map(p=>Number(p.weekly_confidence||55))),ros_conf:avg(ps.map(p=>Number(p.ros_confidence||55))),weekly_total:weeklyStarterSum+weeklyDepth*0.35,ros_total:rosStarterSum+rosDepth*0.7}
  });

  const build=layer=>{
   const pre=layer==='weekly'?'weekly':'ros';
   const ranks={qb:rankMap(teamRows,pre+'_qb'),rb:rankMap(teamRows,pre+'_rb'),wr:rankMap(teamRows,pre+'_wr'),te:rankMap(teamRows,pre+'_te'),starters:rankMap(teamRows,pre+'_starters'),overall:rankMap(teamRows,pre+'_total')};
   const sorted=[...teamRows].sort((a,b)=>b[pre+'_total']-a[pre+'_total']),my=context.my_team.team,mine=teamRows.find(r=>r.team===my),n=teamRows.length;
   const leagueStarterAvg=avg(teamRows.map(r=>r[pre+'_starters'])),leagueDepthAvg=avg(teamRows.map(r=>r[pre+'_depth'])),bullets=[],labels={qb:'QB',rb:'RB',wr:'WR',te:'TE'};
   for(const k of ['qb','rb','wr','te']){const rk=ranks[k][my];if(rk<=3)bullets.push(labels[k]+' is a major strength at #'+rk+' of '+n+'.')}
   for(const k of ['qb','rb','wr','te']){const rk=ranks[k][my];if(rk>=Math.max(4,n-3))bullets.push(labels[k]+' is the clearest weakness at #'+rk+' of '+n+'.')}
   bullets.push('Your optimal starters rank #'+ranks.starters[my]+' of '+n+' ('+mine[pre+'_starters'].toFixed(1)+' vs league average '+leagueStarterAvg.toFixed(1)+').');
   const dd=mine[pre+'_depth']-leagueDepthAvg;bullets.push('Depth is '+(Math.abs(dd)<0.5?'about league average':dd>0?'above league average by '+dd.toFixed(1):'below league average by '+Math.abs(dd).toFixed(1))+'.');
   return{my_ranks:{qb:ranks.qb[my],rb:ranks.rb[my],wr:ranks.wr[my],te:ranks.te[my],starters:ranks.starters[my],overall:ranks.overall[my]},my_explanation:{summary:(layer==='weekly'?'This week':'Rest of season')+', you rank #'+ranks.overall[my]+' of '+n+'. ESPN and FantasyPros supply valuation inputs; Sleeper/platform data supplies league context; code performs the ranking math.',bullets},power_rankings:sorted.map(r=>({team:r.team,score:Math.round(r[pre+'_total']*10)/10,confidence:Math.round(r[pre+'_conf']),note:layer==='weekly'?'Projected starter points '+r.weekly_starters.toFixed(1)+'; bench strength '+r.weekly_depth.toFixed(1):'ROS starter PPG '+r.ros_starters.toFixed(1)+'; bench PPG '+r.ros_depth.toFixed(1)}))}
  };

  const myNames=new Set((context.my_team?.players||[]).map(p=>p.name));
  const player_audit=researched.filter(p=>myNames.has(p.name)).map(p=>({name:p.name,position:allPlayers.find(x=>x.name===p.name)?.position||'',weekly_points:p.weekly_points,ros_ppg:p.ros_ppg,weekly_rank:p.weekly_pos_rank,ros_rank:p.ros_pos_rank,espn_weekly_points:p.espn_weekly_points??null,fantasypros_weekly_points:p.fantasypros_weekly_points??null,espn_ros_ppg:p.espn_ros_ppg??null,fantasypros_ros_ppg:p.fantasypros_ros_ppg??null,espn_weekly_rank:p.espn_weekly_rank??null,fantasypros_weekly_rank:p.fantasypros_weekly_rank??null,espn_ros_rank:p.espn_ros_rank??null,fantasypros_ros_rank:p.fantasypros_ros_rank??null,weekly_confidence:p.weekly_confidence,ros_confidence:p.ros_confidence,espn_url:p.espn_url||null,fantasypros_url:p.fantasypros_url||null,data_note:p.data_note||'',platform_status:allPlayers.find(x=>x.name===p.name)?.injury_status||null}));

  return res.json({weekly:build('weekly'),ros:build('ros'),player_audit,source_policy:{version:'1.1',core_sources:['ESPN','FantasyPros','Sleeper/platform data'],valuation_sources:['ESPN','FantasyPros'],context_source:context.platform||'Platform',rule:'No other fantasy site may set player value. Missing source data is exposed rather than silently replaced.'},method:'Three-source SOP: ESPN + FantasyPros valuation inputs, Sleeper/platform league context, deterministic roster math. Structured output prevents malformed projection JSON.'})
 }catch(e){res.status(500).json({error:e.message})}
}