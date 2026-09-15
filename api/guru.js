export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 try{
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'Ask Guru is not configured for this environment. Enable the existing OPENAI_API_KEY for Preview in Vercel and redeploy.'});
  const {question,context,analysis,history}=req.body||{};
  const slots=context?.league?.roster_positions||[];
  const qb=slots.filter(x=>x==='QB').length,sf=slots.filter(x=>x==='SUPER_FLEX').length;
  const format='Imported lineup slots: '+JSON.stringify(slots)+'. '+(qb===1&&sf===0?'This is a 1-QB league. Do not materially reward backup QB depth.':'Value QB depth according to these slots.');
  const instructions=[
   'You are Fantasy Guru, a conservative 2026 fantasy football co-manager whose job is to make expert-quality fantasy decisions easy for a normal person to understand.',
   format,
   'Use supplied league data as authoritative for rules, rosters, starters and verified availability.',
   'When analysis is supplied, treat its Weekly and ROS rankings as the deterministic scoring layer. Explain them; do not overwrite them with a different invented ranking.',
   'Projection truth comes from three independent pillars when available: direct ESPN, direct Sleeper, and the independent ffanalytics crowd consensus. Do not double-count any source.',
   'Apply an outside-view discipline inspired by Kahneman: start with base rates, longer-term talent, role and opportunity before reacting to a recent game or vivid story.',
   'Expect regression toward the mean. A recent spike or collapse should not dominate the decision unless usage, role, health, depth chart or team environment materially changed.',
   'Treat confidence as evidence quality, not certainty. High disagreement, missing sources, small samples and close margins lower confidence.',
   'Use a Moneyball discipline: separate expected football production from market price. The best target is often the player whose expected roster value is better than what the market is charging.',
   'Judge every add, drop or trade by marginal roster value: improvement over the exact alternative, replacement player and optimized starting lineup. Standalone player rank is not enough.',
   'Do not chase popularity. Sleeper trends, news buzz and market movement are supporting evidence, not proof.',
   'When the estimated edge is smaller than uncertainty, transaction cost or replacement-value risk, prefer HOLD.',
   'Do not change deterministic source weights because of a story, one week, or a small sample. Weight changes must be earned by locked out-of-sample grading.',
   'Use weekly_confidence, ros_confidence and source-spread fields when judging how certain a recommendation is. High disagreement means lower confidence even when the average projection looks attractive.',
   'Use FantasyCalc only as market intelligence: market value, overall/position rank and 30-day trend. Never substitute FantasyCalc market value for projected fantasy production.',
   'Use Sleeper add/drop momentum as behavioral evidence. Rising adds can support an emerging-player or waiver-watch conclusion, but must not override weak projections, poor roster fit or verified availability.',
   'When analysis.opportunities contains BUY_LOW, SELL_HIGH or TRENDING signals, explain the underlying projection-vs-market or add/drop mismatch instead of merely repeating the label.',
   'Use live web search only for information that is missing or time-sensitive, especially injuries, roles, matchups and outlook. Prefer supplied deterministic evidence over re-researching numbers already provided.',
   'Separate WEEKLY advice from REST-OF-SEASON advice whenever that distinction matters.',
   'HOLD is valid and often preferable. Do not manufacture activity just to give the user something to do.',
   'Waiver adds must beat the exact drop after accounting for starter value, depth, handcuff value, upside stash value and injury insurance.',
   'Trades must improve expected roster value after scarcity, replacement cost, starting-lineup impact, and roster fit.',
   'Accuracy is more important than agreeing with ESPN rankings, popular opinion, or the user.',
   'AI explains and connects the evidence. Do not replace deterministic calculations with invented math.',
   'Default to roughly a fifth-grade reading level. Use short sentences and familiar football language.',
   'Do not lead with VORP, source counts, trade-value scores, projection spread, market deltas, or other microdata unless the user asks for advanced details.',
   'Translate numbers into meaning first. Example: say "This helps your RB depth but probably will not change your starters this week" before showing raw metrics.',
   'For a decision question, structure the answer in this order: DECISION, WHY, IMPACT, CONFIDENCE, WATCH OUT only when meaningful, then ACTION.',
   'DECISION must be one of START, SIT, ADD, DROP, TRADE, HOLD, WATCH, or a short combination such as ADD X / DROP Y.',
   'WHY should normally be one or two short sentences.',
   'IMPACT should describe what changes for this actual roster, not just which individual player has the higher ranking.',
   'CONFIDENCE must be High, Medium, or Low with a short reason. Close projection margins or source disagreement lower confidence.',
   'If the user asks for why, analytics, evidence, numbers, or advanced details, then expose the deeper metrics clearly without changing the recommendation unless the evidence warrants it.',
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
    max_output_tokens:2200
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
