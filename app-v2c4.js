function leaguePlatformUrl(l){
  if(!l)return null;
  const platform=String(l.platform||'').toUpperCase();
  const id=encodeURIComponent(String(l.id||''));
  const rid=encodeURIComponent(String(l.rid||l.roster_id||''));
  if(platform==='SLEEPER'&&id)return `https://sleeper.com/leagues/${id}/team`;
  if(platform==='ESPN'&&id)return `https://fantasy.espn.com/football/team?leagueId=${id}${rid?`&teamId=${rid}`:''}`;
  return null;
}
function leaguePlatformLabel(l){return String(l?.platform||'League')+' ↗'}
function externalLeagueLink(l,compact=false){const u=leaguePlatformUrl(l);if(!u)return'';return `<a href="${u}" target="_blank" rel="noopener noreferrer" class="fgPlatformLink${compact?' compact':''}" title="Open this league on ${esc(l.platform)}">${esc(leaguePlatformLabel(l))}</a>`}

function ssEligible(p,s){p=pos(p);if(s===p)return true;if(s==='FLEX')return['RB','WR','TE'].includes(p);if(s==='SUPER_FLEX')return['QB','RB','WR','TE'].includes(p);return false}
function ssOptimized(){
  const m=mineTeam(),players=m?.players||[],slots=(C?.league?.roster_positions||[]).filter(s=>!['BN','IR'].includes(s));
  const order=[...slots].map((slot,i)=>({slot,i})).sort((a,b)=>({QB:1,SUPER_FLEX:2,TE:3,RB:4,WR:5,FLEX:6,DEF:7,K:8}[a.slot]||9)-({QB:1,SUPER_FLEX:2,TE:3,RB:4,WR:5,FLEX:6,DEF:7,K:8}[b.slot]||9));
  const used=new Set(),picks=[];
  for(const x of order){let bi=-1,bv=-Infinity;players.forEach((p,i)=>{if(used.has(i)||!ssEligible(p.position,x.slot)||!finite(p.weekly_points))return;const v=Number(p.weekly_points);if(v>bv){bv=v;bi=i}});if(bi>=0){used.add(bi);picks.push({slot:x.slot,player:players[bi],value:bv})}}
  return picks;
}
function ssDecisions(){
  const m=mineTeam();if(!m)return{picks:[],changes:[],close:[]};
  const picks=ssOptimized(),optIds=new Set(picks.map(x=>ident(x.player))),current=(m.players||[]).filter(p=>p.starter),curIds=new Set(current.map(ident));
  const incoming=picks.filter(x=>!curIds.has(ident(x.player))),outgoing=current.filter(p=>!optIds.has(ident(p))),usedOut=new Set(),changes=[];
  for(const x of incoming){let cand=null;for(const p of outgoing){if(usedOut.has(ident(p))||!ssEligible(p.position,x.slot)||!finite(p.weekly_points))continue;if(!cand||Number(p.weekly_points)<Number(cand.weekly_points))cand=p}if(!cand)continue;usedOut.add(ident(cand));const diff=Number(x.player.weekly_points)-Number(cand.weekly_points);changes.push({start:x.player,sit:cand,slot:x.slot,diff,confidence:diff>=5?'HIGH':diff>=2.5?'GOOD':diff>=1?'MEDIUM':'TOSS-UP'})}
  const bench=(m.players||[]).filter(p=>!optIds.has(ident(p))&&finite(p.weekly_points)),close=[];
  for(const x of picks){for(const b of bench){if(!ssEligible(b.position,x.slot))continue;const diff=Number(x.player.weekly_points)-Number(b.weekly_points);if(diff>=0&&diff<=5)close.push({start:x.player,sit:b,slot:x.slot,diff,confidence:diff>=2.5?'GOOD':diff>=1?'MEDIUM':'TOSS-UP'})}}
  close.sort((a,b)=>a.diff-b.diff);const seen=new Set(),unique=[];for(const x of close){const k=ident(x.start)+'|'+ident(x.sit);if(seen.has(k))continue;seen.add(k);unique.push(x);if(unique.length>=6)break}
  return{picks,changes,close:unique};
}
function ssPlayerLine(p){const conf=p?.weekly_confidence?.label||p?.weekly_confidence||null;return `${esc(p.name)} <span class="muted">${esc(pos(p.position))}${p.team?' · '+esc(p.team):''}${p.injury_status?' · '+esc(p.injury_status):''}</span><span class="ssPts">${finite(p.weekly_points)?Number(p.weekly_points).toFixed(1):'—'}</span>${conf?`<span class="ssSource">${esc(String(conf))}</span>`:''}`}
function renderStartSit(){
  const d=ssDecisions(),m=mineTeam();if(!m){$('content').innerHTML='<h2>✅ Start / Sit</h2><div class="card muted">Roster data unavailable.</div>';return}
  const currentIds=new Set((m.players||[]).filter(p=>p.starter).map(ident));
  const changeHtml=d.changes.length?d.changes.map((x,i)=>`<div class="ssDecision"><div class="ssNum">${i+1}</div><div><div><span class="gain"><b>START ${esc(x.start.name)}</b></span> over <span class="loss"><b>${esc(x.sit.name)}</b></span></div><div class="muted">${esc(x.slot)} · ${Number(x.start.weekly_points).toFixed(1)} vs ${Number(x.sit.weekly_points).toFixed(1)} · edge ${x.diff>=0?'+':''}${x.diff.toFixed(1)}</div></div><span class="grade">${x.confidence}</span></div>`).join(''):`<div class="ssOptimized">✅ Your current starters already match Fantasy Guru's highest-projected lineup.</div>`;
  const closeHtml=d.close.length?d.close.map(x=>`<div class="ssClose"><div><b>${esc(x.start.name)}</b> over ${esc(x.sit.name)} <span class="grade">${x.confidence}</span></div><div class="muted">${Number(x.start.weekly_points).toFixed(1)} vs ${Number(x.sit.weekly_points).toFixed(1)} · ${x.diff.toFixed(1)} point edge</div></div>`).join(''):'<div class="muted">No especially close start/sit calls from the trusted weekly projections.</div>';
  const lineup=d.picks.map(x=>`<div class="ssLine"><span class="ssSlot">${esc(x.slot)}</span><span>${ssPlayerLine(x.player)}${currentIds.has(ident(x.player))?'':' <span class="pill">MOVE IN</span>'}</span></div>`).join('');
  $('content').innerHTML=`<h2>✅ Start / Sit</h2><div class="sub">Optimized for Week ${C.current_week} using this league's exact lineup rules and the trusted ESPN + Sleeper + independent consensus projection layer.</div><div class="ssGrid"><div class="card"><h3>Guru Lineup Check</h3>${changeHtml}<button class="btn secondary ssAsk" id="ssAskGuru">🧠 Ask Guru about these calls</button></div><div class="card"><h3>Closest Decisions</h3>${closeHtml}</div></div><div class="card" style="margin-top:10px"><h3>Highest-Projected Starting Lineup</h3><div class="ssHeader"><span>SLOT</span><span>PLAYER <span style="float:right">PROJ</span></span></div>${lineup}</div>`;
  $('ssAskGuru').onclick=()=>openGuruDrawer('Explain my Start / Sit decisions this week. Focus first on the closest call and tell me whether injury, role, matchup, or upside changes the projection-based recommendation.');
}

