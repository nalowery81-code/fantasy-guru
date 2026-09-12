export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 try{
  const {question,context,analysis,history}=req.body||{};
  const slots=context?.league?.roster_positions||[];
  const qb=slots.filter(x=>x==='QB').length,sf=slots.filter(x=>x==='SUPER_FLEX').length;
  const format='Imported lineup slots: '+JSON.stringify(slots)+'. '+(qb===1&&sf===0?'This is a 1-QB league. Do not materially reward backup QB depth.':'Value QB depth according to these slots.');
  const instructions=[
   'You are Fantasy Guru, a conservative 2026 fantasy football co-manager.',
   format,
   'Use supplied league data as authoritative for rules, rosters, starters and verified availability.',
   'When analysis is supplied, treat its Weekly and ROS rankings as the deterministic scoring layer. Explain them; do not overwrite them with a different invented ranking.',
   'Projection truth comes from three independent pillars when available: direct ESPN, direct Sleeper, and the independent ffanalytics crowd consensus. Do not double-count any source.',
   'Use weekly_confidence, ros_confidence and source-spread fields when judging how certain a recommendation is. High disagreement means lower confidence even when the average projection looks attractive.',
   'Use FantasyCalc only as market intelligence: market value, overall/position rank and 30-day trend. Never substitute FantasyCalc market value for projected fantasy production.',
   'Use Sleeper add/drop momentum as behavioral evidence. Rising adds can support an emerging-player or waiver-watch conclusion, but must not override weak projections, poor roster fit or verified availability.',
   'When analysis.opportunities contains BUY_LOW, SELL_HIGH or TRENDING signals, explain the underlying projection-vs-market or add/drop mismatch instead of merely repeating the label.',
   'Use live web search only for information that is missing or time-sensitive, especially injuries, roles, matchups and outlook. Prefer supplied deterministic evidence over re-researching numbers already provided.',
   'Separate WEEKLY advice from REST-OF-SEASON advice whenever that distinction matters.',
   'HOLD is valid. Do not manufacture activity.',
   'Waiver adds must beat the exact drop after accounting for starter value, depth, handcuff value, upside stash value and injury insurance.',
   'Trades must improve expected roster value after scarcity, replacement cost, starting-lineup impact, and roster fit.',
   'Accuracy is more important than agreeing with ESPN rankings or with the user.',
   'Treat the supplied conversation history as context so short replies such as yes, no, compare them, or what about him continue the same topic naturally.',
   'After answering, ask exactly ONE useful context-aware follow-up question that naturally advances the current fantasy decision. Do not ask a generic question if a specific next step is obvious.',
   'End every response with exactly one final line in this format: FOLLOW_UP_QUESTION: <one concise question>.',
   'Do not include FOLLOW_UP_QUESTION anywhere else in the answer.',
   'Output clean plain text only with short headings and bullet character • only. No markdown symbols, raw URLs, or tables.'
  ].join('\n');
  const recent=Array.isArray(history)?history.slice(-8).map(x=>({role:x?.role==='assistant'?'assistant':'user',content:String(x?.content||'').slice(0,5000)})):[];
  const transcript=recent.length?recent.map(x=>(x.role==='assistant'?'GURU':'USER')+': '+x.content).join('\n\n'):'No prior conversation.';
  const r=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
   body:JSON.stringify({
    model:'gpt-5.6-luna',
    reasoning:{effort:'medium'},
    tools:[{type:'web_search',search_context_size:'high'}],
    instructions,
    input:'CONVERSATION SO FAR:\n'+transcript+'\n\nCURRENT QUESTION:\n'+question+'\n\nLEAGUE:\n'+JSON.stringify(context)+'\n\nDETERMINISTIC ANALYSIS:\n'+JSON.stringify(analysis||null),
    max_output_tokens:3500
   })
  });
  const d=await r.json();if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'OpenAI failed'});
  let raw=d.output_text||'';if(!raw&&Array.isArray(d.output))raw=d.output.flatMap(x=>x.content||[]).map(x=>x.text||'').filter(Boolean).join('\n');
  let follow='';const marker='FOLLOW_UP_QUESTION:';const mi=raw.lastIndexOf(marker);if(mi>=0){follow=raw.slice(mi+marker.length).trim().split('\n')[0].trim();raw=raw.slice(0,mi).trim()}
  let a=raw.replace(/\*\*/g,'').replace(/#{1,6}\s*/g,'').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'$1').replace(/https?:\/\/\S+/g,'').trim();
  if(!follow)follow='Want me to compare the next-best option for this decision?';
  let sources=[],seen=new Set(),walk=x=>{if(!x)return;if(Array.isArray(x))return x.forEach(walk);if(typeof x==='object'){if(typeof x.url==='string'&&/^https?:\/\//.test(x.url)&&!seen.has(x.url)){seen.add(x.url);sources.push({url:x.url,title:x.title||'Source'})}Object.values(x).forEach(walk)}};walk(d.output);
  res.json({answer:a,follow_up_question:follow,sources:sources.slice(0,10)})
 }catch(e){res.status(500).json({error:e.message})}
}