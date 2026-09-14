/* First-paint stability: never flash the retired league gate; reveal dashboard only after layout layers settle. */
(function(){
  /* The old league gate is retired as startup UI, but remains available for Add League. */
  const baseAdd=showAddForm;
  showAddForm=function(){
    document.body.classList.remove('fg31NoGate');
    return baseAdd();
  };

  const baseOpen=openLeague;
  openLeague=async function(i){
    document.body.classList.add('fg31NoGate');
    return baseOpen(i);
  };

  /* If a legacy Back to Leagues path is reached, return to the dashboard instead of reviving the old home screen. */
  backToLeagues=function(){
    document.body.classList.add('fg31NoGate');
    if(C){
      $('gate')?.classList.add('hidden');
      $('shell')?.classList.remove('hidden');
      showView('dashboard');
      return;
    }
    const ls=leagues();
    const i=Math.max(0,Math.min(ls.length-1,Number(localStorage.getItem('fg-last-league-index')||0)));
    if(ls.length)openLeague(i);
  };

  let revealTimer=null;
  function hideDashboardAssembly(){
    document.body.classList.add('fg31DashboardBuilding');
    clearTimeout(revealTimer);
    revealTimer=setTimeout(()=>{
      requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove('fg31DashboardBuilding')));
    },70);
  }

  const baseRender=renderDashboard;
  renderDashboard=function(){
    hideDashboardAssembly();
    const out=baseRender();
    clearTimeout(revealTimer);
    revealTimer=setTimeout(()=>{
      requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove('fg31DashboardBuilding')));
    },90);
    return out;
  };

  const baseShow=showView;
  showView=function(v){
    if(v==='dashboard')hideDashboardAssembly();
    const out=baseShow(v);
    if(v!=='dashboard')document.body.classList.remove('fg31DashboardBuilding');
    return out;
  };

  /* Startup should never display the retired gate even for one frame. */
  document.body.classList.add('fg31NoGate');

  const style=document.createElement('style');
  style.textContent=`
    body.fg31NoGate #gate{display:none!important}
    body.fg31DashboardBuilding #content{visibility:hidden!important}
    body.fg31DashboardBuilding #content::before{content:''}
    #content{transition:none!important}
  `;
  document.head.appendChild(style);
})();
