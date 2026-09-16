/* Dashboard route owner: send Dashboard directly to the core renderer, bypassing legacy wrappers. */
(function(){
  const coreDashboard=renderDashboard;
  const priorShowView=showView;

  showView=function(v){
    if(v==='dashboard'){
      currentView='dashboard';
      const nav=$('nav');
      if(nav)nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.view==='dashboard'));
      return coreDashboard();
    }
    return priorShowView(v);
  };

  if(C&&analysis&&currentView==='dashboard')coreDashboard();
})();
