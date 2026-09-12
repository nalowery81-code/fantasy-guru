export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{
    const {context}=req.body||{};
    const roster=context?.my_team?.players||[];
    if(!roster.length)return res.status(400).json({error:'Roster missing'});
    const now=new Date();
    const today=now.toISOString().slice(0,10);
    const playerList=roster.map(p=>({name:p.name,position:p.position,team:p.team||null,injury_status:p.injury_status||null}));
    const instructions=[
      'You are Fantasy Guru roster intel.',
      'Return STRICT JSON only, no markdown and no commentary outside the JSON.',
      'Use the supplied platform injury_status as authoritative for the displayed injury designation unless it is blank.',
      'Research every supplied player with current public web information. Prefer official team/NFL reporting and reputable fantasy or beat-reporting sources.',
      'For each player, first look for material fantasy-relevant news from roughly the last 30 days: injury changes, depth-chart movement, suspension/availability, role changes, trades, coach comments, workload, target/share changes, or notable usage.',
      'If meaningful recent news exists, set intel_type to RECENT NEWS and summarize it in intel.',
      'If no meaningful recent news exists, still provide useful CURRENT OUTLOOK using reliable current context such as expected role, depth-chart position, workload profile, competition for touches/targets, handcuff value, or likely fantasy utility.',
      'For RECENT NEWS, intel_date must be the date of the specific update/event/source you are summarizing when that date can be established.',
      'For CURRENT OUTLOOK, intel_date should be the date the current role/outlook was verified; use the current date when the source is current but no more specific dated event applies.',
      'intel_date must be YYYY-MM-DD. Never invent an older event date. If a reliable specific date cannot be established, use '+today+'.',
      'Do not pretend old information is recent news. CURRENT OUTLOOK may use broader current-season context when necessary.',
      'Do not invent injuries, roles, rumors, usage, or quotes. If reliable context truly cannot be established, use intel_type CURRENT OUTLOOK and say Reliable current role context was not found.',
      'Keep each intel field concise but useful, maximum 34 words.',
      'IMPORTANT: intel must contain plain prose only. Do not put URLs, markdown links, citations, source domains, parentheses containing links, or utm parameters inside intel.',
      'Return this exact shape: {"players":[{"name":"...","position":"...","injury_status":"ACTIVE or supplied designation","intel_type":"RECENT NEWS or CURRENT OUTLOOK","intel":"...","intel_date":"YYYY-MM-DD"}],"generated_at":"ISO timestamp"}.',
      'Include every supplied roster player exactly once and preserve the supplied player names.'
    ].join('\n');
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
      body:JSON.stringify({
        model:'gpt-5.6-luna',
        reasoning:{effort:'medium'},
        tools:[{type:'web_search',search_context_size:'high'}],
        instructions,
        input:'CURRENT DATE: '+now.toISOString()+'\nROSTER TO RESEARCH:\n'+JSON.stringify(playerList),
        max_output_tokens:4600
      })
    });
    const d=await r.json();
    if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'OpenAI failed'});
    let text=d.output_text||'';
    if(!text&&Array.isArray(d.output))text=d.output.flatMap(x=>x.content||[]).map(x=>x.text||'').filter(Boolean).join('\n');
    text=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    let parsed;try{parsed=JSON.parse(text)}catch{return res.status(502).json({error:'Roster intel returned invalid JSON'})}
    const cleanIntel=s=>String(s||'')
      .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi,'$1')
      .replace(/\(\[?[^\])]{1,80}\]?\]\(https?:\/\/[^)]+\)\)/gi,'')
      .replace(/\(https?:\/\/[^)]+\)/gi,'')
      .replace(/https?:\/\/\S+/gi,'')
      .replace(/\(\s*\)/g,'')
      .replace(/\s{2,}/g,' ')
      .trim();
    const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))?String(s):today;
    const byName=new Map((parsed.players||[]).map(x=>[String(x.name||'').toLowerCase(),x]));
    const players=roster.map(p=>{const hit=byName.get(String(p.name||'').toLowerCase())||{},intel=cleanIntel(hit.intel||hit.news||'Reliable current role context was not found.');return{name:p.name,position:p.position||hit.position||'',injury_status:p.injury_status||hit.injury_status||'ACTIVE',intel_type:hit.intel_type==='RECENT NEWS'?'RECENT NEWS':'CURRENT OUTLOOK',intel:intel||'Reliable current role context was not found.',intel_date:validDate(hit.intel_date)}});
    return res.json({players,generated_at:now.toISOString()});
  }catch(e){return res.status(500).json({error:e.message})}
}
