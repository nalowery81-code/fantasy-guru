/* Preserve platform roster-slot metadata for presentation, especially Sleeper IR/reserve. */
(function(){
  const TTL=5*60*1000;
  const baseLoadContext=loadContext;
  async function sleeperReserveMap(leagueId){
    const key=`fg-sleeper-reserve:v1:${leagueId}`;
    try{const c=JSON.parse(localStorage.getItem(key)||'null');if(c?.rows&&Date.now()-Number(c.ts||0)<TTL)return c.rows}catch{}
    try{
      const rows=await get(`${A}/league/${encodeURIComponent(leagueId)}/rosters`),out={};
      for(const r of rows||[])out[String(r.roster_id)]=(r.reserve||[]).map(String);
      try{localStorage.setItem(key,JSON.stringify({ts:Date.now(),rows:out}))}catch{}
      return out;
    }catch{return{}}
  }
  loadContext=async function(c){
    const data=await baseLoadContext(c);
    if(String(data?.platform||c?.platform||'').toUpperCase()!=='SLEEPER'||!(data?.league?.roster_positions||[]).includes('IR'))return data;
    const reserves=await sleeperReserveMap(data.league?.id||c.id);
    for(const t of data.league_teams||[]){
      const set=new Set(reserves[String(t.roster_id)]||[]);
      for(const p of t.players||[]){if(set.has(String(p.id))){p.starter=false;p.lineup_slot='IR'}}
    }
    const mine=(data.league_teams||[]).find(t=>String(t.roster_id)===String(data.my_team?.roster_id));
    if(mine)data.my_team.players=mine.players;
    return data;
  };
})();
