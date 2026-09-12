import { buildValuation } from './valuation-engine.js';

const FC_TTL_MS=5*60*1000;
const fcCache=new Map();
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const pos=p=>String(p||'').toUpperCase()==='DST'?'DEF':String(p||'').toUpperCase();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

function leagueMarketConfig(context){
  const slots=context?.league?.roster_positions||[];
  const numQbs=slots.includes('SUPER_FLEX')||slots.filter(x=>x==='QB').length>=2?2:1;
  const numTeams=Math.max(2,Math.min(32,Number(context?.league_teams?.length||12)));
  const settings=context?.league?.scoring_settings||{};
  let ppr=Number.isFinite(Number(settings.rec))?Number(settings.rec):null;
  if(ppr===null&&Array.isArray(settings.scoringItems)){
    const rec=settings.scoringItems.find(x=>Number(x?.statId)===53);
    if(rec&&Number.isFinite(Number(rec.points)))ppr=Number(rec.points);
  }
  if(ppr===null){
    const s=(context?.league?.scoring_summary||[]).join(' ').toUpperCase();
    ppr=s.includes('HALF')?0.5:s.includes('PPR')?1:0;
  }
  ppr=ppr>=0.75?1:ppr>0?0.5:0;
  return{isDynasty:false,numQbs,numTeams,ppr};
}

async function getFantasyCalc(context){
  const cfg=leagueMarketConfig(context),key=`${cfg.numTeams}-${cfg.numQbs}-${cfg.ppr}`;
  const cached=fcCache.get(key);
  if(cached&&Date.now()-cached.ts<FC_TTL_MS)return{...cached,cache:'hit'};
  const q=new URLSearchParams({isDynasty:'false',numQbs:String(cfg.numQbs),numTeams:String(cfg.numTeams),ppr:String(cfg.ppr)});
  try{
    const r=await fetch(`https://api.fantasycalc.com/values/current?${q}`,{headers:{Accept:'application/json','User-Agent':'FantasyGuru/1.0'}});
    if(!r.ok)throw new Error(`FantasyCalc ${r.status}`);
    const rows=await r.json();
    const value={ts:Date.now(),rows:Array.isArray(rows)?rows:[],config:cfg,cache:'miss',error:null};
    fcCache.set(key,value);
    return value;
  }catch(e){
    if(cached)return{...cached,cache:'stale',error:e.message};
    return{ts:Date.now(),rows:[],config:cfg,cache:'unavailable',error:e.message};
  }
}

async function getSleeperTrends(){
  const fetchOne=async type=>{try{const r=await fetch(`https://api.sleeper.app/v1/players/nfl/trending/${type}?lookback_hours=24&limit=100`,{headers:{Accept:'application/json','User-Agent':'FantasyGuru/1.0'}});if(!r.ok)return[];const d=await r.json();return Array.isArray(d)?d:[]}catch{return[]}};
  const [adds,drops]=await Promise.all([fetchOne('add'),fetchOne('drop')]);
  const byId=new Map();
  for(const x of adds){const id=String(x.player_id||'');if(id)byId.set(id,{adds_24h:Number(x.count||0),drops_24h:0})}
  for(const x of drops){const id=String(x.player_id||'');if(!id)continue;const v=byId.get(id)||{adds_24h:0,drops_24h:0};v.drops_24h=Number(x.count||0);byId.set(id,v)}
  for(const v of byId.values())v.net_24h=v.adds_24h-v.drops_24h;
  return byId;
}

function marketIndexes(rows=[]){
  const bySleeper=new Map(),byEspn=new Map(),byNamePos=new Map();
  for(const item of rows){
    const p=item?.player||{},rec={market_value:finite(item?.value)?Number(item.value):null,market_overall_rank:item?.overallRank??null,market_position_rank:item?.positionRank??null,market_trend_30d:finite(item?.trend30Day)?Number(item.trend30Day):null};
    if(p?.sleeperId!=null)bySleeper.set(String(p.sleeperId),rec);
    if(p?.espnId!=null)byEspn.set(String(p.espnId),rec);
    if(p?.name)byNamePos.set(`${norm(p.name)}|${pos(p.position)}`,rec);
  }
  return{bySleeper,byEspn,byNamePos};
}

function sourceConfidence(values=[]){
  const a=values.filter(finite).map(Number);
  if(!a.length)return{label:'UNAVAILABLE',source_count:0,spread_pct:null};
  if(a.length===1)return{label:'LOW',source_count:1,spread_pct:null};
  const mean=a.reduce((x,y)=>x+y,0)/a.length,spread=mean?((Math.max(...a)-Math.min(...a))/Math.abs(mean))*100:0;
  let label='LOW';
  if(a.length>=3)label=spread<=8?'HIGH':spread<=18?'GOOD':spread<=30?'MEDIUM':'LOW';
  else label=spread<=12?'GOOD':spread<=25?'MEDIUM':'LOW';
  return{label,source_count:a.length,spread_pct:Math.round(spread*10)/10};
}

