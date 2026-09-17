const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number(n)||0));
const pos=p=>String(p||'').toUpperCase()==='DST'?'DEF':String(p||'').toUpperCase();
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');

function percentile(value,values=[]){
  if(!finite(value))return null;
  const a=values.filter(finite).map(Number).sort((x,y)=>x-y);
  if(!a.length)return null;
  if(a.length===1)return 100;
  let below=0,equal=0;
  for(const x of a){if(x<Number(value))below++;else if(x===Number(value))equal++}
  return clamp(((below+Math.max(0,equal-1)*0.5)/(a.length-1))*100);
}
function leagueShape(context){
  const slots=context?.league?.roster_positions||[],c={};for(const s of slots)c[String(s).toUpperCase()]=(c[String(s).toUpperCase()]||0)+1;
  const teams=Math.max(2,Number(context?.league_teams?.length||12));
  return{teams,counts:c};
}
function starterCutoff(position,shape){
  const c=shape.counts,t=shape.teams,q=pos(position),flex=Number(c.FLEX||0),sf=Number(c.SUPER_FLEX||0);
  let per=Number(c[q]||0);
  if(q==='QB')per+=sf*.65;
  if(q==='RB')per+=flex*.38+sf*.10;
  if(q==='WR')per+=flex*.42+sf*.08;
  if(q==='TE')per+=flex*.20+sf*.02;
  if(q==='K'||q==='DEF')per=Math.max(per,Number(c[q]||0));
  return Math.max(1,Math.round(t*Math.max(per,.15)));
}
function confidenceScore(p){
  const label=String(p?.ros_confidence||'').toUpperCase();
  let score={HIGH:100,GOOD:88,MEDIUM:70,LOW:48,UNAVAILABLE:35}[label]??60;
  const s=String(p?.injury_status||'').toUpperCase();
  if(/IR|PUP|NFI/.test(s))score=Math.min(score,20);
  else if(/OUT/.test(s))score=Math.min(score,30);
  else if(/DOUBT/.test(s))score=Math.min(score,45);
  else if(/QUESTION|LIMITED|DNP/.test(s))score=Math.min(score,68);
  return clamp(score);
}
function label(tv){
  if(!finite(tv))return'Unavailable';
  if(tv>=90)return'Elite';if(tv>=80)return'Strong asset';if(tv>=70)return'Quality starter';if(tv>=60)return'Useful starter';if(tv>=40)return'Depth';return'Replacement-level';
}
function averageTop(values=[],n=3){
  const a=values.filter(finite).map(Number).sort((x,y)=>y-x).slice(0,n);
  return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
}
function correlation(players=[],aKey,bKey){
  const pairs=[];
  for(const p of players){const c=p?.trade_value_components||{},a=c[aKey],b=c[bKey];if(finite(a)&&finite(b))pairs.push([Number(a),Number(b)])}
  if(pairs.length<3)return null;
  const ma=pairs.reduce((s,x)=>s+x[0],0)/pairs.length,mb=pairs.reduce((s,x)=>s+x[1],0)/pairs.length;
  let num=0,da=0,db=0;
  for(const [a,b] of pairs){const xa=a-ma,xb=b-mb;num+=xa*xb;da+=xa*xa;db+=xb*xb}
  if(!da||!db)return null;
  return num/Math.sqrt(da*db);
}

