/* Central interaction controller for active Fantasy Guru pages. */
(function(){
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const F=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const N=(v,d=1)=>F(v)?Number(v).toFixed(d):'—';
  const POS=p=>typeof pos==='function'?pos(p?.position):String(p?.position||'').toUpperCase();

  function startSitDetail(opened=false){
    const page=document.querySelector('.ss2Page'),top=page?.querySelector('.ss2Top'),detail=page?.querySelector('#ss2Detail');
    if(!page||!top||!detail)return;
    if(detail.previousElementSibling!==top)top.after(detail);
    if(!detail.dataset.fgInit){detail.dataset.fgInit='1';if(!opened)detail.innerHTML=''}
    if(opened){detail.dataset.userOpened='1';detail.style.display='block';requestAnimationFrame(()=>detail.scrollIntoView({behavior:'smooth',block:'nearest'}))}
  }

  function allPlayers(){
    const out=[],seen=new Set();
    for(const t of analysis?.team_details||[])for(const p of t?.players||[]){const k=playerKey(p);if(k&&!seen.has(k)){seen.add(k);out.push(p)}}
    for(const p of analysis?.waiver_pool||[]){const k=playerKey(p);if(k&&!seen.has(k)){seen.add(k);out.push(p)}}
    return out;
  }
  function playerKey(p){return String(p?.canonical_player_id||p?.sleeper_id||p?.espn_id||p?.id||p?.name||'')}
  function findPlayer(name,id){const q=String(name||'').trim().toLowerCase(),qid=String(id||'');return allPlayers().find(p=>qid&&playerKey(p)===qid)||allPlayers().find(p=>String(p?.name||'').trim().toLowerCase()===q)||null}
  function playerImage(p){if(p?.image||p?.headshot||p?.photo)return p.image||p.headshot||p.photo;if(p?.sleeper_id)return `https://sleepercdn.com/content/nfl/players/${encodeURIComponent(p.sleeper_id)}.jpg`;if(p?.espn_id)return `https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(p.espn_id)}.png`;return''}
  function initials(p){return String(p?.name||'?').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}
  function pct(p){const v=p?.rostered_pct??p?.rostered_percentage??p?.percent_rostered??p?.ownership;return F(v)?`${N(v,0)}%`:'—'}
  function confidence(p){const x=String(p?.weekly_confidence||p?.player_advice?.confidence||'').toUpperCase();return x==='HIGH'?'High':x==='LOW'?'Low':x==='GOOD'?'Good':'Medium'}
  function opponent(p){return p?.opponent||p?.opp||p?.matchup_opponent||'—'}
  function tv(p){return F(p?.trade_value)?Number(p.trade_value):F(p?.tv)?Number(p.tv):null}
  function value(v,fallback='—'){return v!==null&&v!==undefined&&String(v)!==''?String(v):fallback}
  function statusText(p){return p?.injury_status||p?.status||p?.game_status||'No injury flag'}
  function heightText(p){const h=p?.height||p?.height_text;if(h)return String(h);const inches=Number(p?.height_inches);if(Number.isFinite(inches)&&inches>0)return `${Math.floor(inches/12)}'${inches%12}\"`;return'—'}
  function experienceText(p){const x=p?.years_exp??p?.experience??p?.exp;return F(x)?(Number(x)===0?'Rookie':`${Math.round(Number(x))} yr`):'—'}
  function tvBreakdown(c={}){const rows=[['ROS percentile',c.ros_projection,45],['Value over replacement',c.value_over_replacement,20],['FantasyCalc market',c.market,15],['Starter impact',c.starter_impact,10],['Week Outlook',F(c.week_outlook)?c.week_outlook:c.weekly_trend,5],['Confidence / risk',c.confidence_risk,5]].filter(([,v])=>F(v));return rows.map(([label,score,w])=>({label,score:Number(score),weight:w,contribution:Number(score)*w/100}))}

  function newsFor(p){
    const n=Array.isArray(window.nflNews)?window.nflNews:(typeof nflNews!=='undefined'&&Array.isArray(nflNews)?nflNews:[]),name=String(p?.name||'').toLowerCase(),last=name.split(/\s+/).pop();
    return n.filter(x=>{const t=`${x?.headline||''} ${x?.description||''}`.toLowerCase();return name&&t.includes(name)||last&&last.length>3&&t.includes(last)}).slice(0,3)
  }
  function recentResults(p){
    const rows=[];
    if(F(p?.actual_weekly_points))rows.push({week:C?.current_week||'',actual:Number(p.actual_weekly_points),proj:F(p?.weekly_points)?Number(p.weekly_points):null});
    const hist=p?.game_log||p?.game_logs||p?.weekly_history||p?.history;
    if(Array.isArray(hist))for(const x of hist){const actual=x?.fantasy_points??x?.points??x?.actual_weekly_points,proj=x?.projected_points??x?.projection??x?.weekly_points;if(F(actual)||F(proj))rows.push({week:x?.week??x?.wk??'—',actual:F(actual)?Number(actual):null,proj:F(proj)?Number(proj):null,opp:x?.opponent||x?.opp||''})}
    const seen=new Set();return rows.filter(x=>{const k=`${x.week}|${x.actual}|${x.proj}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,8)
  }

  function closePlayerModal(){document.getElementById('fgPlayerModal')?.remove();document.body.classList.remove('fgProfileOpen')}
  function showPlayerProfile(p){
    if(!p)return;closePlayerModal();
    const c=p?.trade_value_components||{},v=tv(p),parts=tvBreakdown(c),img=playerImage(p),news=newsFor(p),games=recentResults(p);
    const math=parts.map(x=>`<div class="fgPMath"><span>${E(x.label)}</span><b>${Math.round(x.score)}/100</b><em>${x.weight}%</em><strong>+${N(x.contribution,1)}</strong></div>`).join('');
    const newsHtml=news.length?news.map(x=>`<article class="fgPNews"><b>${E(x.headline||'NFL update')}</b><p>${E(x.description||'')}</p></article>`).join(''):`<div class="fgPEmpty">No player-specific news is loaded right now.</div>`;
    const gameHtml=games.length?`<table class="fgPGameTable"><thead><tr><th>WK</th><th>OPP</th><th>PROJ</th><th>ACTUAL</th></tr></thead><tbody>${games.map(x=>`<tr><td>${E(x.week)}</td><td>${E(x.opp||'—')}</td><td>${N(x.proj)}</td><td><b>${N(x.actual)}</b></td></tr>`).join('')}</tbody></table>`:`<div class="fgPEmpty">Completed weekly results are not loaded for this player yet.</div>`;
    const modal=document.createElement('div');modal.id='fgPlayerModal';modal.className='fgPOverlay';
    modal.innerHTML=`<section class="fgPModal" role="dialog" aria-modal="true" aria-label="${E(p.name||'Player')} profile"><button class="fgPClose" data-fg-profile-close aria-label="Close player profile">×</button><header class="fgPHero"><div class="fgPPhoto"><span>${E(initials(p))}</span>${img?`<img src="${E(img)}" alt="${E(p.name||'Player')} headshot">`:''}</div><div class="fgPIdentity"><div class="fgPTeam">${E(p.team||'NFL')} · ${E(POS(p))}</div><h2>${E(p.name||'Player')}</h2><div class="fgPBio"><span><small>AGE</small><b>${E(value(p.age))}</b></span><span><small>HEIGHT</small><b>${E(heightText(p))}</b></span><span><small>WEIGHT</small><b>${p.weight?E(String(p.weight))+' lb':'—'}</b></span><span><small>EXP</small><b>${E(experienceText(p))}</b></span><span><small>COLLEGE</small><b>${E(value(p.college))}</b></span></div></div><div class="fgPBadge"><small>TV</small><b>${F(v)?Math.round(v):'—'}</b><span>${E(p.trade_value_label||'')}</span></div></header><div class="fgPMetrics"><div><small>WEEK</small><b>${N(p.weekly_points)}</b></div><div><small>ROS</small><b>${N(p.ros_points)}</b></div><div><small>POS RANK</small><b>${F(c.position_rank)?'#'+Math.round(c.position_rank):'—'}</b></div><div><small>ROSTERED</small><b>${pct(p)}</b></div><div><small>OPP</small><b>${E(opponent(p))}</b></div><div><small>STATUS</small><b>${E(statusText(p))}</b></div></div><div class="fgPBody"><main><section class="fgPSection"><div class="fgPSectionHead"><h3>Projection Sources</h3><span>Week ${E(C?.current_week||'')}</span></div><div class="fgPSourceGrid"><div><small>ESPN</small><b>${N(p.espn_weekly_points)}</b></div><div><small>Sleeper</small><b>${N(p.sleeper_weekly_points)}</b></div><div><small>ffanalytics</small><b>${N(p.ffanalytics_weekly_points)}</b></div><div><small>Guru confidence</small><b>${E(confidence(p))}</b></div></div></section><section class="fgPSection"><div class="fgPSectionHead"><h3>Game Log / Recent Results</h3></div>${gameHtml}</section>${F(v)?`<section class="fgPSection"><div class="fgPSectionHead"><h3>Why Guru Values Him at TV ${Math.round(v)}</h3><span>Rest of Season</span></div><div class="fgPMathGrid">${math}</div><div class="fgPFoot">Replacement ROS ${F(c.replacement_ros_points)?N(c.replacement_ros_points):'—'} · Starter cutoff ${F(c.starter_cutoff)?Math.round(c.starter_cutoff):'—'} · Market ${F(p.market_value)?N(p.market_value,0):'No direct match'}</div></section>`:''}</main><aside><section class="fgPSection"><div class="fgPSectionHead"><h3>Latest News</h3></div>${newsHtml}</section><section class="fgPSection"><div class="fgPSectionHead"><h3>Player Info</h3></div><div class="fgPInfo"><div><span>Team</span><b>${E(p.team||'—')}</b></div><div><span>Position</span><b>${E(POS(p))}</b></div><div><span>Experience</span><b>${E(experienceText(p))}</b></div><div><span>College</span><b>${E(value(p.college))}</b></div><div><span>FantasyCalc rank</span><b>${F(p.market_overall_rank)?'#'+Math.round(p.market_overall_rank):'—'}</b></div><div><span>Market position rank</span><b>${F(p.market_position_rank)?'#'+Math.round(p.market_position_rank):'—'}</b></div></div></section></aside></div></section>`;
    document.body.appendChild(modal);document.body.classList.add('fgProfileOpen');
    modal.querySelector('[data-fg-profile-close]').onclick=closePlayerModal;modal.addEventListener('click',e=>{if(e.target===modal)closePlayerModal()});
    modal.querySelectorAll('img').forEach(x=>x.onerror=()=>x.style.display='none');
    setTimeout(()=>modal.querySelector('.fgPClose')?.focus(),0)
  }
  window.showFantasyGuruPlayerProfile=showPlayerProfile;

  function playerNameFromButton(btn){const row=btn.closest('tr'),card=btn.closest('.ph3Card,.ph2Card');return row?.querySelector('.ph3Player b,.ph2Player b')?.textContent||card?.querySelector('.ph3HeroPlayer b,.ph2HeroPlayer b')?.textContent||''}
  function playerFromClickable(el){
    const id=el?.dataset?.ph3Id||el?.closest?.('[data-ph3-id]')?.dataset?.ph3Id||'';
    const name=el?.querySelector?.('b')?.textContent||el?.closest?.('tr')?.querySelector?.('.ph3Player b,.ph2Player b,.ss2Player b,.mu4Player b')?.textContent||'';
    return findPlayer(name,id)
  }

  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('fgPlayerModal'))closePlayerModal()});
  document.addEventListener('click',e=>{
    const ss=e.target.closest('[data-close],.ss2View,.ss2Btn[data-player]');if(ss){setTimeout(()=>startSitDetail(true),0);return}
    const ph=e.target.closest('.ph3View[data-ph-waiver="0"],.ph3Btn[data-ph-action="view"],.ph2View[data-ph-waiver="0"],.ph2Btn[data-ph-action="view"]');
    if(ph){e.preventDefault();const p=findPlayer(playerNameFromButton(ph),ph.dataset.ph3Id||'');if(p)showPlayerProfile(p);return}
    if(e.target.closest('button,a,input,select,textarea'))return;
    const clickable=e.target.closest('.ph3Player,.ph3HeroPlayer,.ph2Player,.ph2HeroPlayer,.ss2Player,.mu4Player');
    if(clickable){const p=playerFromClickable(clickable);if(p){e.preventDefault();showPlayerProfile(p)}}
  });

  const observer=new MutationObserver(()=>startSitDetail(false));observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>startSitDetail(false),0);
  const style=document.createElement('style');style.textContent=`
    #ss2Detail:empty{display:none}.ss2Top+#ss2Detail{margin-top:0;margin-bottom:0}.ss2Top+#ss2Detail:not(:empty){display:block}
    .ph3Player,.ph3HeroPlayer,.ph2Player,.ph2HeroPlayer,.ss2Player,.mu4Player{cursor:pointer}.ph3Player:hover b,.ph3HeroPlayer:hover b,.ss2Player:hover b,.mu4Player:hover b{text-decoration:underline}
    body.fgProfileOpen{overflow:hidden}.fgPOverlay{position:fixed;inset:0;z-index:99999;background:rgba(2,8,18,.72);display:grid;place-items:center;padding:18px}.fgPModal{width:min(1080px,96vw);max-height:92vh;overflow:auto;background:#0a1626;border:1px solid #31506d;border-radius:14px;color:#edf6ff;box-shadow:0 24px 80px rgba(0,0,0,.45);position:relative}.fgPClose{position:absolute;right:14px;top:12px;z-index:3;background:transparent;border:0;color:#78d7ff;font-size:27px;cursor:pointer}.fgPHero{display:grid;grid-template-columns:145px 1fr auto;gap:18px;align-items:end;padding:18px 54px 16px 18px;background:linear-gradient(120deg,#173255,#253d6e 52%,#38216a)}.fgPPhoto{height:150px;border-radius:12px 12px 0 0;background:#142a42;display:grid;place-items:center;overflow:hidden;position:relative;font-size:32px;font-weight:900}.fgPPhoto img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top}.fgPTeam{font-size:10px;color:#8fdcff;font-weight:800}.fgPIdentity h2{font-size:31px;margin:3px 0 13px}.fgPBio{display:flex;flex-wrap:wrap;gap:0}.fgPBio span{padding:0 13px;border-right:1px solid rgba(255,255,255,.18)}.fgPBio span:first-child{padding-left:0}.fgPBio small,.fgPMetrics small,.fgPSourceGrid small{display:block;color:#9fb2c7;font-size:8px;font-weight:800}.fgPBio b{font-size:15px}.fgPBadge{min-width:86px;text-align:center;background:#071421;border:1px solid #38c996;border-radius:11px;padding:9px}.fgPBadge small{display:block;color:#8fa6bf;font-size:8px}.fgPBadge b{display:block;color:#73f0b8;font-size:28px}.fgPBadge span{font-size:8px;color:#a5f3cf}.fgPMetrics{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:#1c3349}.fgPMetrics>div{background:#0a1828;padding:10px 12px}.fgPMetrics b{display:block;font-size:14px;margin-top:2px}.fgPBody{display:grid;grid-template-columns:minmax(0,2.15fr) minmax(260px,.85fr);gap:12px;padding:12px}.fgPBody main,.fgPBody aside{display:grid;gap:12px;align-content:start}.fgPSection{background:#081524;border:1px solid #203d58;border-radius:10px;padding:11px}.fgPSectionHead{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.fgPSectionHead h3{margin:0;font-size:13px}.fgPSectionHead span{font-size:8px;color:#8198ad}.fgPSourceGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.fgPSourceGrid>div{background:#071421;border:1px solid #193650;border-radius:7px;padding:8px}.fgPSourceGrid b{display:block;font-size:15px;margin-top:2px}.fgPGameTable{width:100%;border-collapse:collapse;font-size:9px}.fgPGameTable th{color:#8fa6bf;text-align:left;padding:6px;border-bottom:1px solid #27435e}.fgPGameTable td{padding:7px 6px;border-bottom:1px solid #183149}.fgPMathGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.fgPMath{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;background:#091a2a;border:1px solid #183149;border-radius:6px;padding:7px 8px;font-size:8px}.fgPMath em{font-style:normal;color:#7891a8}.fgPMath strong{color:#8ff0bc}.fgPFoot{margin-top:8px;color:#8fa6bf;font-size:8px}.fgPNews{padding:8px 0;border-bottom:1px solid #1d364e}.fgPNews:first-of-type{padding-top:0}.fgPNews b{font-size:10px}.fgPNews p{font-size:8px;line-height:1.45;color:#9db1c5;margin:3px 0 0}.fgPEmpty{font-size:9px;color:#8499ae;padding:10px 0}.fgPInfo{display:grid;gap:0}.fgPInfo>div{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #193149;font-size:9px}.fgPInfo span{color:#8fa6bf}.fgPInfo b{text-align:right}@media(max-width:850px){.fgPOverlay{padding:6px}.fgPModal{width:100%;max-height:96vh}.fgPHero{grid-template-columns:90px 1fr;padding-right:44px}.fgPPhoto{height:105px}.fgPBadge{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:8px}.fgPBadge b{font-size:20px}.fgPIdentity h2{font-size:22px}.fgPBio{gap:8px}.fgPBio span{padding:0 7px}.fgPMetrics{grid-template-columns:repeat(3,1fr)}.fgPBody{grid-template-columns:1fr}.fgPSourceGrid{grid-template-columns:repeat(2,1fr)}.fgPMathGrid{grid-template-columns:1fr}}
  `;document.head.appendChild(style);
})();