function attachIntel(data,fc,trends){
  const idx=marketIndexes(fc.rows),lookup=p=>(p?.sleeper_id&&idx.bySleeper.get(String(p.sleeper_id)))||(p?.espn_id&&idx.byEspn.get(String(p.espn_id)))||idx.byNamePos.get(`${norm(p?.name)}|${pos(p?.position)}`)||null;
  let matched=0,total=0;const all=[];
  const enrich=p=>{
    total++;
    const m=lookup(p);if(m){Object.assign(p,m,{market_source:'FantasyCalc'});matched++}else Object.assign(p,{market_value:null,market_source:null,market_overall_rank:null,market_position_rank:null,market_trend_30d:null});
    const w=sourceConfidence([p.espn_weekly_points,p.sleeper_weekly_points,p.ffanalytics_weekly_points]);
    const r=sourceConfidence([p.espn_ros_points,p.sleeper_ros_points,p.ffanalytics_ros_points]);
    Object.assign(p,{weekly_confidence:w.label,weekly_spread_pct:w.spread_pct,ros_confidence:r.label,ros_spread_pct:r.spread_pct});
    const t=p?.sleeper_id?trends.get(String(p.sleeper_id)):null;
    Object.assign(p,{sleeper_adds_24h:t?.adds_24h||0,sleeper_drops_24h:t?.drops_24h||0,sleeper_net_24h:t?.net_24h||0});
    all.push(p);
  };
  for(const t of data?.team_details||[])for(const p of t.players||[])enrich(p);
  for(const p of data?.waiver_pool||[])enrich(p);
  const byPos={};for(const p of all){const q=pos(p.position);(byPos[q]||(byPos[q]=[])).push(p)}
  for(const group of Object.values(byPos))group.filter(p=>finite(p.ros_points)).sort((a,b)=>Number(b.ros_points)-Number(a.ros_points)).forEach((p,i)=>p.projection_position_rank=i+1);
  const buys=[],sells=[],emerging=[];
  for(const p of all){
    const pr=Number(p.projection_position_rank||0),mr=Number(p.market_position_rank||0),trend=Number(p.market_trend_30d||0),gap=pr&&mr?mr-pr:0;
    if(gap>=5&&trend<=0){p.opportunity_signal='BUY_LOW';p.opportunity_reason=`Projection rank #${pr} is ${gap} spots stronger than market rank #${mr}.`;buys.push(p)}
    else if(gap<=-5&&trend>0){p.opportunity_signal='SELL_HIGH';p.opportunity_reason=`Market rank #${mr} is ${Math.abs(gap)} spots stronger than projection rank #${pr}.`;sells.push(p)}
    if(Number(p.sleeper_net_24h||0)>=250){if(!p.opportunity_signal)p.opportunity_signal='TRENDING';p.sleeper_momentum='HOT';emerging.push(p)}
  }
  const simple=p=>({name:p.name,position:p.position,team:p.team||null,projection_position_rank:p.projection_position_rank||null,market_position_rank:p.market_position_rank||null,market_trend_30d:p.market_trend_30d??null,sleeper_net_24h:p.sleeper_net_24h||0,signal:p.opportunity_signal||null,reason:p.opportunity_reason||null,weekly_confidence:p.weekly_confidence,ros_confidence:p.ros_confidence});
  data.market={source:'FantasyCalc',role:'market realism only; not a projection source',available:fc.rows.length>0,cache:fc.cache,ttl_seconds:300,error:fc.error,config:fc.config,matched_players:matched,total_players_enriched:total,coverage_pct:total?Math.round(matched/total*100):0};
  data.opportunities={buy_low:buys.sort((a,b)=>(Number(b.market_position_rank||0)-Number(b.projection_position_rank||0))-(Number(a.market_position_rank||0)-Number(a.projection_position_rank||0))).slice(0,10).map(simple),sell_high:sells.sort((a,b)=>Number(b.market_trend_30d||0)-Number(a.market_trend_30d||0)).slice(0,10).map(simple),sleeper_trending:emerging.sort((a,b)=>Number(b.sleeper_net_24h||0)-Number(a.sleeper_net_24h||0)).slice(0,10).map(simple)};
  data.evidence_policy={projection_sources:['ESPN','Sleeper','Independent ffanalytics crowd'],projection_rule:'Equal average of available independent sources',confidence_rule:'Source count plus cross-source spread; smaller disagreement means higher confidence',market_source:'FantasyCalc',behavioral_source:'Sleeper 24h add/drop trends'};
  return data;
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{
    const {context}=req.body||{};
    const [data,fc,trends]=await Promise.all([buildValuation(context,{includeWaivers:true}),getFantasyCalc(context),getSleeperTrends()]);
    return res.json(attachIntel(data,fc,trends));
  }catch(e){
    return res.status(500).json({error:e.message});
  }
}
