/* Decision-first UX foundation: simple answer first, analytics on demand. */
(function(){
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const F=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const N=(v,d=1)=>F(v)?Number(v).toFixed(d):'—';
  const playerId=p=>typeof ident==='function'?ident(p):String(p?.id||p?.name||'');
  const P=p=>typeof pos==='function'?pos(p?.position):String(p?.position||'').toUpperCase();

  function sourceCount(p){return Math.max(Number(p?.weekly_source_count||0),Number(p?.ros_source_count||0),0)}
  function confidence(edge,a,b){
    const src=Math.min(sourceCount(a)||3,sourceCount(b)||3);
    const e=Math.abs(Number(edge||0));
    if(src>=3&&e>=3)return {label:'High',reason:'Multiple sources agree and the edge is meaningful.'};
    if(src>=2&&e>=1)return {label:'Medium',reason:'The move has an edge, but it is not a lock.'};
    return {label:'Low',reason:'This is close enough that normal projection error could flip it.'};
  }
  function playerBye(p){try{const x=typeof bye==='function'?bye(p):null;return x==null?'—':x}catch{return'—'}}

  function startSitWhy(start,sit,diff){
    const e=Number(diff||0);
    if(e>=4)return `${start.name} has the stronger projection this week. The gap is big enough to act on.`;
    if(e>=1)return `${start.name} has a small edge this week. This is a reasonable change, not a sure thing.`;
    return `The projections are nearly even. Do not force a change for a tiny edge.`;
  }

  function startSitRow(x){
    const p=x.p,week=F(p.weekly_points)?Number(p.weekly_points):null;
    return `<div class="fg33RosterRow ${x.inOpt?'start':'bench'}">
      <div class="fg33RosterMain"><span class="fg33Slot">${E(x.slot||P(p))}</span><div><b>${E(p.name)}</b><small>${E(P(p))}${p.team?' · '+E(p.team):''}${p.injury_status?' · '+E(p.injury_status):''}</small></div><strong>${week==null?'—':N(week)}<small>WEEK</small></strong></div>
      <details class="fg33Details"><summary>Details</summary><div class="fg33DetailGrid"><span>ROS <b>${N(p.ros_points)}</b></span><span>Sources <b>${sourceCount(p)||'—'}/3</b></span><span>Bye <b>${E(playerBye(p))}</b></span><span>Status <b>${E(p.injury_status||'No flag')}</b></span></div></details>
    </div>`;
  }

  function renderDecisionStartSit(){
    const m=mineTeam(),d=ssDecisions();
    if(!m){$('content').innerHTML='<h2>✅ Start / Sit</h2><div class="card muted">Roster data unavailable.</div>';return}
    const opt=ssOptimized(),optIds=new Set(opt.map(x=>playerId(x.player))),slotById=new Map(opt.map(x=>[playerId(x.player),x.slot]));
    const starters=[],bench=[];
    for(const p of m.players||[]){const id=playerId(p),inOpt=optIds.has(id),row={p,inOpt,slot:slotById.get(id)||p.lineup_slot||''};(inOpt?starters:bench).push(row)}
    const sort=(a,b)=>Number(b.p.weekly_points??-999)-Number(a.p.weekly_points??-999);starters.sort(sort);bench.sort(sort);
    const changes=d.changes||[];
    const decision=changes.length?`MAKE ${changes.length} LINEUP CHANGE${changes.length===1?'':'S'}`:'HOLD YOUR LINEUP';
    const decisionClass=changes.length?'act':'hold';
    const cards=changes.length?changes.map(x=>{const c=confidence(x.diff,x.start,x.sit);return `<article class="fg33DecisionCard"><div class="fg33DecisionTop"><span class="fg33Action start">START</span><b>${E(x.start.name)}</b><span class="fg33Over">over ${E(x.sit.name)}</span></div><div class="fg33Why"><b>Why</b><span>${E(startSitWhy(x.start,x.sit,x.diff))}</span></div><div class="fg33DecisionMeta"><span><b>${Number(x.diff)>=0?'+':''}${N(x.diff)}</b> projected points</span><span class="fg33Confidence ${c.label.toLowerCase()}">${E(c.label)} confidence</span></div><details class="fg33Analytics"><summary>Advanced analytics</summary><div class="fg33DetailGrid"><span>${E(x.start.name)} week <b>${N(x.start.weekly_points)}</b></span><span>${E(x.sit.name)} week <b>${N(x.sit.weekly_points)}</b></span><span>${E(x.start.name)} ROS <b>${N(x.start.ros_points)}</b></span><span>${E(x.sit.name)} ROS <b>${N(x.sit.ros_points)}</b></span><span>Confidence note <b>${E(c.reason)}</b></span></div></details></article>`}).join(''):`<article class="fg33DecisionCard hold"><div class="fg33DecisionTop"><span class="fg33Action hold">HOLD</span><b>No lineup change needed</b></div><div class="fg33Why"><b>Why</b><span>Your current starters already match the highest-projected lineup. Do not make a move just to make a move.</span></div><div class="fg33DecisionMeta"><span>Close calls: <b>${(d.close||[]).length}</b></span><span class="fg33Confidence high">High confidence</span></div></article>`;
    $('content').innerHTML=`<div class="fg33SS">
      <header class="fg33PageHead"><div><h2>✅ Start / Sit</h2><p>Week ${C.current_week} · the answer first, deeper numbers only if you want them.</p></div><span class="fg33Decision ${decisionClass}">${E(decision)}</span></header>
      <section class="fg33DecisionArea">${cards}</section>
      <div class="fg33RosterCols"><section><div class="fg33ColHead"><h3>Starters</h3><span>${starters.length}</span></div>${starters.map(startSitRow).join('')}</section><section><div class="fg33ColHead"><h3>Bench</h3><span>${bench.length}</span></div>${bench.map(startSitRow).join('')}</section></div>
    </div>`;
  }

  function findPlayerByName(name){
    for(const p of analysis?.waiver_pool||[])if(String(p?.name||'')===name)return p;
    for(const t of analysis?.team_details||[])for(const p of t.players||[])if(String(p?.name||'')===name)return p;
    return null;
  }

  function impactMeaning(card){
    const vals=[...card.querySelectorAll('.fg28Impact b')].map(x=>Number(String(x.textContent||'').replace(/[^0-9+-.]/g,''))).filter(Number.isFinite);
    const week=vals[0]??0,ros=vals[1]??0;
    if(week>=2)return 'This move should help your starting lineup right away.';
    if(ros>=2)return 'This is more about making your roster stronger for the rest of the season.';
    if(week<0&&ros>0)return 'This may cost a little this week, but it can improve your roster long term.';
    return 'The edge is small. Compare the move before acting.';
  }

  function simplifyDashboard(){
    if(currentView!=='dashboard')return;
    document.querySelectorAll('.fg28Move').forEach(card=>{
      if(card.dataset.fg33==='1')return;card.dataset.fg33='1';
      const title=card.querySelector('h3')?.textContent?.trim()||'';
      const playerName=card.querySelector('.fg28Player b')?.textContent?.trim()||title.replace(/^(Add|Target|Consider)\s+/i,'');
      const p=findPlayerByName(playerName);
      const whyText=card.querySelector('.fg30Why')?.textContent?.replace(/^Why:\s*/i,'').trim()||card.querySelector('p')?.textContent?.trim()||'This is the best current fit for your roster.';
      const kind=card.classList.contains('trade')?'TRADE':'ADD';
      const src=sourceCount(p),conf=src>=3?'High':src>=2?'Medium':'Low';
      const why=document.createElement('div');why.className='fg33Why fg33DashWhy';why.innerHTML=`<b>Why</b><span>${E(whyText)}</span>`;
      const impact=document.createElement('div');impact.className='fg33ImpactPlain';impact.innerHTML=`<b>Impact</b><span>${E(impactMeaning(card))}</span><em class="fg33Confidence ${conf.toLowerCase()}">${conf} confidence</em>`;
      const pEl=card.querySelector('p');if(pEl)pEl.style.display='none';
      const oldWhy=card.querySelector('.fg30Why');if(oldWhy)oldWhy.remove();
      const player=card.querySelector('.fg28Player'),metrics=card.querySelector('.fg28Impact');
      if(player||metrics){const details=document.createElement('details');details.className='fg33Analytics';details.innerHTML='<summary>Advanced analytics</summary>';if(player)details.appendChild(player);if(metrics)details.appendChild(metrics);const action=card.querySelector('.fg28Action');card.insertBefore(details,action||null)}
      const action=card.querySelector('.fg28Action');card.insertBefore(impact,action||null);card.insertBefore(why,impact);
      const top=card.querySelector('.fg28MoveTop>b');if(top)top.textContent=kind==='TRADE'?'TRADE':'ADD';
    });
  }

  function simplifyHubOverview(){
    if(currentView!=='playerhub')return;
    const hero=document.querySelector('.fg25Hero h3');if(hero)hero.textContent='What should I do?';
    const sub=document.querySelector('.fg25Hero p');if(sub)sub.textContent='Start with the moves that can actually help your roster. Open the deeper tools only when you need them.';
  }

  renderStartSit=renderDecisionStartSit;

  const baseRenderDashboard=renderDashboard;
  renderDashboard=function(){const out=baseRenderDashboard();setTimeout(simplifyDashboard,180);return out};

  const baseShow=showView;
  showView=function(v){const out=baseShow(v);if(v==='startsit')renderDecisionStartSit();if(v==='dashboard')setTimeout(simplifyDashboard,180);if(v==='playerhub')setTimeout(simplifyHubOverview,80);return out};

  if(currentView==='dashboard')setTimeout(simplifyDashboard,220);

  const style=document.createElement('style');style.textContent=`
    .fg33SS{width:100%;max-width:none}.fg33PageHead{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}.fg33PageHead h2{margin:0;font-size:23px}.fg33PageHead p{margin:3px 0 0;color:#8fa6bf;font-size:11px}.fg33Decision{border-radius:999px;padding:8px 12px;font-size:10px;font-weight:900;letter-spacing:.02em}.fg33Decision.hold{background:#10243a;color:#b9dcf5;border:1px solid #2d5e86}.fg33Decision.act{background:#0c2b26;color:#9df5ca;border:1px solid #216a56}
    .fg33DecisionArea{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-bottom:12px}.fg33DecisionCard{background:#081524;border:1px solid #28405d;border-radius:11px;padding:12px}.fg33DecisionCard.hold{border-color:#2d5e86}.fg33DecisionTop{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.fg33DecisionTop>b{font-size:15px}.fg33Over{font-size:10px;color:#8fa6bf}.fg33Action{font-size:8px;font-weight:900;padding:4px 7px;border-radius:999px}.fg33Action.start{background:#0f4a38;color:#9df5ca}.fg33Action.hold{background:#10243a;color:#b9dcf5}
    .fg33Why{display:grid;grid-template-columns:42px 1fr;gap:8px;margin-top:10px;align-items:start}.fg33Why>b{font-size:9px;color:#7dd3fc;text-transform:uppercase}.fg33Why>span{font-size:11px;line-height:1.4;color:#d3deea}.fg33DecisionMeta{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px;padding-top:9px;border-top:1px solid #1e324a;font-size:9px}.fg33DecisionMeta b{font-size:13px}.fg33Confidence{display:inline-block;border-radius:999px;padding:4px 7px;font-size:8px!important;font-weight:900;font-style:normal}.fg33Confidence.high{background:#0c2b26;color:#9df5ca}.fg33Confidence.medium{background:#32290b;color:#fde68a}.fg33Confidence.low{background:#341820;color:#fecdd3}
    .fg33Analytics,.fg33Details{margin-top:9px;border-top:1px solid #1e324a;padding-top:7px}.fg33Analytics summary,.fg33Details summary{cursor:pointer;color:#7dd3fc;font-size:9px;font-weight:800;list-style:none}.fg33Analytics summary::-webkit-details-marker,.fg33Details summary::-webkit-details-marker{display:none}.fg33Analytics summary:after,.fg33Details summary:after{content:'  ▾'}.fg33Analytics[open] summary:after,.fg33Details[open] summary:after{content:'  ▴'}.fg33DetailGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:7px}.fg33DetailGrid>span{background:#07111e;border:1px solid #20364e;border-radius:7px;padding:6px;color:#8fa6bf;font-size:8px}.fg33DetailGrid b{display:block;color:#e4edf7;font-size:10px;margin-top:2px}
    .fg33RosterCols{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}.fg33RosterCols>section{background:#081524;border:1px solid #28405d;border-radius:11px;padding:11px}.fg33ColHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}.fg33ColHead h3{margin:0;font-size:17px}.fg33ColHead span{color:#8fa6bf;font-size:9px}.fg33RosterRow{border-top:1px solid #1e324a;padding:8px 2px}.fg33RosterRow:first-of-type{border-top:0}.fg33RosterMain{display:grid;grid-template-columns:76px minmax(0,1fr) 64px;gap:9px;align-items:center}.fg33Slot{font-size:8px;font-weight:900;color:#7dd3fc}.fg33RosterMain>div>b{display:block;font-size:12px}.fg33RosterMain>div>small{display:block;font-size:8px;color:#8fa6bf;margin-top:2px}.fg33RosterMain>strong{text-align:right;font-size:13px}.fg33RosterMain>strong small{display:block;font-size:7px;color:#8fa6bf;margin-top:1px}
    .fg33DashWhy{margin-top:9px!important}.fg33ImpactPlain{display:grid;grid-template-columns:45px minmax(0,1fr) auto;gap:7px;align-items:center;margin-top:8px;border:1px solid #20364e;border-radius:7px;padding:7px}.fg33ImpactPlain>b{font-size:9px;color:#7dd3fc;text-transform:uppercase}.fg33ImpactPlain>span{font-size:9px;color:#d3deea;line-height:1.35}.fg28Move>.fg33Analytics .fg28Player,.fg28Move>.fg33Analytics .fg28Impact{margin-top:7px}.fg28Move>.fg33Analytics .fg28Impact{display:flex!important}
    @media(max-width:950px){.fg33RosterCols{grid-template-columns:1fr}.fg33PageHead{align-items:flex-start}.fg33ImpactPlain{grid-template-columns:1fr}.fg33Confidence{width:max-content}}
    @media(max-width:600px){.fg33DetailGrid{grid-template-columns:1fr}.fg33RosterMain{grid-template-columns:58px minmax(0,1fr) 54px}}
  `;document.head.appendChild(style);
})();