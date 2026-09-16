import { readFileSync } from 'node:fs';
const ffaWeeklyData=JSON.parse(readFileSync(new URL('../data/ffanalytics_weekly.json',import.meta.url),'utf8'));
import { rebuildNormalizedAnalysis } from './normalized-analysis.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const pos=p=>String(p||'').toUpperCase()==='DST'?'DEF':String(p||'').toUpperCase();

let gameCache={key:'',ts:0,map:new Map()};
const GAME_TTL=10*60*1000;

function ffaIndex(){
  const byId=new Map(),byName=new Map();
  for(const r of ffaWeeklyData?.players||[]){
    const rec={...r,position:pos(r.position)};
    for(const id of [r.gsis_id,r.sleeper_id,r.espn_id].filter(Boolean))byId.set(String(id),rec);
    if(r.name)byName.set(`${norm(r.name)}|${rec.position}`,rec);
  }
  return{byId,byName};
}
const FFA=ffaIndex();
function ffaFor(p){
  for(const id of [p?.gsis_id,p?.sleeper_id,p?.espn_id,p?.id].filter(Boolean)){const x=FFA.byId.get(String(id));if(x&&pos(x.position)===pos(p?.position))return x}
  return FFA.byName.get(`${norm(p?.name)}|${pos(p?.position)}`)||null;
}

function parseWind(weather){
  const text=[weather?.displayValue,weather?.wind,weather?.conditionId,weather?.condition].filter(Boolean).join(' ');
  const m=text.match(/(\d+(?:\.\d+)?)\s*mph/i);
  return m?Number(m[1]):finite(weather?.windSpeed)?Number(weather.windSpeed):null;
}
function weatherText(weather){return [weather?.displayValue,weather?.condition,weather?.summary].filter(Boolean).join(' ')||null}
function parseFavorite(details=''){
  const m=String(details).toUpperCase().match(/\b([A-Z]{2,3})\s*([+-]?\d+(?:\.\d+)?)/);
  return m?{team:m[1],spread:Number(m[2])}:null;
}
function teamAbbr(c){return String(c?.team?.abbreviation||'').toUpperCase()}
async function nflGames(context){
  const season=String(context?.league?.season||new Date().getFullYear()),week=Number(context?.current_week||1),key=`${season}:${week}`;
  if(gameCache.key===key&&Date.now()-gameCache.ts<GAME_TTL)return gameCache.map;
  const map=new Map();
  try{
    const u=`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${encodeURIComponent(season)}&seasontype=2&week=${encodeURIComponent(week)}&limit=100`;
    const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':'FantasyGuru/1.0'}});if(!r.ok)throw Error(`ESPN scoreboard ${r.status}`);
    const d=await r.json();
    for(const e of d?.events||[]){
      const c=e?.competitions?.[0]||{},teams=c?.competitors||[],home=teams.find(x=>x.homeAway==='home'),away=teams.find(x=>x.homeAway==='away');if(!home||!away)continue;
      const h=teamAbbr(home),a=teamAbbr(away),od=(c?.odds||[])[0]||{},total=finite(od?.overUnder)?Number(od.overUnder):null,fav=parseFavorite(od?.details||''),w=c?.weather||e?.weather||null,wind=parseWind(w),wt=weatherText(w);
      let hi=null,ai=null;
      if(total!==null&&fav&&finite(fav.spread)){
        const margin=Math.abs(Number(fav.spread)),favoriteTotal=total/2+margin/2,underdogTotal=total/2-margin/2;
        if(fav.team===h){hi=favoriteTotal;ai=underdogTotal}else if(fav.team===a){ai=favoriteTotal;hi=underdogTotal}
      }
      const common={event_id:e?.id||null,game_total:total,spread_details:od?.details||null,weather:wt,wind_mph:wind,venue:c?.venue?.fullName||null,indoor:/dome|indoor/i.test(String(c?.venue?.indoor||'')+' '+String(c?.venue?.fullName||''))};
      map.set(h,{...common,team:h,opponent:a,home:true,team_implied:hi,opponent_implied:ai});
      map.set(a,{...common,team:a,opponent:h,home:false,team_implied:ai,opponent_implied:hi});
    }
  }catch{}
  gameCache={key,ts:Date.now(),map};return map;
}

