/* Commit 3: Simplified dashboard — Guru Today hero + This Week + Team Snapshot + Season Outlook. */
(function(){
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const F=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const N=(v,d=1)=>F(v)?Number(v).toFixed(d):'—';
  const ord=n=>{n=Number(n);if(!Number.isFinite(n))return'—';const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};

  function lineupSignal(){
    try{
      if(typeof ssDecisions!=='function')return {level:'watch',label:'Lineup',text:'Lineup check is still loading.',view:'startsit'};
      const d=ssDecisions()||{},x=(d.changes||[])[0];
      if(x){const edge=F(x.diff)?Number(x.diff):null;return {level:'act',label:'Lineup',text:`Start ${x.start?.name||'the recommended player'} over ${x.sit?.name||'your current starter'}`,meta:edge!=null?`${edge>=0?'+':''}${edge.toFixed(1)} projected points`:'Recommended change',view:'startsit'};}
      return {level:'good',label:'Lineup',text:'Your current starters already match Guru’s preferred lineup.',meta:'No change needed',view:'startsit'};
    }catch{return {level:'watch',label:'Lineup',text:'Lineup recommendation is temporarily unavailable.',view:'startsit'}}
  }
  function waiverSignal(){
    try{
      const x=typeof storedWaiverIdeas==='function'?(storedWaiverIdeas()||[])[0]:null;
      if(x?.add){return {level:'act',label:'Waivers',text:`Add ${x.add.name}${x.drop?.name?` for ${x.drop.name}`:''}`,meta:'Verified roster improvement',view:'waivers'};}
      return {level:'good',label:'Waivers',text:'No verified available player clearly improves your roster.',meta:'No move needed',view:'waivers'};
    }catch{return {level:'watch',label:'Waivers',text:'Waiver recommendation is temporarily unavailable.',view:'waivers'}}
  }
  function tradeSignal(){
    try{
      const strict=typeof tradeIdeas==='function'?(tradeIdeas()||[]):[],radar=typeof tradeRadar==='function'?(tradeRadar()||[]):[],x=strict[0]||radar[0];
      if(x?.get?.[0])return {level:'watch',label:'Trade watch',text:`${x.get[0].name}${x.partner?` · ${x.partner}`:''}`,meta:'No urgent trade action',view:'trades'};
      return {level:'good',label:'Trade watch',text:'No trade currently clears Guru’s recommendation bar.',meta:'No urgent action',view:'trades'};
    }catch{return {level:'watch',label:'Trade watch',text:'Trade recommendation is temporarily unavailable.',view:'trades'}}
  }
  function injurySignal(){
    try{
      const m=typeof mineTeam==='function'?mineTeam():null,flagged=(m?.players||[]).filter(p=>p?.starter&&p?.injury_status&&String(p.injury_status).toLowerCase()!=='healthy');
      if(flagged.length){const p=flagged[0];return {level:'watch',label:'Injury watch',text:`${p.name} is ${p.injury_status}${flagged.length>1?` · +${flagged.length-1} more`:''}`,meta:'Recheck before kickoff',view:'intel'};}
      return {level:'good',label:'Injury watch',text:'No starter has an injury flag that needs attention.',meta:'All clear',view:'intel'};
    }catch{return {level:'watch',label:'Injury watch',text:'Injury status is temporarily unavailable.',view:'intel'}}
  }
  function signals(){return [lineupSignal(),waiverSignal(),tradeSignal(),injurySignal()]}
  function overall(ss){const act=ss.filter(x=>x.level==='act').length,watch=ss.filter(x=>x.level==='watch').length;if(act)return{cls:'act',label:'ACT',sub:`${act} move${act===1?'':'s'} worth looking at today.`};if(watch)return{cls:'watch',label:'WATCH',sub:`${watch} item${watch===1?'':'s'} worth monitoring.`};return{cls:'hold',label:'HOLD',sub:'You’re set for now. No action required today.'}}

  function matchup(){
    const d=matchupData?.available?matchupData:null;
    const you=d?.you||{},opp=d?.opponent||d?.them||{};
    const myName=you.team||C?.my_team?.team||'Your Team',oppName=opp.team||opp.name||'Opponent';
    const myProj=F(you.projection)?Number(you.projection):null,oppProj=F(opp.projection)?Number(opp.projection):null;
    const edge=myProj!=null&&oppProj!=null?myProj-oppProj:null;
    return {myName,oppName,myProj,oppProj,edge};
  }
  function snapshot(){
    const r=analysis?.ros?.my_ranks||{},teams=Number(analysis?.team_details?.length||C?.league_teams?.length||10);
    const pairs=[['QB',r.qb],['RB',r.rb],['WR',r.wr],['TE',r.te]].filter(x=>F(x[1]));
    const weak=pairs.length?[...pairs].sort((a,b)=>Number(b[1])-Number(a[1]))[0]:null;
    const strong=pairs.length?[...pairs].sort((a,b)=>Number(a[1])-Number(b[1]))[0]:null;
    return {overall:F(r.overall)?Number(r.overall):null,teams,weak,strong};
  }
  function seasonOutlook(s){
    const rank=s.overall,teams=s.teams||10;
    let label='Competitive',cls='competitive',copy='You’re in a workable position this season.';
    if(F(rank)&&rank<=Math.ceil(teams*.3)){label='Strong';cls='strong';copy='Your roster grades near the top of this league.'}
    else if(F(rank)&&rank>Math.ceil(teams*.7)){label='At Risk';cls='risk';copy='Your roster needs improvement to climb the league.'}
    else if(F(rank)&&rank>Math.ceil(teams*.55)){label='On the Bubble';cls='bubble';copy='You’re within range, but there is room to improve.'}
    const bullets=[];
    if(s.strong)bullets.push(`Strength: ${s.strong[0]} (#${s.strong[1]})`);
    if(s.weak)bullets.push(`Room to improve: ${s.weak[0]} (#${s.weak[1]})`);
    bullets.push('Guru will only recommend moves that clear its value bar.');
    return {label,cls,copy,bullets:bullets.slice(0,3)};
  }

  function signalIcon(s){if(s.level==='act')return'↑';if(s.level==='watch')return'↔';return'✓'}
  function actionRows(ss){
    const important=ss.filter(x=>x.level!=='good');
    const chosen=important.length?important:ss.slice(0,2);
    return chosen.slice(0,3).map(s=>`<button class="fg39Action ${s.level}" data-fg39-view="${E(s.view)}"><span class="fg39ActionIcon">${signalIcon(s)}</span><div class="fg39ActionText"><b>${E(s.label)}</b><span>${E(s.text)}</span></div><strong>${E(s.meta||'')}</strong><em>${s.level==='good'?'View':'Review'} →</em></button>`).join('');
  }

  function dashboardHTML(){
    const ss=signals(),o=overall(ss),m=matchup(),snap=snapshot(),out=seasonOutlook(snap);
    const clear=ss.filter(x=>x.level==='good').length;
    const edgeText=F(m.edge)?`${m.edge>=0?'+':''}${N(m.edge)} projected ${m.edge>=0?'advantage':'disadvantage'}`:'Projection comparison unavailable';
    return `<div class="fg39Dash">
      <section class="fg39Hero">
        <div class="fg39Mascot"><img src="/assets/fantasy-guru-robot.webp" alt="Fantasy Guru robot mascot"><span>Small moves.<br>Big wins.</span></div>
        <div class="fg39HeroMain">
          <div class="fg39HeroHead"><div><span class="fg39Eyebrow">GURU TODAY · WEEK ${E(C?.current_week||'—')}</span><h1>What should I do?</h1><p>${E(o.sub)}</p></div><strong class="fg39Status ${o.cls}">${E(o.label)}</strong></div>
          <div class="fg39Actions">${actionRows(ss)}</div>
          <div class="fg39AllClear"><span>✓</span>${clear?`${clear} other check${clear===1?'':'s'} look good right now.`:'Everything else looks good right now.'}</div>
        </div>
      </section>
      <div class="fg39SummaryGrid">
        <section class="fg39Card fg39Week"><div class="fg39CardHead"><div><span>🗓️</span><div><h2>This Week</h2><p>Your projected matchup for Week ${E(C?.current_week||'—')}.</p></div></div><button data-fg39-view="matchup">View Matchup →</button></div>
          <div class="fg39Score"><div><small>${E(m.myName)}</small><b>${N(m.myProj)}</b><span>Projected</span></div><em>VS</em><div><small>${E(m.oppName)}</small><b>${N(m.oppProj)}</b><span>Projected</span></div></div><div class="fg39Edge ${F(m.edge)&&m.edge<0?'bad':''}">${E(edgeText)}</div>
        </section>
        <section class="fg39Card"><div class="fg39CardHead"><div><span>👥</span><div><h2>Team Snapshot</h2><p>A quick look at your team.</p></div></div></div><div class="fg39Snapshot"><div><span>Overall Rank</span><b>🏆 ${snap.overall?'#'+snap.overall:'—'} <small>/ ${snap.teams}</small></b><em>In this league</em></div><div><span>Biggest Need</span><b>${E(snap.weak?.[0]||'—')}</b><em>${snap.weak?`${ord(snap.weak[1])} at position`:'Need unavailable'}</em></div></div></section>
        <section class="fg39Card"><div class="fg39CardHead"><div><span>📊</span><div><h2>Season Outlook</h2><p>Directional roster health, not fake precision.</p></div></div></div><div class="fg39Outlook ${out.cls}"><b>${E(out.label)}</b><span>${E(out.copy)}</span></div><div class="fg39Bullets">${out.bullets.map(x=>`<div><span>✓</span>${E(x)}</div>`).join('')}</div></section>
      </div>
    </div>`;
  }

  function bind(){
    document.querySelectorAll('[data-fg39-view]').forEach(b=>b.onclick=()=>{const v=b.dataset.fg39View;if(typeof showView==='function')showView(v)});
  }
  function simplify(){
    if(currentView!=='dashboard')return;
    const content=$('content');if(!content)return;
    content.innerHTML=dashboardHTML();
    bind();
  }

  const baseRenderDashboard=renderDashboard;
  renderDashboard=function(){const out=baseRenderDashboard();setTimeout(simplify,320);return out};
  const baseShowView=showView;
  showView=function(v){const out=baseShowView(v);if(v==='dashboard')setTimeout(simplify,320);return out};
  setTimeout(simplify,500);

  const style=document.createElement('style');style.textContent=`
    #content:has(.fg39Dash){padding:10px 12px 16px!important;background:transparent!important}.fg39Dash{display:grid;gap:12px;width:100%;max-width:none;color:#eef6ff}.fg39Hero{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:365px;background:linear-gradient(135deg,#07111e 0%,#0a2034 72%,#07111e 100%);border:1px solid #12aeea;border-radius:14px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.2)}
    .fg39Mascot{position:relative;display:flex;align-items:stretch;justify-content:center;min-height:365px;background:radial-gradient(circle at 50% 35%,rgba(14,165,233,.18),transparent 62%)}.fg39Mascot img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}.fg39Mascot>span{position:absolute;left:24px;bottom:22px;color:#8fe7ff;font-size:15px;line-height:1.08;font-weight:800;font-style:italic;transform:rotate(-4deg);text-shadow:0 2px 12px #00101c}
    .fg39HeroMain{padding:22px 22px 16px;min-width:0}.fg39HeroHead{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.fg39Eyebrow{display:block;color:#38bdf8;font-weight:950;font-size:9px;letter-spacing:.12em}.fg39HeroHead h1{margin:5px 0 3px;font-size:35px;line-height:1.05}.fg39HeroHead p{margin:0;color:#a7bbcf;font-size:12px}.fg39Status{font-size:11px;letter-spacing:.08em;border-radius:999px;padding:11px 16px;white-space:nowrap}.fg39Status.act{background:#43161d;color:#fecdd3;border:1px solid #ef4444}.fg39Status.watch{background:#3a2d0b;color:#fde68a;border:1px solid #f59e0b}.fg39Status.hold{background:#0c2b26;color:#9df5ca;border:1px solid #22c55e}
    .fg39Actions{display:grid;gap:8px;margin-top:18px}.fg39Action{display:grid;grid-template-columns:36px minmax(0,1fr) auto 88px;gap:10px;align-items:center;text-align:left;background:#071422;color:#edf6ff;border:1px solid #28435f;border-radius:10px;padding:11px 12px;cursor:pointer}.fg39Action:hover{border-color:#38bdf8;background:#0a1c2e}.fg39Action.act{border-left:4px solid #22c55e}.fg39Action.watch{border-left:4px solid #f59e0b}.fg39Action.good{border-left:4px solid #64748b}.fg39ActionIcon{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;background:#0e3652;color:#dff5ff;font-size:16px;font-weight:950}.fg39Action.act .fg39ActionIcon{background:#0e6b49;color:#b7f7d3}.fg39Action.watch .fg39ActionIcon{background:#6b4b0e;color:#fde68a}.fg39ActionText b{display:block;font-size:12px}.fg39ActionText span{display:block;font-size:10px;color:#a9bdd0;margin-top:2px;line-height:1.35}.fg39Action>strong{font-size:10px;color:#6ee7b7;text-align:right;white-space:nowrap}.fg39Action.watch>strong{color:#fde68a}.fg39Action>em{font-style:normal;border:1px solid #1687bd;border-radius:7px;padding:8px 9px;text-align:center;color:#dff5ff;background:#0b5f91;font-size:9px;font-weight:900}.fg39Action.good>em{background:#0b2033}.fg39AllClear{display:flex;align-items:center;gap:8px;border-top:1px solid #18324b;margin-top:10px;padding-top:10px;color:#c3d5e6;font-size:10px}.fg39AllClear>span{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#0e5f44;color:#b7f7d3;font-weight:950}
    .fg39SummaryGrid{display:grid;grid-template-columns:1.15fr .92fr .96fr;gap:12px}.fg39Card{background:#081524;border:1px solid #28405d;border-radius:12px;padding:13px;min-width:0}.fg39CardHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.fg39CardHead>div{display:flex;gap:9px;align-items:flex-start}.fg39CardHead>div>span{font-size:19px}.fg39CardHead h2{margin:0;font-size:17px}.fg39CardHead p{margin:2px 0 0;color:#8299b0;font-size:8.5px}.fg39CardHead button{border:0;background:transparent;color:#38bdf8;font-size:9px;font-weight:900;cursor:pointer}.fg39Score{display:grid;grid-template-columns:1fr 44px 1fr;align-items:center;margin-top:14px;border:1px solid #20364e;border-radius:10px;overflow:hidden}.fg39Score>div{padding:12px;text-align:center}.fg39Score>div:first-child{border-right:1px solid #20364e}.fg39Score>div:last-child{border-left:1px solid #20364e}.fg39Score small{display:block;font-size:9px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fg39Score b{display:block;font-size:25px;margin-top:4px}.fg39Score span{display:block;color:#8299b0;font-size:8px;margin-top:1px}.fg39Score em{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;margin:auto;border:1px solid #24648a;color:#bfe8ff;font-style:normal;font-size:9px;font-weight:900}.fg39Edge{margin:8px auto 0;width:max-content;max-width:100%;border-radius:999px;padding:6px 11px;background:#0e4f3b;color:#a7f3d0;font-size:9px;font-weight:900}.fg39Edge.bad{background:#4a1d26;color:#fecdd3}.fg39Snapshot{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.fg39Snapshot>div{border:1px solid #20364e;border-radius:10px;padding:15px 10px;text-align:center;background:#07111e}.fg39Snapshot span{display:block;color:#95a9bd;font-size:8px}.fg39Snapshot b{display:block;font-size:22px;margin-top:5px}.fg39Snapshot b small{font-size:11px;color:#8299b0}.fg39Snapshot em{display:block;font-style:normal;color:#8299b0;font-size:8px;margin-top:4px}.fg39Outlook{margin-top:14px;border:1px solid #216a56;background:#0a211c;border-radius:10px;padding:13px}.fg39Outlook b{display:block;font-size:15px;color:#86efac}.fg39Outlook span{display:block;color:#b8d7c9;font-size:9px;margin-top:3px}.fg39Outlook.bubble{border-color:#8a6b1b;background:#2d250b}.fg39Outlook.bubble b{color:#fde68a}.fg39Outlook.risk{border-color:#8f3040;background:#32131a}.fg39Outlook.risk b{color:#fecdd3}.fg39Bullets{display:grid;gap:7px;margin-top:10px}.fg39Bullets>div{display:flex;gap:7px;align-items:flex-start;color:#a9bdd0;font-size:9px;line-height:1.35}.fg39Bullets>div>span{color:#86efac;font-weight:950}
    @media(max-width:1150px){.fg39Hero{grid-template-columns:210px minmax(0,1fr)}.fg39SummaryGrid{grid-template-columns:1fr 1fr}.fg39SummaryGrid>.fg39Card:last-child{grid-column:1/-1}.fg39Action{grid-template-columns:34px minmax(0,1fr) auto}.fg39Action>strong{grid-column:2}.fg39Action>em{grid-column:3;grid-row:1/3}}
    @media(max-width:780px){.fg39Hero{grid-template-columns:1fr}.fg39Mascot{min-height:210px;max-height:260px}.fg39Mascot img{object-fit:cover;object-position:center 24%}.fg39HeroMain{padding:16px}.fg39HeroHead h1{font-size:28px}.fg39SummaryGrid{grid-template-columns:1fr}.fg39SummaryGrid>.fg39Card:last-child{grid-column:auto}.fg39Action{grid-template-columns:32px minmax(0,1fr)}.fg39Action>strong{grid-column:2;text-align:left}.fg39Action>em{grid-column:2;grid-row:auto;width:max-content}.fg39Status{padding:8px 11px}.fg39Snapshot{grid-template-columns:1fr 1fr}}
  `;document.head.appendChild(style);
})();
