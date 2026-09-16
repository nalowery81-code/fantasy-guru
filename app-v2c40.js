/* Commit 4: final dashboard polish — direct render, unified CTAs, combined Snapshot + Outlook, corrected mascot. */
(function(){
  const E=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  const F=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const N=(v,d=1)=>F(v)?Number(v).toFixed(d):'—';
  const ord=n=>{n=Number(n);if(!Number.isFinite(n))return'—';const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};

  function lineupSignal(){
    try{
      if(typeof ssDecisions!=='function')return {level:'watch',label:'Lineup',text:'Lineup check is still loading.',meta:'Check again shortly',view:'startsit'};
      const d=ssDecisions()||{},x=(d.changes||[])[0];
      if(x){const edge=F(x.diff)?Number(x.diff):null;return {level:'act',label:'Lineup',text:`Start ${x.start?.name||'the recommended player'} over ${x.sit?.name||'your current starter'}`,meta:edge!=null?`${edge>=0?'+':''}${edge.toFixed(1)} projected points`:'Recommended change',view:'startsit'};}
      return {level:'good',label:'Lineup',text:'Your current starters already match Guru’s preferred lineup.',meta:'No change needed',view:'startsit'};
    }catch{return {level:'watch',label:'Lineup',text:'Lineup recommendation is temporarily unavailable.',meta:'Try again',view:'startsit'}}
  }
  function waiverSignal(){
    try{
      const x=typeof storedWaiverIdeas==='function'?(storedWaiverIdeas()||[])[0]:null;
      if(x?.add)return {level:'act',label:'Waivers',text:`Add ${x.add.name}${x.drop?.name?` for ${x.drop.name}`:''}`,meta:'Verified roster improvement',view:'waivers'};
      return {level:'good',label:'Waivers',text:'No verified available player clearly improves your roster.',meta:'No move needed',view:'waivers'};
    }catch{return {level:'watch',label:'Waivers',text:'Waiver recommendation is temporarily unavailable.',meta:'Try again',view:'waivers'}}
  }
  function tradeSignal(){
    try{
      const strict=typeof tradeIdeas==='function'?(tradeIdeas()||[]):[],radar=typeof tradeRadar==='function'?(tradeRadar()||[]):[],x=strict[0]||radar[0];
      if(x?.get?.[0])return {level:'watch',label:'Trade watch',text:`${x.get[0].name}${x.partner?` · ${x.partner}`:''}`,meta:'No urgent trade action',view:'trades'};
      return {level:'good',label:'Trade watch',text:'No trade currently clears Guru’s recommendation bar.',meta:'No urgent action',view:'trades'};
    }catch{return {level:'watch',label:'Trade watch',text:'Trade recommendation is temporarily unavailable.',meta:'Try again',view:'trades'}}
  }
  function injurySignal(){
    try{
      const m=typeof mineTeam==='function'?mineTeam():null,flagged=(m?.players||[]).filter(p=>p?.starter&&p?.injury_status&&String(p.injury_status).toLowerCase()!=='healthy');
      if(flagged.length){const p=flagged[0];return {level:'watch',label:'Injury watch',text:`${p.name} is ${p.injury_status}${flagged.length>1?` · +${flagged.length-1} more`:''}`,meta:'Recheck before kickoff',view:'intel'};}
      return {level:'good',label:'Injury watch',text:'No starter has an injury flag that needs attention.',meta:'All clear',view:'intel'};
    }catch{return {level:'watch',label:'Injury watch',text:'Injury status is temporarily unavailable.',meta:'Try again',view:'intel'}}
  }
  function signals(){return [lineupSignal(),waiverSignal(),tradeSignal(),injurySignal()]}
  function overall(ss){const act=ss.filter(x=>x.level==='act').length,watch=ss.filter(x=>x.level==='watch').length;if(act)return{cls:'act',label:'ACT',sub:`${act} move${act===1?'':'s'} worth looking at today.`};if(watch)return{cls:'watch',label:'WATCH',sub:`${watch} item${watch===1?'':'s'} worth monitoring.`};return{cls:'hold',label:'HOLD',sub:'You’re set for now. No action required today.'}}

  function matchup(){
    const d=matchupData?.available?matchupData:null,you=d?.you||{},opp=d?.opponent||d?.them||d?.opponent_team||{};
    const myName=you.team||C?.my_team?.team||'Your Team',oppName=opp.team||opp.name||d?.opponent_name||'Opponent';
    const myProj=F(you.projection)?Number(you.projection):F(d?.your_projection)?Number(d.your_projection):null;
    const oppProj=F(opp.projection)?Number(opp.projection):F(d?.opponent_projection)?Number(d.opponent_projection):null;
    return {myName,oppName,myProj,oppProj,edge:myProj!=null&&oppProj!=null?myProj-oppProj:null};
  }
  function snapshot(){
    const r=analysis?.ros?.my_ranks||{},teams=Number(analysis?.team_details?.length||C?.league_teams?.length||10);
    const pairs=[['QB',r.qb],['RB',r.rb],['WR',r.wr],['TE',r.te]].filter(x=>F(x[1]));
    const weak=pairs.length?[...pairs].sort((a,b)=>Number(b[1])-Number(a[1]))[0]:null;
    const strong=pairs.length?[...pairs].sort((a,b)=>Number(a[1])-Number(b[1]))[0]:null;
    return {overall:F(r.overall)?Number(r.overall):null,teams,weak,strong,pairs};
  }
  function seasonOutlook(s){
    const rank=s.overall,teams=s.teams||10;let label='Competitive',cls='competitive',copy='You’re in a workable position this season.';
    if(F(rank)&&rank<=Math.ceil(teams*.3)){label='Strong';cls='strong';copy='Your roster grades near the top of this league.'}
    else if(F(rank)&&rank>Math.ceil(teams*.7)){label='At Risk';cls='risk';copy='Your roster needs improvement to climb the league.'}
    else if(F(rank)&&rank>Math.ceil(teams*.55)){label='On the Bubble';cls='bubble';copy='You’re within range, but there is room to improve.'}
    return {label,cls,copy};
  }
  function signalIcon(s){return s.level==='act'?'↑':s.level==='watch'?'↔':'✓'}
  function actionRows(ss){
    const important=ss.filter(x=>x.level!=='good'),chosen=important.length?important:ss.slice(0,2);
    return chosen.slice(0,3).map(s=>`<div class="fg40Action ${s.level}"><span class="fg40ActionIcon">${signalIcon(s)}</span><div class="fg40ActionText"><b>${E(s.label)}</b><span>${E(s.text)}</span></div><strong>${E(s.meta||'')}</strong><button class="fg40Cta" data-fg40-view="${E(s.view)}">${s.level==='good'?'View':'Review'} →</button></div>`).join('');
  }
  function analyticsRows(s){
    const pos=s.pairs.map(([p,r])=>`<div><span>${E(p)}</span><b>#${E(r)}</b><small>of ${E(s.teams)}</small></div>`).join('');
    return `<div class="fg40WhyGrid">${pos||'<div><span>Position ranks</span><b>—</b><small>Unavailable</small></div>'}<div><span>Overall</span><b>${s.overall?'#'+s.overall:'—'}</b><small>of ${s.teams}</small></div></div><p class="fg40WhyNote">These are rest-of-season roster ranks. Guru uses them with weekly projections, replacement value, source confidence and availability before recommending a move.</p>`;
  }

  function dashboardHTML(){
    const ss=signals(),o=overall(ss),m=matchup(),snap=snapshot(),out=seasonOutlook(snap),clear=ss.filter(x=>x.level==='good').length;
    const edgeText=F(m.edge)?`${m.edge>=0?'+':''}${N(m.edge)} projected ${m.edge>=0?'advantage':'disadvantage'}`:'Projection comparison unavailable';
    return `<div class="fg40Dash">
      <section class="fg40Hero"><div class="fg40Mascot"><img src="/assets/fantasy-guru-mascot-final.webp" alt="Fantasy Guru robot mascot"></div><div class="fg40HeroMain"><div class="fg40HeroHead"><div><span class="fg40Eyebrow">GURU TODAY · WEEK ${E(C?.current_week||'—')}</span><h1>What should I do?</h1><p>${E(o.sub)}</p></div><strong class="fg40Status ${o.cls}">${E(o.label)}</strong></div><div class="fg40Actions">${actionRows(ss)}</div><div class="fg40AllClear"><span>✓</span>${clear?`${clear} other check${clear===1?'':'s'} look good right now.`:'Everything else looks good right now.'}</div></div></section>
      <div class="fg40BottomGrid">
        <section class="fg40Card"><div class="fg40CardHead"><div><span>🗓️</span><div><h2>This Week</h2><p>Your projected matchup for Week ${E(C?.current_week||'—')}.</p></div></div><button class="fg40Cta" data-fg40-view="matchup">View Matchup →</button></div><div class="fg40Score"><div><small>${E(m.myName)}</small><b>${N(m.myProj)}</b><span>Projected</span></div><em>VS</em><div><small>${E(m.oppName)}</small><b>${N(m.oppProj)}</b><span>Projected</span></div></div><div class="fg40Edge ${F(m.edge)&&m.edge<0?'bad':''}">${E(edgeText)}</div></section>
        <section class="fg40Card fg40Team"><div class="fg40CardHead"><div><span>👥</span><div><h2>Team Snapshot &amp; Outlook</h2><p>A quick summary of your team.</p></div></div><button class="fg40Cta" id="fg40WhyBtn">See Why →</button></div><div class="fg40TeamSummary"><div><span>🏆</span><div><small>Overall Rank</small><b>${snap.overall?'#'+snap.overall:'—'} <em>/ ${snap.teams}</em></b><p>In this league</p></div></div><div><span>🎯</span><div><small>Biggest Need</small><b>${E(snap.weak?.[0]||'—')}</b><p>${snap.weak?`${ord(snap.weak[1])} at position`:'Need unavailable'}</p></div></div><div><span>📊</span><div><small>Outlook</small><b class="${out.cls}">${E(out.label)}</b><p>${E(out.copy)}</p></div></div></div><div class="fg40Quick"><span>✓</span>${snap.strong?`Strength: ${E(snap.strong[0])} (#${E(snap.strong[1])})`:'Strength data unavailable'}<span>✓</span>${snap.weak?`Room to improve: ${E(snap.weak[0])} (#${E(snap.weak[1])})`:'Need data unavailable'}</div><div class="fg40Why" id="fg40Why" hidden>${analyticsRows(snap)}</div></section>
      </div>
    </div>`;
  }
  function bind(){
    document.querySelectorAll('[data-fg40-view]').forEach(b=>b.onclick=()=>{const v=b.dataset.fg40View;if(typeof showView==='function')showView(v)});
    const btn=document.getElementById('fg40WhyBtn'),why=document.getElementById('fg40Why');if(btn&&why)btn.onclick=()=>{why.hidden=!why.hidden;btn.textContent=why.hidden?'See Why →':'Hide Why ↑'};
  }
  function directRender(){if(currentView!=='dashboard')return;const content=$('content');if(!content)return;content.innerHTML=dashboardHTML();bind();}

  renderDashboard=function(){directRender()};
  setTimeout(()=>{if(currentView==='dashboard')directRender()},0);

  const style=document.createElement('style');style.textContent=`
    #content:has(.fg40Dash){padding:10px 12px 16px!important;background:transparent!important}.fg40Dash{display:grid;gap:12px;width:100%;color:#eef6ff}.fg40Hero{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:365px;background:linear-gradient(135deg,#07111e,#0a2034 72%,#07111e);border:1px solid #12aeea;border-radius:14px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.2)}.fg40Mascot{min-height:365px;background:radial-gradient(circle at 50% 35%,rgba(14,165,233,.18),transparent 62%);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}.fg40Mascot img{width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block}.fg40HeroMain{padding:22px 22px 16px;min-width:0}.fg40HeroHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.fg40Eyebrow{display:block;color:#38bdf8;font-weight:950;font-size:9px;letter-spacing:.12em}.fg40HeroHead h1{margin:5px 0 3px;font-size:35px;line-height:1.05}.fg40HeroHead p{margin:0;color:#a7bbcf;font-size:12px}.fg40Status{font-size:11px;letter-spacing:.08em;border-radius:999px;padding:11px 16px;white-space:nowrap}.fg40Status.act{background:#43161d;color:#fecdd3;border:1px solid #ef4444}.fg40Status.watch{background:#3a2d0b;color:#fde68a;border:1px solid #f59e0b}.fg40Status.hold{background:#0c2b26;color:#9df5ca;border:1px solid #22c55e}.fg40Actions{display:grid;gap:8px;margin-top:18px}.fg40Action{display:grid;grid-template-columns:36px minmax(0,1fr) auto 112px;gap:10px;align-items:center;background:#071422;border:1px solid #28435f;border-radius:10px;padding:11px 12px}.fg40Action.act{border-left:4px solid #22c55e}.fg40Action.watch{border-left:4px solid #f59e0b}.fg40Action.good{border-left:4px solid #64748b}.fg40ActionIcon{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;background:#0e3652;color:#dff5ff;font-size:16px;font-weight:950}.fg40Action.act .fg40ActionIcon{background:#0e6b49;color:#b7f7d3}.fg40Action.watch .fg40ActionIcon{background:#6b4b0e;color:#fde68a}.fg40ActionText b{display:block;font-size:12px}.fg40ActionText span{display:block;font-size:10px;color:#a9bdd0;margin-top:2px;line-height:1.35}.fg40Action>strong{font-size:10px;color:#6ee7b7;text-align:right;white-space:nowrap}.fg40Action.watch>strong{color:#fde68a}.fg40Cta{min-height:40px;border-radius:10px;border:1px solid #00c2ff;background:linear-gradient(180deg,#139ee5,#0678bd);color:#fff;padding:0 16px;font-size:10px;font-weight:900;white-space:nowrap;cursor:pointer;box-shadow:0 0 0 1px rgba(0,194,255,.12),0 5px 14px rgba(0,132,205,.16);transition:filter .15s ease,box-shadow .15s ease,transform .15s ease}.fg40Cta:hover{filter:brightness(1.14);box-shadow:0 0 14px rgba(0,194,255,.35)}.fg40Cta:active{filter:brightness(.9);transform:translateY(1px)}.fg40AllClear{display:flex;align-items:center;gap:8px;border-top:1px solid #18324b;margin-top:10px;padding-top:10px;color:#c3d5e6;font-size:10px}.fg40AllClear>span{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#0e5f44;color:#b7f7d3;font-weight:950}.fg40BottomGrid{display:grid;grid-template-columns:.88fr 1.12fr;gap:12px}.fg40Card{background:#081524;border:1px solid #28405d;border-radius:12px;padding:13px;min-width:0}.fg40CardHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.fg40CardHead>div{display:flex;gap:9px;align-items:flex-start}.fg40CardHead>div>span{font-size:19px}.fg40CardHead h2{margin:0;font-size:17px}.fg40CardHead p{margin:2px 0 0;color:#8299b0;font-size:8.5px}.fg40Score{display:grid;grid-template-columns:1fr 44px 1fr;align-items:center;margin-top:14px;border:1px solid #20364e;border-radius:10px;overflow:hidden}.fg40Score>div{padding:12px;text-align:center}.fg40Score>div:first-child{border-right:1px solid #20364e}.fg40Score>div:last-child{border-left:1px solid #20364e}.fg40Score small{display:block;font-size:9px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fg40Score b{display:block;font-size:25px;margin-top:4px}.fg40Score span{display:block;color:#8299b0;font-size:8px;margin-top:1px}.fg40Score>em{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;margin:auto;border:1px solid #24648a;color:#bfe8ff;font-style:normal;font-size:9px;font-weight:900}.fg40Edge{margin:8px auto 0;width:max-content;max-width:100%;border-radius:999px;padding:6px 11px;background:#0e4f3b;color:#a7f3d0;font-size:9px;font-weight:900}.fg40Edge.bad{background:#4a1d26;color:#fecdd3}.fg40TeamSummary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.fg40TeamSummary>div{display:grid;grid-template-columns:36px 1fr;gap:9px;align-items:center;background:#07111e;border:1px solid #20364e;border-radius:10px;padding:12px}.fg40TeamSummary>div>span{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#0e3652;font-size:18px}.fg40TeamSummary small{display:block;color:#9ab0c5;font-size:8px}.fg40TeamSummary b{display:block;font-size:19px;margin-top:2px}.fg40TeamSummary b em{font-style:normal;font-size:10px;color:#8299b0}.fg40TeamSummary b.strong,.fg40TeamSummary b.competitive{color:#6ee7b7}.fg40TeamSummary b.bubble{color:#fde68a}.fg40TeamSummary b.risk{color:#fecdd3}.fg40TeamSummary p{margin:2px 0 0;color:#8299b0;font-size:8px;line-height:1.25}.fg40Quick{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:10px;color:#a9bdd0;font-size:9px}.fg40Quick span{color:#6ee7b7;font-weight:950}.fg40Why{margin-top:10px;border-top:1px solid #20364e;padding-top:10px}.fg40WhyGrid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.fg40WhyGrid>div{background:#07111e;border:1px solid #20364e;border-radius:8px;padding:8px;text-align:center}.fg40WhyGrid span,.fg40WhyGrid small{display:block;color:#8299b0;font-size:8px}.fg40WhyGrid b{display:block;font-size:14px;margin:2px 0}.fg40WhyNote{margin:8px 0 0;color:#91a7bd;font-size:8.5px;line-height:1.4}
    @media(max-width:1150px){.fg40Hero{grid-template-columns:210px minmax(0,1fr)}.fg40Action{grid-template-columns:34px minmax(0,1fr) auto}.fg40Action>strong{grid-column:2}.fg40Action>.fg40Cta{grid-column:3;grid-row:1/3}.fg40BottomGrid{grid-template-columns:1fr}.fg40TeamSummary{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:780px){.fg40Hero{grid-template-columns:1fr}.fg40Mascot{min-height:220px;max-height:280px}.fg40Mascot img{max-height:280px}.fg40HeroMain{padding:16px}.fg40HeroHead h1{font-size:28px}.fg40Action{grid-template-columns:32px minmax(0,1fr)}.fg40Action>strong{grid-column:2;text-align:left}.fg40Action>.fg40Cta{grid-column:2;grid-row:auto;width:max-content}.fg40TeamSummary{grid-template-columns:1fr}.fg40WhyGrid{grid-template-columns:repeat(2,1fr)}.fg40Status{padding:8px 11px}}
  `;document.head.appendChild(style);
})();
