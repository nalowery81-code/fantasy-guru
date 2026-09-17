/* Progressive enrichment for the reusable Fantasy Guru player modal. */
(function(){
  if(window.__fgProfileEnrichmentLoaded)return;
  window.__fgProfileEnrichmentLoaded=true;
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const F=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const N=(v,d=1)=>F(v)?Number(v).toFixed(d):'—';

  function players(){
    const out=[],seen=new Set();
    const add=p=>{const k=String(p?.canonical_player_id||p?.sleeper_id||p?.espn_id||p?.id||p?.name||'');if(k&&!seen.has(k)){seen.add(k);out.push(p)}};
    try{for(const t of analysis?.team_details||[])for(const p of t?.players||[])add(p);for(const p of analysis?.waiver_pool||[])add(p)}catch{}
    return out;
  }
  function currentPlayer(modal){const name=modal?.querySelector('.fgPIdentity h2')?.textContent?.trim().toLowerCase();return players().find(p=>String(p?.name||'').trim().toLowerCase()===name)||null}
  function fmtDate(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}
  function oppText(r){if(!r?.opponent)return'BYE';return `${String(r.home_away).toLowerCase()==='away'?'@':'vs'} ${r.opponent}`}

  function sectionByTitle(modal,title){return [...modal.querySelectorAll('.fgPSection')].find(s=>s.querySelector('h3')?.textContent?.trim()===title)||null}

  function renderBio(modal,bio={}){
    const spans=modal.querySelectorAll('.fgPBio span b');
    const vals=[bio.age??'—',bio.height||'—',bio.weight?`${bio.weight} lb`:'—',F(bio.experience)?(Number(bio.experience)===0?'Rookie':`${Math.round(Number(bio.experience))} yr`):'—',bio.college||'—'];
    spans.forEach((x,i)=>{if(i<vals.length)x.textContent=vals[i]});
    const info=sectionByTitle(modal,'Player Info')?.querySelector('.fgPInfo');
    if(info)info.innerHTML=`<div><span>Team</span><b>${E(bio.team||'—')}</b></div><div><span>Position</span><b>${E(bio.position||'—')}</b></div><div><span>Experience</span><b>${F(bio.experience)?(Number(bio.experience)===0?'Rookie':`${Math.round(Number(bio.experience))} yr`):'—'}</b></div><div><span>College</span><b>${E(bio.college||'—')}</b></div><div><span>Age</span><b>${E(bio.age??'—')}</b></div><div><span>Number</span><b>${bio.number!=null?'#'+E(bio.number):'—'}</b></div>`;
  }

  function renderSchedule(modal,data){
    const sec=sectionByTitle(modal,'Game Log / Recent Results');if(!sec)return;
    const rows=Array.isArray(data?.schedule)?data.schedule:[];
    const body=rows.length?rows.map(r=>`<tr class="${r.week===data.current_week?'current':''}"><td>${E(r.week)}</td><td>${E(fmtDate(r.date))}</td><td>${E(oppText(r))}</td><td>${E(r.result||r.status||'—')}</td><td>${F(r.guru_projection)?N(r.guru_projection):'—'}</td><td>${F(r.fantasy_points)?`<b>${N(r.fantasy_points)}</b>`:'—'}</td><td>${E(r.stat_line||'—')}</td></tr>`).join(''):`<tr><td colspan="7">No schedule data is available for this player yet.</td></tr>`;
    sec.innerHTML=`<div class="fgPSectionHead"><h3>Season Schedule & Stats</h3><span>${E(data?.season||'')} season</span></div><div class="fgPSeasonWrap"><table class="fgPSeason"><thead><tr><th>WK</th><th>DATE</th><th>OPP</th><th>RESULT</th><th>GURU PROJ</th><th>FANTASY PTS</th><th>STAT LINE</th></tr></thead><tbody>${body}</tbody></table></div><div class="fgPSourceNote">Fantasy points use this league's scoring settings when the required stat categories are available.</div>`;
  }

  function renderNews(modal,data){
    const sec=sectionByTitle(modal,'Latest News');if(!sec)return;
    const rows=Array.isArray(data?.news)?data.news:[];
    sec.innerHTML=`<div class="fgPSectionHead"><h3>Latest News</h3></div>${rows.length?rows.map(x=>`<article class="fgPNews"><b>${E(x.headline||'NFL update')}</b>${x.description?`<p>${E(x.description)}</p>`:''}</article>`).join(''):'<div class="fgPEmpty">No exact player-name news match is loaded right now.</div>'}`;
  }

  function setLoading(modal){const sec=sectionByTitle(modal,'Game Log / Recent Results');if(sec)sec.innerHTML='<div class="fgPSectionHead"><h3>Season Schedule & Stats</h3></div><div class="fgPEmpty">Loading schedule and completed-game stats…</div>'}

  async function enrich(modal){
    if(!modal||modal.dataset.fgEnriching)return;modal.dataset.fgEnriching='1';
    const p=currentPlayer(modal);if(!p){modal.dataset.fgEnriching='done';return}
    setLoading(modal);
    try{
      const context=typeof C!=='undefined'?C:{};
      const r=await fetch('/api/player-profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player:p,context})});
      const data=await r.json();
      if(!document.body.contains(modal))return;
      if(data?.available){renderBio(modal,data.bio||{});renderSchedule(modal,data);renderNews(modal,data)}
      else{const sec=sectionByTitle(modal,'Season Schedule & Stats')||sectionByTitle(modal,'Game Log / Recent Results');if(sec)sec.innerHTML='<div class="fgPSectionHead"><h3>Season Schedule & Stats</h3></div><div class="fgPEmpty">Schedule/stat enrichment is temporarily unavailable.</div>'}
    }catch{
      if(document.body.contains(modal)){const sec=sectionByTitle(modal,'Season Schedule & Stats')||sectionByTitle(modal,'Game Log / Recent Results');if(sec)sec.innerHTML='<div class="fgPSectionHead"><h3>Season Schedule & Stats</h3></div><div class="fgPEmpty">Schedule/stat enrichment is temporarily unavailable.</div>'}
    }finally{modal.dataset.fgEnriching='done'}
  }

  const observer=new MutationObserver(()=>{const modal=document.getElementById('fgPlayerModal');if(modal&&!modal.dataset.fgEnriching)enrich(modal)});
  observer.observe(document.body,{childList:true,subtree:true});
  const style=document.createElement('style');
  style.textContent=`.fgPSeasonWrap{overflow:auto;border:1px solid #183149;border-radius:8px}.fgPSeason{width:100%;border-collapse:collapse;font-size:9px;min-width:760px}.fgPSeason th{background:#0c2134;color:#9fb3c8;text-align:left;padding:7px}.fgPSeason td{padding:7px;border-top:1px solid #183149;vertical-align:top}.fgPSeason tr.current{background:#0c2236}.fgPSeason td:nth-child(5),.fgPSeason td:nth-child(6){text-align:center}.fgPSourceNote{color:#7891a8;font-size:8px;margin-top:6px}`;
  document.head.appendChild(style);
})();
