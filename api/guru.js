export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 try{
  const {question,context,analysis}=req.body||{};
  const slots=context?.league?.roster_positions||[];
  const qb=slots.filter(x=>x==='QB').length,sf=slots.filter(x=>x==='SUPER_FLEX').length;
  const format='Imported lineup slots: '+JSON.stringify(slots)+'. '+(qb===1&&sf===0?'This is a 1-QB league. Do not materially reward backup QB depth.':'Value QB depth according to these slots.');
  const instructions=[
   'You are Fantasy Guru, a conservative 2026 fantasy football co-manager.',
   format,
   'Use supplied league data as authoritative for rules, rosters, starters and verified availability.',
   'When analysis is supplied, treat its Weekly and ROS rankings as the deterministic scoring layer. Explain them; do not overwrite them with a different invented ranking.',
   'Use live web search for current value, injuries, roles, matchup, and outlook.',
   'Separate WEEKLY advice from REST-OF-SEASON advice whenever that distinction matters.',
   'HOLD is valid. Do not manufacture activity.',
   'Waiver adds must beat the exact drop after accounting for starter value, depth, handcuff value, upside stash value and injury insurance.',
   'Trades must improve expected roster value after scarcity, replacement cost, starting-lineup impact, and roster fit.',
   'Accuracy is more important than agreeing with ESPN rankings or with the user.',
   'Output clean plain text only with short headings and bullet character • only. No markdown symbols, raw URLs, or tables.'
  ].join('\n');
  const r=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
   body:JSON.stringify({
    model:'gpt-5.6-luna',
    reasoning:{effort:'medium'},
    tools:[{type:'web_search',search_context_size:'high'}],
    instructions,
    input:'QUESTION:\n'+question+'\n\nLEAGUE:\n'+JSON.stringify(context)+'\n\nDETERMINISTIC ANALYSIS:\n'+JSON.stringify(analysis||null),
    max_output_tokens:3500
   })
  });
  const d=await r.json();if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'OpenAI failed'});
  let a=d.output_text||'';if(!a&&Array.isArray(d.output))a=d.output.flatMap(x=>x.content||[]).map(x=>x.text||'').filter(Boolean).join('\n');
  a=a.replace(/\*\*/g,'').replace(/#{1,6}\s*/g,'').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'$1').replace(/https?:\/\/\S+/g,'').trim();
  let sources=[],seen=new Set(),walk=x=>{if(!x)return;if(Array.isArray(x))return x.forEach(walk);if(typeof x==='object'){if(typeof x.url==='string'&&/^https?:\/\//.test(x.url)&&!seen.has(x.url)){seen.add(x.url);sources.push({url:x.url,title:x.title||'Source'})}Object.values(x).forEach(walk)}};walk(d.output);
  res.json({answer:a,sources:sources.slice(0,10)})
 }catch(e){res.status(500).json({error:e.message})}
}