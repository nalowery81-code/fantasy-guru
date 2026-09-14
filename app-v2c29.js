/* Final dashboard layout: Week Matchup | Roster at a Glance | League Hub, Improve center, Opportunities | Fantasy News | My Team Outlook. */
(function(){
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const F=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const N=(v,d=1)=>F(v)?Number(v).toFixed(d):'—';
  function byTitle(root,re){return [...root.querySelectorAll('section,.fg6Card')].find(x=>re.test(x.querySelector('h2,h3')?.textContent||''))||null}
  function leagueHubHTML(){
    const ls=leagues(),active=String(C?.league?.id||'');
    let alertHtml='';
    const snaps=[];
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!/fg.*(analysis|snapshot|league)/i.test(k))continue;const v=JSON.parse(localStorage.getItem(k)||'null');if(v?.data?.league?.id||v?.data?.my_team)snaps.push(v.data)}}catch{}
    alertHtml=ls.map((x,i)=>{const on=String(x.id)===active;let note=on?'Current league':(x.platform==='ESPN'?'Open to review':'Across-league status');return `<button class="fg29League" data-fg29-league="${i}"><span>${x.platform==='ESPN'?'🏆':'🏈'}</span><div><b>${E(x.name)}</b><small>${E(x.team)} · ${E(x.platform)}</small></div><em>${on?'● Current':E(note)}</em></button>`}).join('');
    return `<section class="fg29Card fg29LeagueHub"><div class="fg29Head"><div><h2>🏆 League Hub</h2><span>Switch leagues and review your other teams.</span></div><button id="fg29AddLeague">+ Add League</button></div><div class="fg29LeagueList">${alertHtml}</div></section>`;
  }
  function outlookHTML(){
    const r=analysis?.ros?.my_ranks||{},teams=analysis?.team_details?.length||C?.league_teams?.length||10;
    const ranks=[['QB',r.qb],['RB',r.rb],['WR',r.wr],['TE',r.te]].filter(x=>F(x[1]));
    const weak=ranks.length?[...ranks].sort((a,b)=>Number(b[1])-Number(a[1]))[0]:null;
    const strong=ranks.length?[...ranks].sort((a,b)=>Number(a[1])-Number(b[1]))[0]:null;
    const bottom=ranks.filter(x=>Number(x[1])>Math.ceil(teams*.65)).length;
    const outlook=F(r.overall)&&Number(r.overall)<=Math.ceil(teams*.3)?'Strong':F(r.overall)&&Number(r.overall)<=Math.ceil(teams*.6)?'Competitive':'Needs Work';
    const d=matchupData?.available?matchupData:null,proj=d?.you?.projection;
    const wa=typeof storedWaiverIdeas==='function'?storedWaiverIdeas():[],tr=typeof tradeIdeas==='function'?tradeIdeas():[],rr=typeof tradeRadar==='function'?tradeRadar():[];
    const path=wa.length?'Waiver wire':tr.length?'Trade':'Monitor';
    const action=wa[0]?.add?`Best path: add ${wa[0].add.name}`:tr[0]?.get?.[0]?`Best path: trade for ${tr[0].get[0].name}`:rr[0]?.get?.[0]?`Best target to monitor: ${rr[0].get[0].name}`:'No move currently clears the recommendation bar.';
    return `<section class="fg29Card fg29Outlook"><div class="fg29Head"><div><h2>📊 My Team Outlook</h2><span>What your roster needs next.</span></div><b class="fg29Status">${E(outlook)}</b></div><div class="fg29OutGrid"><div><span>Overall</span><b>${F(r.overall)?'#'+r.overall:'—'}</b></div><div><span>Week Projection</span><b>${N(proj)}</b></div><div><span>Roster Risk</span><b>${bottom>=2?'High':bottom===1?'Medium':'Low'}</b></div><div><span>Best Path</span><b>${E(path)}</b></div></div><div class="fg29OutNote"><b>${weak?`Biggest need: ${weak[0]} (#${weak[1]})`:'Roster need unavailable'}</b><span>${E(action)}</span>${strong?`<small>Biggest strength: ${E(strong[0])} (#${E(strong[1])})</small>`:''}</div></section>`;
  }
  function enhance(){
    if(currentView!=='dashboard')return;const dash=document.querySelector('.fg6Dash');if(!dash||dash.dataset.fg29)return;dash.dataset.fg29='1';
    const leagues=dash.querySelector('.fg28Leagues');
    const week=dash.querySelector('.fg6Week');
    const improve=dash.querySelector('.fg28Improve');
    const roster=byTitle(dash,/Roster at a Glance/i);
    const opp=byTitle(dash,/Opportunities/i);
    const news=byTitle(dash,/Fantasy News/i);
    const colts=byTitle(dash,/Colts News|NFL Today/i); if(colts)colts.remove();
    const across=byTitle(dash,/Across Your Leagues/i); if(across)across.remove();
    if(leagues)leagues.remove();
    if(week){const h=week.querySelector('h2');if(h)h.textContent=`🗓️ Week ${C.current_week} Matchup`;}
    const top=document.createElement('div');top.className='fg29Top';
    if(week)top.appendChild(week);if(roster)top.appendChild(roster);top.insertAdjacentHTML('beforeend',leagueHubHTML());
    dash.prepend(top);
    if(improve){improve.classList.add('fg29Improve');top.insertAdjacentElement('afterend',improve)}
    const bottom=document.createElement('div');bottom.className='fg29Bottom';
    if(opp)bottom.appendChild(opp);if(news)bottom.appendChild(news);bottom.insertAdjacentHTML('beforeend',outlookHTML());
    dash.appendChild(bottom);
    dash.querySelectorAll('[data-fg29-league]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.fg29League);if(String(leagues()[i]?.id)===String(C?.league?.id))return;openLeague(i)});
    const add=$('fg29AddLeague');if(add)add.onclick=()=>showAddForm();
  }
  const rd=renderDashboard;renderDashboard=function(){const out=rd();setTimeout(enhance,0);return out};
  const sv=showView;showView=function(v){const out=sv(v);if(v==='dashboard')setTimeout(enhance,0);return out};
  const style=document.createElement('style');style.textContent=`
    .fg6Dash{display:block!important;max-width:none!important;width:100%!important}.fg29Top,.fg29Bottom{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:10px;margin-bottom:10px;align-items:stretch}.fg29Top>.fg6Card,.fg29Bottom>.fg6Card,.fg29Card{margin:0!important;min-width:0}.fg29Top .fg6Week,.fg29Top .fg6Card,.fg29Card,.fg29Bottom .fg6Card{height:100%}.fg29Improve{margin:0 0 10px!important}.fg29Card{background:#081524;border:1px solid #28405d;border-radius:11px;padding:11px 12px}.fg29Head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:9px}.fg29Head h2{margin:0;font-size:17px}.fg29Head span{display:block;color:#8fa6bf;font-size:9px;margin-top:2px}.fg29Head button{border:1px solid #2d5e86;background:#0b2033;color:#d8efff;border-radius:7px;padding:6px 9px;font-size:9px;font-weight:850}.fg29LeagueList{display:grid;gap:6px}.fg29League{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:7px;align-items:center;width:100%;text-align:left;background:#07111e;color:#e8f2ff;border:1px solid #20364e;border-radius:8px;padding:7px 8px;cursor:pointer}.fg29League:hover{border-color:#38bdf8}.fg29League>span{font-size:18px}.fg29League b{display:block;font-size:10px}.fg29League small{display:block;font-size:8px;color:#8fa6bf;margin-top:1px}.fg29League em{font-style:normal;font-size:8px;color:#86efac;white-space:nowrap}.fg29Status{font-size:10px;color:#86efac;border:1px solid #216a56;background:#0c2b26;border-radius:999px;padding:4px 8px}.fg29OutGrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.fg29OutGrid>div{border:1px solid #20364e;background:#07111e;border-radius:7px;padding:7px}.fg29OutGrid span{display:block;color:#8fa6bf;font-size:8px}.fg29OutGrid b{display:block;font-size:13px;margin-top:2px}.fg29OutNote{margin-top:7px;border:1px solid #28405d;border-radius:8px;padding:8px;background:#07111e}.fg29OutNote b,.fg29OutNote span,.fg29OutNote small{display:block}.fg29OutNote b{font-size:10px;color:#fbbf24}.fg29OutNote span{font-size:9px;color:#d4dfeb;margin-top:3px;line-height:1.35}.fg29OutNote small{font-size:8px;color:#8fa6bf;margin-top:4px}.fg29Top .fg6WeekGrid{grid-template-columns:1fr!important}.fg29Top .fg6LineupBox{display:none!important}.fg29Top .fg6Week{padding:11px 12px!important}.fg29Top .fg6ScoreBox{height:calc(100% - 34px)}.fg29Bottom .fg6Card{padding:11px 12px!important}.fg29Bottom .fg6Title h2{font-size:17px!important}.fg29Top .fg6Card .fg6Title h2{font-size:17px!important}.fg29Top .fg6Ranks{grid-template-columns:repeat(5,1fr)!important}
    @media(max-width:1150px){.fg29Top,.fg29Bottom{grid-template-columns:1fr 1fr}.fg29LeagueHub,.fg29Outlook{grid-column:1/-1}}
    @media(max-width:760px){.fg29Top,.fg29Bottom{grid-template-columns:1fr}.fg29LeagueHub,.fg29Outlook{grid-column:auto}.fg29Top .fg6WeekGrid{grid-template-columns:1fr!important}.fg29League{grid-template-columns:26px minmax(0,1fr)}.fg29League em{grid-column:2}}
  `;document.head.appendChild(style);
})();
