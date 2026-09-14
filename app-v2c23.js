/* UX consolidation: clearer dashboards, full-roster Start/Sit, calmer Matchup/Guru, Player Hub overview. */
(function(){
  let hubOverviewShown=false, guruManualExpanded=false;

  function n23(v,d=1){return finite(v)?Number(v).toFixed(d):'—'}
  function src23(p,kind='weekly'){const n=Number(p?.[kind+'_source_count']||0);return n?`${n}/3`:'—'}
  function status23(p){return String(p?.injury_status||'ACTIVE').toUpperCase()}

  /* ---------- Dashboard / Power Rankings ---------- */
  function polishDashboard(){
    const tabs=document.querySelector('.fg22DashTabs');
    if(tabs){tabs.classList.add('fg23PrimaryTabs');const a=[...tabs.querySelectorAll('button')];if(a[0])a[0].textContent='Overview';if(a[1])a[1].textContent='Power Rankings'}
    document.querySelectorAll('.fg6Card').forEach(card=>{
      const h=card.querySelector('h2');if(!h||!/Roster at a Glance/i.test(h.textContent||''))return;
      const btn=card.querySelector('.fg6Title button,.fg6Title .fg6Btn');if(btn){btn.textContent='Power Rankings →';btn.onclick=()=>showView('power');btn.dataset.fg6View='power'}
    });
  }

  /* ---------- Full roster Start / Sit ---------- */
  function renderFullStartSit(){
    const m=mineTeam(),d=ssDecisions();if(!m){$('content').innerHTML='<h2>✅ Start / Sit</h2><div class="card muted">Roster data unavailable.</div>';return}
    const opt=ssOptimized(),optIds=new Set(opt.map(x=>ident(x.player))),curIds=new Set((m.players||[]).filter(p=>p.starter).map(ident));
    const moveIn=new Set((d.changes||[]).map(x=>ident(x.start))),moveOut=new Set((d.changes||[]).map(x=>ident(x.sit)));
    const slotById=new Map(opt.map(x=>[ident(x.player),x.slot]));
    const rows=[...(m.players||[])].sort((a,b)=>{const ao=optIds.has(ident(a))?0:1,bo=optIds.has(ident(b))?0:1;if(ao!==bo)return ao-bo;return Number(b.weekly_points||-999)-Number(a.weekly_points||-999)});
    const totalOpt=opt.reduce((s,x)=>s+Number(x.value||0),0),current=(m.players||[]).filter(p=>p.starter&&finite(p.weekly_points)).reduce((s,p)=>s+Number(p.weekly_points),0),gain=totalOpt-current;
    const changes=d.changes||[],close=d.close||[];
    const explain=changes.length?changes.map(x=>`<div class="fg23Decision"><div><b>START ${esc(x.start.name)}</b><span>over ${esc(x.sit.name)} · ${esc(x.slot)}</span></div><strong>+${n23(x.diff)} <small>${esc(x.confidence)}</small></strong></div>`).join(''):'<div class="fg23NoMove">✅ Your current starters already match the highest-projected lineup.</div>';
    const roster=rows.map(p=>{const id=ident(p),inOpt=optIds.has(id),inCur=curIds.has(id),label=moveIn.has(id)?'MOVE IN':moveOut.has(id)?'MOVE OUT':inOpt?'START':'BENCH',cls=moveIn.has(id)?'in':moveOut.has(id)?'out':inOpt?'start':'bench';return `<div class="fg23RosterRow ${cls}"><div class="fg23Action"><b>${label}</b><span>${esc(slotById.get(id)||p.lineup_slot||'')}</span></div><div class="fg23Player"><b>${esc(p.name)}</b><span>${esc(pos(p.position))}${p.team?' · '+esc(p.team):''} · ${esc(status23(p))}</span></div><div><b>${n23(p.weekly_points)}</b><span>WEEK</span></div><div><b>${n23(p.ros_points)}</b><span>ROS</span></div><div><b>${src23(p,'weekly')}</b><span>SOURCES</span></div><div><b>${inCur?'YES':'NO'}</b><span>CURRENT START</span></div></div>`}).join('');
    $('content').innerHTML=`<div class="fg23SS"><div class="fg23PageHead"><div><h2>✅ Start / Sit</h2><span>Week ${C.current_week} · every rostered player, optimized for your exact lineup slots.</span></div><div class="fg23WeekGain"><span>Projected lineup gain</span><b>${gain>0?'+':''}${n23(gain)}</b></div></div><div class="fg23SSSummary"><section><h3>Guru Lineup Check</h3>${explain}</section><section><h3>What this means</h3><p>${changes.length?`Fantasy Guru found ${changes.length} lineup change${changes.length===1?'':'s'} that improve the highest-published projection for this week.`:'There is no projected reason to change starters right now.'}</p><p class="muted">Close calls within 5 points: ${close.length}. A small edge is not treated like a certainty.</p></section></div><div class="fg23RosterHead"><span>ACTION</span><span>PLAYER</span><span>WEEK</span><span>ROS</span><span>SOURCES</span><span>STARTING?</span></div><div class="fg23Roster">${roster}</div></div>`;
  }
  renderStartSit=renderFullStartSit;

  /* ---------- Player Hub overview ---------- */
  function hubOverviewHTML(){
    const needs=mineTeam()?needProfile(mineTeam()).slice().sort((a,b)=>(b.ros_rank||0)-(a.ros_rank||0)).slice(0,4):[];
    const w=typeof storedWaiverIdeas==='function'?storedWaiverIdeas():[],wr=typeof waiverRadar==='function'?waiverRadar():[],tr=typeof tradeIdeas==='function'?tradeIdeas():[],rr=typeof tradeRadar==='function'?tradeRadar():[];
    const market=(analysis?.opportunities?.sleeper_trending||[]).slice(0,4);
    const needHtml=needs.length?needs.map(x=>`<div class="fg23Mini"><b>${esc(x.position)}</b><span>League rank #${x.ros_rank||'—'} · need ${Math.round((needScore(needProfile(mineTeam()),x.position)||0)*100)}%</span></div>`).join(''):'<div class="muted">No roster needs available.</div>';
    const waiver=(w.length?w:wr).slice(0,4).map(x=>x.add||x).filter(Boolean).map(p=>`<button class="fg23PlayerJump" data-hub-target="available"><b>${esc(p.name)}</b><span>${esc(pos(p.position))} · Week ${n23(p.weekly_points)} · ROS ${n23(p.ros_points)}</span></button>`).join('')||'<div class="muted">No waiver target clears the current bar.</div>';
    const trades=(tr.length?tr:rr).slice(0,4).map(x=>x.get?.[0]).filter(Boolean).map(p=>`<button class="fg23PlayerJump" data-hub-target="trade"><b>${esc(p.name)}</b><span>${esc(pos(p.position))} · realistic target</span></button>`).join('')||'<div class="muted">No realistic trade target stands out.</div>';
    const movers=market.map(p=>`<div class="fg23Mini"><b>${esc(p.name)}</b><span>${esc(p.position||'')} · net adds ${Number(p.sleeper_net_24h||0).toLocaleString()}</span></div>`).join('')||'<div class="muted">No strong market movers right now.</div>';
    return `<div class="fg23HubOverview"><div class="fg23HubHero"><div><h3>Your Player Market</h3><p>Start here. See needs, best opportunities and market movement before choosing a tool.</p></div><button data-hub-target="compare">Compare an Add/Drop →</button></div><div class="fg23HubGrid"><section><h3>🎯 Roster Needs</h3>${needHtml}</section><section><h3>📋 Best Available Fits</h3>${waiver}</section><section><h3>🤝 Trade Targets</h3>${trades}</section><section><h3>🔥 Market Movers</h3>${movers}</section></div></div>`
  }
  function installHubOverview(force=false){
    if(currentView!=='playerhub')return;const tabs=document.querySelector('.fg17Tabs'),body=$('fg17Body');if(!tabs||!body)return;
    let ov=$('fg23HubOverviewTab');if(!ov){ov=document.createElement('button');ov.id='fg23HubOverviewTab';ov.className='fg17Tab fg23OverviewTab';ov.textContent='Overview';tabs.prepend(ov);ov.onclick=()=>{hubOverviewShown=true;tabs.querySelectorAll('.fg17Tab').forEach(x=>x.classList.remove('active'));ov.classList.add('active');body.innerHTML=hubOverviewHTML();wireHubOverview()};
      [...tabs.querySelectorAll('.fg17Tab')].filter(x=>x!==ov).forEach(b=>b.addEventListener('click',()=>{hubOverviewShown=false;ov.classList.remove('active')}));
    }
    if(force||!hubOverviewShown){hubOverviewShown=true;tabs.querySelectorAll('.fg17Tab').forEach(x=>x.classList.remove('active'));ov.classList.add('active');body.innerHTML=hubOverviewHTML();wireHubOverview()}
  }
  function wireHubOverview(){document.querySelectorAll('[data-hub-target]').forEach(b=>b.onclick=()=>{const target=b.dataset.hubTarget;const btn=[...document.querySelectorAll('.fg17Tabs .fg17Tab')].find(x=>x.dataset.tab===target);if(btn)btn.click()})}

  /* ---------- Guru behavior ---------- */
  function fixGuru(){
    const g=$('fg7Guru'),toggle=$('fg8GuruToggle');if(!g||!toggle)return;
    if(!toggle.dataset.fg23){toggle.dataset.fg23='1';toggle.onclick=()=>{guruManualExpanded=!g.classList.contains('fg8Expanded');g.classList.toggle('fg8Expanded',guruManualExpanded);toggle.textContent=guruManualExpanded?'Collapse':'Expand'}}
    if(!guruManualExpanded&&g.classList.contains('fg8Expanded'))g.classList.remove('fg8Expanded');toggle.textContent=g.classList.contains('fg8Expanded')?'Collapse':'Expand';
  }

  /* ---------- Matchup polish ---------- */
  function polishMatchup(){
    if(currentView!=='matchup')return;document.querySelectorAll('.fg10Team').forEach(t=>t.classList.add('fg23MatchTeam'));
    document.querySelectorAll('.fg10ColHead').forEach(h=>{const labels=[...h.children];if(labels.length>=5){labels[0].textContent='POS';labels[1].textContent='PLAYER';labels[2].textContent='PTS';labels[3].textContent='LIVE PROJ';labels[4].textContent='ROS'}});
  }

  const oldShow=showView;showView=function(v){const out=oldShow(v);setTimeout(()=>{polishDashboard();fixGuru();if(v==='playerhub')installHubOverview(true);if(v==='matchup')polishMatchup()},0);return out};
  const oldDash=renderDashboard;renderDashboard=function(){const out=oldDash();setTimeout(()=>{polishDashboard();fixGuru()},0);return out};

  const obs=new MutationObserver(()=>requestAnimationFrame(()=>{fixGuru();if(currentView==='matchup')polishMatchup();if(currentView==='playerhub'&&!document.getElementById('fg23HubOverviewTab'))installHubOverview(false);if(currentView==='dashboard')polishDashboard()}));obs.observe(document.documentElement,{subtree:true,childList:true});

  const style=document.createElement('style');style.textContent=`
    /* dashboard */
    .fg23PrimaryTabs{position:sticky;top:0;z-index:35;background:#07111e;padding:6px 0 9px!important;margin-bottom:10px!important}.fg23PrimaryTabs button{font-size:11px!important;padding:8px 14px!important}.fg23PrimaryTabs button.active{box-shadow:inset 0 -2px 0 rgba(255,255,255,.28)}
    /* start/sit */
    .fg23SS{max-width:1250px}.fg23PageHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}.fg23PageHead h2{margin:0}.fg23PageHead span{color:#8fa6bf;font-size:10px}.fg23WeekGain{border:1px solid #285845;background:#0c211c;border-radius:9px;padding:8px 12px;text-align:right}.fg23WeekGain span{display:block;font-size:8px}.fg23WeekGain b{font-size:18px;color:#86efac}.fg23SSSummary{display:grid;grid-template-columns:1.2fr .8fr;gap:9px;margin-bottom:10px}.fg23SSSummary section{background:#081524;border:1px solid #28405d;border-radius:10px;padding:10px}.fg23SSSummary h3{margin:0 0 7px}.fg23SSSummary p{font-size:10px;line-height:1.45}.fg23Decision{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid #1e324a}.fg23Decision:last-child{border-bottom:0}.fg23Decision div{display:grid;gap:2px}.fg23Decision span{font-size:9px;color:#8fa6bf}.fg23Decision strong{color:#86efac}.fg23Decision small{display:block;font-size:7px;color:#8fa6bf}.fg23NoMove{color:#86efac;font-size:10px}.fg23RosterHead,.fg23RosterRow{display:grid;grid-template-columns:90px minmax(220px,1fr) 75px 75px 75px 90px;gap:8px;align-items:center}.fg23RosterHead{padding:6px 9px;background:#0b1b2d;border:1px solid #28405d;border-radius:8px 8px 0 0;color:#8fa6bf;font-size:8px;font-weight:900}.fg23Roster{border:1px solid #28405d;border-top:0;border-radius:0 0 8px 8px;overflow:hidden}.fg23RosterRow{padding:8px 9px;border-top:1px solid #1e324a;background:#081524}.fg23RosterRow:first-child{border-top:0}.fg23RosterRow>div:not(.fg23Player):not(.fg23Action){text-align:center}.fg23RosterRow b{display:block;font-size:11px}.fg23RosterRow span{display:block;font-size:8px;color:#8fa6bf;margin-top:2px}.fg23Action b{font-size:9px;border-radius:999px;display:inline-block;padding:3px 6px;width:max-content}.fg23RosterRow.in .fg23Action b{background:#0f4a38;color:#9df5ca}.fg23RosterRow.out .fg23Action b{background:#4a1f28;color:#ffc2cb}.fg23RosterRow.start .fg23Action b{background:#12314d;color:#7dd3fc}.fg23RosterRow.bench{opacity:.88}.fg23RosterRow.bench .fg23Action b{background:#18263a;color:#aab9ca}
    /* player hub */
    .fg23OverviewTab{order:-1}.fg23HubOverview{display:grid;gap:10px}.fg23HubHero{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid #31506d;background:#0a1a2a;border-radius:11px;padding:12px}.fg23HubHero h3{margin:0 0 3px;font-size:16px}.fg23HubHero p{margin:0;color:#8fa6bf;font-size:10px}.fg23HubHero button,.fg23PlayerJump{border:1px solid #2d5e86;background:#0b2033;color:#c9ecff;border-radius:8px;padding:7px 9px;font-weight:850;cursor:pointer}.fg23HubGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.fg23HubGrid section{background:#081524;border:1px solid #28405d;border-radius:10px;padding:10px}.fg23HubGrid h3{margin:0 0 8px}.fg23Mini,.fg23PlayerJump{display:grid;gap:2px;width:100%;text-align:left;padding:7px 0;border:0;border-bottom:1px solid #1e324a;background:transparent;border-radius:0}.fg23Mini:last-child,.fg23PlayerJump:last-child{border-bottom:0}.fg23Mini b,.fg23PlayerJump b{font-size:11px}.fg23Mini span,.fg23PlayerJump span{font-size:9px;color:#8fa6bf}.fg23PlayerJump:hover{background:#0b2033;padding-left:7px;padding-right:7px;border-radius:6px}
    /* matchup */
    .fg10Teams{gap:14px!important}.fg23MatchTeam{border-radius:10px!important;overflow:hidden}.fg10TeamHead{padding:10px 12px!important}.fg10ColHead,.fg10PlayerMain{grid-template-columns:46px minmax(220px,1fr) 58px 72px 62px 20px!important;column-gap:10px!important}.fg10ColHead{padding:8px 12px!important;font-size:8.5px!important}.fg10PlayerMain{padding:10px 12px 7px!important}.fg12IntelBar{margin:2px 12px 10px 68px!important;padding:8px 10px!important}.fg10SectionLabel{padding:7px 12px!important}.fg10Player{border-bottom:1px solid #1d3045!important}.fg10Alerts{gap:10px!important;margin:10px 0!important}.fg10Alerts>div{padding:10px 12px!important}.fg10Score{margin-bottom:12px!important}.fg10Title{margin-bottom:8px!important}
    /* guru */
    #fg11GuruShow{top:118px!important;right:14px!important;padding:8px 11px!important;font-size:11px!important}#fg7Guru{width:330px!important}.main{padding-right:360px!important}#fg7Guru.fg8Expanded{width:min(680px,calc(100vw - 60px))!important;right:18px!important;top:82px!important;height:calc(100vh - 100px)!important;z-index:260!important}.fg8Expanded .fg7GuruLog{padding:16px!important}.fg8Expanded .fg7Msg{max-width:92%;font-size:13px!important;line-height:1.55!important}.fg8Expanded .fg7Msg.user{margin-left:auto!important}.fg8Expanded .fg7Msg.guru{margin-right:auto!important}.fg8Expanded .fg7Compose textarea{min-height:88px!important;font-size:13px!important}.fg8Expanded .fg7GuruContext{padding:9px 14px!important}.fg8Expanded .fg7GuruHead{padding:12px 14px!important}
    @media(max-width:1180px){.fg10ColHead,.fg10PlayerMain{grid-template-columns:42px minmax(190px,1fr) 52px 64px 56px 18px!important}.fg12IntelBar{margin-left:60px!important}.fg23SSSummary,.fg23HubGrid{grid-template-columns:1fr}.fg23RosterHead,.fg23RosterRow{grid-template-columns:75px minmax(180px,1fr) 60px 60px 60px 75px}}
    @media(max-width:900px){.main{padding-right:12px!important}.fg23RosterHead{display:none}.fg23RosterRow{grid-template-columns:78px minmax(0,1fr) repeat(2,56px);grid-template-rows:auto auto}.fg23RosterRow>div:nth-child(5),.fg23RosterRow>div:nth-child(6){display:none}.fg23PageHead{display:block}.fg23WeekGain{margin-top:8px;text-align:left}.fg23HubHero{display:block}.fg23HubHero button{margin-top:8px}.fg23PrimaryTabs{margin-left:50px!important}#fg7Guru.fg8Expanded{width:auto!important;left:10px!important;right:10px!important}.fg10Teams{gap:8px!important}}
  `;document.head.appendChild(style);
  setTimeout(()=>{polishDashboard();fixGuru();if(currentView==='playerhub')installHubOverview(true);if(currentView==='matchup')polishMatchup()},0);
})();