let guruDrawerHistory=[],guruDrawerFollow='';
function guruDrawerKey(){return `fg-guru-drawer:v1:${C?.platform||''}:${C?.league?.id||''}:${C?.my_team?.roster_id||''}`}
function loadGuruDrawerHistory(){try{guruDrawerHistory=JSON.parse(localStorage.getItem(guruDrawerKey())||'[]');if(!Array.isArray(guruDrawerHistory))guruDrawerHistory=[]}catch{guruDrawerHistory=[]}}
function saveGuruDrawerHistory(){try{localStorage.setItem(guruDrawerKey(),JSON.stringify(guruDrawerHistory.slice(-12)))}catch{}}
function currentScreenContext(){
  const ctx={screen:currentView,week:C?.current_week,league:C?.league?.name,team:C?.my_team?.team};
  try{
    if(currentView==='startsit'){const d=ssDecisions();ctx.start_sit={changes:d.changes.map(x=>({start:x.start.name,sit:x.sit.name,slot:x.slot,projection_edge:+x.diff.toFixed(1),confidence:x.confidence})),closest:d.close.slice(0,4).map(x=>({start:x.start.name,sit:x.sit.name,edge:+x.diff.toFixed(1)}))}}
    else if(currentView==='waivers'){ctx.waivers={recommendations:storedWaiverIdeas().slice(0,4).map(x=>({add:x.add.name,drop:x.drop.name,weekly_gain:+x.wg.toFixed(1),ros_gain:+x.rg.toFixed(1)})),radar:waiverRadar().slice(0,4).map(x=>x.add?.name)}}
    else if(currentView==='trades'){ctx.trades={recommendations:tradeIdeas().slice(0,4).map(x=>({partner:x.partner,give:x.give.map(p=>p.name),get:x.get.map(p=>p.name),weekly_gain:+x.wg.toFixed(1),ros_gain:+x.rg.toFixed(1)})),radar:tradeRadar().slice(0,4).map(x=>({partner:x.partner,target:x.get?.[0]?.name}))}}
    else if(currentView==='matchup'&&matchupData?.available)ctx.matchup={you:matchupData.you?.team,opponent:matchupData.them?.team,actual_you:matchupData.you?.actual,actual_them:matchupData.them?.actual,projected_you:matchupData.you?.projection,projected_them:matchupData.them?.projection};
    else if(currentView==='power')ctx.power_rank=analysis?.ros?.my_ranks||null;
    else if(currentView==='intel'){const t=C?.league_teams?.find(x=>String(x.roster_id)===String(selectedIntel));ctx.roster_intel_team=t?.team||C?.my_team?.team;ctx.roster_players=(t?.players||[]).map(p=>p.name)}
  }catch{}
  return ctx;
}
function renderGuruDrawer(){
  const log=$('fgGuruLog');if(!log)return;
  log.innerHTML=guruDrawerHistory.length?guruDrawerHistory.map(x=>`<div class="fgGuruMsg ${x.role==='user'?'user':'guru'}"><div class="fgGuruWho">${x.role==='user'?'YOU':'🧠 GURU'}</div><div>${esc(x.content).replace(/\n/g,'<br>')}</div>${x.follow_up?`<button class="fgFollow" data-q="${esc(x.follow_up)}">${esc(x.follow_up)}</button>`:''}</div>`).join(''):'<div class="fgGuruWelcome"><b>Ask Guru from anywhere.</b><br><span class="muted">I know your league and the screen you're looking at.</span></div>';
  log.querySelectorAll('.fgFollow').forEach(b=>b.onclick=()=>{$('fgGuruInput').value=b.dataset.q||'';$('fgGuruInput').focus()});log.scrollTop=log.scrollHeight;
}
function openGuruDrawer(prefill=''){loadGuruDrawerHistory();$('fgGuruDrawer').classList.add('open');renderGuruDrawer();if(prefill){$('fgGuruInput').value=prefill;$('fgGuruInput').focus()}}
function closeGuruDrawer(){$('fgGuruDrawer').classList.remove('open')}
async function sendGuruDrawer(){
  const input=$('fgGuruInput'),q=input.value.trim();if(!q||!C||!analysis)return;input.value='';guruDrawerHistory.push({role:'user',content:q});saveGuruDrawerHistory();renderGuruDrawer();$('fgGuruSend').disabled=true;$('fgGuruThinking').classList.remove('hidden');
  try{const enriched={...analysis,screen_context:currentScreenContext()},d=await get('/api/guru',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,context:C,analysis:enriched,history:guruDrawerHistory.slice(-8)})});guruDrawerHistory.push({role:'assistant',content:d.answer||'No answer returned.',follow_up:d.follow_up_question||''});saveGuruDrawerHistory();renderGuruDrawer()}catch(e){guruDrawerHistory.push({role:'assistant',content:'Guru could not answer: '+(e.message||'Unknown error')});renderGuruDrawer()}finally{$('fgGuruSend').disabled=false;$('fgGuruThinking').classList.add('hidden')}
}

