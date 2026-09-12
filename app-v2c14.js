/* Progressive Matchup Intel loading: render cached data immediately, refresh only missing/stale sides. */
(function(){
  function emptyIntel(){return{players:[],generated_at:''}}
  function cachedIntel(team){try{return(typeof readIntelCache==='function'&&team?readIntelCache(team)?.data:null)||null}catch{return null}}
  function wireMatchup(){
    $('content')?.querySelectorAll('[data-fg10-toggle]').forEach(b=>b.onclick=()=>b.closest('[data-fg10-player]')?.classList.toggle('open'));
    $('content')?.querySelectorAll('[data-fg10-view]').forEach(b=>b.onclick=()=>showView(b.dataset.fg10View));
    if(typeof fg12PolishMatchup==='function')fg12PolishMatchup();
    if(typeof fg12WireAlerts==='function')fg12WireAlerts();
  }
  function paint(d,youTeam,themTeam,intels,refreshing){
    const teams={you:youTeam,them:themTeam},edge=Number(d.you?.projection||0)-Number(d.them?.projection||0),edgeTxt=`${edge>=0?'+':''}${edge.toFixed(1)} projected ${edge>=0?'advantage':'deficit'}`;
    const freshNote=refreshing?'<span class="fg14Refreshing">Updating uncached intel…</span>':'';
    $('content').innerHTML=`<div class="fg10Wrap"><div class="fg10Title"><div><h2>⚔️ Matchup Center</h2><span>Live score, projections and cached player intel for both teams. ${freshNote}</span></div><b>Week ${esc(C.current_week)}</b></div><section class="fg10Score"><div><b>${esc(d.you.team)}</b><strong>${Number(d.you.actual||0).toFixed(1)}</strong><small>Proj ${Number(d.you.projection||0).toFixed(1)}</small></div><span>VS</span><div><b>${esc(d.them.team)}</b><strong>${Number(d.them.actual||0).toFixed(1)}</strong><small>Proj ${Number(d.them.projection||0).toFixed(1)}</small></div><em class="${edge>=0?'good':'bad'}">${esc(edgeTxt)}</em></section>${fg10AlertHTML(d,teams,intels)}<div class="fg10Teams">${fg10TeamCard(d.you.team,d.you,youTeam,intels.you)}${fg10TeamCard(d.them.team,d.them,themTeam,intels.them)}</div></div>`;
    wireMatchup();
  }
  async function progressiveMatchup(){
    const d=matchupData;if(!d?.available){$('content').innerHTML=`<h2>⚔️ Matchup</h2><div class="card muted">${esc(d?.message||'Matchup unavailable.')}</div>`;return}
    const youTeam=fg10TeamByName(d.you?.team)||C?.league_teams?.find(t=>String(t.roster_id)===String(C?.my_team?.roster_id))||null,themTeam=fg10TeamByName(d.them?.team)||null;
    const cy=cachedIntel(youTeam),ct=cachedIntel(themTeam),intels={you:cy||emptyIntel(),them:ct||emptyIntel()};
    const missing=[];if(!cy)missing.push(['you',youTeam]);if(!ct)missing.push(['them',themTeam]);
    paint(d,youTeam,themTeam,intels,missing.length>0);
    if(!missing.length)return;
    await Promise.all(missing.map(async([side,team])=>{intels[side]=await fg10LoadIntel(team);paint(d,youTeam,themTeam,intels,true)}));
    paint(d,youTeam,themTeam,intels,false);
  }
  const s=document.createElement('style');s.textContent='.fg14Refreshing{color:#fbbf24;font-weight:800;margin-left:4px}.fg10Title span{display:inline-block}';document.head.appendChild(s);
  renderMatchup=progressiveMatchup;
})();