export function attachTradeValues(context,data){
  const rostered=(data?.team_details||[]).flatMap(t=>t.players||[]),waivers=(data?.waiver_pool||[]),all=[...rostered,...waivers];
  const unique=[],seen=new Set();
  for(const p of all){const k=String(p?.canonical_player_id||p?.sleeper_id||p?.espn_id||p?.id||`${p?.name}|${pos(p?.position)}`);if(!k||seen.has(k))continue;seen.add(k);unique.push(p)}
  const shape=leagueShape(context),byPos={},waiverByPos={};
  for(const p of unique){const q=pos(p.position);(byPos[q]||(byPos[q]=[])).push(p)}
  for(const p of waivers){const q=pos(p.position);if(finite(p.ros_points))(waiverByPos[q]||(waiverByPos[q]=[])).push(Number(p.ros_points))}
  const marketValues=unique.map(p=>p.market_value).filter(finite),cutoffs={},replacement={},replacementSource={},replacementSamples={};
  for(const [q,group] of Object.entries(byPos)){
    const vals=group.filter(p=>finite(p.ros_points)).sort((a,b)=>Number(b.ros_points)-Number(a.ros_points));
    const cut=starterCutoff(q,shape);cutoffs[q]=cut;
    const waiverVals=(waiverByPos[q]||[]).filter(finite).map(Number).sort((a,b)=>b-a),waiverRepl=averageTop(waiverVals,3);
    if(finite(waiverRepl)){
      replacement[q]=Number(waiverRepl);replacementSource[q]='TOP_3_AVAILABLE_AVG';replacementSamples[q]=Math.min(3,waiverVals.length);
    }else{
      const rosterableCut=Math.max(cut,Math.round(cut*1.5));
      replacement[q]=vals.length?Number(vals[Math.min(vals.length-1,Math.max(0,rosterableCut-1))].ros_points):null;
      replacementSource[q]='ROSTERABLE_CUTOFF_FALLBACK';replacementSamples[q]=0;
    }
  }
  let marketFallbacks=0,weekFallbacks=0,scored=0;
  for(const [q,group] of Object.entries(byPos)){
    const rosVals=group.map(p=>p.ros_points).filter(finite),weekVals=group.map(p=>p.weekly_points).filter(finite),topRos=rosVals.length?Math.max(...rosVals.map(Number)):null,repl=replacement[q],cut=cutoffs[q]||1;
    const ranked=[...group].filter(p=>finite(p.ros_points)).sort((a,b)=>Number(b.ros_points)-Number(a.ros_points));const rankMap=new Map(ranked.map((p,i)=>[p,i+1]));
    for(const p of group){
      if(!finite(p.ros_points)){Object.assign(p,{trade_value:null,tv:null,trade_value_label:'Unavailable',trade_value_version:'tv-v3-ros'});continue}
      const rosScore=percentile(p.ros_points,rosVals);
      const vorp=finite(repl)&&finite(topRos)&&Number(topRos)>Number(repl)?clamp((Number(p.ros_points)-Number(repl))/(Number(topRos)-Number(repl))*100):rosScore;
      const observedMarket=finite(p.market_value)?percentile(p.market_value,marketValues):null;
      const marketScore=finite(observedMarket)?Number(observedMarket):45;
      if(!finite(observedMarket))marketFallbacks++;
      const r=rankMap.get(p)||999,starterImpact=clamp(100*(1-(r-1)/(Math.max(1,cut)*1.5)));
      const observedWeek=finite(p.weekly_points)?percentile(p.weekly_points,weekVals):null;
      const weekOutlook=finite(observedWeek)?Number(observedWeek):50;
      if(!finite(observedWeek))weekFallbacks++;
      const risk=confidenceScore(p);
      const tvRaw=(Number(rosScore)*45+Number(vorp)*20+marketScore*15+Number(starterImpact)*10+weekOutlook*5+Number(risk)*5)/100;
      let tv=Math.round(clamp(tvRaw));
      if(q==='K')tv=Math.min(tv,45);if(q==='DEF')tv=Math.min(tv,50);
      scored++;
      Object.assign(p,{trade_value:tv,tv,trade_value_label:label(tv),trade_value_version:'tv-v3-ros',trade_value_horizon:'REST_OF_SEASON',trade_value_components:{ros_projection:Math.round(rosScore),value_over_replacement:Math.round(vorp),market:Math.round(marketScore),market_observed:finite(observedMarket)?Math.round(observedMarket):null,market_fallback_used:!finite(observedMarket),starter_impact:Math.round(starterImpact),week_outlook:Math.round(weekOutlook),weekly_trend:Math.round(weekOutlook),week_outlook_observed:finite(observedWeek)?Math.round(observedWeek):null,week_outlook_fallback_used:!finite(observedWeek),confidence_risk:Math.round(risk),replacement_ros_points:finite(repl)?Math.round(Number(repl)*10)/10:null,replacement_source:replacementSource[q],replacement_sample_size:replacementSamples[q],position_rank:r,starter_cutoff:cut}});
    }
  }
  const byKey=new Map(unique.map(p=>[`${norm(p.name)}|${pos(p.position)}`,p]));
  for(const list of Object.values(data?.opportunities||{}))for(const row of Array.isArray(list)?list:[]){const p=byKey.get(`${norm(row?.name)}|${pos(row?.position)}`);if(p){row.trade_value=p.trade_value??null;row.trade_value_label=p.trade_value_label||null}}
  const corrRosVorp=correlation(unique,'ros_projection','value_over_replacement'),corrRosStarter=correlation(unique,'ros_projection','starter_impact'),corrVorpStarter=correlation(unique,'value_over_replacement','starter_impact');
  const corrPairs=[['ROS ↔ VORP',corrRosVorp],['ROS ↔ Starter Impact',corrRosStarter],['VORP ↔ Starter Impact',corrVorpStarter]],corrVals=corrPairs.map(([,v])=>v).filter(finite).map(x=>Math.abs(Number(x))),avgCorr=corrVals.length?corrVals.reduce((s,v)=>s+v,0)/corrVals.length:null,maxCorr=corrVals.length?Math.max(...corrVals):null,strongest=corrPairs.filter(([,v])=>finite(v)).sort((a,b)=>Math.abs(Number(b[1]))-Math.abs(Number(a[1])))[0]||null;
  const auditStatus=scored<12?'INSUFFICIENT_SAMPLE':finite(maxCorr)&&maxCorr>=.80?'CAUTION':'PASS';
  data.trade_value_audit={version:'tv-v3-audit',platform:String(context?.platform||'UNKNOWN').toUpperCase(),players_evaluated:scored,projection_linked_weight_pct:75,correlations:{ros_vs_vorp:finite(corrRosVorp)?Math.round(corrRosVorp*100)/100:null,ros_vs_starter_impact:finite(corrRosStarter)?Math.round(corrRosStarter*100)/100:null,vorp_vs_starter_impact:finite(corrVorpStarter)?Math.round(corrVorpStarter*100)/100:null,average_absolute:finite(avgCorr)?Math.round(avgCorr*100)/100:null,max_absolute:finite(maxCorr)?Math.round(maxCorr*100)/100:null,strongest_pair:strongest?.[0]||null},warning_threshold:.80,status:auditStatus,missing_component_fallbacks:{market:marketFallbacks,week_outlook:weekFallbacks},rule:'Audit only. Any projection-linked component pair with absolute correlation of 0.80 or higher triggers CAUTION; it does not change player scores automatically.'};
  data.trade_value_policy={version:'tv-v3-ros',horizon:'REST_OF_SEASON',scale:'0-100',weights:{ros_projection:45,value_over_replacement:20,market_value:15,starter_impact:10,week_outlook:5,confidence_and_injury_risk:5},market_source:'FantasyCalc',replacement_rule:'VORP compares a player to the average ROS projection of the top three actually available players at the same position. Starter impact remains a separate league-specific component. If no waiver baseline exists, a deeper rosterable cutoff is used as fallback.',missing_component_rule:'Weights always remain 45/20/15/10/5/5. Missing FantasyCalc market evidence uses a conservative 45/100 fallback. Missing Week Outlook uses a neutral 50/100 fallback. Missing evidence never increases other component weights.',rule:'TV is a trade asset score, not a fantasy-point projection.',position_caps:{K:45,DEF:50}};
  return data;
}
