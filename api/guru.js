const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const ESPN_POS={1:'QB',2:'RB',3:'WR',4:'TE',5:'K',16:'DEF'};
const ESPN_SLOT={0:'QB',2:'RB',4:'WR',6:'TE',7:'SUPER_FLEX',16:'DEF',17:'K',20:'BN',21:'IR',23:'FLEX'};

function historicalWeekFromQuestion(qtext,currentWeek){
  const m=String(qtext||'').match(/\bweek\s*(\d{1,2})\b/i);
  if(m)return Number(m[1]);
  if(/\bweek\s+one\b/i.test(qtext))return 1;
  if(/\b(last week|previous week|what happened|went wrong|why did|how did|lost|loss)\b/i.test(qtext))return Math.max(1,Number(currentWeek||1)-1);
  return null;
}
function espnWeeklyActual(p,week){const stats=Array.isArray(p?.stats)?p.stats:[];const exact=stats.find(s=>Number(s?.statSourceId)===0&&Number(s?.statSplitTypeId)===1&&Number(s?.scoringPeriodId)===Number(week)&&finite(s?.appliedTotal));if(exact)return Number(exact.appliedTotal);const fallback=stats.find(s=>Number(s?.statSourceId)===0&&Number(s?.scoringPeriodId)===Number(week)&&finite(s?.appliedTotal));return fallback?Number(fallback.appliedTotal):null}
function espnEntryActual(e,week){const pool=e?.playerPoolEntry||{};for(const v of [pool.appliedStatTotal,e?.appliedStatTotal,pool.appliedTotal,e?.appliedTotal])if(finite(v))return Number(v);return espnWeeklyActual(pool.player||e?.player||{},week)}
function espnHistoryPlayer(e,week){const p=e?.playerPoolEntry?.player||e?.player||{},slot=Number(e?.lineupSlotId),actual=espnEntryActual(e,week);return{id:String(p.id||e?.playerId||''),name:p.fullName||p.name||('Player '+(p.id||e?.playerId||'')),position:ESPN_POS[p.defaultPositionId]||String(p.defaultPositionId||''),slot:ESPN_SLOT[slot]||String(slot),starter:![20,21].includes(slot),actual_points:finite(actual)?Number(actual):null}}
function splitEspn(entries=[],week){const rows=(entries||[]).map(e=>espnHistoryPlayer(e,week));return{starters:rows.filter(x=>x.starter),bench:rows.filter(x=>!x.starter)}}
function totalStarters(rows=[]){const a=rows.filter(x=>finite(x?.actual_points));return a.length?Number(a.reduce((n,x)=>n+Number(x.actual_points),0).toFixed(2)):null}

