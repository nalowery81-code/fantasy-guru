/* Dashboard polish: compact Action Center, adaptive Guru, cached cross-league alerts. */
function fg8SummaryKey(l){return `fg-league-summary:v1:${String(l?.platform||'')}:${String(l?.id||'')}:${String(l?.rid||l?.roster_id||'')}`}
function fg8CurrentLeagueDef(){return leagues().find(l=>String(l.id)===String(C?.league?.id)&&String(l.platform).toUpperCase()===String(C?.platform).toUpperCase()&&String(l.rid||l.roster_id)===String(C?.my_team?.roster_id))||{platform:C?.platform,id:C?.league?.id,rid:C?.my_team?.roster_id,name:C?.league?.name,team:C?.my_team?.team}}
function fg8CaptureCurrentSummary(){
  if(!C||!analysis)return null;
  try{
    const l=fg8CurrentLeagueDef(),ss=typeof ssDecisions==='function'?ssDecisions():{changes:[]},wa=typeof storedWaiverIdeas==='function'?storedWaiverIdeas():[],tr=typeof tradeIdeas==='function'?tradeIdeas():[];
    const data={ts:Date.now(),league:C.league?.name||l.name,team:C.my_team?.team||l.team,week:C.current_week,startSit:(ss.changes||[]).length,waivers:wa.length,trades:tr.length,startSitTop:(ss.changes||[]).slice(0,2).map(x=>({start:x.start?.name,sit:x.sit?.name,edge:Number(x.diff||0)})),waiverTop:wa.slice(0,2).map(x=>x.add?.name).filter(Boolean),tradeTop:tr.slice(0,2).map(x=>x.get?.[0]?.name).filter(Boolean)};
    localStorage.setItem(fg8SummaryKey(l),JSON.stringify(data));return data;
  }catch{return null}
}
function fg8ReadSummary(l){try{return JSON.parse(localStorage.getItem(fg8SummaryKey(l))||'null')}catch{return null}}
function fg8Age(ts){const m=Math.max(0,Math.floor((Date.now()-Number(ts||0))/60000));if(m<1)return'just now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}
function fg8AcrossHTML(){
  const ls=leagues(),current=fg8CurrentLeagueDef();
  const rows=ls.map((l,i)=>({l,i,s:fg8ReadSummary(l)})).filter(x=>!(String(x.l.id)===String(current.id)&&String(x.l.platform).toUpperCase()===String(current.platform).toUpperCase()&&String(x.l.rid||x.l.roster_id)===String(current.rid||current.roster_id)));
  if(!rows.length)return '<div class="muted">Add another league to see cross-league alerts here.</div>';
  return rows.map(({l,i,s})=>{
    if(!s)return `<div class="fg8LeagueAlert"><div><b>${esc(l.name)}</b><span class="muted">Not checked yet</span></div><button data-fg8-league="${i}" data-fg8-view="dashboard">Open league</button></div>`;
    const alerts=[];if(s.startSit>0)alerts.push(`<span class="fg8Badge warn">${s.startSit} Start/Sit</span>`);if(s.waivers>0)alerts.push(`<span class="fg8Badge good">${s.waivers} Waiver</span>`);if(s.trades>0)alerts.push(`<span class="fg8Badge blue">${s.trades} Trade</span>`);const view=s.startSit>0?'startsit':s.waivers>0?'waivers':s.trades>0?'trades':'dashboard';
    return `<div class="fg8LeagueAlert"><div><b>${esc(l.name)}</b><div class="fg8AlertBadges">${alerts.length?alerts.join(''):'<span class="fg8Badge quiet">No action</span>'}</div><span class="muted">Week ${s.week||'—'} · checked ${fg8Age(s.ts)}</span></div><button data-fg8-league="${i}" data-fg8-view="${view}">${alerts.length?'Review':'Open'}</button></div>`;
  }).join('')
}
function fg8WireLeagueAlerts(root=document){root.querySelectorAll('[data-fg8-league]').forEach(b=>b.onclick=async()=>{const i=Number(b.dataset.fg8League),v=b.dataset.fg8View||'dashboard';await openLeague(i);if(v!=='dashboard')showView(v)})}

(function(){
  const style=document.createElement('style');style.textContent=`
    .fg8ActionPair{align-items:start}.fg8ActionPair>.fg6Card{height:100%}.fg8ActionPair .fg6Actions>div{grid-template-columns:82px 1fr;gap:7px;padding:6px 8px}.fg8ActionPair .fg6Actions>div>.fg6Btn{grid-column:2;justify-self:start;padding:4px 7px}.fg8ActionPair .fg6Actions>div>span{font-size:10px}.fg8Across{min-height:0}.fg8LeagueAlert{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid #1e324a}.fg8LeagueAlert:last-child{border-bottom:0}.fg8LeagueAlert>div{display:grid;gap:3px}.fg8LeagueAlert>div>b{font-size:11px}.fg8LeagueAlert .muted{font-size:9px}.fg8LeagueAlert>button{border:1px solid #2d5e86;background:#0a1a2a;color:#c9ecff;border-radius:7px;padding:5px 7px;font-size:9px;font-weight:850}.fg8AlertBadges{display:flex;gap:4px;flex-wrap:wrap}.fg8Badge{display:inline-block;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:900}.fg8Badge.warn{background:#3d2f12;color:#fde68a}.fg8Badge.good{background:#10392c;color:#86efac}.fg8Badge.blue{background:#12314d;color:#7dd3fc}.fg8Badge.quiet{background:#18263a;color:#aab9ca}
    #fg7Guru{bottom:auto!important;height:300px!important;max-height:calc(100vh - 80px)!important;transition:height .18s ease!important}#fg7Guru.fg8Expanded{height:calc(100vh - 80px)!important}.fg7GuruHead{display:grid!important;grid-template-columns:1fr auto auto;gap:6px;align-items:start}.fg7GuruHead>div{min-width:0}.fg7GuruHead>button{margin-top:0!important}.fg8GuruToggle{border:1px solid #2d5e86!important;background:#0a1a2a!important;color:#c9ecff!important;border-radius:7px!important;padding:5px 8px!important;font-size:9px!important}.fg7GuruLog{min-height:70px}.fg7Compose textarea{min-height:44px!important;max-height:90px}
    @media(max-width:1250px){.fg8ActionPair{grid-template-columns:1fr}.fg8ActionPair .fg6Actions>div{grid-template-columns:90px 1fr auto}.fg8ActionPair .fg6Actions>div>.fg6Btn{grid-column:auto}}
  `;document.head.appendChild(style);

  const baseDashboard=fg6RenderDashboard;
  fg6RenderDashboard=function(){
    baseDashboard();fg8CaptureCurrentSummary();
    const dash=document.querySelector('.fg6Dash');if(!dash)return;
    const kids=[...dash.children],action=kids[1];if(action&&!action.closest('.fg8ActionPair')){const pair=document.createElement('div');pair.className='fg6Split fg8ActionPair';action.before(pair);pair.appendChild(action);const across=document.createElement('section');across.className='fg6Card fg8Across';across.innerHTML=`<div class="fg6Title"><div><h2>🚨 Across Your Leagues</h2><span>Alerts reuse the last analysis from each league—no extra API calls.</span></div></div>${fg8AcrossHTML()}`;pair.appendChild(across);fg8WireLeagueAlerts(pair)}
  };
  renderDashboard=fg6RenderDashboard;

  const baseGuruRender=fg7RenderGuru;
  fg7RenderGuru=function(){baseGuruRender();const g=$('fg7Guru');if(g&&fg7GuruHistory.length>=2)g.classList.add('fg8Expanded');const t=$('fg8GuruToggle');if(t)t.textContent=g?.classList.contains('fg8Expanded')?'Collapse':'Expand'};
  function ensureGuruToggle(){const head=document.querySelector('.fg7GuruHead');if(!head||$('fg8GuruToggle'))return;const b=document.createElement('button');b.id='fg8GuruToggle';b.className='fg8GuruToggle';b.textContent='Expand';b.onclick=()=>{const g=$('fg7Guru');g.classList.toggle('fg8Expanded');b.textContent=g.classList.contains('fg8Expanded')?'Collapse':'Expand'};head.appendChild(b)}
  ensureGuruToggle();
  const obsTarget=$('fg7GuruLog');if(obsTarget)new MutationObserver(()=>{ensureGuruToggle();if(fg7GuruHistory.length>=2){$('fg7Guru')?.classList.add('fg8Expanded');const b=$('fg8GuruToggle');if(b)b.textContent='Collapse'}}).observe(obsTarget,{childList:true,subtree:true});
})();
