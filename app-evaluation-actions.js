// Evaluation Lab actions — on-demand checks for beginner-facing cards.
(function(){
  if(window.__fgEvalActionsLoaded)return;
  window.__fgEvalActionsLoaded=true;

  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const escLocal=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function liveAnalysis(){
    try{return (typeof analysis!=='undefined'&&analysis)?analysis:(window.analysis||null)}catch{return window.analysis||null}
  }

  function rosteredPlayers(){
    const a=liveAnalysis();
    const out=[],seen=new Set();
    for(const t of a?.team_details||[])for(const p of t.players||[]){
      const k=String(p?.canonical_player_id||p?.sleeper_id||p?.espn_id||p?.id||`${p?.name}|${p?.position}`);
      if(!seen.has(k)){seen.add(k);out.push(p)}
    }
    return out;
  }

  function allPlayers(){
    const a=liveAnalysis();
    const out=rosteredPlayers(),seen=new Set(out.map(p=>String(p?.canonical_player_id||p?.sleeper_id||p?.espn_id||p?.id||`${p?.name}|${p?.position}`)));
    for(const p of a?.waiver_pool||[]){
      const k=String(p?.canonical_player_id||p?.sleeper_id||p?.espn_id||p?.id||`${p?.name}|${p?.position}`);
      if(!seen.has(k)){seen.add(k);out.push(p)}
    }
    return out;
  }

  function accuracyResult(){
    const players=rosteredPlayers();
    const rows=players.filter(p=>finite(p.actual_weekly_points)&&finite(p.weekly_points));
    if(!rows.length)return{tone:'watch',text:'Check complete: no completed player results are available yet. Guru has nothing fair to grade right now, so check again after games finish.'};
    const mae=rows.reduce((s,p)=>s+Math.abs(Number(p.weekly_points)-Number(p.actual_weekly_points)),0)/rows.length;
    const enough=rows.length>=25;
    return{tone:enough?'good':'watch',text:`Check complete: Guru graded ${rows.length} player${rows.length===1?'':'s'} from the latest loaded results. Its current average miss is ${mae.toFixed(2)} fantasy points per player. ${enough?'That is enough data to start treating the accuracy result as meaningful.':'We still want at least 25 graded players before drawing strong conclusions.'}`};
  }

  function rookieResult(){
    const players=allPlayers();
    const rookies=players.filter(p=>p?.rookie===true||p?.is_rookie===true||Number(p?.years_exp)===0||Number(p?.experience)===0);
    if(!rookies.length)return{tone:'watch',text:'Check complete: the current league/player feed does not reliably identify rookies, so Guru will not guess who is a rookie. Rookie players can still receive TV from projections and market data; we just cannot audit rookies as a separate group yet.'};
    const valued=rookies.filter(p=>finite(p.trade_value)).length;
    const market=rookies.filter(p=>finite(p.market_value)).length;
    const missing=rookies.length-valued;
    return{tone:missing?'watch':'good',text:`Check complete: Guru identified ${rookies.length} rookies. ${valued} have a Trade Value and ${market} have FantasyCalc market data.${missing?` ${missing} rookie${missing===1?' is':'s are'} missing enough forward-looking evidence for a TV.`:' Every identified rookie has a usable Trade Value.'}`};
  }

  function marketResult(){
    const m=liveAnalysis()?.market||{};
    if(m.available===false)return{tone:'problem',text:'Check complete: FantasyCalc is unavailable right now. Guru is protecting the model by using conservative market fallbacks instead of making the other inputs count more.'};
    const total=Number(m.total_players_enriched||0),matched=Number(m.matched_players||0),coverage=Number(m.coverage_pct||0),rows=Number(m.rows_received||0);
    if(!total)return{tone:'watch',text:'Check complete: market data is connected, but there is not enough matching information loaded to judge coverage yet.'};
    const tone=coverage>=70?'good':coverage>=45?'watch':'problem';
    const grade=coverage>=70?'healthy':coverage>=45?'usable but incomplete':'too limited';
    return{tone,text:`Check complete: FantasyCalc returned ${rows} market rows and Guru matched ${matched} of ${total} players (${coverage}% coverage). Market coverage looks ${grade}. Players without a market match keep a conservative fallback rather than getting an inflated score.`};
  }

  function resultBox(card,id,result){
    let box=card.querySelector(`[data-eval-result="${id}"]`);
    if(!box){box=document.createElement('div');box.dataset.evalResult=id;box.className='fgEvalCheckResult';card.appendChild(box)}
    box.className=`fgEvalCheckResult ${result.tone||'watch'}`;
    box.innerHTML=escLocal(result.text);
  }

  function injectButtons(){
    const cards=document.querySelectorAll('.fgEvalCards > .card');
    if(cards.length<3)return;
    const defs=[
      ['accuracy','Run Accuracy Check',accuracyResult],
      ['rookie','Run Rookie Value Check',rookieResult],
      ['market','Run Market Data Check',marketResult]
    ];
    cards.forEach((card,i)=>{
      const [id,label]=defs[i]||[];
      if(!id||card.querySelector(`[data-eval-check="${id}"]`))return;
      const btn=document.createElement('button');
      btn.type='button';btn.className='fgEvalCheckBtn';btn.dataset.evalCheck=id;btn.textContent=label;
      card.appendChild(btn);
    });
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-eval-check]');
    if(!btn)return;
    const id=btn.dataset.evalCheck,card=btn.closest('.card');
    if(!card)return;
    const fn=id==='accuracy'?accuracyResult:id==='rookie'?rookieResult:id==='market'?marketResult:null;
    if(!fn)return;
    btn.disabled=true;const old=btn.textContent;btn.textContent='Checking…';
    try{resultBox(card,id,fn())}catch(err){resultBox(card,id,{tone:'problem',text:`Check could not finish: ${err?.message||'unknown error'}`})}
    finally{btn.disabled=false;btn.textContent=old}
  });

  const previousShowView=window.showView;
  if(typeof previousShowView==='function')window.showView=function(v){const r=previousShowView(v);if(v==='evalLab')setTimeout(injectButtons,0);return r};
  try{if(typeof currentView!=='undefined'&&currentView==='evalLab')setTimeout(injectButtons,0)}catch{}

  const style=document.createElement('style');
  style.textContent=`.fgEvalCheckBtn{margin-top:10px;border:1px solid #2685b8;background:#0c6fa4;color:#fff;border-radius:8px;padding:8px 11px;font-size:11px;font-weight:900;cursor:pointer}.fgEvalCheckBtn:hover{filter:brightness(1.08)}.fgEvalCheckBtn:disabled{opacity:.65;cursor:wait}.fgEvalCheckResult{margin-top:9px;border-radius:8px;padding:9px 10px;font-size:11px;line-height:1.4;border:1px solid #36526c;background:#0a1828;color:#dcecff}.fgEvalCheckResult.good{border-color:#1f7a5b;background:#0a201a}.fgEvalCheckResult.watch{border-color:#9b750d;background:#211b08}.fgEvalCheckResult.problem{border-color:#a53645;background:#291016}`;
  document.head.appendChild(style);
})();