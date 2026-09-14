/* Mobile nav drawer polish: vertical navigation, full-width controls, outside-tap close. */
(function(){
  const isMobile=()=>window.matchMedia('(max-width: 700px)').matches;
  function ensureBackdrop(){
    let b=document.getElementById('fg16NavBackdrop');
    if(!b){b=document.createElement('button');b.id='fg16NavBackdrop';b.type='button';b.setAttribute('aria-label','Close menu');b.onclick=()=>document.body.classList.add('fg11NavHidden');document.body.appendChild(b)}
    return b;
  }
  function sync(){
    if(!isMobile())return;
    ensureBackdrop();
    document.querySelectorAll('.sidebar .nav button').forEach(btn=>{if(!btn.dataset.fg16Close){btn.dataset.fg16Close='1';btn.addEventListener('click',()=>document.body.classList.add('fg11NavHidden'))}});
  }
  const s=document.createElement('style');s.textContent=`
    @media(max-width:700px){
      body.fg15Mobile .sidebar{padding:16px 14px!important;gap:10px!important;overflow-y:auto!important;overflow-x:hidden!important;align-items:stretch!important}
      body.fg15Mobile .sideBrand{width:100%!important;margin:0 0 8px!important;font-size:18px!important}
      body.fg15Mobile .sideLabel{font-size:10px!important;letter-spacing:.12em!important;margin-top:2px!important}
      body.fg15Mobile .sideSelect,body.fg15Mobile .sideAdd{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
      body.fg15Mobile .sideSelect{font-size:14px!important;padding:11px 36px 11px 12px!important}
      body.fg15Mobile .sideAdd{padding:11px 12px!important;font-size:13px!important}
      body.fg15Mobile .sidebar .nav{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:7px!important;width:100%!important;min-width:0!important;margin:4px 0 0!important}
      body.fg15Mobile .sidebar .nav button{display:flex!important;align-items:center!important;justify-content:flex-start!important;width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box!important;padding:12px 13px!important;border-radius:9px!important;font-size:14px!important;line-height:1.2!important;text-align:left!important;white-space:normal!important;overflow:hidden!important}
      body.fg15Mobile .sidebar .nav button.active{background:#56b4e9!important;color:#082033!important}
      body.fg15Mobile .sideFoot{margin-top:auto!important;font-size:10px!important;line-height:1.35!important;padding-top:12px!important}
      #fg16NavBackdrop{display:none;position:fixed;inset:0;border:0;background:rgba(2,8,20,.54);z-index:240;padding:0;margin:0}
      body.fg15Mobile:not(.fg11NavHidden) #fg16NavBackdrop{display:block!important}
      body.fg15Mobile .sidebar{z-index:250!important}
      body.fg15Mobile #fg11NavShow{z-index:260!important}
    }
  `;document.head.appendChild(s);
  const obs=new MutationObserver(sync);obs.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',sync);setTimeout(sync,0);
})();
