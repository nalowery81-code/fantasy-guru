function cleanJson(s){return String(s||'').replace(/```json|```/g,'').trim()}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;

function slotCounts(slots=[]){
 const c={}; for(const s of slots)c[s]=(c[s]||0)+1; return c;
}
function eligible(pos,slot){
 if(slot===pos)return true;
 if(slot==='FLEX')return ['RB','WR','TE'].includes(pos);
 if(slot==='SUPER_FLEX')return ['QB','RB','WR','TE'].includes(pos);
 return false;
}
function optimize(players, slots, field){
 const used=new Set(), picks=[];
 const startSlots=slots.filter(s=>!['BN','IR'].includes(s));
 const scarcityOrder=[...startSlots].sort((a,b)=>{
  const rank={QB:1,SUPER_FLEX:2,TE:3,RB:4,WR:5,FLEX:6,DEF:7,K:8};
  return (rank[a]||9)-(rank[b]||9)
 });
 for(const slot of scarcityOrder){
  let best=null,bi=-1;
  players.forEach((p,i)=>{
   if(used.has(i)||!eligible(p.position,slot))return;
   const v=Number(p[field]||0);
   if(!best||v>Number(best[field]||0)){best=p;bi=i}
  });
  if(best){used.add(bi);picks.push({slot,player:best,value:Number(best[field]||0)})}
 }
 return picks;
}
function positionScore(players,pos,field,count){
 const vals=players.filter(p=>p.position===pos).map(p=>Number(p[field]||0)).sort((a,b)=>b-a);
 if(!vals.length)return 0;
 const starters=vals.slice(0,Math.max(1,count||1));
 const depth=vals.slice(Math.max(1,count||1),Math.max(1,count||1)+2);
 return avg(starters)*0.88+avg(depth)*0.12;
}
function rankMap(rows,key){
 const sorted=[...rows].sort((a,b)=>b[key]-a[key]);
 const m={};sorted.forEach((r,i)=>m[r.team]=i+1);return m;
}
function normalizeScores(rows,key){
 const vals=rows.map(r=>r[key]),min=Math.min(...vals),max=Math.max(...vals);
 rows.forEach(r=>r[key+'_100']=max===min?50:50+50*(r[key]-min)/(max-min));
}

