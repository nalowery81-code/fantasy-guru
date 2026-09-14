/* Fast startup caches: render from recent/stale data immediately, refresh quietly in background. */
(function(){
  const ANALYSIS_FRESH=15*60*1000,ANALYSIS_STALE=6*60*60*1000;
  const MATCH_FRESH=2*60*1000,MATCH_STALE=30*60*1000;
  const PUBLIC_FRESH=10*60*1000,PUBLIC_STALE=2*60*60*1000;
  const networkMatchup=loadMatchup,networkPublic=loadPublic;

  function rosterFingerprint(){return (C?.league_teams||[]).map(t=>String(t.roster_id)+':'+(t.players||[]).map(p=>String(p.id||p.canonical_player_id||p.espn_id||p.sleeper_id||p.name||'')).sort().join(',')).sort().join('|')}
  function analysisKey(){return `fg-analysis:v2:${C?.platform||''}:${C?.league?.id||''}:${C?.current_week||''}:${C?.my_team?.roster_id||''}:${rosterFingerprint()}`}
  function matchupKey(){return `fg-matchup-fast:v1:${C?.platform||''}:${C?.league?.id||''}:${C?.current_week||''}:${C?.my_team?.roster_id||''}`}
  const publicKey='fg-public-nfl:v1';
  function read(k,max){try{const x=JSON.parse(localStorage.getItem(k)||'null');if(!x?.data||Date.now()-Number(x.ts||0)>max)return null;return x}catch{return null}}
  function write(k,data){try{localStorage.setItem(k,JSON.stringify({ts:Date.now(),data}))}catch{}return data}
  function age(x){return x?Date.now()-Number(x.ts||0):Infinity}

  async function freshMatchup(){await networkMatchup();write(matchupKey(),matchupData);return matchupData}
  loadMatchup=async function(){
    const c=read(matchupKey(),MATCH_STALE);
    if(c?.data){matchupData=c.data;if(age(c)>MATCH_FRESH)freshMatchup().catch(()=>{});return matchupData}
    return freshMatchup();
  };

  async function freshPublic(){await networkPublic();write(publicKey,{games:nflGames||[],news:nflNews||[]});return true}
  loadPublic=async function(){
    const c=read(publicKey,PUBLIC_STALE);
    if(c?.data){nflGames=c.data.games||[];nflNews=c.data.news||[];if(age(c)>PUBLIC_FRESH)freshPublic().catch(()=>{});return true}
    return freshPublic();
  };

  async function refreshAnalysis(key){
    try{const body=JSON.stringify({context:C}),d=await get('/api/rankings',{method:'POST',headers:{'Content-Type':'application/json'},body});if(String(C?.platform||'').toUpperCase()==='ESPN'&&d?.source_policy)d.source_policy.version=String(d.source_policy.version||'4.0-canonical')+':espn-verified-waivers-v2';write(key,d);return d}catch{return null}
  }

  loadAnalysis=async function(){
    const key=analysisKey(),cached=read(key,ANALYSIS_STALE);
    if(cached?.data){
      analysis=cached.data;
      const quick=Promise.allSettled([loadMatchup(),loadPublic()]);
      await quick;
      if(age(cached)>ANALYSIS_FRESH)refreshAnalysis(key).then(d=>{if(!d)return;analysis=d;if(currentView==='dashboard')try{renderDashboard()}catch{}});
      return analysis;
    }
    const publicPromise=loadPublic().catch(()=>null);
    analysis=await refreshAnalysis(key);
    if(!analysis)throw Error('Fantasy analysis is temporarily unavailable.');
    await Promise.allSettled([loadMatchup(),publicPromise]);
    return analysis;
  };
})();
