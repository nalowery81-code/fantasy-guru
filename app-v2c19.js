/* Compare-player verdict guardrails. Keeps deterministic roster impact from being mislabeled. */
(function(){
  function numFrom(text){const m=String(text||'').replace(/,/g,'').match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null}
  function verdictFor(wg,rg,rv){
    if(![wg,rg,rv].every(Number.isFinite))return null;
    // Large roster-value loss cannot be called an upgrade without a meaningful lineup gain.
    if(rv<=-20 && wg<1.5 && rg<0.5)return 'DOWNGRADE';
    if(wg<-2 || rg<-1)return 'DOWNGRADE';
    if((wg>=1.5 || rg>=0.5) && rv>=-10)return 'UPGRADE';
    if((wg>0.25 || rg>0.25) && rv>=-5)return 'SLIGHT UPGRADE';
    return 'HOLD';
  }
  function applyCompareGuardrail(root=document){
    root.querySelectorAll('.fg17CompareResult').forEach(box=>{
      const metrics=[...box.querySelectorAll('.fg17CompareMetrics>div')];
      const get=label=>{const x=metrics.find(d=>String(d.querySelector('span')?.textContent||'').trim().toLowerCase()===label);return x?numFrom(x.querySelector('b')?.textContent):null};
      const wg=get('weekly lineup'),rg=get('ros lineup'),rv=get('total ros value'),v=verdictFor(wg,rg,rv),badge=box.querySelector('.fg17CompareVerdict');
      if(!v||!badge)return;
      badge.textContent=v;badge.classList.toggle('good',v==='UPGRADE'||v==='SLIGHT UPGRADE');badge.classList.toggle('bad',v==='DOWNGRADE');
      let why=box.querySelector('.fg19Why');
      if(!why){why=document.createElement('div');why.className='fg19Why';const note=box.querySelector('.fg17CompareNote');(note||box).insertAdjacentElement(note?'beforebegin':'beforeend',why)}
      if(v==='DOWNGRADE'&&rv<=-20&&wg<1.5&&rg<0.5)why.textContent=`Why: this move gives up ${Math.abs(rv).toFixed(1)} ROS roster points without creating a meaningful weekly or ROS starting-lineup gain.`;
      else if(v==='HOLD')why.textContent='Why: the projected lineup benefit is too small to justify the roster-value tradeoff.';
      else if(v==='UPGRADE'||v==='SLIGHT UPGRADE')why.textContent='Why: the move improves the optimized lineup while keeping the roster-value cost within the allowed range.';
      else why.textContent='';
    })
  }
  const style=document.createElement('style');style.textContent='.fg19Why{margin:8px 0 2px;padding:8px 10px;border:1px solid #28405d;border-radius:8px;background:#091827;color:#b9cbe0;font-size:10px;line-height:1.4}';document.head.appendChild(style);
  const obs=new MutationObserver(()=>requestAnimationFrame(()=>applyCompareGuardrail()));obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  document.addEventListener('change',e=>{if(e.target?.id==='fg17Drop'||e.target?.id==='fg17Add')setTimeout(()=>applyCompareGuardrail(),0)});
  setTimeout(()=>applyCompareGuardrail(),0);
})();
