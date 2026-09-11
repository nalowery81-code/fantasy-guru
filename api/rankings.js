import { buildValuation } from './valuation-engine.js';

const FC_TTL_MS=5*60*1000;
const fcCache=new Map();
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const pos=p=>String(p||'').toUpperCase()==='DST'?'DEF':String(p||'').toUpperCase();

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

function marketIndexes(rows=[]){
  const bySleeper=new Map(),byEspn=new Map(),byNamePos=new Map();
  for(const item of rows){
    const p=item?.player||{},rec={market_value:Number.isFinite(Number(item?.value))?Number(item.value):null,market_overall_rank:item?.overallRank??null,market_position_rank:item?.positionRank??null,market_trend_30d:item?.trend30Day??null};
    if(p?.sleeperId!=null)bySleeper.set(String(p.sleeperId),rec);
    if(p?.espnId!=null)byEspn.set(String(p.espnId),rec);
    if(p?.name)byNamePos.set(`${norm(p.name)}|${pos(p.position)}`,rec);
  }
  return{bySleeper,byEspn,byNamePos};
}

function attachMarket(data,fc){
  const idx=marketIndexes(fc.rows),lookup=p=>(p?.sleeper_id&&idx.bySleeper.get(String(p.sleeper_id)))||(p?.espn_id&&idx.byEspn.get(String(p.espn_id)))||idx.byNamePos.get(`${norm(p?.name)}|${pos(p?.position)}`)||null;
  let matched=0,total=0;
  for(const t of data?.team_details||[])for(const p of t.players||[]){total++;const m=lookup(p);if(m){Object.assign(p,m,{market_source:'FantasyCalc'});matched++}else Object.assign(p,{market_value:null,market_source:null})}
  for(const p of data?.waiver_pool||[]){const m=lookup(p);if(m)Object.assign(p,m,{market_source:'FantasyCalc'});else Object.assign(p,{market_value:null,market_source:null})}
  data.market={source:'FantasyCalc',role:'market realism only; not a projection source',available:fc.rows.length>0,cache:fc.cache,ttl_seconds:300,error:fc.error,config:fc.config,matched_players:matched,total_rostered_players:total,coverage_pct:total?Math.round(matched/total*100):0};
  return data;
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{
    const {context}=req.body||{};
    const [data,fc]=await Promise.all([buildValuation(context,{includeWaivers:true}),getFantasyCalc(context)]);
    return res.json(attachMarket(data,fc));
  }catch(e){
    return res.status(500).json({error:e.message});
  }
}
