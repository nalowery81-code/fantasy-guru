/* Short-lived league analysis cache: avoid re-pulling player rankings/market data on every reopen. */
(function(){
  const ANALYSIS_TTL=15*60*1000;
  function rosterFingerprint(){return (C?.league_teams||[]).map(t=>String(t.roster_id)+':'+(t.players||[]).map(p=>String(p.id||p.canonical_player_id||p.espn_id||p.sleeper_id||p.name||'')).sort().join(',')).sort().join('|')}
  function analysisKey(){return `fg-analysis:v1:${C?.platform||''}:${C?.league?.id||''}:${C?.current_week||''}:${C?.my_team?.roster_id||''}:${rosterFingerprint()}`}
  function read(){try{const x=JSON.parse(localStorage.getItem(analysisKey())||'null');if(!x?.data||Date.now()-Number(x.ts||0)>ANALYSIS_TTL)return null;return x}catch{return null}}
  function write(data){try{localStorage.setItem(analysisKey(),JSON.stringify({ts:Date.now(),data}))}catch{}return data}
  loadAnalysis=async function(){
    const cached=read();
    if(cached?.data){analysis=cached.data;await Promise.allSettled([loadMatchup(),loadPublic()]);return analysis}
    const body=JSON.stringify({context:C});
    analysis=await get('/api/rankings',{method:'POST',headers:{'Content-Type':'application/json'},body});
    if(String(C?.platform||'').toUpperCase()==='ESPN'&&analysis?.source_policy){analysis.source_policy.version=String(analysis.source_policy.version||'4.0-canonical')+':espn-verified-waivers-v2'}
    write(analysis);await Promise.allSettled([loadMatchup(),loadPublic()]);return analysis
  };
})();
