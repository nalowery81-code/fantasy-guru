/* Final dashboard structure lock: remove duplicate league block and enforce designed section order. */
(function(){
  function byTitle(root,re){return [...root.querySelectorAll('section,.fg6Card,.fg29Card')].find(x=>re.test(x.querySelector('h2,h3')?.textContent||''))||null}
  function lockDashboard(){
    if(currentView!=='dashboard')return;
    const dash=document.querySelector('.fg6Dash');if(!dash)return;

    /* Retire duplicate c28 league switcher; League Hub is the one dashboard league control. */
    dash.querySelectorAll('.fg28Leagues').forEach(x=>x.remove());

    const week=byTitle(dash,/Week\s*\d+\s*Matchup|My Week/i);
    const roster=byTitle(dash,/Roster at a Glance/i);
    const league=byTitle(dash,/League Hub/i);
    const improve=byTitle(dash,/How to Improve Your Team/i);
    const opp=byTitle(dash,/Opportunities/i);
    const news=byTitle(dash,/Fantasy News/i);
    const outlook=byTitle(dash,/My Team Outlook/i);

    /* Remove stale wrapper shells only after detaching the live sections. */
    [week,roster,league,improve,opp,news,outlook].forEach(x=>x&&x.remove());
    dash.querySelectorAll('.fg29Top,.fg29Bottom,.fg6Split,.fg6Bottom').forEach(w=>{if(!w.children.length)w.remove()});

    const top=document.createElement('div');top.className='fg32Top';
    if(week)top.appendChild(week);if(roster)top.appendChild(roster);if(league)top.appendChild(league);
    const bottom=document.createElement('div');bottom.className='fg32Bottom';
    if(opp)bottom.appendChild(opp);if(news)bottom.appendChild(news);if(outlook)bottom.appendChild(outlook);

    dash.innerHTML='';
    dash.appendChild(top);
    if(improve)dash.appendChild(improve);
    dash.appendChild(bottom);
    dash.dataset.fg32='1';
  }

  function scheduleLock(){
    document.body.classList.add('fg32Building');
    requestAnimationFrame(()=>{
      lockDashboard();
      requestAnimationFrame(()=>document.body.classList.remove('fg32Building'));
    });
  }

  const rd=renderDashboard;renderDashboard=function(){const out=rd();setTimeout(scheduleLock,0);return out};
  const sv=showView;showView=function(v){const out=sv(v);if(v==='dashboard')setTimeout(scheduleLock,0);return out};
  setTimeout(scheduleLock,0);

  const style=document.createElement('style');style.textContent=`
    body.fg32Building #content{visibility:hidden!important}
    .fg6Dash{display:block!important;max-width:none!important;width:100%!important}
    .fg32Top,.fg32Bottom{display:grid!important;grid-template-columns:1.15fr 1fr 1fr!important;gap:10px!important;margin-bottom:10px!important;align-items:stretch!important}
    .fg32Top>*,.fg32Bottom>*{min-width:0!important;height:100%!important;margin:0!important}
    .fg28Improve,.fg29Improve{margin:0 0 10px!important}
    .fg32Top .fg6WeekGrid{grid-template-columns:1fr!important}
    .fg32Top .fg6LineupBox{display:none!important}
    .fg32Top .fg6ScoreBox{height:calc(100% - 34px)!important}
    .fg32Bottom .fg6Card,.fg32Bottom .fg29Card{height:100%!important}
    @media(max-width:1150px){.fg32Top,.fg32Bottom{grid-template-columns:1fr 1fr!important}.fg32Top>*:last-child,.fg32Bottom>*:last-child{grid-column:1/-1}}
    @media(max-width:760px){.fg32Top,.fg32Bottom{grid-template-columns:1fr!important}.fg32Top>*:last-child,.fg32Bottom>*:last-child{grid-column:auto}}
  `;document.head.appendChild(style);
})();
