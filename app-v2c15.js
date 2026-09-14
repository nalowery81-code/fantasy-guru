/* Mobile responsive shell + matchup workspace. Presentation only; fantasy logic is unchanged. */
(function(){
  const MOBILE='(max-width: 700px)';
  let mobileSide='you';
  const isMobile=()=>window.matchMedia(MOBILE).matches;

  function mobileShell(){
    if(!isMobile())return;
    document.body.classList.add('fg15Mobile','fg11NavHidden','fg11GuruHidden');
    const menu=$('fg11NavShow');if(menu){menu.style.display='grid';menu.textContent='☰';menu.setAttribute('aria-label','Open menu')}
    const ask=$('fg11GuruShow');if(ask){ask.style.display='block';ask.textContent='🧠 Ask Guru'}
  }

  function closeMobileNav(){if(isMobile())document.body.classList.add('fg11NavHidden')}
  function wireMobileNav(){
    if(!isMobile())return;
    document.querySelectorAll('.sidebar .nav button').forEach(b=>{if(!b.dataset.fg15MobileWired){b.dataset.fg15MobileWired='1';b.addEventListener('click',()=>setTimeout(closeMobileNav,0))}});
    const sel=$('leagueSelect');if(sel&&!sel.dataset.fg15MobileWired){sel.dataset.fg15MobileWired='1';sel.addEventListener('change',()=>setTimeout(closeMobileNav,0))}
  }

  function ensureTeamToggle(){
    if(!isMobile()||currentView!=='matchup')return;
    const teams=document.querySelector('.fg10Teams');if(!teams)return;
    let toggle=document.querySelector('.fg15TeamToggle');
    if(!toggle){
      toggle=document.createElement('div');toggle.className='fg15TeamToggle';
      toggle.innerHTML='<button type="button" data-side="you">My Team</button><button type="button" data-side="them">Opponent</button>';
      teams.before(toggle);
      toggle.querySelectorAll('button').forEach(b=>b.onclick=()=>{mobileSide=b.dataset.side||'you';applyTeamSide()});
    }
    applyTeamSide();
  }

  function applyTeamSide(){
    const teams=document.querySelector('.fg10Teams');if(!teams)return;
    const cards=[...teams.querySelectorAll(':scope > .fg10Team')];
    cards.forEach((c,i)=>c.classList.toggle('fg15ActiveTeam',mobileSide==='you'?i===0:i===1));
    document.querySelectorAll('.fg15TeamToggle button').forEach(b=>b.classList.toggle('active',b.dataset.side===mobileSide));
  }

  function enhance(){mobileShell();wireMobileNav();ensureTeamToggle()}

  const style=document.createElement('style');style.textContent=`
    @media(max-width:700px){
      html,body{overflow-x:hidden!important}
      body.fg15Mobile #shell{display:block!important;min-height:100vh!important}
      body.fg15Mobile .main{width:100%!important;max-width:none!important;margin:0!important;padding:58px 8px 14px!important}
      body.fg15Mobile .panel{min-height:0!important;padding:6px!important;overflow:visible!important}
      body.fg15Mobile .topbar{display:none!important}

      body.fg15Mobile .sidebar{display:flex!important;position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:min(82vw,300px)!important;z-index:250!important;transform:translateX(0)!important;transition:transform .2s ease,visibility .2s ease!important;box-shadow:12px 0 35px rgba(0,0,0,.5)!important;visibility:visible!important;pointer-events:auto!important;overflow:hidden!important}
      body.fg15Mobile.fg11NavHidden .sidebar{transform:translateX(-110%)!important;left:0!important;visibility:hidden!important;pointer-events:none!important;box-shadow:none!important}
      body.fg15Mobile #fg11NavShow{display:grid!important;position:fixed!important;left:10px!important;top:10px!important;width:42px!important;height:42px!important;border-radius:10px!important;font-size:22px!important;z-index:260!important}
      body.fg15Mobile:not(.fg11NavHidden) #fg11NavShow{display:none!important}
      body.fg15Mobile #fg11NavToggle{display:grid!important}

      body.fg15Mobile #fg7Guru{display:flex!important;position:fixed!important;left:8px!important;right:8px!important;top:auto!important;bottom:8px!important;width:auto!important;height:min(72vh,620px)!important;max-height:72vh!important;z-index:270!important;border-radius:14px!important;transform:translateY(0)!important;transition:transform .2s ease!important}
      body.fg15Mobile.fg11GuruHidden #fg7Guru{transform:translateY(calc(100% + 20px))!important;pointer-events:none!important}
      body.fg15Mobile #fg11GuruShow{display:block!important;position:fixed!important;right:10px!important;top:auto!important;bottom:14px!important;padding:10px 13px!important;font-size:12px!important;z-index:265!important;border-radius:999px!important}
      body.fg15Mobile:not(.fg11GuruHidden) #fg11GuruShow{display:none!important}
      body.fg15Mobile .fg7GuruHead{grid-template-columns:1fr auto auto!important}

      body.fg15Mobile .fg10Wrap{width:100%!important;max-width:none!important;margin:0!important}
      body.fg15Mobile .fg10Title{margin:0 0 7px 50px!important;align-items:flex-start!important}
      body.fg15Mobile .fg10Title h2{font-size:18px!important}
      body.fg15Mobile .fg10Title span{font-size:10px!important;line-height:1.35!important}
      body.fg15Mobile .fg10Title>b{font-size:11px!important;padding-top:3px!important}
      body.fg15Mobile .fg10Score{grid-template-columns:1fr 38px 1fr!important;gap:5px!important;padding:9px 7px 28px!important;margin-bottom:9px!important}
      body.fg15Mobile .fg10Score>div b{font-size:11px!important;white-space:normal!important}
      body.fg15Mobile .fg10Score strong{font-size:24px!important}
      body.fg15Mobile .fg10Score small{font-size:9px!important}
      body.fg15Mobile .fg10Score>span{width:32px!important;height:32px!important;font-size:9px!important}
      body.fg15Mobile .fg10Score em{font-size:8.5px!important;bottom:-6px!important;white-space:nowrap!important}

      body.fg15Mobile .fg10Alerts{grid-template-columns:1fr!important;gap:6px!important;margin:12px 0 8px!important}
      body.fg15Mobile .fg10Alerts>div,body.fg15Mobile .fg10Alerts>button{padding:9px!important;grid-template-columns:24px 1fr!important}
      body.fg15Mobile .fg10Alerts b{font-size:12px!important}
      body.fg15Mobile .fg10Alerts small{font-size:10px!important}

      .fg15TeamToggle{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:8px 0;padding:4px;background:#071524;border:1px solid #28405d;border-radius:10px;position:sticky;top:6px;z-index:30}
      .fg15TeamToggle button{border:0;border-radius:7px;background:transparent;color:#93a9c0;padding:9px 7px;font-size:11px;font-weight:900}
      .fg15TeamToggle button.active{background:#1597d1;color:#041b2a}
      body.fg15Mobile .fg10Teams{display:block!important}
      body.fg15Mobile .fg10Teams>.fg10Team{display:none!important;width:100%!important}
      body.fg15Mobile .fg10Teams>.fg10Team.fg15ActiveTeam{display:block!important}
      body.fg15Mobile .fg10TeamHead{padding:9px 10px!important}
      body.fg15Mobile .fg10TeamHead h3{font-size:15px!important}
      body.fg15Mobile .fg10TeamHead span{font-size:9px!important}
      body.fg15Mobile .fg10TeamHead strong{font-size:12px!important}

      body.fg15Mobile .fg10ColHead{grid-template-columns:44px minmax(0,1fr) 50px 54px 58px!important;gap:4px!important;padding:6px 8px!important;font-size:8px!important}
      body.fg15Mobile .fg10ColHead>span:nth-child(n+6){display:none!important}
      body.fg15Mobile .fg10PlayerMain{display:grid!important;grid-template-columns:44px minmax(82px,1fr) 48px 50px 54px 14px!important;grid-template-rows:auto auto!important;gap:3px 4px!important;padding:9px 8px 6px!important;align-items:center!important}
      body.fg15Mobile .fg10Slot{grid-column:1;grid-row:1 / span 2;font-size:10px!important;align-self:center!important}
      body.fg15Mobile .fg10Identity{grid-column:2 / 6;grid-row:1;min-width:0!important;padding-right:4px!important}
      body.fg15Mobile .fg10Identity b{font-size:13px!important;line-height:1.2!important}
      body.fg15Mobile .fg10Identity small{font-size:9px!important;margin-top:2px!important}
      body.fg15Mobile .fg12StatusWrap{margin-left:5px!important}
      body.fg15Mobile .fg10Status{font-size:8px!important;padding:2px 6px!important}
      body.fg15Mobile .fg10PlayerMain>.fg10Num:nth-of-type(1){grid-column:3;grid-row:2}
      body.fg15Mobile .fg10PlayerMain>.fg10Num:nth-of-type(2){grid-column:4;grid-row:2}
      body.fg15Mobile .fg10PlayerMain>.fg10Num:nth-of-type(3){grid-column:5;grid-row:2}
      body.fg15Mobile .fg10Num{text-align:center!important}
      body.fg15Mobile .fg10Num b{font-size:12px!important}
      body.fg15Mobile .fg10Num small{font-size:7px!important}
      body.fg15Mobile .fg10Arrow{grid-column:6;grid-row:1 / span 2;font-size:18px!important}
      body.fg15Mobile .fg12IntelBar{margin:0 7px 8px 52px!important;padding:7px 8px!important;display:block!important}
      body.fg15Mobile .fg12IntelText{display:block!important;font-size:10.5px!important;line-height:1.42!important;white-space:normal!important}
      body.fg15Mobile .fg12IntelMeta{display:block!important;margin-top:4px!important;font-size:8px!important;text-align:left!important;white-space:normal!important}
      body.fg15Mobile .fg10Detail{padding:8px 10px 9px 52px!important}
      body.fg15Mobile .fg10Detail>div{grid-template-columns:1fr!important;gap:2px!important}
      body.fg15Mobile .fg10Detail b{font-size:8px!important}
      body.fg15Mobile .fg10Detail span{font-size:10px!important}
      body.fg15Mobile .fg10SectionLabel{font-size:10px!important;padding:6px 8px!important}

      body.fg15Mobile .fg6Dash{width:100%!important;max-width:none!important;display:block!important}
      body.fg15Mobile .fg6Dash>*{margin-bottom:8px!important}
      body.fg15Mobile .fg6Split,body.fg15Mobile .fg6WeekGrid,body.fg15Mobile .fg8ActionPair{display:grid!important;grid-template-columns:minmax(0,1fr)!important;width:100%!important}
      body.fg15Mobile .fg6Ranks{grid-template-columns:repeat(5,minmax(0,1fr))!important}
      body.fg15Mobile .fg6Card{padding:9px!important;min-width:0!important;width:100%!important;overflow:hidden!important}
      body.fg15Mobile .fg6NewsRow{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:4px!important;width:100%!important;min-width:0!important;padding:8px 0!important;align-items:start!important}
      body.fg15Mobile .fg6NewsRow>a,body.fg15Mobile .fg6NewsRow>b{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;font-size:11px!important;line-height:1.35!important}
      body.fg15Mobile .fg6NewsRow>span{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;font-size:9.5px!important;line-height:1.4!important;text-align:left!important;margin:0!important}
      body.fg15Mobile .fg6Bottom{display:grid!important;grid-template-columns:minmax(0,1fr)!important;width:100%!important}
    }
    @media(min-width:701px){.fg15TeamToggle{display:none!important}}
  `;document.head.appendChild(style);

  const baseShow=showView;
  showView=function(v){const out=baseShow(v);setTimeout(enhance,0);return out};
  const baseShell=renderShell;
  renderShell=function(i){const out=baseShell(i);setTimeout(enhance,0);return out};

  const observer=new MutationObserver(()=>{if(isMobile())requestAnimationFrame(enhance)});
  const content=$('content');if(content)observer.observe(content,{childList:true,subtree:true});
  window.addEventListener('resize',()=>{if(isMobile())enhance();else document.body.classList.remove('fg15Mobile')});
  setTimeout(enhance,0);
})();
