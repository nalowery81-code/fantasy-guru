/* Dashboard command center: auto-land in last league, league switcher on Dashboard, actionable improvement center. */
(function(){
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const F=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const N=(v,d=1)=>F(v)?Number(v).toFixed(d):'—';
  const lastKey='fg-last-league-index';

  function hubTab(tab){
    showView('playerhub');
    setTimeout(()=>{const b=[...document.querySelectorAll('.fg17Tabs .fg17Tab')].find(x=>x.dataset.tab===tab);if(b)b.click()},40);
  }

  function leagueButtons(){
    const ls=leagues(),activeId=String(C?.league?.id||'');
    return `<section class="fg28Leagues"><div class="fg28SectionHead"><div><h2>🏆 My Leagues</h2><span>Switch leagues without leaving the Dashboard.</span></div><button id="fg28AddLeague">+ Add a League</button></div><div class="fg28LeagueGrid">${ls.map((x,i)=>{const on=String(x.id)===activeId;return `<button class="fg28League ${on?'active':''}" data-i="${i}"><div class="fg28LeagueIcon">${x.platform==='ESPN'?'🏆':'🏈'}</div><div><b>${E(x.name)}</b><span>${E(x.team)} · ${E(x.platform)}</span></div>${on?'<em>● Current</em>':''}</button>`}).join('')}</div></section>`;
  }

  function actionCandidates(){
    const out=[];
    const strictW=typeof storedWaiverIdeas==='function'?storedWaiverIdeas():[];
    const radarW=typeof waiverRadar==='function'?waiverRadar():[];
    const strictT=typeof tradeIdeas==='function'?tradeIdeas():[];
    const radarT=typeof tradeRadar==='function'?tradeRadar():[];
    const needs=typeof needProfile==='function'&&mineTeam()?needProfile(mineTeam()):[];
    const needFor=q=>typeof needScore==='function'?needScore(needs,q):0;

    if(strictW[0]?.add){const x=strictW[0],p=x.add;out.push({kind:'waiver',label:'BEST WAIVER MOVE',title:`Add ${p.name}`,sub:`Addresses a ${Math.round(needFor(p.position)*100)}% ${pos(p.position)} need`,desc:x.hook||x.blocker||'This move clears the strict waiver recommendation bar for your roster.',p,wg:x.wg,rg:x.rg,rv:x.rv,button:'View Waiver Adds',tab:'waivers'});}
    const t=strictT[0]||radarT[0];if(t?.get?.[0]){const p=t.get[0],partner=t.partner||'another team';out.push({kind:'trade',label:strictT[0]?'BEST TRADE PATH':'TRADE TARGET',title:`Target ${p.name}`,sub:`Trade with ${partner}`,desc:t.hook||t.blocker||'This target fits your roster and has a plausible trade path.',p,wg:t.wg,rg:t.rg,rv:null,button:'Open Trade Targets',tab:'trade'});}
    const used=new Set(out.map(x=>ident(x.p)));
    const watch=[...strictW,...radarW].find(x=>x?.add&&!used.has(ident(x.add)));
    if(watch?.add){const p=watch.add;out.push({kind:'waiver',label:'NEXT BEST FIT',title:`Consider ${p.name}`,sub:`${pos(p.position)} · ${Math.round(needFor(p.position)*100)}% roster need`,desc:watch.hook||watch.blocker||'Worth comparing against the weakest spot on your roster.',p,wg:watch.wg,rg:watch.rg,rv:watch.rv,button:'Compare Add / Drop',tab:'compare'});}
    return out.slice(0,3);
  }

  function impactLine(x){
    const parts=[];
    if(F(x.wg))parts.push(`<span><b class="${Number(x.wg)>=0?'good':'bad'}">${Number(x.wg)>=0?'+':''}${N(x.wg)}</b><small>WEEKLY LINEUP</small></span>`);
    if(F(x.rg))parts.push(`<span><b class="${Number(x.rg)>=0?'good':'bad'}">${Number(x.rg)>=0?'+':''}${N(x.rg)}</b><small>ROS LINEUP</small></span>`);
    if(F(x.rv))parts.push(`<span><b class="${Number(x.rv)>=0?'good':'bad'}">${Number(x.rv)>=0?'+':''}${N(x.rv)}</b><small>ROSTER VALUE</small></span>`);
    return parts.length?`<div class="fg28Impact">${parts.join('')}</div>`:'<div class="fg28ImpactNote">Open the move to see its full roster impact.</div>';
  }

  function improveHTML(){
    const items=actionCandidates();
    return `<section class="fg28Improve"><div class="fg28ImproveHead"><div><h2>⚡ How to Improve Your Team</h2><span>Actionable moves tied directly to waivers and trades.</span></div><button data-fg28-hub="overview">View Player Hub →</button></div>${items.length?`<div class="fg28ImproveGrid">${items.map((x,i)=>`<article class="fg28Move ${x.kind}"><div class="fg28MoveTop"><span class="fg28Rank">${i+1}</span><b>${E(x.label)}</b></div><h3>${E(x.title)}</h3><strong>${E(x.sub)}</strong><p>${E(x.desc)}</p><div class="fg28Player"><div><b>${E(x.p.name)}</b><span>${E(pos(x.p.position))}${x.p.team?' · '+E(x.p.team):''}${typeof bye==='function'&&bye(x.p)!=null?' · BYE '+E(bye(x.p)):''}</span></div><div><b>${N(x.p.weekly_points)}</b><span>WEEK</span></div><div><b>${N(x.p.ros_points)}</b><span>ROS</span></div></div>${impactLine(x)}<button class="fg28Action" data-fg28-hub="${E(x.tab)}">${E(x.button)} →</button></article>`).join('')}</div>`:`<div class="fg28Hold"><b>HOLD</b><span>No waiver or trade move currently clears the recommendation bar. Your best action is to keep the roster intact.</span></div>`}</section>`;
  }

  function injectDashboard(){
    if(currentView!=='dashboard')return;const dash=document.querySelector('.fg6Dash');if(!dash||document.querySelector('.fg28Leagues'))return;
    dash.insertAdjacentHTML('afterbegin',leagueButtons());
    const week=dash.querySelector('.fg6Week');if(week)week.insertAdjacentHTML('afterend',improveHTML());else dash.insertAdjacentHTML('afterbegin',improveHTML());
    const oldAction=[...dash.querySelectorAll('.fg6Card')].find(x=>/Guru Action Center/i.test(x.querySelector('h2')?.textContent||''));if(oldAction)oldAction.remove();
    dash.querySelectorAll('.fg28League').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.i);if(String(leagues()[i]?.id)===String(C?.league?.id))return;localStorage.setItem(lastKey,String(i));openLeague(i)});
    dash.querySelectorAll('[data-fg28-hub]').forEach(b=>b.onclick=()=>hubTab(b.dataset.fg28Hub));
    const add=$('fg28AddLeague');if(add)add.onclick=()=>showAddForm();
  }

  const baseOpen=openLeague;openLeague=async function(i){localStorage.setItem(lastKey,String(i));return baseOpen(i)};
  const baseDash=renderDashboard;renderDashboard=function(){const out=baseDash();setTimeout(injectDashboard,0);return out};
  const baseShow=showView;showView=function(v){const out=baseShow(v);if(v==='dashboard')setTimeout(injectDashboard,0);return out};

  /* Skip the old league-choice gate on normal app startup. */
  setTimeout(()=>{
    if(C||loadingLeague)return;
    const ls=leagues();if(!ls.length)return;
    let i=Number(localStorage.getItem(lastKey)||0);if(!Number.isInteger(i)||i<0||i>=ls.length)i=0;
    openLeague(i);
  },0);

  const style=document.createElement('style');style.textContent=`
    .fg6Dash{max-width:none!important;width:100%!important}
    .fg28Leagues,.fg28Improve{background:#081524;border:1px solid #28405d;border-radius:11px;padding:12px}
    .fg28SectionHead,.fg28ImproveHead{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:9px}.fg28SectionHead h2,.fg28ImproveHead h2{margin:0;font-size:18px}.fg28SectionHead span,.fg28ImproveHead span{font-size:10px;color:#8fa6bf;margin-top:2px;display:block}.fg28SectionHead button,.fg28ImproveHead button{border:1px solid #2d5e86;background:#0b2033;color:#d5efff;border-radius:8px;padding:7px 10px;font-size:10px;font-weight:850;cursor:pointer}
    .fg28LeagueGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.fg28League{min-width:0;display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:9px;align-items:center;text-align:left;background:#07111e;color:#e8f2ff;border:1px solid #28405d;border-radius:9px;padding:10px;cursor:pointer}.fg28League:hover{border-color:#38bdf8}.fg28League.active{border-color:#38bdf8;box-shadow:inset 0 0 0 1px #38bdf8;background:#0a2032}.fg28LeagueIcon{font-size:24px}.fg28League b{display:block;font-size:12px}.fg28League span{display:block;font-size:9px;color:#8fa6bf;margin-top:2px}.fg28League em{font-style:normal;color:#86efac;font-size:9px;font-weight:850}
    .fg28Improve{border-color:#1687bd;box-shadow:0 0 0 1px rgba(56,189,248,.22)}.fg28ImproveGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.fg28Move{border:1px solid #2b4866;border-radius:10px;background:#07111e;padding:11px;display:flex;flex-direction:column;min-width:0}.fg28Move.waiver{border-top:3px solid #22c55e}.fg28Move.trade{border-top:3px solid #fbbf24}.fg28MoveTop{display:flex;align-items:center;gap:7px}.fg28MoveTop>b{font-size:9px;color:#7dd3fc;letter-spacing:.03em}.fg28Rank{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#0e3652;border:1px solid #2d6d96;font-weight:900}.fg28Move h3{font-size:16px;margin:10px 0 3px}.fg28Move>strong{font-size:10px;color:#7dd3fc}.fg28Move>p{font-size:10px;color:#b6c6d7;line-height:1.45;min-height:42px}.fg28Player{display:grid;grid-template-columns:minmax(0,1fr) 60px 60px;gap:7px;border:1px solid #20364e;border-radius:8px;padding:8px;margin-top:auto}.fg28Player>div:nth-child(n+2){text-align:center}.fg28Player b{display:block;font-size:10px}.fg28Player span{display:block;font-size:8px;color:#8fa6bf;margin-top:2px}.fg28Impact{display:flex;gap:6px;margin-top:8px}.fg28Impact>span{flex:1;border:1px solid #20364e;border-radius:7px;padding:6px;text-align:center}.fg28Impact b{display:block;font-size:14px}.fg28Impact small{display:block;font-size:7px;color:#8fa6bf;margin-top:2px}.fg28ImpactNote{font-size:9px;color:#8fa6bf;padding:8px 0}.fg28Action{margin-top:8px;border:1px solid #1687bd;background:#0b5f91;color:white;border-radius:8px;padding:8px;font-weight:900;font-size:10px;cursor:pointer}.fg28Hold{border:1px solid #28405d;background:#07111e;border-radius:9px;padding:12px;display:flex;gap:12px;align-items:center}.fg28Hold b{color:#fbbf24}.fg28Hold span{font-size:10px;color:#b6c6d7}
    #fg11GuruShow{position:fixed!important;right:18px!important;bottom:18px!important;top:auto!important;z-index:120!important}
    @media(max-width:1000px){.fg28LeagueGrid,.fg28ImproveGrid{grid-template-columns:1fr}.fg28Move>p{min-height:0}}
    @media(max-width:700px){.fg28SectionHead,.fg28ImproveHead{align-items:flex-start}.fg28League{grid-template-columns:34px minmax(0,1fr)}.fg28League em{grid-column:2}.fg28Player{grid-template-columns:minmax(0,1fr) 54px 54px}}
  `;document.head.appendChild(style);
})();
