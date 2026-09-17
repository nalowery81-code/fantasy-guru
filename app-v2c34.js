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
  function sampleMessage(n,target=25){return n<target?`Not enough data yet. ${n} graded player${n===1?'':'s'}; target at least ${target} before drawing conclusions.`:`${n} graded players. Results are useful, but Guru will keep learning as the sample grows.`}
  function ledgerStatus(ledger){
    if(!ledger)return'No ledger result returned yet.';
    if(ledger.status==='NOT_CONFIGURED')return'Durable storage is ready in code but Vercel still needs the Supabase server credentials.';
    if(ledger.status==='CAPTURED')return`This week's pre-game snapshot is locked with ${ledger.players_snapshotted||0} players.`;
    if(ledger.status==='LOCKED')return`This week's snapshot is locked with ${ledger.players_snapshotted||0} players and is waiting for completed-game actuals.`;
    if(ledger.status==='GRADED')return`This week's locked snapshot has ${ledger.players_graded||0} graded players.`;
    if(ledger.status==='MISSED_PREGAME')return'This week was intentionally skipped because scoring had already begun before a clean snapshot existed.';
    if(ledger.status==='WAITING_FOR_MATCHES')return'Actual scoring exists, but none of it matches the locked tracked-player snapshot yet.';
    if(ledger.status==='ERROR')return`Ledger error: ${ledger.error||'Unknown error'}`;
    return ledger.reason||ledger.note||`Ledger status: ${ledger.status||'unknown'}`;
  }
  function tvAuditHTML(){
    const a=analysis?.trade_value_audit||null,m=analysis?.market||null;
    if(!a)return`<div class="card" style="margin-top:14px"><h3>Trade Value Model Audit</h3><div class="muted">No TV audit data returned yet.</div></div>`;
    const c=a.correlations||{},f=a.missing_component_fallbacks||{},mm=m?.match_methods||{},status=String(a.status||'UNKNOWN'),statusText=status==='PASS'?'PASS — no projection-linked component pair crosses the caution threshold in this league.':status==='CAUTION'?`CAUTION — ${c.strongest_pair||'a projection-linked pair'} is too highly correlated. Review before changing weights.`:'INSUFFICIENT SAMPLE — keep collecting player observations before judging component overlap.';
    return`<div class="card" style="margin-top:14px"><h3>Trade Value Model Audit</h3><div><b>${esc(status)}</b> · ${esc(a.platform||C?.platform||'UNKNOWN')} · TV ${esc(analysis?.trade_value_policy?.version||'')}</div><div class="muted" style="margin-top:5px">${esc(statusText)}</div><div class="dashboardGrid" style="margin-top:10px"><div class="card"><div class="muted">Projection-linked weight</div><h3 style="font-size:24px;margin:5px 0">${Number(a.projection_linked_weight_pct||0)}%</h3><div class="muted">ROS + VORP + Starter Impact</div></div><div class="card"><div class="muted">Max pairwise correlation</div><h3 style="font-size:24px;margin:5px 0">${fmt(c.max_absolute)}</h3><div class="muted">${esc(c.strongest_pair||'—')} · threshold ${fmt(a.warning_threshold)}</div></div><div class="card"><div class="muted">Average absolute correlation</div><h3 style="font-size:24px;margin:5px 0">${fmt(c.average_absolute)}</h3><div class="muted">Across the three projection-linked pairs</div></div><div class="card"><div class="muted">Missing-evidence fallbacks</div><h3 style="font-size:24px;margin:5px 0">${Number(f.market||0)+Number(f.week_outlook||0)}</h3><div class="muted">Market ${Number(f.market||0)} · Week Outlook ${Number(f.week_outlook||0)}</div></div></div><div class="row"><b>ROS ↔ VORP</b><div class="muted">Correlation ${fmt(c.ros_vs_vorp)}</div></div><div class="row"><b>ROS ↔ Starter Impact</b><div class="muted">Correlation ${fmt(c.ros_vs_starter_impact)}</div></div><div class="row"><b>VORP ↔ Starter Impact</b><div class="muted">Correlation ${fmt(c.vorp_vs_starter_impact)}</div></div><div class="card" style="margin-top:10px"><h3>FantasyCalc Market Matching</h3><div class="muted">Payload ${esc(m?.payload_schema||'UNKNOWN')} · rows ${Number(m?.rows_received||0)} · coverage ${Number(m?.coverage_pct||0)}% (${Number(m?.matched_players||0)}/${Number(m?.total_players_enriched||0)})</div><div class="row"><b>Sleeper ID</b><div class="muted">${Number(mm.sleeper_id||0)} matches</div></div><div class="row"><b>ESPN ID</b><div class="muted">${Number(mm.espn_id||0)} matches</div></div><div class="row"><b>Name + position</b><div class="muted">${Number(mm.name_position||0)} matches</div></div><div class="row"><b>Name-only fallback</b><div class="muted">${Number(mm.name_only||0)} matches</div></div><div class="row"><b>Unmatched</b><div class="muted">${Number(mm.unmatched||0)} players</div></div></div><div class="muted" style="margin-top:7px">This audit is diagnostic only. It never changes a player's TV automatically.</div></div>`;
  }
  function renderEvaluationLab(){
    const players=allPlayers(),rows=actualRows(players),guru=mae(rows,r=>r.p.weekly_points),espn=mae(rows,r=>r.sources.ESPN),sleeper=mae(rows,r=>r.sources.Sleeper),ffa=mae(rows,r=>r.sources.ffanalytics);
    const conf=players.map(confidence).filter(x=>x.sources),avgConf=conf.length?mean(conf.map(x=>x.score)):null;
    const byPos=['QB','RB','WR','TE'].map(position=>{const x=rows.filter(r=>pos(r.p.position)===position),g=mae(x,r=>r.p.weekly_points);return{position,n:g.n,mae:g.v}});
    const best=[['Guru consensus',guru],['ESPN',espn],['Sleeper',sleeper],['ffanalytics',ffa]].filter(x=>finite(x[1].v)).sort((a,b)=>a[1].v-b[1].v)[0];
    const headline=rows.length<25?'Collecting baseline data':best?`${best[0]} currently has the lowest error`:'Waiting for completed-game actuals';
    const ledger=analysis?.evaluation_ledger||null,hist=ledger?.history&&!ledger.history.error?ledger.history:null;
    const histSource=hist?.source_accuracy||{},histCards=[['Guru consensus',{n:hist?.players_graded||0,mae:hist?.consensus_mae}],['ESPN',histSource.espn],['Sleeper',histSource.sleeper],['ffanalytics',histSource.ffanalytics]];
    const histBest=histCards.filter(x=>finite(x[1]?.mae)).sort((a,b)=>Number(a[1].mae)-Number(b[1].mae))[0];
    const tuningText=hist?.ready_for_weight_tuning?'Baseline threshold reached. Source-weight review is allowed, but weights should still change only after the evidence is inspected.':`Keep collecting locked predictions. ${hist?.players_graded||0}/100 graded player observations toward the source-weight review threshold.`;
    $('content').innerHTML=`<h2>🧪 Evaluation Lab</h2><div class="sub">Shadow testing for Evaluation Engine v2. This page does not change Guru recommendations.</div>
      <div class="card" style="margin-top:16px"><h3>${esc(headline)}</h3><div class="muted">${esc(sampleMessage(rows.length))}</div><div class="muted" style="margin-top:6px">V2 projection confidence: ${fmt(avgConf)} / 100 across ${conf.length} players.</div></div>
      ${tvAuditHTML()}
      <div class="card" style="margin-top:14px"><h3>Durable prediction ledger</h3><div><b>${esc(ledger?.status||'NOT RUN')}</b></div><div class="muted" style="margin-top:5px">${esc(ledgerStatus(ledger))}</div>${hist?`<div class="muted" style="margin-top:8px">Selected-league history: ${hist.graded_snapshots||0} graded week${hist.graded_snapshots===1?'':'s'} · ${hist.players_graded||0} player grades${histBest?` · lowest historical MAE: ${esc(histBest[0])} ${fmt(histBest[1].mae)}`:''}</div><div class="muted" style="margin-top:5px">${esc(tuningText)}</div>`:''}</div>
      ${hist?`<div class="dashboardGrid" style="margin-top:14px">${histCards.map(([name,x])=>`<div class="card"><div class="muted">${esc(name)} historical MAE</div><h3 style="font-size:28px;margin:5px 0">${fmt(x?.mae)}</h3><div class="muted">${x?.n||0} locked predictions · selected league</div></div>`).join('')}</div>`:''}
      <div class="dashboardGrid" style="margin-top:14px">
        ${[['Guru consensus',guru],['ESPN',espn],['Sleeper',sleeper],['ffanalytics',ffa]].map(([name,x])=>`<div class="card"><div class="muted">${esc(name)} current-week MAE</div><h3 style="font-size:28px;margin:5px 0">${fmt(x.v)}</h3><div class="muted">${x.n} loaded actuals · lower is better</div></div>`).join('')}
      </div>
      <div class="card" style="margin-top:14px"><h3>Current-week accuracy by position</h3>${byPos.map(x=>`<div class="row"><b>${x.position}</b><div class="muted">MAE ${fmt(x.mae)} · ${x.n} graded</div></div>`).join('')}</div>
      <div class="card" style="margin-top:14px"><h3>What V2 is testing</h3><div class="row"><b>Source agreement</b><div class="muted">Confidence falls when ESPN, Sleeper and ffanalytics disagree.</div></div><div class="row"><b>Decision-specific value</b><div class="muted">Start/sit, waiver and trade questions use different evidence weights.</div></div><div class="row"><b>Replacement value</b><div class="muted">Players are judged against what the league can realistically replace at that position.</div></div><div class="row"><b>HOLD discipline</b><div class="muted">Small edges should not become forced recommendations.</div></div></div>
      <div class="card" style="margin-top:14px"><h3>V1 vs V2 recommendation test</h3><div class="muted">Shadow comparison is ready for recommendation snapshots. Until enough pre-game decisions are captured, Guru will not claim V2 is better.</div></div>`;
  }
  window.renderEvaluationLab=renderEvaluationLab;
})();