function injuryEvidence(status){
  const s=String(status||'').toUpperCase();
  if(/(^|\b)(IR|OUT|PUP|NFI)(\b|$)/.test(s))return{eligible:false,adjustment:null,level:'OUT',reason:`Status ${s}`};
  if(/DOUBT/.test(s))return{eligible:true,adjustment:-1.5,level:'DOUBTFUL',reason:'Doubtful status materially lowers expected availability.'};
  if(/QUESTION|LIMITED|DNP/.test(s))return{eligible:true,adjustment:0,level:'WATCH',reason:'Injury/practice flag lowers confidence but is not automatically penalized.'};
  return{eligible:true,adjustment:0,level:'CLEAR',reason:null};
}
function environmentAdjustment(p,g){
  if(!g)return{points:0,reasons:[],quality:'UNAVAILABLE'};
  const q=pos(p.position),reasons=[];let points=0;
  const implied=q==='DEF'?g.opponent_implied:g.team_implied;
  if(finite(implied)){
    const raw=clamp((Number(implied)-22)*0.08,-1.2,1.2)*(q==='K'?.7:1),adj=q==='DEF'?-raw:raw;points+=adj;
    if(Math.abs(adj)>=.25)reasons.push(`${q==='DEF'?'Opponent':'Team'} implied total ${Number(implied).toFixed(1)} (${adj>=0?'+':''}${adj.toFixed(1)} pts)`);
  }else if(finite(g.game_total)){
    const raw=clamp((Number(g.game_total)-44)*0.035,-.55,.55),adj=q==='DEF'?-raw:raw;points+=adj;if(Math.abs(adj)>=.2)reasons.push(`Game total ${Number(g.game_total).toFixed(1)} (${adj>=0?'+':''}${adj.toFixed(1)} pts)`);
  }
  if(!g.indoor&&finite(g.wind_mph)){
    const w=Number(g.wind_mph);let wx=0;if(w>=20)wx={QB:-.8,WR:-.5,TE:-.35,K:-1.0,RB:.1,DEF:.15}[q]||0;else if(w>=15)wx={QB:-.4,WR:-.25,TE:-.15,K:-.5,RB:.05,DEF:.08}[q]||0;if(wx){points+=wx;reasons.push(`Wind ${w.toFixed(0)} mph (${wx>=0?'+':''}${wx.toFixed(1)} pts)`) }
  }
  const wt=String(g.weather||'');if(!g.indoor&&/rain|snow|storm/i.test(wt)&&(!finite(g.wind_mph)||Number(g.wind_mph)<15)){const wx={QB:-.15,WR:-.1,TE:-.08,K:-.2,RB:.05,DEF:.05}[q]||0;if(wx){points+=wx;reasons.push(`${wt.slice(0,42)} (${wx>=0?'+':''}${wx.toFixed(1)} pts)`)}}
  return{points:clamp(points,-2,2),reasons,quality:finite(g.team_implied)||finite(g.game_total)?'GOOD':'PARTIAL'};
}
function crowdEvidence(p){
  const f=ffaFor(p);if(!f)return{source_count:0,sd:null,rank_mean:null,rank_sd:null,sources:[],quality:'UNAVAILABLE'};
  const sd=finite(f.point_source_sd)?Number(f.point_source_sd):null,rankMean=finite(f.source_rank_mean)?Number(f.source_rank_mean):null,rankSd=finite(f.source_rank_sd)?Number(f.source_rank_sd):null,c=finite(f.point_source_count)?Number(f.point_source_count):finite(f.source_count)?Number(f.source_count):Array.isArray(f.sources)?f.sources.length:0;
  return{source_count:c,sd,rank_mean:rankMean,rank_sd:rankSd,sources:Array.isArray(f.sources)?f.sources:[],quality:c>=5?'HIGH':c>=3?'GOOD':c>=2?'MEDIUM':c===1?'LOW':'UNAVAILABLE'};
}
function confidenceFor(p,crowd,inj,env){
  const providerCount=Number(p.weekly_source_count||0),spread=finite(p.weekly_spread_pct)?Number(p.weekly_spread_pct):null;let score=0;
  score+=providerCount>=3?3:providerCount===2?2:providerCount===1?1:0;
  if(spread!==null)score+=spread<=12?2:spread<=25?1:spread>40?-1:0;
  score+=crowd.source_count>=5?2:crowd.source_count>=3?1:0;
  if(finite(crowd.sd))score+=crowd.sd<=3?1:crowd.sd>=6?-1:0;
  if(inj.level==='WATCH')score-=1;if(inj.level==='DOUBTFUL')score-=2;if(env.quality==='GOOD')score+=1;
  const label=score>=7?'HIGH':score>=5?'GOOD':score>=3?'MEDIUM':'LOW';
  const threshold=clamp(0.9+(spread??20)*0.03+(finite(crowd.sd)?Number(crowd.sd)*0.08:0)+(inj.level==='WATCH'?.35:0),1,3);
  return{label,score,decision_threshold:Math.round(threshold*10)/10,provider_spread_pct:spread};
}

