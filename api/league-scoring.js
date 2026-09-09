const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const n=v=>finite(v)?Number(v):0;

// ffanalytics normalized stat -> ESPN fantasy statId. Only linear categories are
// scored here. Nonlinear game-threshold / points-allowed brackets are intentionally
// excluded until we have per-game projected distributions rather than season totals.
const ESPN_STAT_IDS={
  pass_yds:3,pass_tds:4,pass_2pt:19,pass_int:20,
  rush_yds:24,rush_tds:25,rush_2pt:26,
  rec_yds:42,rec_tds:43,rec_2pt:44,rec:53,
  fum_lost:72,
  fgm_50p:74,fgm_40_49:77,fgm_under_40:80,fgmiss:85,xpm:86,xpmiss:88,
  dst_int:95,dst_fum_rec:96,dst_blk_kick:97,dst_safety:98,dst_sack:99
};

const SLEEPER_KEYS={
  pass_yds:'pass_yd',pass_tds:'pass_td',pass_2pt:'pass_2pt',pass_int:'pass_int',
  rush_yds:'rush_yd',rush_tds:'rush_td',rush_2pt:'rush_2pt',
  rec_yds:'rec_yd',rec_tds:'rec_td',rec_2pt:'rec_2pt',rec:'rec',
  fum_lost:'fum_lost',
  fgm_50p:'fgm_50p',fgm_40_49:'fgm_40_49',fgm_under_40:'fgm_0_39',fgmiss:'fgmiss',xpm:'xpm',xpmiss:'xpmiss',
  dst_int:'int',dst_fum_rec:'fum_rec',dst_blk_kick:'blk_kick',dst_safety:'safe',dst_sack:'sack'
};

function normalizedStats(stats={}){
  const out={...stats};
  out.fgm_under_40=n(stats.fgm_0_19)+n(stats.fgm_20_29)+n(stats.fgm_30_39);
  return out;
}

function espnWeights(context){
  const items=context?.league?.scoring_settings?.scoringItems||context?.league?.settings?.scoringSettings?.scoringItems||[];
  const map=new Map();
  for(const row of items||[]){if(finite(row?.statId)&&finite(row?.points))map.set(Number(row.statId),Number(row.points));}
  return map;
}

function sleeperWeights(context){
  const s=context?.league?.scoring_settings||context?.league?.settings?.scoring_settings||{};
  return s&&typeof s==='object'&&!Array.isArray(s)?s:{};
}

export function scoreConsensusStats(context,stats={},position=''){
  const st=normalizedStats(stats),platform=String(context?.platform||'').toUpperCase();
  let total=0,used=0,unsupported=[];
  if(platform==='ESPN'){
    const weights=espnWeights(context);
    if(!weights.size)return{points:null,used_categories:0,unsupported:['missing_espn_scoring_items'],scoring_mode:'unavailable'};
    for(const [stat,id] of Object.entries(ESPN_STAT_IDS)){
      if(!finite(st[stat]))continue;
      if(!weights.has(id))continue;
      total+=Number(st[stat])*weights.get(id);used++;
    }
    // Do not claim exact DEF scoring when the league uses nonlinear points/yard
    // allowed brackets that cannot be reconstructed from one season-total stat.
    if(String(position).toUpperCase()==='DEF')unsupported.push('defense_points_allowed_brackets_not_scored');
    return{points:used?total:null,used_categories:used,unsupported,scoring_mode:'espn_exact_linear_rules'};
  }
  const weights=sleeperWeights(context);
  if(Object.keys(weights).length){
    for(const [stat,key] of Object.entries(SLEEPER_KEYS)){
      if(!finite(st[stat])||!finite(weights[key]))continue;
      total+=Number(st[stat])*Number(weights[key]);used++;
    }
    if(String(position).toUpperCase()==='DEF')unsupported.push('defense_points_allowed_brackets_not_scored');
    return{points:used?total:null,used_categories:used,unsupported,scoring_mode:'sleeper_exact_linear_rules'};
  }
  return{points:null,used_categories:0,unsupported:['missing_supported_scoring_settings'],scoring_mode:'unavailable'};
}