(function(){
  if(!NAV.some(x=>x[0]==='startsit'))NAV.splice(2,0,['startsit','✅ Start / Sit']);
  const style=document.createElement('style');
  style.textContent=`
    .fgPlatformLink{display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:5px 9px;border:1px solid #35506e;border-radius:8px;color:#7dd3fc;text-decoration:none;font-size:11px;font-weight:700;white-space:nowrap;background:#0b1727}.fgPlatformLink:hover{border-color:#7dd3fc;background:#102238}.fgPlatformLink.compact{padding:3px 7px;font-size:10px;margin-left:7px}.fgLeagueChoice,.fgLeagueTile{position:relative}.fgLeagueChoice .fgInternal,.fgLeagueTile .fgInternal{all:unset;display:block;box-sizing:border-box;width:100%;cursor:pointer}.fgLeagueChoice .fgPlatformLink,.fgLeagueTile .fgPlatformLink{position:absolute;right:10px;top:50%;transform:translateY(-50%)}.fgLeagueChoice .fgInternal,.fgLeagueTile .fgInternal{padding-right:100px}
    .ssGrid{display:grid;grid-template-columns:1.15fr .85fr;gap:10px}.ssDecision{display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #26364f}.ssNum{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#10263b;color:#7dd3fc;font-weight:800}.ssOptimized{padding:12px;border:1px solid #285845;background:#0c211c;border-radius:8px;color:#86efac}.ssAsk{margin-top:10px}.ssClose{padding:8px 0;border-bottom:1px solid #26364f}.ssHeader,.ssLine{display:grid;grid-template-columns:70px 1fr;gap:8px;align-items:center}.ssHeader{font-size:9px;color:#7f94ad;padding:0 0 5px;border-bottom:1px solid #26364f}.ssLine{padding:8px 0;border-bottom:1px solid #1e2f46}.ssSlot{font-weight:800;color:#7dd3fc}.ssPts{float:right;font-weight:800;color:#fff;margin-left:12px}.ssSource{float:right;font-size:8px;color:#7f94ad;margin:3px 8px 0 8px}
    #fgGuruFab{position:fixed;right:24px;bottom:22px;z-index:80;width:54px;height:54px;border-radius:50%;border:1px solid #355b83;background:#10304d;color:#fff;font-size:23px;box-shadow:0 10px 30px #0008;cursor:pointer}#fgGuruFab:hover{background:#16476f}.fgGuruDrawer{position:fixed;right:0;top:0;bottom:0;width:min(390px,94vw);z-index:90;background:#081525;border-left:1px solid #2a405c;box-shadow:-16px 0 40px #0009;transform:translateX(105%);transition:transform .2s ease;display:flex;flex-direction:column}.fgGuruDrawer.open{transform:translateX(0)}.fgGuruHead{padding:14px;border-bottom:1px solid #26364f;display:flex;justify-content:space-between;align-items:center}.fgGuruHeadBtns{display:flex;gap:6px}.fgGuruHead button{border:1px solid #344a65;background:#102034;color:#dbeafe;border-radius:7px;padding:5px 8px;cursor:pointer}.fgGuruContext{padding:7px 14px;font-size:10px;color:#7f94ad;border-bottom:1px solid #1c2d42}.fgGuruLog{flex:1;overflow:auto;padding:12px}.fgGuruMsg{padding:10px 11px;border-radius:10px;margin-bottom:9px;line-height:1.4}.fgGuruMsg.user{background:#12314d;margin-left:28px}.fgGuruMsg.guru{background:#0d2034;margin-right:18px;border:1px solid #213a55}.fgGuruWho{font-size:8px;font-weight:800;color:#7dd3fc;margin-bottom:4px}.fgGuruWelcome{padding:14px;border:1px dashed #29425e;border-radius:10px}.fgFollow{display:block;margin-top:9px;text-align:left;border:1px solid #31506d;background:#0b1828;color:#9bdcff;border-radius:8px;padding:7px 8px;cursor:pointer}.fgGuruCompose{padding:10px;border-top:1px solid #26364f}.fgGuruCompose textarea{width:100%;min-height:72px;resize:vertical;background:#07111e;border:1px solid #32465f;color:#fff;border-radius:9px;padding:9px;box-sizing:border-box}.fgGuruComposeRow{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:7px}.fgGuruComposeRow button{border:0;border-radius:8px;background:#38bdf8;color:#062033;font-weight:800;padding:8px 14px;cursor:pointer}.fgGuruThinking{font-size:10px;color:#7dd3fc}
    @media(max-width:700px){.fgLeagueChoice .fgPlatformLink,.fgLeagueTile .fgPlatformLink{position:static;transform:none;margin-top:8px}.fgLeagueChoice .fgInternal,.fgLeagueTile .fgInternal{padding-right:0}.ssGrid{grid-template-columns:1fr}#fgGuruFab{right:15px;bottom:15px}}
  `;
  document.head.appendChild(style);

  const drawer=document.createElement('div');drawer.id='fgGuruDrawer';drawer.className='fgGuruDrawer';drawer.innerHTML=`<div class="fgGuruHead"><div><b>🧠 Ask Guru</b><div class="muted" style="font-size:9px">Context-aware assistant</div></div><div class="fgGuruHeadBtns"><button id="fgGuruNew">New Chat</button><button id="fgGuruClose">✕</button></div></div><div class="fgGuruContext" id="fgGuruContext">Current screen context</div><div class="fgGuruLog" id="fgGuruLog"></div><div class="fgGuruCompose"><textarea id="fgGuruInput" placeholder="Ask about what you're looking at…"></textarea><div class="fgGuruComposeRow"><span id="fgGuruThinking" class="fgGuruThinking hidden">Guru is thinking…</span><button id="fgGuruSend">Send</button></div></div>`;document.body.appendChild(drawer);
  const fab=document.createElement('button');fab.id='fgGuruFab';fab.title='Ask Guru';fab.textContent='🧠';document.body.appendChild(fab);
  fab.onclick=()=>{const s=currentScreenContext();$('fgGuruContext').textContent=`${String(s.screen||'').replace(/^./,x=>x.toUpperCase())} · ${C?.league?.name||''}`;openGuruDrawer()};$('fgGuruClose').onclick=closeGuruDrawer;$('fgGuruSend').onclick=sendGuruDrawer;$('fgGuruNew').onclick=()=>{guruDrawerHistory=[];guruDrawerFollow='';try{localStorage.removeItem(guruDrawerKey())}catch{}renderGuruDrawer()};$('fgGuruInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendGuruDrawer()}});
  const syncFab=()=>{fab.style.display=$('shell')?.classList.contains('hidden')?'none':'block';if(!$('shell')?.classList.contains('hidden')){$('fgGuruContext').textContent=`${String(currentView||'').replace(/^./,x=>x.toUpperCase())} · ${C?.league?.name||''}`}};new MutationObserver(syncFab).observe($('shell'),{attributes:true,attributeFilter:['class']});syncFab();

  const baseGateRender=gateRender;
  gateRender=function(){const ls=leagues();$('gateLeagues').innerHTML=ls.map((x,i)=>`<div class="leagueChoice fgLeagueChoice"><button class="fgInternal" data-i="${i}"><b>${esc(x.name)}</b><div class="leagueMeta">${esc(x.team)} · ${esc(x.platform)}</div></button>${externalLeagueLink(x)}</div>`).join('');$('gateLeagues').querySelectorAll('.fgInternal').forEach(b=>b.onclick=()=>openLeague(Number(b.dataset.i)))};

  const baseRenderShell=renderShell;
  renderShell=function(idx){baseRenderShell(idx);const l=leagues()[idx]||{platform:C?.platform,id:C?.league?.id,rid:C?.my_team?.roster_id};$('topTitle').innerHTML=`${esc(C.league.name)} — ${esc(C.my_team.team)} [${esc(C.platform)}] ${externalLeagueLink(l,true)}`;syncFab()};

  const baseRenderDashboard=renderDashboard;
  renderDashboard=function(){baseRenderDashboard();const box=$('content')?.querySelector('.leagueTiles');if(!box)return;const ls=leagues();box.innerHTML=ls.map((x,i)=>`<div class="miniLeague fgLeagueTile ${String(x.id)===String(C?.league?.id)?'current':''}"><button class="fgInternal" data-i="${i}"><b>${esc(x.name)}</b><div class="leagueMeta">${esc(x.team)} · ${esc(x.platform)}</div></button>${externalLeagueLink(x)}</div>`).join('');box.querySelectorAll('.fgInternal').forEach(b=>b.onclick=()=>openLeague(Number(b.dataset.i)))};

  const baseShowView=showView;
  showView=function(v){if(v==='startsit'){currentView=v;$('nav').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));renderStartSit();syncFab();return}baseShowView(v);syncFab()};

  gateRender();
})();