export async function enrichPlayerAdvice(context,data){
  const games=await nflGames(context),players=[...(data?.team_details||[]).flatMap(t=>t.players||[]),...(data?.waiver_pool||[])];
  for(const p of players){
    if(!finite(p.weekly_points))continue;
    const base=Number(p.weekly_points),inj=injuryEvidence(p.injury_status),g=games.get(String(p.team||'').toUpperCase())||null,env=environmentAdjustment(p,g),crowd=crowdEvidence(p),confidence=confidenceFor(p,crowd,inj,env);
    let adjusted=inj.eligible?base+Number(inj.adjustment||0)+env.points:0;adjusted=Math.max(0,adjusted);
    p.projection_weekly_points=base;p.weekly_points=Math.round(adjusted*100)/100;
    p.player_advice={version:'2.0-context-bounded',base_projection:Math.round(base*100)/100,adjusted_projection:p.weekly_points,context_adjustment:Math.round((p.weekly_points-base)*100)/100,confidence:confidence.label,decision_threshold:confidence.decision_threshold,availability:inj.level,opponent:g?.opponent||null,game_total:g?.game_total??null,team_implied:g?.team_implied??null,weather:g?.weather||null,wind_mph:g?.wind_mph??null,ffanalytics_crowd:crowd,evidence:{injury:inj.reason,environment:env.reasons,provider_spread_pct:confidence.provider_spread_pct},policy:'Projection consensus is the anchor. Context adjustments are capped at ±2 points; uncertainty raises the edge required for a confident recommendation.'};
  }
  rebuildNormalizedAnalysis(context,data);
  data.player_advice_policy={version:'2.0-context-bounded',anchor:'Equal consensus of available ESPN, Sleeper and ffanalytics weekly projections after league scoring normalization.',context_adjustment_cap_points:2,uses:['projection disagreement','ffanalytics crowd dispersion','injury/availability','ESPN opponent and betting environment','ESPN weather when present'],does_not_use_as_production_signal:['FantasyCalc market value','Sleeper add/drop popularity'],decision_rule:'Prefer HOLD/TOSS-UP when the adjusted edge is smaller than uncertainty.',double_count_guard:'ffanalytics crowd rank/dispersion is used as uncertainty evidence, not as a second projection adjustment because its sources already contribute to the ffanalytics projection pillar.'};
  return data;
}
