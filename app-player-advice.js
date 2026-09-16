/* Canonical player-advice decision layer. No timers or DOM patching. */
(function(){
  const F=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const score=p=>F(p?.weekly_points)?Number(p.weekly_points):-Infinity;
  const threshold=p=>Math.max(1,Number(p?.player_advice?.decision_threshold||1));
  const pairThreshold=(a,b)=>Math.max(threshold(a),threshold(b));
  const eligible=(p,s)=>{const q=pos(p?.position);return s===q||(s==='FLEX'&&['RB','WR','TE'].includes(q))||(s==='SUPER_FLEX'&&['QB','RB','WR','TE'].includes(q))};

  function rawOptimized(){
    const m=mineTeam(),players=m?.players||[],slots=(C?.league?.roster_positions||[]).filter(s=>!['BN','IR'].includes(s));
    const order=[...slots].map((slot,i)=>({slot,i})).sort((a,b)=>({QB:1,SUPER_FLEX:2,TE:3,RB:4,WR:5,FLEX:6,DEF:7,K:8}[a.slot]||9)-({QB:1,SUPER_FLEX:2,TE:3,RB:4,WR:5,FLEX:6,DEF:7,K:8}[b.slot]||9));
    const used=new Set(),picks=[];
    for(const x of order){let bi=-1,bv=-Infinity;players.forEach((p,i)=>{if(used.has(i)||!eligible(p,x.slot)||!F(p.weekly_points))return;const v=score(p);if(v>bv){bv=v;bi=i}});if(bi>=0){used.add(bi);picks.push({slot:x.slot,player:players[bi],value:bv})}}
    return picks;
  }

  function thresholdAwareOptimized(){
    const m=mineTeam();if(!m)return[];
    const picks=rawOptimized(),current=(m.players||[]).filter(p=>p.starter&&F(p.weekly_points)),curIds=new Set(current.map(ident)),pickIds=new Set(picks.map(x=>ident(x.player)));
    const outgoing=current.filter(p=>!pickIds.has(ident(p))),usedOut=new Set();
    for(const x of picks){
      if(curIds.has(ident(x.player)))continue;
      let cand=null;
      for(const p of outgoing){if(usedOut.has(ident(p))||!eligible(p,x.slot))continue;if(!cand||score(p)<score(cand))cand=p}
      if(!cand)continue;
      const edge=score(x.player)-score(cand),need=pairThreshold(x.player,cand);
      if(edge<need){usedOut.add(ident(cand));x.raw_player=x.player;x.raw_value=x.value;x.player=cand;x.value=score(cand);x.held_for_uncertainty=true;x.held_edge=edge;x.required_edge=need}
    }
    return picks;
  }

  function decisionConfidence(diff,a,b){
    const need=pairThreshold(a,b),extra=Number(diff)-need;
    if(extra>=3)return'HIGH';if(extra>=1.5)return'GOOD';if(extra>=0)return'MEDIUM';return'TOSS-UP';
  }

  ssOptimized=thresholdAwareOptimized;
  ssDecisions=function(){
    const m=mineTeam();if(!m)return{picks:[],changes:[],close:[]};
    const picks=thresholdAwareOptimized(),optIds=new Set(picks.map(x=>ident(x.player))),current=(m.players||[]).filter(p=>p.starter),curIds=new Set(current.map(ident));
    const incoming=picks.filter(x=>!curIds.has(ident(x.player))),outgoing=current.filter(p=>!optIds.has(ident(p))),usedOut=new Set(),changes=[];
    for(const x of incoming){
      let cand=null;for(const p of outgoing){if(usedOut.has(ident(p))||!eligible(p,x.slot)||!F(p.weekly_points))continue;if(!cand||score(p)<score(cand))cand=p}if(!cand)continue;
      const diff=score(x.player)-score(cand),required=pairThreshold(x.player,cand);if(diff<required)continue;
      usedOut.add(ident(cand));changes.push({start:x.player,sit:cand,slot:x.slot,diff,required_edge:required,confidence:decisionConfidence(diff,x.player,cand),reason:'Adjusted weekly edge clears the uncertainty threshold.'});
    }
    const bench=(m.players||[]).filter(p=>!optIds.has(ident(p))&&F(p.weekly_points)),close=[];
    for(const x of picks){for(const b of bench){if(!eligible(b,x.slot))continue;const diff=score(x.player)-score(b),required=pairThreshold(x.player,b);if(diff>=0&&diff<=Math.max(5,required+2))close.push({start:x.player,sit:b,slot:x.slot,diff,required_edge:required,confidence:decisionConfidence(diff,x.player,b),actionable:diff>=required})}}
    close.sort((a,b)=>Math.abs(a.diff-a.required_edge)-Math.abs(b.diff-b.required_edge));const seen=new Set(),unique=[];for(const x of close){const k=ident(x.start)+'|'+ident(x.sit);if(seen.has(k))continue;seen.add(k);unique.push(x);if(unique.length>=6)break}
    return{picks,changes,close:unique,policy:analysis?.player_advice_policy||null};
  };
})();
