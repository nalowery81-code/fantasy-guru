/* Focus mode: reclaim screen space for dense fantasy views without changing decision logic. */
(function(){
  const LS_NAV='fg-ui-nav-hidden-v1',LS_GURU='fg-ui-guru-hidden-v1';
  const style=document.createElement('style');style.textContent=`
    body.fg11NavHidden #shell{display:block!important;min-height:100vh!important}
    body.fg11NavHidden .main{width:100%!important;max-width:none!important;margin:0!important}
    body.fg11NavHidden .sidebar{position:fixed!important;left:-230px!important;top:0!important;width:205px!important;z-index:90!important;transition:left .18s ease!important;box-shadow:8px 0 25px rgba(0,0,0,.35)}
    body:not(.fg11NavHidden) .sidebar{transition:left .18s ease!important}
    .sideBrand{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important}
    #fg11NavToggle{flex:0 0 auto;width:31px;height:31px;display:grid;place-items:center;border:1px solid #315b7f;background:#0b1b2c;color:#d9f2ff;border-radius:7px;font-size:17px;line-height:1;cursor:pointer}
    #fg11NavToggle:hover{border-color:#38bdf8;background:#102a43}
    #fg11NavShow,#fg11GuruShow{position:fixed;z-index:120;border:1px solid #3974a3;background:#0a1a2a;color:#d9f2ff;border-radius:9px;font-weight:900;box-shadow:0 5px 18px rgba(0,0,0,.28)}
    #fg11NavShow{left:9px;top:9px;width:38px;height:38px;padding:0;font-size:20px;display:grid;place-items:center}
    #fg11GuruShow{right:12px;top:74px;padding:10px 14px;font-size:13px;background:#102a43;border-color:#38bdf8;color:#f0f9ff;letter-spacing:.1px}
    #fg11GuruShow:hover{background:#153a59;border-color:#67e8f9;transform:translateY(-1px)}
    body:not(.fg11NavHidden) #fg11NavShow,body:not(.fg11GuruHidden) #fg11GuruShow{display:none!important}
    #fg11GuruHide{border:1px solid #315b7f;background:#0b1b2c;color:#d6efff;border-radius:7px;padding:5px 8px;font-size:9px;font-weight:900}
    body.fg11GuruHidden #fg7Guru{transform:translateX(calc(100% + 24px))!important;pointer-events:none!important}
    body.fg11GuruHidden .main{padding-right:16px!important}
    body.fg11GuruHidden .fg6Dash{max-width:none!important;width:100%!important}
    body.fg11NavHidden .main{padding-left:16px!important}
    body.fg11NavHidden.fg11GuruHidden .main{padding:10px 16px!important}
    body.fg11Focus .fg10Wrap{max-width:none!important;width:100%!important}
    body.fg11Focus .panel{padding:10px!important}
    body.fg11Focus .fg10Title h2{font-size:21px!important}
    body.fg11Focus .fg10Title span{font-size:12px!important}
    body.fg11Focus .fg10Score>div b{font-size:15px!important}
    body.fg11Focus .fg10Score strong{font-size:30px!important}
    body.fg11Focus .fg10Score small{font-size:11px!important}
    body.fg11Focus .fg10Alerts b{font-size:12px!important}
    body.fg11Focus .fg10Alerts small{font-size:10.5px!important;line-height:1.35!important}
    body.fg11Focus .fg10TeamHead h3{font-size:14px!important}
    body.fg11Focus .fg10TeamHead strong{font-size:12px!important}
    body.fg11Focus .fg10ColHead{font-size:9px!important;padding:7px 9px!important}
    body.fg11Focus .fg10PlayerMain{padding:8px 9px!important}
    body.fg11Focus .fg10Slot{font-size:11px!important}
    body.fg11Focus .fg10Identity b{font-size:13px!important;line-height:1.25!important}
    body.fg11Focus .fg10Identity small{font-size:10px!important;margin-top:2px!important}
    body.fg11Focus .fg10Status{font-size:9px!important;padding:3px 7px!important}
    body.fg11Focus .fg10Num b{font-size:13px!important}
    body.fg11Focus .fg10Num small{font-size:8px!important}
    body.fg11Focus .fg10SectionLabel{font-size:10px!important;padding:6px 9px!important}
    body.fg11Focus .fg10Detail{padding:9px 12px 10px 59px!important}
    body.fg11Focus .fg10Detail b{font-size:10px!important}
    body.fg11Focus .fg10Detail span{font-size:11px!important;line-height:1.45!important}
    @media(max-width:1450px){body.fg11Focus .fg10Identity b{font-size:12px!important}}
    @media(max-width:1100px){#fg11NavShow,#fg11GuruShow{display:none!important}}
  `;document.head.appendChild(style);

  function boolRead(k,def){try{const v=localStorage.getItem(k);return v==null?def:v==='1'}catch{return def}}
  function boolSave(k,v){try{localStorage.setItem(k,v?'1':'0')}catch{}}
  function setNav(hidden,persist=false){document.body.classList.toggle('fg11NavHidden',!!hidden);if(persist)boolSave(LS_NAV,!!hidden)}
  function setGuru(hidden,persist=false){document.body.classList.toggle('fg11GuruHidden',!!hidden);if(persist)boolSave(LS_GURU,!!hidden)}
  function ensureButtons(){
    const old=$('fg11NavHide');if(old)old.remove();
    if(!$('fg11NavShow')){const b=document.createElement('button');b.id='fg11NavShow';b.textContent='☰';b.title='Open menu';b.setAttribute('aria-label','Open menu');b.onclick=()=>setNav(false,true);document.body.appendChild(b)}
    else{$('fg11NavShow').textContent='☰';$('fg11NavShow').title='Open menu'}
    if(!$('fg11GuruShow')){const b=document.createElement('button');b.id='fg11GuruShow';b.textContent='🧠 Ask Guru';b.setAttribute('aria-label','Open Ask Guru');b.onclick=()=>setGuru(false,true);document.body.appendChild(b)}
    else $('fg11GuruShow').textContent='🧠 Ask Guru';
    const brand=document.querySelector('.sideBrand');if(brand&&!$('fg11NavToggle')){const b=document.createElement('button');b.id='fg11NavToggle';b.textContent='☰';b.title='Hide menu';b.setAttribute('aria-label','Hide menu');b.onclick=()=>setNav(true,true);brand.appendChild(b)}
    const head=document.querySelector('.fg7GuruHead');if(head&&!$('fg11GuruHide')){const b=document.createElement('button');b.id='fg11GuruHide';b.textContent='Hide';b.onclick=()=>setGuru(true,true);head.appendChild(b)}
  }
  function applyView(v){
    ensureButtons();const focus=v==='matchup';document.body.classList.toggle('fg11Focus',focus);
    if(focus){setNav(boolRead(LS_NAV,true));setGuru(boolRead(LS_GURU,true))}
    else{setNav(false);setGuru(false)}
  }
  const baseShow=showView;showView=function(v){const out=baseShow(v);applyView(v);return out};
  const baseShell=renderShell;renderShell=function(idx){const out=baseShell(idx);setTimeout(()=>applyView(currentView||'dashboard'),0);return out};
  ensureButtons();applyView(currentView||'dashboard');
})();
