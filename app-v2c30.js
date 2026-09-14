/* Dashboard clarity pass: consistent League Hub, forward-looking Outlook, clearer recommendations/news. */
(function(){
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const F=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const N=(v,d=1)=>F(v)?Number(v).toFixed(d):'—';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function ranks(){return analysis?.ros?.my_ranks||{}}
  function rankPairs(){const r=ranks();return [['QB',r.qb],['RB',r.rb],['WR',r.wr],['TE',r.te]].filter(x=>F(x[1]))}
  function biggestNeed(){const a=rankPairs();return a.length?[...a].sort((x,y)=>Number(y[1])-Number(x[1]))[0]:null}
  function biggestStrength(){const a=rankPairs();return a.length?[...a].sort((x,y)=>Number(x[1])-Number(y[1]))[0]:null}

  function playoffEstimate(){
    const r=ranks(),teams=Number(analysis?.team_details?.length||C?.league_teams?.length||10);
    const configured=Number(C?.league?.settings?.playoff_teams||C?.league?.settings?.playoffTeams||0);
    const spots=configured>0?configured:Math.max(2,Math.ceil(teams*.6));
    const base=spots/teams;
    const strength=F(r.overall)&&teams>1?1-(Number(r.overall)-1)/(teams-1):.5;
    const rec=C?.my_team?.record||{},wins=Number(rec.wins||0),losses=Number(rec.losses||0),games=wins+losses;
    const recordPct=games?wins/games:.5;
    const week=Math.max(1,Number(C?.current_week||1));
    const recordWeight=clamp((week-1)/10,0,.35);
    const strengthWeight=.45;
    const raw=base+(strength-.5)*strengthWeight+(recordPct-.5)*recordWeight;
    const odds=Math.round(clamp(raw,.05,.95)*100);
    const overall=F(r.overall)?Number(r.overall):Math.ceil(teams/2);
    const lo=clamp(overall-1,1,teams),hi=clamp(overall+1,1,teams);
    return {odds,range:lo===hi?ordinal(lo):`${ordinal(lo)}–${ordinal(hi)}`,spots,teams};
  }
  function ordinal(n){n=Number(n);const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}

  function bestPath(){
    const wa=typeof storedWaiverIdeas==='function'?storedWaiverIdeas():[];
    const tr=typeof tradeIdeas==='function'?tradeIdeas():[];
    const rr=typeof tradeRadar==='function'?tradeRadar():[];
    if(wa[0]?.add)return {label:'Waiver wire',detail:`Add ${wa[0].add.name}`,kind:'waiver'};
    if(tr[0]?.get?.[0])return {label:'Trade',detail:`Target ${tr[0].get[0].name}`,kind:'trade'};
    if(rr[0]?.get?.[0])return {label:'Monitor trade market',detail:`Watch ${rr[0].get[0].name}`,kind:'trade'};
    return {label:'Hold',detail:'No move currently clears the recommendation bar.',kind:'hold'};
  }
  function trendLabel(){
    const r=ranks(),teams=Number(analysis?.team_details?.length||C?.league_teams?.length||10),overall=Number(r.overall||Math.ceil(teams/2));
    const path=bestPath();
    if(overall<=Math.ceil(teams*.3)&&path.kind!=='hold')return 'Rising';
    if(overall>Math.ceil(teams*.7))return 'Vulnerable';
    return 'Stable';
  }
  function confidenceLabel(){
    const week=Number(C?.current_week||1),m=mineTeam?.(),players=m?.players||[];
    const counts=players.map(p=>Number(p.ros_source_count||p.weekly_source_count||0)).filter(Boolean);
    const avg=counts.length?counts.reduce((a,b)=>a+b,0)/counts.length:0;
    if(week<=2||avg<2)return 'Medium';
    return avg>=2.7?'High':'Medium';
  }

  function outlookHTML(){
    const est=playoffEstimate(),need=biggestNeed(),path=bestPath(),trend=trendLabel(),conf=confidenceLabel();
    const risk=need?`${need[0]} depth (#${need[1]})`:'No major positional weakness';
    return `<section class="fg29Card fg29Outlook fg30Outlook"><div class="fg29Head"><div><h2>📊 My Team Outlook</h2><span>Forward-looking team health and next-best path.</span></div><b class="fg29Status">${E(trend)}</b></div><div class="fg30OutGrid"><div class="primary"><span>Estimated Playoff Odds</span><b>${est.odds}%</b><small title="Estimate uses league size/playoff settings when available, current record and ROS overall rank.">Model estimate ⓘ</small></div><div><span>Expected Finish</span><b>${E(est.range)}</b><small>Current ROS rank ±1</small></div><div><span>Biggest Risk</span><b>${E(risk)}</b></div><div><span>Best Improvement Path</span><b>${E(path.label)}</b><small>${E(path.detail)}</small></div><div><span>Team Trend</span><b>${E(trend)}</b></div><div><span>Confidence</span><b>${E(conf)}</b><small>Projection coverage + season stage</small></div></div></section>`;
  }

  function leagueStatus(i,x){
    const on=String(x.id)===String(C?.league?.id||'');
    if(on)return {label:'Current',cls:'current',detail:`Week ${C?.current_week||'—'} · active league`};
    return {label:'Open',cls:'open',detail:'Switch to review this league'};
  }
  function rebuildLeagueHub(){
    const hub=document.querySelector('.fg29LeagueHub');if(!hub)return;
    const list=hub.querySelector('.fg29LeagueList');if(!list)return;
    const ls=leagues();
    list.innerHTML=ls.map((x,i)=>{const s=leagueStatus(i,x);return `<button class="fg29League" data-fg29-league="${i}"><span>${x.platform==='ESPN'?'🏆':'🏈'}</span><div><b>${E(x.name)}</b><small>${E(x.team)} · ${E(x.platform)}</small><small class="fg30LeagueDetail">${E(s.detail)}</small></div><em class="fg30LeagueStatus ${s.cls}">${E(s.label)}</em></button>`}).join('');
    list.querySelectorAll('[data-fg29-league]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.fg29League);if(String(ls[i]?.id)===String(C?.league?.id))return;openLeague(i)});
  }

  function recommendationWhy(kind,p){
    const need=biggestNeed();
    if(kind==='waiver'){
      if(need&&String(pos(p?.position))===String(need[0]))return `Why: directly addresses your biggest roster need (${need[0]}).`;
      return need?`Why: this is the strongest immediate add even though ${need[0]} remains the bigger long-term need.`:'Why: this move clears the current waiver recommendation threshold.';
    }
    return need?`Why: this trade path targets a meaningful weakness without forcing a low-value waiver move.`:'Why: this is the most realistic trade path currently available.';
  }
  function enhanceImprove(){
    const box=document.querySelector('.fg28Improve');if(!box)return;
    box.querySelectorAll('.fg28Move').forEach(card=>{
      if(card.querySelector('.fg30Why'))return;
      const kind=card.classList.contains('trade')?'trade':'waiver';
      const playerName=card.querySelector('.fg28Player b')?.textContent||'';
      let p=null;for(const pool of [analysis?.waiver_pool||[],...(analysis?.team_details||[]).map(t=>t.players||[])]){for(const q of pool||[]){if(String(q?.name||'')===playerName){p=q;break}}if(p)break}
      const why=document.createElement('div');why.className='fg30Why';why.textContent=recommendationWhy(kind,p);const action=card.querySelector('.fg28Action');card.insertBefore(why,action||null);
    });
  }

  function opportunityHTML(kind){
    if(kind==='trades'){
      const a=typeof tradeRadar==='function'?tradeRadar().slice(0,3):[];
      return a.length?a.map((x,i)=>{const p=x.get?.[0],need=biggestNeed();return `<div class="fg30Opp"><span>${i+1}</span><div><b>${E(p?.name||'Trade target')} · ${E(pos(p?.position)||'')}</b><small>${E(x.partner||'Other team')} · ${need?`targets ${need[0]} weakness`:'realistic roster fit'}</small></div></div>`}).join(''):'<div class="muted">No realistic trade targets right now.</div>';
    }
    if(kind==='market'){
      const a=(analysis?.opportunities?.sleeper_trending||[]).slice(0,3);
      return a.length?a.map((p,i)=>`<div class="fg30Opp"><span>${i+1}</span><div><b>${E(p.name)} · ${E(p.position||'')}</b><small>Market movement only — verify roster fit before acting.</small></div></div>`).join(''):'<div class="muted">No major market movement right now.</div>';
    }
    const a=typeof waiverRadar==='function'?waiverRadar().slice(0,3):[];
    return a.length?a.map((x,i)=>{const p=x.add||{},need=biggestNeed();const direct=need&&String(pos(p.position))===String(need[0]);return `<div class="fg30Opp"><span>${i+1}</span><div><b>${E(p.name||'Waiver target')} · ${E(pos(p.position)||'')}</b><small>${direct?`Directly addresses ${need[0]} weakness`:`${E(x.hook||x.blocker||'Worth monitoring for depth or matchup value.')}`}</small></div></div>`}).join(''):'<div class="muted">No waiver adds currently clear the watchlist threshold.</div>';
  }
  function enhanceOpportunities(){
    const card=[...document.querySelectorAll('.fg29Bottom .fg6Card')].find(x=>/Opportunities/i.test(x.querySelector('h2')?.textContent||''));if(!card)return;
    const list=card.querySelector('#fg6OppList');if(list)list.innerHTML=opportunityHTML('waivers');
    card.querySelectorAll('.fg6OppTab').forEach(b=>b.onclick=()=>{card.querySelectorAll('.fg6OppTab').forEach(x=>x.classList.toggle('active',x===b));if(list)list.innerHTML=opportunityHTML(b.dataset.kind)});
  }

  function enhanceNews(){
    const card=[...document.querySelectorAll('.fg29Bottom .fg6Card')].find(x=>/Fantasy News/i.test(x.querySelector('h2')?.textContent||''));if(!card)return;
    card.classList.add('fg30News');
    card.querySelectorAll('.fg6NewsRow').forEach(row=>{const a=row.querySelector('a');const s=row.querySelector('span');if(a)a.classList.add('fg30Headline');if(s)s.classList.add('fg30Summary')});
  }

  function replaceOutlook(){const old=document.querySelector('.fg29Outlook');if(!old)return;old.outerHTML=outlookHTML()}
  function enforceGuruHidden(){if(currentView==='dashboard'){try{document.body.classList.add('fg11GuruHidden');document.body.classList.remove('fg11GuruOpen')}catch{}}}
  function enhance(){if(currentView!=='dashboard')return;rebuildLeagueHub();replaceOutlook();enhanceImprove();enhanceOpportunities();enhanceNews();enforceGuruHidden()}

  const rd=renderDashboard;renderDashboard=function(){const out=rd();setTimeout(enhance,0);return out};
  const sv=showView;showView=function(v){const out=sv(v);if(v==='dashboard')setTimeout(enhance,0);return out};
  setTimeout(enhance,0);

  const style=document.createElement('style');style.textContent=`
    .fg30LeagueStatus{font-style:normal!important;font-size:8px!important;font-weight:900!important;border-radius:999px;padding:4px 7px;border:1px solid #35506b;color:#b8c7d8!important;background:#0b1b2d}.fg30LeagueStatus.current{color:#9df5ca!important;background:#0c2b26;border-color:#216a56}.fg30LeagueStatus.open{color:#b9dcf5!important;background:#0b2033;border-color:#2d5e86}.fg30LeagueDetail{margin-top:3px!important;color:#6f879e!important}.fg29League em{white-space:nowrap}
    .fg30OutGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.fg30OutGrid>div{border:1px solid #20364e;background:#07111e;border-radius:8px;padding:8px;min-width:0}.fg30OutGrid>div.primary{border-color:#216a56;background:#0a201c}.fg30OutGrid span{display:block;color:#8fa6bf;font-size:8px}.fg30OutGrid b{display:block;font-size:13px;margin-top:2px;line-height:1.25}.fg30OutGrid .primary b{font-size:21px;color:#86efac}.fg30OutGrid small{display:block;font-size:7.5px;color:#7890a7;margin-top:3px;line-height:1.25}.fg30Why{margin-top:8px;border:1px solid #27435f;background:#0b1a29;border-radius:7px;padding:7px 8px;font-size:9px;line-height:1.4;color:#c9d8e7}.fg30Opp{display:grid;grid-template-columns:27px minmax(0,1fr);gap:8px;align-items:start;padding:7px 0;border-bottom:1px solid #1e324a}.fg30Opp:last-child{border-bottom:0}.fg30Opp>span{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#afc9df;color:#0b1a29;font-weight:900;font-size:10px}.fg30Opp b{display:block;font-size:10px}.fg30Opp small{display:block;font-size:8.5px;color:#8fa6bf;margin-top:2px;line-height:1.35}.fg30News .fg6NewsRow{grid-template-columns:minmax(0,1fr)!important;gap:2px!important;padding:7px 0!important}.fg30Headline{font-size:10.5px!important;line-height:1.3!important}.fg30Summary{font-size:8.5px!important;color:#8fa6bf!important;line-height:1.35!important;margin-top:2px!important}.fg30Outlook .fg29Status{min-width:54px;text-align:center}
    @media(max-width:760px){.fg30OutGrid{grid-template-columns:1fr}.fg30LeagueStatus{grid-column:2;justify-self:start}}
  `;document.head.appendChild(style);
})();
