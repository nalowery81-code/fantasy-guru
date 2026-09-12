function fgTopNeeds(limit=2){
  const m=mineTeam(); if(!m)return[]; return needProfile(m).slice(0,limit);
}
function fgViewButton(view,label){return `<button class="fgActionBtn" data-fg-view="${view}">${label}</button>`}
function fgWireViewButtons(root=$('content')){root?.querySelectorAll('[data-fg-view]').forEach(b=>b.onclick=()=>showView(b.dataset.fgView))}

(function(){
  const style=document.createElement('style');
  style.textContent=`
    /* Focused desktop layout */
    .topbar,.panel{max-width:1320px;margin-left:auto;margin-right:auto}
    .panel{padding:12px 14px!important}
    .topbar{min-height:58px!important;padding:8px 10px!important}
    .card{padding:10px 12px!important}
    .card h3{margin:0 0 7px!important}
    .sub{margin-bottom:8px!important}
    .row{padding:6px 0!important}
    .move{padding:8px 0!important}
    .playerRow{padding:5px 0!important}
    .intelRow{padding:7px 0!important}
    .dashboardGrid{gap:8px!important}
    .rankGrid{gap:6px!important}
    .teamTabs{gap:4px!important}
    .teamTabs button{padding:5px 8px!important}
    .matchHead{padding:8px 14px!important}
    .lineups{gap:8px!important}
    .fgNowGrid{display:grid;grid-template-columns:1.1fr .9fr;gap:8px;margin-bottom:8px}
    .fgDecisionGrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:start}
    .fgScrollCard{max-height:620px;overflow:auto}
    .fgCompactList .row{padding:5px 0!important}
    .fgActionBar{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    .fgActionBtn{border:1px solid #31506d;background:#0b1828;color:#bfe8ff;border-radius:7px;padding:6px 9px;font-weight:700;cursor:pointer}
    .fgActionBtn:hover{border-color:#7dd3fc;background:#10263b}
    .fgKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
    .fgKpi{border:1px solid #253a54;border-radius:8px;padding:8px;background:#091827}
    .fgKpi span{display:block;font-size:8px;color:#7f94ad;text-transform:uppercase}.fgKpi b{display:block;margin-top:3px;font-size:15px}
    .fgMiniFacts{display:grid;gap:5px;margin-top:7px}.fgMiniFact{padding:6px 8px;border-left:2px solid #38bdf8;background:#071422;border-radius:6px;font-size:10px}
    .fgSectionHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.fgSectionHead h2,.fgSectionHead h3{margin:0!important}
    .fgMetaLine{font-size:10px;color:#8ea6c1}
    .fgDecisionGrid .card{margin-top:0!important}
    .needBar{display:none!important}
    .dashAsk,.dashLeague{display:none!important}
    @media(max-width:1000px){.fgNowGrid,.fgDecisionGrid{grid-template-columns:1fr}.topbar,.panel{max-width:none}.fgKpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);

  const baseDashboard=renderDashboard;
  renderDashboard=function(){
    const fav=localStorage.getItem('fg-favorite-team')||'IND',facts=allTeamFacts(fav).slice(0,2),favGames=nflGames.filter(e=>{const g=fmtGame(e);return g.away===fav||g.home===fav}).slice(0,1),r=analysis?.ros?.my_ranks||{},needs=fgTopNeeds(2),ss=typeof ssDecisions==='function'?ssDecisions():{changes:[]},wi=typeof storedWaiverIdeas==='function'?storedWaiverIdeas():[],ti=typeof tradeIdeas==='function'?tradeIdeas():[],opp=matchupData?.available?matchupData.them?.team:null;
    const nextGame=favGames.length?gameLine(fmtGame(favGames[0])):'<span class="muted">No game in the current scoreboard window.</span>';
    $('content').innerHTML=`
      <div class="fgSectionHead"><div><h2>🏈 Command Center</h2><div class="fgMetaLine">The few things that matter most right now.</div></div></div>
      <div class="fgKpis">
        <div class="fgKpi"><span>ROS Rank</span><b>#${r.overall||'—'} / ${C.league_teams.length}</b></div>
        <div class="fgKpi"><span>This Week</span><b>${opp?`vs ${esc(opp)}`:'No matchup'}</b></div>
        <div class="fgKpi"><span>Lineup Changes</span><b>${ss.changes?.length||0}</b></div>
        <div class="fgKpi"><span>Actionable Moves</span><b>${(wi.length||0)+(ti.length||0)}</b></div>
      </div>
      <div class="fgActionBar">
        ${fgViewButton('startsit','✅ Start / Sit')}${fgViewButton('matchup','⚔️ Matchup')}${fgViewButton('waivers','📈 Waivers')}${fgViewButton('trades','🤝 Trades')}${fgViewButton('power','🏆 Rankings')}
      </div>
      <div class="fgNowGrid" style="margin-top:8px">
        <div class="card"><div class="fgSectionHead"><h3>⭐ ${esc(fav)} Snapshot</h3><select id="favTeam">${Object.keys(TEAM_FACTS).map(t=>`<option ${t===fav?'selected':''}>${t}</option>`).join('')}</select></div>${nextGame}<div class="fgMiniFacts">${facts.map(f=>`<div class="fgMiniFact">💡 ${esc(f)}</div>`).join('')}</div></div>
        <div class="card"><h3>🎯 Roster Focus</h3>${needs.length?needs.map(n=>`<div class="row"><b>${n.position}</b><span class="muted"> Weekly #${n.weekly_rank} · ROS #${n.ros_rank}</span></div>`).join(''):'<div class="muted">Roster need profile unavailable.</div>'}<div class="fgActionBar">${fgViewButton('intel','🩺 Roster Intel')}${fgViewButton('guru','🧠 Full Guru Chat')}</div></div>
      </div>
      <div class="fgDecisionGrid">
        <div class="card fgCompactList fgScrollCard"><h3>📅 NFL Schedule</h3>${nflGames.slice(0,6).map(e=>`<div class="row">${gameLine(fmtGame(e))}</div>`).join('')||'<div class="muted">Loading schedule…</div>'}</div>
        <div class="card fgCompactList fgScrollCard"><h3>📰 NFL & Fantasy Watch</h3>${nflNews.slice(0,5).map(a=>`<div class="row"><a class="headline" target="_blank" rel="noopener" href="${a.links?.web?.href||'#'}">${esc(a.headline)}</a><div class="muted">${esc((a.description||'').slice(0,105))}</div></div>`).join('')||'<div class="muted">Loading headlines…</div>'}</div>
      </div>`;
    $('favTeam').onchange=()=>{localStorage.setItem('fg-favorite-team',$('favTeam').value);renderDashboard()};
    fgWireViewButtons();
  };

  const baseWaivers=renderWaivers;
  renderWaivers=function(){
    const ideas=storedWaiverIdeas(),radar=waiverRadar(),m=mineTeam(),pr=m?needProfile(m):[],strictIds=new Set(ideas.map(x=>ident(x.add))),radarOnly=radar.filter(x=>!strictIds.has(ident(x.add))).slice(0,6),needs=pr.slice(0,2);
    $('content').innerHTML=`<div class="fgSectionHead"><div><h2>📈 Waiver Wire</h2><div class="fgMetaLine">${needs.length?`Primary needs: ${needs.map(n=>`${n.position} ROS #${n.ros_rank}`).join(' · ')}`:'Best verified available options'}</div></div><button class="fgActionBtn" data-fg-view="power">View full roster ranks</button></div><div class="fgDecisionGrid"><div class="card fgScrollCard"><h3>Recommendation</h3>${ideas.length?ideas.map((x,i)=>waiverMoveHTML(x,i,pr)).join(''):`<div class="hold">HOLD</div><div class="muted">No waiver move clearly improves the roster right now.</div>`}</div><div class="card fgScrollCard"><h3>🔭 Best Available / Watch</h3>${(radarOnly.length?radarOnly:radar).slice(0,6).map((x,i)=>waiverMoveHTML(x,i,pr,'wr')).join('')||'<div class="muted">No verified waiver candidates are available.</div>'}</div></div>`;
    fgWireViewButtons();
  };

  const baseTrades=renderTrades;
  renderTrades=function(){
    const ideas=tradeIdeas(),radar=tradeRadar(),m=mineTeam(),pr=m?needProfile(m):[],market=analysis?.market,strictTargets=new Set(ideas.flatMap(x=>x.get.map(ident))),radarOnly=radar.filter(x=>!strictTargets.has(ident(x.get[0]))).slice(0,6),needs=pr.slice(0,2),marketNote=market?`${market.available?'Market data active':'Market data unavailable'} · ${market.coverage_pct??0}% coverage`:'';
    $('content').innerHTML=`<div class="fgSectionHead"><div><h2>🤝 Trade Finder</h2><div class="fgMetaLine">${needs.length?`Primary needs: ${needs.map(n=>`${n.position} ROS #${n.ros_rank}`).join(' · ')}`:''}${needs.length&&marketNote?' · ':''}${marketNote}</div></div><button class="fgActionBtn" data-fg-view="power">View full roster ranks</button></div><div class="fgDecisionGrid"><div class="card fgScrollCard"><h3>Recommendation</h3>${ideas.length?ideas.map((x,i)=>tradeMoveHTML(x,i,'tr')).join(''):`<div class="hold">HOLD</div><div class="muted">No trade clears every roster-impact, fairness and realism check.</div>`}</div><div class="card fgScrollCard"><h3>🎯 Realistic Targets</h3>${(radarOnly.length?radarOnly:radar).slice(0,6).map((x,i)=>tradeMoveHTML(x,i,'rr')).join('')||'<div class="muted">No sufficiently plausible trade frameworks found.</div>'}</div></div>`;
    fgWireViewButtons();
  };
})();
