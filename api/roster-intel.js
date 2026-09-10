export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{
    const {context}=req.body||{};
    const roster=context?.my_team?.players||[];
    if(!roster.length)return res.status(400).json({error:'Roster missing'});
    const playerList=roster.map(p=>({name:p.name,position:p.position,team:p.team||null,injury_status:p.injury_status||null}));
    const instructions=[
      'You are Fantasy Guru roster intel.',
      'Return STRICT JSON only, no markdown and no commentary outside the JSON.',
      'Use the supplied platform injury_status as authoritative for the displayed injury designation unless it is blank.',
      'Use web search to find only material fantasy-relevant news from roughly the last 7 days for each player: injury changes, depth-chart movement, suspension/availability, role changes, trades, major coach comments, or notable workload news.',
      'Do not pad the answer. If there is no material recent update, use exactly: No material recent update found.',
      'Do not invent dates, injuries, roles, or rumors.',
      'Keep each news field to one concise sentence, max 28 words.',
      'Return this exact shape: {"players":[{"name":"...","position":"...","injury_status":"ACTIVE or supplied designation","news":"..."}],"generated_at":"ISO timestamp"}.',
      'Include every supplied roster player exactly once and preserve the supplied player names.'
    ].join('\n');
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
      body:JSON.stringify({
        model:'gpt-5.6-luna',
        reasoning:{effort:'low'},
        tools:[{type:'web_search',search_context_size:'medium'}],
        instructions,
        input:'CURRENT DATE: '+new Date().toISOString()+'\nROSTER:\n'+JSON.stringify(playerList),
        max_output_tokens:2600
      })
    });
    const d=await r.json();
    if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'OpenAI failed'});
    let text=d.output_text||'';
    if(!text&&Array.isArray(d.output))text=d.output.flatMap(x=>x.content||[]).map(x=>x.text||'').filter(Boolean).join('\n');
    text=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    let parsed;try{parsed=JSON.parse(text)}catch{return res.status(502).json({error:'Roster intel returned invalid JSON'})}
    const byName=new Map((parsed.players||[]).map(x=>[String(x.name||'').toLowerCase(),x]));
    const players=roster.map(p=>{const hit=byName.get(String(p.name||'').toLowerCase())||{};return{name:p.name,position:p.position||hit.position||'',injury_status:p.injury_status||hit.injury_status||'ACTIVE',news:hit.news||'No material recent update found.'}});
    return res.json({players,generated_at:new Date().toISOString()});
  }catch(e){return res.status(500).json({error:e.message})}
}
