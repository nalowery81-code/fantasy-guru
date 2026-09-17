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
    if(opened){
      detail.dataset.userOpened='1';
      detail.style.display='block';
      requestAnimationFrame(()=>detail.scrollIntoView({behavior:'smooth',block:'nearest'}));
    }
  }

  function allPlayers(){
    const out=[],seen=new Set();
    for(const t of analysis?.team_details||[])for(const p of t?.players||[]){const k=String(p?.canonical_player_id||p?.sleeper_id||p?.espn_id||p?.id||p?.name||'');if(k&&!seen.has(k)){seen.add(k);out.push(p)}}
    for(const p of analysis?.waiver_pool||[]){const k=String(p?.canonical_player_id||p?.sleeper_id||p?.espn_id||p?.id||p?.name||'');if(k&&!seen.has(k)){seen.add(k);out.push(p)}}
    return out;
  }
  function playerKey(p){return String(p?.canonical_player_id||p?.sleeper_id||p?.espn_id||p?.id||p?.name||'')}
  function findPlayer(name,id){const q=String(name||'').trim().toLowerCase(),qid=String(id||'');return allPlayers().find(p=>qid&&playerKey(p)===qid)||allPlayers().find(p=>String(p?.name||'').trim().toLowerCase()===q)||null}
  function playerImage(p){if(p?.image||p?.headshot||p?.photo)return p.image||p.headshot||p.photo;if(p?.sleeper_id)return `https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(p.sleeper_id)}.jpg`;if(p?.espn_id)return `https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(p.espn_id)}.png`;return''}
  function avatar(p){const u=playerImage(p),ini=String(p?.name||'?').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();return `<span class="fgIntAvatar"><span>${E(ini)}</span>${u?`<img src="${E(u)}" alt="${E(p?.name||'Player')} headshot">`:''}</span>`}
  function pct(p){const v=p?.rostered_pct??p?.rostered_percentage??p?.percent_rostered??p?.ownership;return F(v)?`${N(v,0)}%`:'—'}
  function confidence(p){const x=String(p?.weekly_confidence||p?.player_advice?.confidence||'').toUpperCase();return x==='HIGH'?'High':x==='LOW'?'Low':x==='GOOD'?'Good':'Medium'}
  function opponent(p){return p?.opponent||p?.opp||p?.matchup_opponent||'—'}
  function tv(p){return F(p?.trade_value)?Number(p.trade_value):F(p?.tv)?Number(p.tv):null}

  function showPlayerHubDetail(p){
    const page=document.querySelector('.ph3Page,.ph2Page'),cards=page?.querySelector('.ph3Cards,.ph2Cards');if(!page||!cards||!p)return;
    let el=page.querySelector('#phDetail');if(!el){el=document.createElement('section');el.id='phDetail';el.className='fgIntDetail';cards.after(el)}
    const c=p?.trade_value_components||{},v=tv(p);
    el.innerHTML=`<div class="fgIntHead"><div class="fgIntTitle">${avatar(p)}<div><h3>${E(p.name||'Player')}</h3><p>${E(POS(p))} · ${E(p.team||'Free Agent')} · Opp ${E(opponent(p))}</p></div></div><button id="phDetailClose" aria-label="Close player details">×</button></div><div class="fgIntStats"><div><span>Week</span><b>${N(p.weekly_points)}</b></div><div><span>ROS</span><b>${N(p.ros_points)}</b></div><div class="tv"><span>Trade Value</span><b>${F(v)?Math.round(v):'—'}</b><small>${E(p.trade_value_label||'')}</small></div><div><span>Rostered</span><b>${pct(p)}</b></div><div><span>ESPN</span><b>${N(p.espn_weekly_points)}</b></div><div><span>Sleeper</span><b>${N(p.sleeper_weekly_points)}</b></div><div><span>ffanalytics</span><b>${N(p.ffanalytics_weekly_points)}</b></div><div><span>Confidence</span><b>${E(confidence(p))}</b></div></div>${F(v)?`<div class="fgTvWhy"><b>TV ${Math.round(v)} · Rest of Season</b><span>ROS ${F(c.ros_projection)?Math.round(c.ros_projection):'—'} · VORP ${F(c.value_over_replacement)?Math.round(c.value_over_replacement):'—'} · Market ${F(c.market)?Math.round(c.market):'—'} · Starter impact ${F(c.starter_impact)?Math.round(c.starter_impact):'—'} · Risk ${F(c.confidence_risk)?Math.round(c.confidence_risk):'—'}</span></div>`:''}`;
    const close=el.querySelector('#phDetailClose');if(close)close.onclick=()=>el.remove();
    el.querySelectorAll('img').forEach(x=>x.onerror=()=>x.style.display='none');
    requestAnimationFrame(()=>el.scrollIntoView({behavior:'smooth',block:'nearest'}));
  }

  function playerNameFromButton(btn){
    const row=btn.closest('tr'),card=btn.closest('.ph3Card,.ph2Card');
    return row?.querySelector('.ph3Player b,.ph2Player b')?.textContent||card?.querySelector('.ph3HeroPlayer b,.ph2HeroPlayer b')?.textContent||'';
  }

  document.addEventListener('click',e=>{
    const ss=e.target.closest('[data-close],.ss2View,.ss2Btn[data-player]');
    if(ss){setTimeout(()=>startSitDetail(true),0);return}

    const ph=e.target.closest('.ph3View[data-ph-waiver="0"],.ph3Btn[data-ph-action="view"],.ph2View[data-ph-waiver="0"],.ph2Btn[data-ph-action="view"]');
    if(ph){
      e.preventDefault();
      const p=findPlayer(playerNameFromButton(ph),ph.dataset.ph3Id||'');
      if(p)showPlayerHubDetail(p);
      return;
    }
  });

  const observer=new MutationObserver(()=>startSitDetail(false));
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>startSitDetail(false),0);

  const style=document.createElement('style');
  style.textContent=`
    #ss2Detail:empty{display:none}.ss2Top+#ss2Detail{margin-top:0;margin-bottom:0}.ss2Top+#ss2Detail:not(:empty){display:block}
    .fgIntDetail{background:#081524;border:1px solid #1e9bd7;border-radius:11px;padding:10px;color:#eef6ff}.fgIntHead{display:flex;justify-content:space-between;align-items:center}.fgIntTitle{display:flex;align-items:center;gap:9px}.fgIntTitle h3{margin:0;font-size:15px}.fgIntTitle p{margin:2px 0 0;color:#8fa6bf;font-size:8px}.fgIntHead button{background:none;border:0;color:#48cfff;font-size:22px;cursor:pointer}.fgIntAvatar{width:42px;height:42px;border-radius:50%;background:#17324a;display:grid;place-items:center;overflow:hidden;position:relative;flex:0 0 42px;font-size:9px;font-weight:900}.fgIntAvatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.fgIntStats{display:grid;grid-template-columns:repeat(8,1fr);gap:7px;margin-top:9px}.fgIntStats>div{background:#071421;border:1px solid #203c56;border-radius:7px;padding:8px}.fgIntStats>div.tv{border-color:#2a9b70}.fgIntStats span{display:block;color:#8fa6bf;font-size:8px}.fgIntStats b{display:block;font-size:13px;margin-top:2px}.fgIntStats small{display:block;color:#8ff0bc;font-size:7px;margin-top:2px}.fgTvWhy{margin-top:8px;background:#071421;border:1px solid #203c56;border-radius:7px;padding:8px}.fgTvWhy b{display:block;color:#8ff0bc;font-size:10px}.fgTvWhy span{display:block;color:#9fb3c8;font-size:8px;margin-top:3px}@media(max-width:1100px){.fgIntStats{grid-template-columns:repeat(3,1fr)}}`;
  document.head.appendChild(style);
})();
