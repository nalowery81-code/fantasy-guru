// Evaluation Lab — development-only shadow analysis for Evaluation Engine v2.
// Reads the valuation data already loaded by Fantasy Guru; no extra API request is made.
(function(){
  if(!Array.isArray(NAV)||NAV.some(x=>x[0]==='evalLab'))return;
  NAV.push(['evalLab','🧪 Evaluation Lab']);

  const oldShowView=showView;
  showView=function(v){
    if(v!=='evalLab')return oldShowView(v);
    currentView=v;
    $('nav').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
    renderEvaluationLab();
  };

  const num=v=>finite(v)?Number(v):null;
  const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  const sd=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length)};
  const confidence=p=>{
    const vals=[p.espn_weekly_points,p.sleeper_weekly_points,p.ffanalytics_weekly_points].filter(finite).map(Number);
    if(!vals.length)return{score:0,label:'LOW',sources:0,spread:null};
    const m=mean(vals),cv=Math.abs(m)>.01?sd(vals)/Math.abs(m):1,source=vals.length===3?1:vals.length===2?.78:.48,agree=Math.max(0,Math.min(1,1-cv));
    const score=Math.round((source*.65+agree*.35)*100);
    return{score,label:score>=80?'HIGH':score>=60?'MEDIUM':'LOW',sources:vals.length,spread:vals.length>1?Math.max(...vals)-Math.min(...vals):0};
  };
  function allPlayers(){const out=[],seen=new Set();for(const t of analysis?.team_details||[])for(const p of t.players||[]){const k=ident(p);if(!seen.has(k)){seen.add(k);out.push(p)}}return out}
  function actualRows(players){return players.filter(p=>finite(p.actual_weekly_points)&&finite(p.weekly_points)).map(p=>{const actual=Number(p.actual_weekly_points),c=confidence(p),sources={ESPN:num(p.espn_weekly_points),Sleeper:num(p.sleeper_weekly_points),ffanalytics:num(p.ffanalytics_weekly_points)};return{p,actual,c,guru:Math.abs(Number(p.weekly_points)-actual),sources}})}
  function mae(rows,getter){const a=[];for(const r of rows){const v=getter(r);if(finite(v))a.push(Math.abs(Number(v)-r.actual))}return a.length?{n:a.length,v:mean(a)}:{n:0,v:null}}
  function fmt(x){return finite(x)?Number(x).toFixed(2):'—'}
  function sampleMessage(n){return n<25?`Not enough data yet. ${n} graded player${n===1?'':'s'}; target at least 25 before drawing conclusions.`:`${n} graded players. Results are useful, but Guru will keep learning as the sample grows.`}
  function renderEvaluationLab(){
    const players=allPlayers(),rows=actualRows(players),guru=mae(rows,r=>r.p.weekly_points),espn=mae(rows,r=>r.sources.ESPN),sleeper=mae(rows,r=>r.sources.Sleeper),ffa=mae(rows,r=>r.sources.ffanalytics);
    const conf=players.map(confidence).filter(x=>x.sources),avgConf=conf.length?mean(conf.map(x=>x.score)):null;
    const byPos=['QB','RB','WR','TE'].map(position=>{const x=rows.filter(r=>pos(r.p.position)===position),g=mae(x,r=>r.p.weekly_points);return{position,n:g.n,mae:g.v}});
    const best=[['Guru consensus',guru],['ESPN',espn],['Sleeper',sleeper],['ffanalytics',ffa]].filter(x=>finite(x[1].v)).sort((a,b)=>a[1].v-b[1].v)[0];
    const headline=rows.length<25?'Collecting baseline data':best?`${best[0]} currently has the lowest error`:'Waiting for completed-game actuals';
    $('content').innerHTML=`<h2>🧪 Evaluation Lab</h2><div class="sub">Shadow testing for Evaluation Engine v2. This page does not change Guru recommendations.</div>
      <div class="card" style="margin-top:16px"><h3>${esc(headline)}</h3><div class="muted">${esc(sampleMessage(rows.length))}</div><div class="muted" style="margin-top:6px">V2 projection confidence: ${fmt(avgConf)} / 100 across ${conf.length} players.</div></div>
      <div class="dashboardGrid" style="margin-top:14px">
        ${[['Guru consensus',guru],['ESPN',espn],['Sleeper',sleeper],['ffanalytics',ffa]].map(([name,x])=>`<div class="card"><div class="muted">${esc(name)} MAE</div><h3 style="font-size:28px;margin:5px 0">${fmt(x.v)}</h3><div class="muted">${x.n} graded predictions · lower is better</div></div>`).join('')}
      </div>
      <div class="card" style="margin-top:14px"><h3>Accuracy by position</h3>${byPos.map(x=>`<div class="row"><b>${x.position}</b><div class="muted">MAE ${fmt(x.mae)} · ${x.n} graded</div></div>`).join('')}</div>
      <div class="card" style="margin-top:14px"><h3>What V2 is testing</h3><div class="row"><b>Source agreement</b><div class="muted">Confidence falls when ESPN, Sleeper and ffanalytics disagree.</div></div><div class="row"><b>Decision-specific value</b><div class="muted">Start/sit, waiver and trade questions use different evidence weights.</div></div><div class="row"><b>Replacement value</b><div class="muted">Players are judged against what the league can realistically replace at that position.</div></div><div class="row"><b>HOLD discipline</b><div class="muted">Small edges should not become forced recommendations.</div></div></div>
      <div class="card" style="margin-top:14px"><h3>V1 vs V2 recommendation test</h3><div class="muted">Shadow comparison is ready for recommendation snapshots. Until enough pre-game decisions are captured, Guru will not claim V2 is better.</div></div>`;
  }
  window.renderEvaluationLab=renderEvaluationLab;
})();