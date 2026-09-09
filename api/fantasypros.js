const BASE='https://api.fantasypros.com/public/v2/json';

const scoringMode=s=>{
  const x=String(s||'PPR').toUpperCase();
  if(x.includes('HALF'))return 'HALF';
  if(x.includes('STD')||x.includes('STANDARD'))return 'STD';
  return 'PPR';
};

const pointsFrom=(stats={},scoring='PPR')=>{
  if(scoring==='PPR'&&Number.isFinite(Number(stats.points_ppr)))return Number(stats.points_ppr);
  if(scoring==='HALF'&&Number.isFinite(Number(stats.points_half)))return Number(stats.points_half);
  if(Number.isFinite(Number(stats.points)))return Number(stats.points);
  return null;
};

async function fpGet(path,params,key){
  const u=new URL(BASE+path);
  Object.entries(params||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});
  const r=await fetch(u,{headers:{'x-api-key':key,'Accept':'application/json'}});
  const text=await r.text();
  let data;try{data=JSON.parse(text)}catch{throw new Error('FantasyPros returned a non-JSON response')}
  if(!r.ok)throw new Error(data?.message||data?.error||('FantasyPros API error '+r.status));
  return data;
}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  const key=process.env.FANTASYPROS_API_KEY;
  if(!key)return res.status(503).json({
    connected:false,
    error:'FANTASYPROS_API_KEY is not configured in Vercel yet.',
    next_step:'Add the FantasyPros API key as a Production environment variable named FANTASYPROS_API_KEY.'
  });
  try{
    const season=String(req.query?.season||'2026');
    const week=Number(req.query?.week||1);
    const scoring=scoringMode(req.query?.scoring||'PPR');
    const positions='QB:RB:WR:TE:DST:K';
    const [weekly,ros,weeklyRanks,rosRanks]=await Promise.all([
      fpGet('/nfl/'+season+'/projections',{week,positions,scoring},key),
      fpGet('/nfl/'+season+'/projections',{type:'ros',positions,scoring},key),
      fpGet('/nfl/'+season+'/consensus-rankings',{position:'ALL',week,scoring},key),
      fpGet('/nfl/'+season+'/consensus-rankings',{position:'ALL',type:'ROS',scoring},key)
    ]);

    const weeklyPlayers=(weekly.players||[]).map(p=>({
      fantasypros_id:String(p.fpid??p.player_id??''),
      name:p.name||p.player_name||'',
      position:p.position_id||p.position||'',
      team:p.team_id||p.player_team_id||'',
      points:pointsFrom(p.stats||{},scoring),
      stats:p.stats||{}
    }));
    const rosPlayers=(ros.players||[]).map(p=>({
      fantasypros_id:String(p.fpid??p.player_id??''),
      name:p.name||p.player_name||'',
      position:p.position_id||p.position||'',
      team:p.team_id||p.player_team_id||'',
      points:pointsFrom(p.stats||{},scoring),
      stats:p.stats||{}
    }));

    res.json({
      connected:true,
      source:'FantasyPros API',
      season,week,scoring,
      weekly:{count:weeklyPlayers.length,players:weeklyPlayers},
      ros:{count:rosPlayers.length,players:rosPlayers},
      weekly_rankings:weeklyRanks.players||[],
      ros_rankings:rosRanks.players||[]
    });
  }catch(e){
    res.status(502).json({connected:false,error:e.message});
  }
}