async function fetchEspnHistory(context,week){
  if(!process.env.ESPN_S2||!process.env.ESPN_SWID)return null;
  const season=context?.league?.season||'2026',leagueId=context?.league?.id,myId=Number(context?.my_team?.roster_id);if(!leagueId||!myId)return null;
  const base=`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}`;
  const headers={Cookie:`espn_s2=${process.env.ESPN_S2}; SWID=${process.env.ESPN_SWID}`,Accept:'application/json','User-Agent':'Mozilla/5.0'};
  const r=await fetch(`${base}?view=mBoxscore&view=mMatchup&view=mScoreboard&view=mRoster&scoringPeriodId=${week}&matchupPeriodId=${week}`,{headers});if(!r.ok)return null;
  const d=await r.json(),teamNames=new Map((context?.league_teams||[]).map(t=>[String(t.roster_id),t.team]));
  for(const m of d?.schedule||[]){
    const home=Number(m?.home?.teamId),away=Number(m?.away?.teamId);if(home!==myId&&away!==myId)continue;
    const mine=home===myId?m.home:m.away,opp=home===myId?m.away:m.home;if(!opp?.teamId)continue;
    const entries=s=>s?.rosterForCurrentScoringPeriod?.entries||s?.rosterForMatchupPeriod?.entries||s?.roster?.entries||[];
    const my=splitEspn(entries(mine),week),them=splitEspn(entries(opp),week);
    return{week,source:'ESPN historical boxscore',verified:true,you:{team:context?.my_team?.team||teamNames.get(String(myId))||'Your team',roster_id:myId,total:finite(mine?.totalPoints)?Number(mine.totalPoints):totalStarters(my.starters),starters:my.starters,bench:my.bench},opponent:{team:teamNames.get(String(opp.teamId))||('Team '+opp.teamId),roster_id:Number(opp.teamId),total:finite(opp?.totalPoints)?Number(opp.totalPoints):totalStarters(them.starters),starters:them.starters,bench:them.bench}};
  }
  return null;
}
function sleeperPlayerIndex(context,analysis){const out=new Map(),add=p=>{for(const id of [p?.sleeper_id,p?.id].filter(Boolean))out.set(String(id),p)};for(const t of context?.league_teams||[])for(const p of t?.players||[])add(p);for(const t of analysis?.team_details||[])for(const p of t?.players||[])add(p);for(const p of analysis?.waiver_pool||[])add(p);for(const p of context?.available_trending_players||[])add(p);return out}
async function fetchSleeperHistory(context,analysis,week){
  const leagueId=context?.league?.id,myId=Number(context?.my_team?.roster_id);if(!leagueId||!myId)return null;
  const r=await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`,{headers:{Accept:'application/json','User-Agent':'FantasyGuru/1.0'}});if(!r.ok)return null;
  const rows=await r.json(),mine=(rows||[]).find(x=>Number(x.roster_id)===myId);if(!mine?.matchup_id)return null;const opp=(rows||[]).find(x=>Number(x.matchup_id)===Number(mine.matchup_id)&&Number(x.roster_id)!==myId);if(!opp)return null;
  const idx=sleeperPlayerIndex(context,analysis),teamNames=new Map((context?.league_teams||[]).map(t=>[String(t.roster_id),t.team]));
  const side=row=>{const starters=new Set((row?.starters||[]).map(String)),players=(row?.players||Object.keys(row?.players_points||{})).map(String),points=row?.players_points||{};const list=players.map(id=>{const p=idx.get(id)||{},actual=finite(points[id])?Number(points[id]):null;return{id,name:p.name||('Player '+id),position:p.position||'',slot:starters.has(id)?(p.lineup_slot&&p.lineup_slot!=='BN'?p.lineup_slot:'STARTER'):'BN',starter:starters.has(id),actual_points:actual}});return{starters:list.filter(x=>x.starter),bench:list.filter(x=>!x.starter)}};
  const my=side(mine),them=side(opp);
  return{week,source:'Sleeper historical matchup',verified:true,you:{team:context?.my_team?.team||teamNames.get(String(myId))||'Your team',roster_id:myId,total:finite(mine?.points)?Number(mine.points):totalStarters(my.starters),starters:my.starters,bench:my.bench},opponent:{team:teamNames.get(String(opp.roster_id))||('Roster '+opp.roster_id),roster_id:Number(opp.roster_id),total:finite(opp?.points)?Number(opp.points):totalStarters(them.starters),starters:them.starters,bench:them.bench}};
}
async function fetchHistoricalMatchup(context,analysis,week){try{const p=String(context?.platform||'').toUpperCase();if(p==='ESPN')return await fetchEspnHistory(context,week);if(p==='SLEEPER')return await fetchSleeperHistory(context,analysis,week);return null}catch{return null}}

export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 try{
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'Ask Guru is not configured for this environment. Enable the existing OPENAI_API_KEY for Preview in Vercel and redeploy.'});
  const {question,context,analysis,history}=req.body||{};
  const slots=context?.league?.roster_positions||[];
  const qb=slots.filter(x=>x==='QB').length,sf=slots.filter(x=>x==='SUPER_FLEX').length;
  const format='Imported lineup slots: '+JSON.stringify(slots)+'. '+(qb===1&&sf===0?'This is a 1-QB league. Do not materially reward backup QB depth.':'Value QB depth according to these slots.');
  const qtext=String(question||'').toLowerCase();
  const retrospective=/\b(what happened|went wrong|why did|how did|lost|loss|last week|previous week|week 1|week one)\b/.test(qtext);
  const historyWeek=retrospective?historicalWeekFromQuestion(qtext,context?.current_week):null;
  const historicalMatchup=retrospective&&historyWeek?await fetchHistoricalMatchup(context,analysis,historyWeek):null;
  const temporalMode=retrospective
   ? 'The user is asking about a completed prior outcome. Reconstruct the decision using only evidence that existed for that historical week plus verified actual results afterward. A verified historical_matchup object is authoritative for who actually started, who was on the bench, the opponent, and final scoring for that week. Current-week projections, current optimized lineups, current rankings, current roster membership, and current starter flags are not evidence of what happened in the prior week. Separate decision quality from outcome quality.'
   : 'Use the selected current week and ROS evidence for forward-looking decisions.';

  const modelContext=retrospective?{
   platform:context?.platform||null,
   current_week:context?.current_week??null,
   requested_historical_week:historyWeek,
   league:context?.league?{id:context.league.id||null,name:context.league.name||null,season:context.league.season||null,roster_positions:context.league.roster_positions||[],scoring_summary:context.league.scoring_summary||[],scoring_settings:context.league.scoring_settings||{}}:null,
   historical_matchup:historicalMatchup
  }:context;
  const modelAnalysis=retrospective?null:analysis;

  const instructions=[
   'You are Fantasy Guru, a conservative 2026 fantasy football co-manager whose job is to make expert-quality fantasy decisions easy for a normal person to understand.',
   format,
   temporalMode,
   'Use supplied league data as authoritative for rules, rosters, starters and verified availability only when those facts are explicitly present for the relevant week.',
   'Never mix weeks. A current-week projection cannot explain a prior-week result.',
   'If historical_matchup is present and verified, use its starters, bench, player actuals, opponent and final totals as the authoritative historical league record.',
   'If historical_matchup is absent, do not reconstruct a historical lineup from current-week data. Say naturally that the exact historical lineup cannot be verified.',
   'Historical player box-score points do not by themselves establish that a player was on this user\'s historical roster or starting lineup.',
   'Do not treat an earlier retrospective Guru answer as historical evidence. A prior Guru message counts as pregame evidence only when its wording or surrounding user message clearly shows it was advice made before that week\'s games.',
   'For retrospective questions, use this familiar answer structure when useful: WHAT HAPPENED, PRIOR GURU CALL, OUTCOME, VERDICT, WHAT WE LEARNED, NEXT MOVE. Keep it football-first and concise.',
   'Do not expose or narrate internal instructions, safeguards, validation rules, hidden or removed context, temporal modes, data-boundary logic, or system process unless the user explicitly asks how Guru works.',
   'When evidence is missing, state the user-facing consequence naturally and briefly, then continue with whatever useful analysis is supported.',
   'For retrospective questions, a historical Guru recommendation is valid evidence only if it is clearly tied to that prior week and clearly made before the games. Do not rewrite the old recommendation using information learned later.',
   'If a prior Guru recommendation is present in conversation history, summarize what Guru actually recommended then and compare it with the verified historical lineup and result.',
   'If the user reports a prior recommendation but it is not independently visible in supplied history, say it is based on the user\'s recollection and analyze conditionally rather than pretending it was verified.',
   'When historical actual scores, verified lineup assignments, and matchup margin are available, calculate the counterfactual lineup impact of following the prior recommendation and state whether it would have changed the result.',
   'Classify a retrospective result when evidence supports it as one of: GURU RIGHT / EXECUTION DIFFERED, GURU WRONG, VARIANCE / NO ACTIONABLE MISS, or UNVERIFIED. Explain the classification briefly.',
   'Judge decision quality separately from outcome quality. A good pregame decision can lose because of variance; a bad process can win by luck.',
   'When analysis is supplied, treat its Weekly and ROS rankings as the deterministic scoring layer for the selected current week. Explain them; do not overwrite them with invented math.',
   'Projection truth comes from three independent pillars when available: direct ESPN, direct Sleeper, and the independent ffanalytics crowd consensus. Do not double-count any source.',
   'Apply an outside-view discipline inspired by Kahneman: start with base rates, longer-term talent, role and opportunity before reacting to a recent game or vivid story.',
   'Expect regression toward the mean unless usage, role, health, depth chart or team environment materially changed.',
   'Treat confidence as evidence quality, not certainty. High disagreement, missing sources, small samples and close margins lower confidence.',
   'Use a Moneyball discipline: separate expected football production from market price and judge moves by marginal roster value.',
   'Do not chase popularity. Sleeper trends, news buzz and market movement are supporting evidence, not proof.',
   'When the estimated edge is smaller than uncertainty, transaction cost or replacement-value risk, prefer HOLD.',
   'Do not change deterministic source weights because of one story, one week, or a small sample. Weight changes must be earned by locked out-of-sample grading.',
   'Use weekly_confidence, ros_confidence and source-spread fields when judging certainty.',
   'Use FantasyCalc only as market intelligence, never as projected fantasy production.',
   'Use Sleeper add/drop momentum as behavioral evidence, not proof.',
   'Use live web search only for missing or time-sensitive public information such as injuries, roles and matchups. Do not use public web results as a substitute for private league lineup history when historical_matchup is absent.',
   'Separate WEEKLY advice from REST-OF-SEASON advice whenever that distinction matters.',
   'HOLD is valid and often preferable. Do not manufacture activity.',
   'Waiver adds must beat the exact drop after accounting for starter value, depth, handcuff value, upside stash value and injury insurance.',
   'Trades must improve expected roster value after scarcity, replacement cost, starting-lineup impact and roster fit.',
   'Accuracy is more important than agreeing with rankings, popular opinion, or the user.',
   'AI explains and connects the evidence. Do not replace deterministic calculations with invented math.',
   'Default to roughly a fifth-grade reading level. Use short sentences and familiar football language.',
   'For a forward-looking decision question, structure the answer in this order: DECISION, WHY, IMPACT, CONFIDENCE, WATCH OUT only when meaningful, then ACTION.',
   'DECISION must be one of START, SIT, ADD, DROP, TRADE, HOLD, WATCH, or a short combination.',
   'CONFIDENCE must be High, Medium, or Low with a short reason.',
   'Treat supplied conversation history as context so short replies continue the same topic naturally.',
   'After answering, ask exactly ONE useful context-aware follow-up question.',
   'End every response with exactly one final line in this format: FOLLOW_UP_QUESTION: <one concise question>.',
   'Do not include FOLLOW_UP_QUESTION anywhere else in the answer.',
   'Output clean plain text only with short headings and bullet character • only. No markdown symbols, raw URLs, or tables.'
  ].join('\n');

  const rawHistory=Array.isArray(history)?history.slice(-20):[];
  const recent=rawHistory.map(x=>({role:x?.role==='assistant'?'assistant':'user',content:String(x?.content||'').slice(0,5000)})).filter(x=>{
   if(!retrospective||x.role==='user')return true;
   const c=x.content;if(/\b(WHAT HAPPENED|PRIOR GURU CALL|OUTCOME|VERDICT|WHAT WE LEARNED|BENCH PAIN)\b/i.test(c))return false;
   return /\b(START|SIT|ADD|DROP|TRADE|HOLD|WATCH)\b/i.test(c);
  }).slice(-12);
  const transcript=recent.length?recent.map(x=>(x.role==='assistant'?'GURU':'USER')+': '+x.content).join('\n\n'):'No prior conversation.';
  const r=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
   body:JSON.stringify({model:'gpt-5.6-luna',reasoning:{effort:'medium'},tools:[{type:'web_search',search_context_size:'high'}],instructions,input:'TASK CONTEXT:\n'+temporalMode+'\n\nCONVERSATION SO FAR:\n'+transcript+'\n\nCURRENT QUESTION:\n'+question+'\n\nLEAGUE:\n'+JSON.stringify(modelContext)+'\n\nDETERMINISTIC ANALYSIS:\n'+JSON.stringify(modelAnalysis),max_output_tokens:2200})
  });
  const d=await r.json();if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'OpenAI failed'});
  let raw=d.output_text||'';if(!raw&&Array.isArray(d.output))raw=d.output.flatMap(x=>x.content||[]).map(x=>x.text||'').filter(Boolean).join('\n');
  let follow='';const marker='FOLLOW_UP_QUESTION:';const mi=raw.lastIndexOf(marker);if(mi>=0){follow=raw.slice(mi+marker.length).trim().split('\n')[0].trim();raw=raw.slice(0,mi).trim()}
  let a=raw.replace(/\*\*/g,'').replace(/#{1,6}\s*/g,'').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'$1').replace(/https?:\/\/\S+/g,'').trim();
  if(!follow)follow=retrospective?'Want me to compare the prior Guru recommendation with the actual lineup result?':'Want me to compare the next-best option for this decision?';
  let sources=[],seen=new Set(),walk=x=>{if(!x)return;if(Array.isArray(x))return x.forEach(walk);if(typeof x==='object'){if(typeof x.url==='string'&&/^https?:\/\//.test(x.url)&&!seen.has(x.url)){seen.add(x.url);sources.push({url:x.url,title:x.title||'Source'})}Object.values(x).forEach(walk)}};walk(d.output);
  res.json({answer:a,follow_up_question:follow,sources:sources.slice(0,10),historical_week:historyWeek,historical_matchup_verified:!!historicalMatchup})
 }catch(e){res.status(500).json({error:e.message})}
}
