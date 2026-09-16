/* Dashboard render guard: keep the approved c40 dashboard active after async app initialization. */
(function(){
  const content=document.getElementById('content');
  const approvedRender=(typeof renderDashboard==='function')?renderDashboard:null;
  let applying=false;

  function onDashboard(){
    try{return typeof currentView==='undefined'||currentView==='dashboard';}
    catch{return true;}
  }

  function ensureApprovedDashboard(){
    if(applying||!content||!approvedRender)return;
    if(!onDashboard()){
      document.body.classList.remove('fg40Boot');
      return;
    }
    if(content.querySelector('.fg40Dash')){
      document.body.classList.remove('fg40Boot');
      return;
    }
    applying=true;
    try{approvedRender();}
    catch(err){console.error('Fantasy Guru approved dashboard render failed',err);}
    finally{applying=false;}
    if(content.querySelector('.fg40Dash'))document.body.classList.remove('fg40Boot');
  }

  if(content){
    const observer=new MutationObserver(()=>queueMicrotask(ensureApprovedDashboard));
    observer.observe(content,{childList:true});
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries+=1;
    ensureApprovedDashboard();
    if(content?.querySelector('.fg40Dash')||tries>=100){
      clearInterval(timer);
      if(tries>=100)document.body.classList.remove('fg40Boot');
    }
  },50);

  setTimeout(()=>document.body.classList.remove('fg40Boot'),5000);
})();