/* Week integrity, bye weeks, value-protected trade radar, and Player Hub table polish. */
(function(){
  const BYE_2026={CAR:5,KC:5,CIN:6,DET:6,MIA:6,MIN:6,BUF:7,JAX:7,LAC:7,WAS:7,HOU:8,NO:8,NYG:8,SF:8,PIT:9,TEN:9,CHI:10,DEN:10,PHI:10,TB:10,ATL:11,CLE:11,GB:11,LAR:11,NE:11,SEA:11,BAL:13,IND:13,LV:13,NYJ:13,ARI:14,DAL:14};
  const TEAM_ALIAS={LA:'LAR',JAC:'JAX',WSH:'WAS'};
  let hubSort={col:null,dir:'desc'};

  function teamKey(v){const k=String(v||'').toUpperCase().replace(/[^A-Z]/g,'');return TEAM_ALIAS[k]||k}
  function byeWeekFor(p){const direct=p?.bye_week??p?.bye??p?.byeWeek;if(direct!==null&&direct!==undefined&&direct!==''&&Number.isFinite(Number(direct))&&Number(direct)>0)return Number(direct);return BYE_2026[teamKey(p?.team)]??null}
  function annotatePlayer(p){if(!p)return p;const w=byeWeekFor(p);if(w!=null)p.bye_week=w;return p}
  function annotateByes(){
    for(const t of C?.league_teams||[])for(const p of t?.players||[])annotatePlayer(p);
    for(const p of C?.my_team?.players||[])annotatePlayer(p);
    for(const p of C?.available_trending_players||[])annotatePlayer(p);
    for(const t of analysis?.team_details||[])for(const p of t?.players||[])annotatePlayer(p);
    for(const p of analysis?.waiver_pool||[])annotatePlayer(p);
    for(const group of Object.values(analysis?.opportunities||{}))if(Array.isArray(group))for(const p of group)annotatePlayer(p);
  }

  /* Bust the old week-agnostic league cache without changing the base loader. */
  if(typeof leagueCacheKey==='function')leagueCacheKey=function(c){return `fg-league-context:v3:${c.platform}:${c.id}:${c.rid}`};
  if(typeof loadContext==='function'){
    const baseLoadContext=loadContext;
    loadContext=async function(c){
      const key=leagueCacheKey(c),cached=readLeagueCache(c);
      if(cached){try{const st=await get(`${A}/state/nfl`),liveWeek=Number(st?.week||0);if(liveWeek&&Number(cached.current_week)!==liveWeek)localStorage.removeItem(key)}catch{}}
      return baseLoadContext(c);
    };
  }

  if(typeof loadAnalysis==='function'){
    const baseLoadAnalysis=loadAnalysis;
    loadAnalysis=async function(){const out=await baseLoadAnalysis();annotateByes();return out};
  }

  function enrichTrade(x){
    if(!x)return x;
    const rv=finite(x?.M2?.v)&&finite(x?.mi?.v)?Number(x.M2.v)-Number(x.mi.v):finite(x?.rv)?Number(x.rv):null;
    if(rv!=null)x.rv=Number(rv.toFixed(1));
    return x;
  }
  if(typeof tradeIdeas==='function'){
    const baseTradeIdeas=tradeIdeas;
    tradeIdeas=function(){return (baseTradeIdeas()||[]).map(enrichTrade).filter(x=>x?.rv==null||Number(x.rv)>=0)};
  }
  if(typeof tradeRadar==='function'){
    const baseTradeRadar=tradeRadar;
    tradeRadar=function(){return (baseTradeRadar()||[]).map(enrichTrade).filter(x=>(x?.rv==null||Number(x.rv)>=0)&&(Number(x?.rg||0)>=0||Number(x?.wg||0)>=0))};
  }

  function playerIndex(){
    const byId=new Map(),byName=new Map(),owner=new Map();
    const add=(p,o=null)=>{if(!p)return;annotatePlayer(p);try{byId.set(String(ident(p)),p)}catch{}if(p.name)byName.set(String(p.name).toLowerCase(),p);if(o){try{owner.set(String(ident(p)),o)}catch{}if(p.name)owner.set('n:'+String(p.name).toLowerCase(),o)}};
    for(const t of analysis?.team_details||[])for(const p of t.players||[])add(p,t.team);
    for(const p of analysis?.waiver_pool||[])add(p,null);
    return{byId,byName,owner};
  }
  function n1(v){return Number.isFinite(Number(v))?Number(v).toFixed(1):'—'}
  function relativeFit(p,ownerName,available){
    const me=typeof mineTeam==='function'?mineTeam():null,position=pos(p?.position),mine=(me?.players||[]).filter(q=>pos(q.position)===position&&finite(q.ros_points)).sort((a,b)=>Number(b.ros_points)-Number(a.ros_points));
    const need=me&&typeof needProfile==='function'&&typeof needScore==='function'?needScore(needProfile(me),position):0;
    const bye=byeWeekFor(p),byeTxt=bye!=null?` · Bye ${bye}`:'';
    if(ownerName===C?.my_team?.team){const rank=Math.max(1,mine.findIndex(q=>ident(q)===ident(p))+1);return `Your roster · ${position} #${rank} of ${mine.length||1} by ROS${byeTxt}`}
    if(available){
      const weakest=mine.length?mine[mine.length-1]:null;
      if(!weakest)return `Available · ${need>=.65?'major need':'depth option'}${byeTxt}`;
      const rd=finite(p?.ros_points)&&finite(weakest?.ros_points)?Number(p.ros_points)-Number(weakest.ros_points):null,wd=finite(p?.weekly_points)&&finite(weakest?.weekly_points)?Number(p.weekly_points)-Number(weakest.weekly_points):null;
      if((rd!=null&&rd>0)||(wd!=null&&wd>1))return `Available · ${rd!=null?(rd>=0?'+':'')+n1(rd)+' ROS':''}${rd!=null&&wd!=null?' · ':''}${wd!=null?(wd>=0?'+':'')+n1(wd)+' week':''} vs ${weakest.name}${byeTxt}`;
      return `Available · depth only · does not beat ${weakest.name} on current ROS value${byeTxt}`;
    }
    const rank=finite(p?.ros_points)?1+mine.filter(q=>Number(q.ros_points)>Number(p.ros_points)).length:null;
    return `${ownerName?'Owned by '+ownerName:'Rostered'}${rank?` · would rank #${rank} among your ${position}s`:''}${byeTxt}`;
  }

  function sortPlayerRows(){
    if(!hubSort.col)return;
    const box=document.querySelector('.fg17Rows');if(!box)return;
    const rows=[...box.children].filter(x=>x.classList?.contains('fg17Row')),idx=hubSort.col,dir=hubSort.dir==='asc'?1:-1;
    const val=row=>{const s=row.children[idx]?.querySelector('b')?.textContent?.trim()||'';if(!s||s==='—')return null;const n=Number(s.replace(/[^0-9+-.]/g,''));return Number.isFinite(n)?n:null};
    rows.sort((a,b)=>{const av=val(a),bv=val(b);if(av==null&&bv==null)return 0;if(av==null)return 1;if(bv==null)return-1;return(av-bv)*dir});
    rows.forEach(r=>box.appendChild(r));
  }
  function installHeaderSort(){
    const head=document.querySelector('.fg17TableHead');if(!head)return;
    const labels={1:'ACTUAL',2:'WEEK PROJ',3:'ROS'};
    for(const [raw,label] of Object.entries(labels)){
      const idx=Number(raw),el=head.children[idx];if(!el)continue;
      el.classList.add('fg35SortHead');el.dataset.fg35Sort=String(idx);el.setAttribute('role','button');el.setAttribute('tabindex','0');
      el.textContent=label+(hubSort.col===idx?(hubSort.dir==='desc'?' ↓':' ↑'):' ↕');
    }
    const old=document.getElementById('fg25Sort');if(old)old.remove();
    sortPlayerRows();
  }
  function enhancePlayerHub(){
    if(currentView!=='playerhub')return;
    annotateByes();installHeaderSort();
    const idx=playerIndex();
    document.querySelectorAll('.fg17Row').forEach(row=>{
      const link=row.querySelector('.fg17PlayerLink');if(!link)return;
      const id=String(link.dataset.playerId||''),name=String(link.textContent||'').trim().toLowerCase(),p=idx.byId.get(id)||idx.byName.get(name);if(!p)return;
      const ownerName=idx.owner.get(id)||idx.owner.get('n:'+name)||null,available=(row.querySelector('.fg17Owner>b')?.textContent||'').trim().toUpperCase()==='AVAILABLE';
      const fit=row.querySelector('.fg17Owner>span');if(fit)fit.textContent=relativeFit(p,ownerName,available);
      const meta=row.querySelector('.fg17Player>span'),bw=byeWeekFor(p);if(meta&&bw!=null&&!/\bBYE\s+\d+/i.test(meta.textContent))meta.textContent+=` · BYE ${bw}`;
    });
    sortPlayerRows();
  }
  function patchIntelByes(){
    annotateByes();const idx=playerIndex();
    document.querySelectorAll('.intelRow').forEach(row=>{const name=row.querySelector('b')?.textContent?.trim().toLowerCase(),meta=row.querySelector('.muted');if(!name||!meta)return;const p=idx.byName.get(name),bw=byeWeekFor(p);if(bw!=null&&!/\bBYE\s+\d+/i.test(meta.textContent))meta.textContent+=` · BYE ${bw}`});
  }
  if(typeof renderIntel==='function'){
    const baseRenderIntel=renderIntel;
    renderIntel=async function(...args){const out=await baseRenderIntel(...args);patchIntelByes();return out};
  }

  document.addEventListener('click',e=>{
    const h=e.target.closest?.('[data-fg35-sort]');if(h){const col=Number(h.dataset.fg35Sort);hubSort={col,dir:hubSort.col===col&&hubSort.dir==='desc'?'asc':'desc'};enhancePlayerHub();return}
    if(e.target.closest?.('.fg17Tabs,[data-hub-tab],.fg20Row'))setTimeout(enhancePlayerHub,40);
  },true);
  document.addEventListener('keydown',e=>{const h=e.target.closest?.('[data-fg35-sort]');if(h&&(e.key==='Enter'||e.key===' ')){e.preventDefault();h.click()}},true);
  document.addEventListener('input',e=>{if(e.target?.id==='fg17Search')setTimeout(enhancePlayerHub,40)},true);
  document.addEventListener('change',e=>{if(['fg17Pos','fg25Sort'].includes(e.target?.id))setTimeout(enhancePlayerHub,40)},true);

  if(typeof showView==='function'){
    const baseShow=showView;
    showView=function(v){const out=baseShow(v);if(v==='playerhub')setTimeout(enhancePlayerHub,60);if(v==='intel')setTimeout(patchIntelByes,120);return out};
  }

  const style=document.createElement('style');style.textContent=`
    .fg17TableHead,.fg17Row{grid-template-columns:minmax(220px,1.45fr) 86px 96px 96px 165px minmax(270px,1.35fr)!important;column-gap:8px!important;align-items:center!important}
    .fg17TableHead>span:nth-child(2),.fg17TableHead>span:nth-child(3),.fg17TableHead>span:nth-child(4),.fg17TableHead>span:nth-child(5),.fg17Row>div:nth-child(2),.fg17Row>div:nth-child(3),.fg17Row>div:nth-child(4),.fg17Row>div:nth-child(5){text-align:center!important}
    .fg17Owner{text-align:left!important}.fg35SortHead{cursor:pointer;user-select:none;color:#bfe8ff!important;border-radius:5px;padding:4px 2px!important}.fg35SortHead:hover{background:#102a43;color:#fff!important}
    .fg17Player>span{line-height:1.35!important}.fg17Owner>span{line-height:1.3!important;white-space:normal!important}
    @media(max-width:1050px){.fg17TableHead,.fg17Row{grid-template-columns:minmax(180px,1.25fr) 72px 82px 82px 135px minmax(220px,1.2fr)!important}}
  `;document.head.appendChild(style);

  annotateByes();
})();
