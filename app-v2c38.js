/* Commit 2: Guru Today — one plain-English summary of the actions that matter now. */
(function(){
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const F=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

  function lineupSignal(){
    try{
      if(typeof ssDecisions!=='function')return {level:'watch',icon:'🟡',label:'Lineup',text:'Lineup check is still loading.'};
      const d=ssDecisions()||{},changes=d.changes||[];
      if(changes.length){
        const x=changes[0],edge=F(x?.diff)?Number(x.diff):null;
        return {level:'act',icon:'🔴',label:'Lineup',text:`Start ${x.start?.name||'the recommended player'} over ${x.sit?.name||'your current starter'}${edge!=null?` (${edge>=0?'+':''}${edge.toFixed(1)} projected pts)`:''}.`,view:'startsit'};
      }
      return {level:'good',icon:'🟢',label:'Lineup',text:'Your current starters already match Guru’s preferred lineup.',view:'startsit'};
    }catch{return {level:'watch',icon:'🟡',label:'Lineup',text:'Lineup recommendation is temporarily unavailable.'}}
  }

  function waiverSignal(){
    try{
      const strict=typeof storedWaiverIdeas==='function'?(storedWaiverIdeas()||[]):[];
      const x=strict[0];
      if(x?.add){
        const drop=x.drop?.name?` for ${x.drop.name}`:'';
        return {level:'act',icon:'🔴',label:'Waivers',text:`Add ${x.add.name}${drop}. This move clears Guru’s recommendation bar.`,view:'waivers'};
      }
      return {level:'good',icon:'🟢',label:'Waivers',text:'No verified available player clearly improves your roster right now.',view:'waivers'};
    }catch{return {level:'watch',icon:'🟡',label:'Waivers',text:'Waiver recommendation is temporarily unavailable.'}}
  }

  function tradeSignal(){
    try{
      const strict=typeof tradeIdeas==='function'?(tradeIdeas()||[]):[];
      const radar=typeof tradeRadar==='function'?(tradeRadar()||[]):[];
      const x=strict[0]||radar[0];
      if(x?.get?.[0]){
        const p=x.get[0],partner=x.partner?` with ${x.partner}`:'';
        return {level:'watch',icon:'🟡',label:'Trades',text:`${strict[0]?'A value-protected trade path':'One trade target'} is worth exploring${partner}: ${p.name}. No need to force it.`,view:'trades'};
      }
      return {level:'good',icon:'🟢',label:'Trades',text:'No trade currently improves your roster enough to recommend action.',view:'trades'};
    }catch{return {level:'watch',icon:'🟡',label:'Trades',text:'Trade recommendation is temporarily unavailable.'}}
  }

  function injurySignal(){
    try{
      const m=typeof mineTeam==='function'?mineTeam():null,players=m?.players||[];
      const flagged=players.filter(p=>p?.starter&&p?.injury_status&&String(p.injury_status).toLowerCase()!=='healthy');
      if(flagged.length){
        const p=flagged[0],more=flagged.length>1?` +${flagged.length-1} more`:'';
        return {level:'watch',icon:'🟡',label:'Injury Watch',text:`${p.name} is ${p.injury_status}${more}. Recheck status before kickoff.`,view:'intel'};
      }
      return {level:'good',icon:'🟢',label:'Injury Watch',text:'No current starter has an injury flag that needs attention.',view:'intel'};
    }catch{return {level:'watch',icon:'🟡',label:'Injury Watch',text:'Injury status check is temporarily unavailable.'}}
  }

  function overall(signals){
    const acts=signals.filter(x=>x.level==='act').length,watches=signals.filter(x=>x.level==='watch').length;
    if(acts)return {cls:'act',label:'ACT',text:`${acts} move${acts===1?'':'s'} worth making now.`};
    if(watches)return {cls:'watch',label:'WATCH',text:'No urgent move, but there is something worth monitoring.'};
    return {cls:'hold',label:'HOLD',text:'You’re set for now. No action required today.'};
  }

  function guruTodayHTML(){
    const signals=[lineupSignal(),waiverSignal(),tradeSignal(),injurySignal()],o=overall(signals),week=C?.current_week||'—';
    return `<section class="fg38Today"><div class="fg38Head"><div><span class="fg38Eyebrow">GURU TODAY · WEEK ${E(week)}</span><h2>What should I do?</h2><p>${E(o.text)}</p></div><strong class="fg38Overall ${o.cls}">${E(o.label)}</strong></div><div class="fg38Grid">${signals.map(s=>`<button type="button" class="fg38Signal ${s.level}" data-fg38-view="${E(s.view||'dashboard')}"><span class="fg38Icon">${s.icon}</span><div><b>${E(s.label)}</b><small>${E(s.text)}</small></div><em>Open →</em></button>`).join('')}</div></section>`;
  }

  function injectGuruToday(){
    if(currentView!=='dashboard')return;
    const dash=document.querySelector('.fg6Dash');if(!dash)return;
    const old=dash.querySelector('.fg38Today');if(old)old.remove();
    const leagues=dash.querySelector('.fg28Leagues');
    if(leagues)leagues.insertAdjacentHTML('afterend',guruTodayHTML());
    else dash.insertAdjacentHTML('afterbegin',guruTodayHTML());
    dash.querySelectorAll('[data-fg38-view]').forEach(b=>b.onclick=()=>{const v=b.dataset.fg38View;if(typeof showView==='function')showView(v)});
  }

  const baseRenderDashboard=renderDashboard;
  renderDashboard=function(){const out=baseRenderDashboard();setTimeout(injectGuruToday,220);return out};
  const baseShowView=showView;
  showView=function(v){const out=baseShowView(v);if(v==='dashboard')setTimeout(injectGuruToday,220);return out};
  setTimeout(injectGuruToday,350);

  const style=document.createElement('style');style.textContent=`
    .fg38Today{background:linear-gradient(135deg,#07111e,#0a1f31);border:1px solid #1687bd;border-radius:12px;padding:14px;box-shadow:0 0 0 1px rgba(56,189,248,.12),0 14px 34px rgba(0,0,0,.16)}
    .fg38Head{display:flex;justify-content:space-between;gap:16px;align-items:center}.fg38Eyebrow{display:block;color:#7dd3fc;font-size:8px;font-weight:900;letter-spacing:.09em}.fg38Head h2{margin:3px 0 2px;font-size:22px}.fg38Head p{margin:0;color:#b6c6d7;font-size:10px}.fg38Overall{border-radius:999px;padding:8px 12px;font-size:10px;letter-spacing:.06em}.fg38Overall.act{background:#40151d;color:#fecdd3;border:1px solid #9f3145}.fg38Overall.watch{background:#3a2d0b;color:#fde68a;border:1px solid #8a6b1b}.fg38Overall.hold{background:#0c2b26;color:#9df5ca;border:1px solid #216a56}
    .fg38Grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.fg38Signal{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:9px;align-items:center;text-align:left;background:#07111e;color:#e7eef7;border:1px solid #28405d;border-radius:9px;padding:10px;cursor:pointer}.fg38Signal:hover{border-color:#38bdf8;background:#0a1a2b}.fg38Signal.act{border-left:3px solid #ef4444}.fg38Signal.watch{border-left:3px solid #f59e0b}.fg38Signal.good{border-left:3px solid #22c55e}.fg38Icon{font-size:16px}.fg38Signal b{display:block;font-size:10px}.fg38Signal small{display:block;color:#9fb2c6;font-size:8.5px;line-height:1.35;margin-top:2px}.fg38Signal em{font-style:normal;color:#7dd3fc;font-size:8px;font-weight:900;white-space:nowrap}
    @media(max-width:850px){.fg38Grid{grid-template-columns:1fr}.fg38Head{align-items:flex-start}.fg38Signal{grid-template-columns:28px minmax(0,1fr)}.fg38Signal em{grid-column:2}}
  `;document.head.appendChild(style);
})();
