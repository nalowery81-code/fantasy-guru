/* Startup performance controller: fast first paint, short-lived analytics cache, background refresh. */
(function(){
  const CACHE_PREFIX='fg-startup-analysis:v1:';
  const CACHE_TTL=15*60*1000;
  let refreshSeq=0;
  let publicStarted=false;

  function contextKey(c=C){
    if(!c)return'';
    return `${String(c.platform||'').toLowerCase()}:${String(c?.league?.id||'')}:${String(c?.my_team?.roster_id||'')}:w${String(c?.current_week||'')}`;
  }
  function cacheKey(c=C){const k=contextKey(c);return k?CACHE_PREFIX+k:''}
  function readCache(c=C){
    try{
      const raw=localStorage.getItem(cacheKey(c));
      if(!raw)return null;
      const x=JSON.parse(raw);
      if(!x?.analysis||Date.now()-Number(x.ts||0)>CACHE_TTL)return null;
      return x;
    }catch{return null}
  }
  function writeCache(a,m,c=C){
    try{
      const key=cacheKey(c);if(!key||!a)return;
      localStorage.setItem(key,JSON.stringify({ts:Date.now(),analysis:a,matchupData:m||null}));
    }catch(e){
      try{
        Object.keys(localStorage).filter(k=>k.startsWith(CACHE_PREFIX)).forEach(k=>localStorage.removeItem(k));
      }catch{}
    }
  }
  function sameContext(key,seq){return seq===refreshSeq&&contextKey()===key}
  function renderIfDashboard(){if(currentView==='dashboard'&&C&&analysis)showView('dashboard')}

  async function refreshMatchup(key,seq,freshAnalysis){
    const context=C;
    try{
      const m=await get('/api/matchup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context,analysis:freshAnalysis})}).catch(e=>({available:false,message:e.message}));
      if(!sameContext(key,seq))return;
      matchupData=m;
      writeCache(analysis,matchupData,C);
      renderIfDashboard();
    }catch{}
  }

  async function refreshRankings(key,seq){
    const context=C;
    const body=JSON.stringify({context});
    try{
      const fresh=await get('/api/rankings',{method:'POST',headers:{'Content-Type':'application/json'},body});
      if(!sameContext(key,seq))return analysis;
      if(String(context?.platform||'').toUpperCase()==='ESPN'&&fresh?.source_policy){
        fresh.source_policy.version=String(fresh.source_policy.version||'4.0-canonical')+':espn-verified-waivers-v2';
      }
      analysis=fresh;
      writeCache(analysis,matchupData,C);
      renderIfDashboard();
      refreshMatchup(key,seq,fresh);
      return fresh;
    }catch(e){
      if(analysis)return analysis;
      throw e;
    }
  }

  loadAnalysis=async function(){
    const key=contextKey();
    const seq=++refreshSeq;
    const cached=readCache(C);
    if(cached){
      analysis=cached.analysis;
      matchupData=cached.matchupData||null;
      renderIfDashboard();
      refreshRankings(key,seq);
      return analysis;
    }
    return await refreshRankings(key,seq);
  };

  function startPublicData(){
    if(publicStarted||nflGames.length||nflNews.length)return;
    publicStarted=true;
    Promise.all([
      fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard').then(r=>r.json()),
      fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=8').then(r=>r.json())
    ]).then(([s,n])=>{nflGames=s.events||[];nflNews=n.articles||[]}).catch(()=>{}).finally(()=>{publicStarted=false});
  }

  /* The clean dashboard does not depend on public NFL news/schedule data. Never block startup on it. */
  loadPublic=function(){startPublicData();};

  /* The league switcher used to hide the entire shell until restore finished. Keep the shell visible. */
  document.body.classList.remove('fg34RestoringLeague');
  const style=document.createElement('style');
  style.textContent='body.fg34RestoringLeague #shell{visibility:visible!important}';
  document.head.appendChild(style);

  /* Warm non-critical public data after the main dashboard has had time to paint. */
  setTimeout(startPublicData,1500);
})();
