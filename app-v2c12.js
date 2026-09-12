/* Matchup readability polish: fold status into player column, reclaim width, actionable insight cards, visible IR. */
function fg12PolishMatchup(){
  document.querySelectorAll('.fg10ColHead').forEach(h=>{const c=[...h.children];if(c[2]?.textContent?.trim()==='STATUS')c[2].remove()});
  document.querySelectorAll('.fg10PlayerMain').forEach(r=>{
    const c=[...r.children],id=r.querySelector('.fg10Identity');
    if(c.length>=8&&id&&c[2]?.querySelector('.fg10Status')){const badge=c[2].querySelector('.fg10Status');const name=id.querySelector('b');if(name&&!id.querySelector('.fg12StatusWrap')){const w=document.createElement('span');w.className='fg12StatusWrap';w.appendChild(badge);name.insertAdjacentElement('afterend',w)}c[2].remove()}
  });
  document.querySelectorAll('.fg10Slot').forEach(s=>{const v=String(s.textContent||'').trim().toUpperCase();if(v==='SUPER_FLEX'||v==='SUPER FLEX'){s.innerHTML='SUPER<br>FLEX';s.classList.add('fg12SuperFlex')}});
}
function fg12TeamCard(title,teamData,team,intel){
  const maps=fg10Maps(team,intel),starters=teamData?.lineup||[],allBench=teamData?.bench||[],bench=[],ir=[];
  for(const x of allBench){const r=maps.rmap.get(String(x?.name||'').toLowerCase())||{},slot=String(r.lineup_slot||x.slot||'BN').toUpperCase();(slot==='IR'?ir:bench).push({...x,slot:slot==='IR'?'IR':'BN'})}
  return `<section class="fg10Team"><div class="fg10TeamHead"><div><h3>${esc(title)}</h3><span>${team===fg10TeamByName(C?.my_team?.team)?'YOU':'OPPONENT'}</span></div><strong>Proj ${Number(teamData?.projection||0).toFixed(1)}</strong></div><div class="fg10ColHead"><span>POS</span><span>PLAYER</span><span>STATUS</span><span>PTS</span><span>PROJ</span><span>ROS</span><span>INTEL</span><span></span></div><div class="fg10SectionLabel">STARTERS <span>${starters.length}</span></div>${starters.map(x=>fg10Row(x,maps,intel?.generated_at)).join('')}<div class="fg10Bench"><div class="fg10SectionLabel">BENCH <span>${bench.length}</span></div>${bench.map(x=>fg10Row(x,maps,intel?.generated_at)).join('')}${ir.length?`<div class="fg10SectionLabel fg12IRLabel">IR <span>${ir.length}</span></div>${ir.map(x=>fg10Row(x,maps,intel?.generated_at)).join('')}`:''}</div></section>`
}
function fg12ProjectionDetail(){
  const d=matchupData;if(!d?.available)return;
  const alerts=document.querySelector('.fg10Alerts');if(!alerts)return;
  let box=document.querySelector('.fg12InsightDetail');
  if(box){box.remove();return}
  const edge=Number(d.you?.projection||0)-Number(d.them?.projection||0),live=Number(d.you?.actual||0)-Number(d.them?.actual||0);
  box=document.createElement('div');box.className='fg12InsightDetail';box.innerHTML=`<div><b>Projected matchup</b><span>${esc(d.you.team)} ${Number(d.you.projection||0).toFixed(1)} · ${esc(d.them.team)} ${Number(d.them.projection||0).toFixed(1)}</span></div><div><b>Projected edge</b><span>${edge>=0?esc(d.you.team):esc(d.them.team)} by ${Math.abs(edge).toFixed(1)} points</span></div><div><b>Live scoring edge</b><span>${live===0?'Tied right now':`${live>0?esc(d.you.team):esc(d.them.team)} by ${Math.abs(live).toFixed(1)} points`}</span></div>`;alerts.insertAdjacentElement('afterend',box)
}
function fg12InjuryDetail(){
  const flagged=[...document.querySelectorAll('.fg10Player')].filter(r=>{const s=r.querySelector('.fg10Status');return s&&!s.classList.contains('active')});
  if(flagged.length){flagged.forEach(r=>r.classList.add('open','fg12Flagged'));flagged[0].scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>flagged.forEach(r=>r.classList.remove('fg12Flagged')),1800);return}
  const alerts=document.querySelector('.fg10Alerts');if(!alerts)return;let box=document.querySelector('.fg12InjuryNone');if(box){box.remove();return}box=document.createElement('div');box.className='fg12InsightDetail fg12InjuryNone';box.innerHTML='<div><b>Injury Watch</b><span>No flagged players are currently shown in this matchup.</span></div>';alerts.insertAdjacentElement('afterend',box)
}
function fg12WireAlerts(){
  const a=document.querySelector('.fg10Alerts');if(!a)return;const cards=[...a.children];
  cards.forEach((card,i)=>{card.classList.add('fg12Clickable');card.setAttribute('role','button');card.setAttribute('tabindex','0');const go=()=>{if(i===0)showView('startsit');else if(i===1)fg12ProjectionDetail();else fg12InjuryDetail()};card.onclick=go;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}});
}
(function(){
  fg10TeamCard=fg12TeamCard;
  const s=document.createElement('style');s.textContent=`
    .fg10ColHead,.fg10PlayerMain{grid-template-columns:42px minmax(190px,1.45fr) 42px 48px 54px minmax(220px,1.9fr) 18px!important}
    .fg12StatusWrap{display:inline-flex;margin-left:7px;vertical-align:middle}.fg10Identity>b{display:inline!important}.fg10Identity{min-width:0}.fg10Identity small{display:block!important}.fg10Intel{min-width:0}
    .fg12SuperFlex{line-height:1.02!important;text-align:left}.fg12IRLabel{background:#241737!important;color:#e9d5ff!important}
    body.fg11Focus .fg10ColHead,body.fg11Focus .fg10PlayerMain{grid-template-columns:52px minmax(235px,1.5fr) 46px 52px 58px minmax(330px,2.15fr) 22px!important;gap:7px!important}
    body.fg11Focus .fg12StatusWrap{margin-left:8px}.fg10Status{vertical-align:1px}.fg12Clickable{cursor:pointer!important;transition:border-color .15s ease,background .15s ease}.fg12Clickable:hover{border-color:#3d82b5!important;background:#0c1d30!important}.fg12Clickable:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}.fg12InsightDetail{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:-1px 0 8px;padding:8px 10px;border:1px solid #2e4a67;border-radius:8px;background:#091827}.fg12InsightDetail>div{display:grid;gap:2px}.fg12InsightDetail b{font-size:10px;color:#7dd3fc}.fg12InsightDetail span{font-size:10px;color:#c4d3e4}.fg12Flagged{box-shadow:inset 0 0 0 2px #fbbf24!important;background:#2b2210!important}
    @media(max-width:1450px){body.fg11Focus .fg10ColHead,body.fg11Focus .fg10PlayerMain{grid-template-columns:46px minmax(190px,1.35fr) 44px 50px 56px minmax(235px,1.7fr) 18px!important;gap:6px!important}}
    @media(max-width:1180px){.fg10ColHead,.fg10PlayerMain{grid-template-columns:40px minmax(165px,1.25fr) 42px 48px 52px minmax(170px,1.5fr) 16px!important}.fg12InsightDetail{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
  const base=renderMatchup;renderMatchup=async function(){const out=await base();fg12PolishMatchup();fg12WireAlerts();return out};
  if(currentView==='matchup')setTimeout(()=>{fg12PolishMatchup();fg12WireAlerts()},0);
})();
