/* Dashboard data/asset sync: use proven mascot asset and hydrate async matchup data without re-render races. */
(function(){
  function syncDashboard(){
    if(typeof currentView!=='undefined'&&currentView!=='dashboard')return;
    const root=document.querySelector('.fg40Dash');
    if(!root)return;

    const img=root.querySelector('.fg40Mascot img');
    if(img&&img.getAttribute('src')!=='/assets/fantasy-guru-robot.webp?v=20260916stable'){
      img.src='/assets/fantasy-guru-robot.webp?v=20260916stable';
      img.alt='Fantasy Guru robot mascot';
    }

    let d=null;
    try{d=(typeof matchupData!=='undefined'&&matchupData?.available)?matchupData:null}catch{}
    const you=d?.you||null,them=d?.them||d?.opponent||d?.opponent_team||null;
    if(!you&&!them)return;

    const sides=root.querySelectorAll('.fg40Score > div');
    const left=sides[0],right=sides[sides.length-1];
    const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
    const fmt=v=>finite(v)?Number(v).toFixed(1):'—';
    const myProj=finite(you?.projection)?Number(you.projection):null;
    const oppProj=finite(them?.projection)?Number(them.projection):null;

    if(left){const n=left.querySelector('small'),p=left.querySelector('b');if(n&&you?.team)n.textContent=you.team;if(p)p.textContent=fmt(myProj)}
    if(right){const n=right.querySelector('small'),p=right.querySelector('b');if(n&&them?.team)n.textContent=them.team;if(p)p.textContent=fmt(oppProj)}

    const edge=root.querySelector('.fg40Edge');
    if(edge&&myProj!=null&&oppProj!=null){
      const diff=myProj-oppProj;
      edge.textContent=`${diff>=0?'+':''}${diff.toFixed(1)} projected ${diff>=0?'advantage':'disadvantage'}`;
      edge.classList.toggle('bad',diff<0);
    }
  }

  const content=document.getElementById('content');
  if(content)new MutationObserver(syncDashboard).observe(content,{childList:true,subtree:true});
  let tries=0;
  const timer=setInterval(()=>{syncDashboard();if(++tries>=30)clearInterval(timer)},400);
  syncDashboard();
})();