export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 try{
  const {context}=req.body||{};
  if(!context?.league_teams?.length)return res.status(400).json({error:'League context missing'});
  const slots=context.league?.roster_positions||[];
  const allPlayers=[];
  const seen=new Set();
  for(const t of context.league_teams){
   for(const p of t.players||[]){
    const key=(p.id||p.name)+'|'+p.position;
    if(seen.has(key))continue;seen.add(key);
    allPlayers.push({id:p.id||null,name:p.name,position:p.position,team:p.team||null,injury_status:p.injury_status||null})
   }
  }

  const instructions=[
   'You are a fantasy-football valuation researcher for the 2026 NFL season.',
   'Use live web search and current reputable sources.',
   'Return ONLY valid JSON. No markdown. No prose outside JSON.',
   'Value every supplied player twice: WEEKLY for the current NFL week and ROS for rest of season.',
   'Values are league-relative 0-100 player values, NOT team rankings.',
   'Base WEEKLY on current role, injury status, matchup, projected opportunity, expected fantasy points, and this exact league scoring.',
   'Base ROS on role security, talent, volume, team context, injury risk, schedule outlook, and rest-of-season expert consensus.',
   'Do not inflate values to match ESPN or the user. Accuracy over agreement.',
   'Use multiple sources when possible. If sources disagree or role is uncertain, lower confidence.',
   'QB value must reflect the exact number of QB/Superflex starting slots in the supplied league.',
   'Use this compact schema exactly: {"players":[{"name":"exact input name","weekly":number,"ros":number,"weekly_confidence":number,"ros_confidence":number}]}.',
   'Include every supplied player exactly once.'
  ].join('\n');

  function extractJson(text){
   const cleaned=cleanJson(text);
   try{return JSON.parse(cleaned)}catch{}
   const first=cleaned.indexOf('{'),last=cleaned.lastIndexOf('}');
   if(first>=0&&last>first){
    try{return JSON.parse(cleaned.slice(first,last+1))}catch{}
   }
   return null;
  }

  async function valueBatch(batch,batchNo,totalBatches){
   const rr=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
    body:JSON.stringify({
     model:'gpt-5.6-luna',
     reasoning:{effort:'medium'},
     tools:[{type:'web_search',search_context_size:'medium'}],
     instructions,
     input:
      'CURRENT WEEK: '+context.current_week+
      '\nBATCH: '+batchNo+' of '+totalBatches+
      '\nLEAGUE SETTINGS:\n'+JSON.stringify({
       roster_positions:context.league?.roster_positions,
       scoring_settings:context.league?.scoring_settings,
       scoring_summary:context.league?.scoring_summary
      })+
      '\nPLAYERS:\n'+JSON.stringify(batch),
     max_output_tokens:3200
    })
   });
   const d=await rr.json();
   if(!rr.ok)throw new Error(d?.error?.message||'OpenAI valuation failed');
   let text=d.output_text||'';
   if(!text&&Array.isArray(d.output))text=d.output.flatMap(x=>x.content||[]).map(x=>x.text||'').filter(Boolean).join('\n');
   const parsed=extractJson(text);
   if(!parsed?.players?.length)throw new Error('Valuation batch '+batchNo+' returned invalid JSON');
   return parsed.players;
  }

  // A full 12-team league can contain ~200 players. One giant JSON response
  // can be truncated, so value players in smaller deterministic batches.
  const batchSize=36;
  const batches=[];
  for(let i=0;i<allPlayers.length;i+=batchSize)batches.push(allPlayers.slice(i,i+batchSize));

  const valuedPlayers=[];
  // Run two batches at a time to control API cost/rate pressure while avoiding timeouts.
  for(let i=0;i<batches.length;i+=2){
   const group=batches.slice(i,i+2);
   const results=await Promise.all(group.map((b,j)=>valueBatch(b,i+j+1,batches.length)));
   for(const arr of results)valuedPlayers.push(...arr);
  }

  const byName=new Map(valuedPlayers.map(x=>[x.name,x]));

  const counts=slotCounts(slots);
  const teamRows=context.league_teams.map(t=>{
   const ps=(t.players||[]).map(p=>({...p,...(byName.get(p.name)||{weekly:0,ros:0,weekly_confidence:25,ros_confidence:25})}));
   const wOpt=optimize(ps,slots,'weekly'),rOpt=optimize(ps,slots,'ros');
   const benchW=ps.filter(p=>!wOpt.some(x=>x.player.name===p.name)).map(p=>Number(p.weekly||0)).sort((a,b)=>b-a).slice(0,4);
   const benchR=ps.filter(p=>!rOpt.some(x=>x.player.name===p.name)).map(p=>Number(p.ros||0)).sort((a,b)=>b-a).slice(0,4);
   const qbc=Math.max(1,(counts.QB||0)+(counts.SUPER_FLEX||0));
   return{
    team:t.team,
    weekly_qb:positionScore(ps,'QB','weekly',qbc),
    weekly_rb:positionScore(ps,'RB','weekly',counts.RB||1),
    weekly_wr:positionScore(ps,'WR','weekly',counts.WR||1),
    weekly_te:positionScore(ps,'TE','weekly',counts.TE||1),
    ros_qb:positionScore(ps,'QB','ros',qbc),
    ros_rb:positionScore(ps,'RB','ros',counts.RB||1),
    ros_wr:positionScore(ps,'WR','ros',counts.WR||1),
    ros_te:positionScore(ps,'TE','ros',counts.TE||1),
    weekly_starters:avg(wOpt.map(x=>x.value)),
    ros_starters:avg(rOpt.map(x=>x.value)),
    weekly_depth:avg(benchW),
    ros_depth:avg(benchR),
    weekly_conf:avg(ps.map(p=>Number(p.weekly_confidence||50))),
    ros_conf:avg(ps.map(p=>Number(p.ros_confidence||50)))
   }
  });
  for(const r of teamRows){
   r.weekly_total=r.weekly_starters*0.82+r.weekly_depth*0.18;
   r.ros_total=r.ros_starters*0.72+r.ros_depth*0.28;
  }
  normalizeScores(teamRows,'weekly_total'); normalizeScores(teamRows,'ros_total');

  const build=layer=>{
   const pre=layer==='weekly'?'weekly':'ros';
   const ranks={
    qb:rankMap(teamRows,pre+'_qb'),rb:rankMap(teamRows,pre+'_rb'),wr:rankMap(teamRows,pre+'_wr'),
    te:rankMap(teamRows,pre+'_te'),starters:rankMap(teamRows,pre+'_starters'),overall:rankMap(teamRows,pre+'_total')
   };
   const sorted=[...teamRows].sort((a,b)=>b[pre+'_total']-a[pre+'_total']);
   const my=context.my_team.team;
   return{
    my_ranks:{qb:ranks.qb[my],rb:ranks.rb[my],wr:ranks.wr[my],te:ranks.te[my],starters:ranks.starters[my],overall:ranks.overall[my]},
    power_rankings:sorted.map(r=>({
     team:r.team,
     score:Math.round(r[pre+'_total_100']*10)/10,
     confidence:Math.round(r[pre+'_conf']),
     note:(layer==='weekly'
      ?'Weekly starters '+r.weekly_starters.toFixed(1)+'; depth '+r.weekly_depth.toFixed(1)
      :'ROS starters '+r.ros_starters.toFixed(1)+'; depth '+r.ros_depth.toFixed(1))
    }))
   }
  };
  return res.json({weekly:build('weekly'),ros:build('ros'),method:'Research player values first; deterministic roster math second.'});
 }catch(e){res.status(500).json({error:e.message})}
}