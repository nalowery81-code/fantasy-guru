/* Commit 1: visual league/team switcher + remember the last league used. */
(function(){
  const LAST_INDEX='fg-last-league-index';
  const LAST_KEY='fg-last-league-key';
  const esc34=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const leagueKey=x=>x?`${String(x.platform||'').toLowerCase()}:${String(x.id||'')}:${String(x.rid||'')}`:'';

  function activeIndex(){
    const ls=leagues();
    if(C){
      const i=ls.findIndex(x=>String(x.id)===String(C?.league?.id)&&String(x.platform).toLowerCase()===String(C?.platform).toLowerCase()&&String(x.rid)===String(C?.my_team?.roster_id));
      if(i>=0)return i;
      const j=ls.findIndex(x=>String(x.id)===String(C?.league?.id)&&String(x.platform).toLowerCase()===String(C?.platform).toLowerCase());
      if(j>=0)return j;
    }
    return 0;
  }

  function rememberedIndex(){
    const ls=leagues();
    const key=localStorage.getItem(LAST_KEY)||'';
    if(key){const i=ls.findIndex(x=>leagueKey(x)===key);if(i>=0)return i;}
    const raw=Number(localStorage.getItem(LAST_INDEX));
    return Number.isInteger(raw)&&raw>=0&&raw<ls.length?raw:0;
  }

  function remember(i){
    const x=leagues()[i];if(!x)return;
    try{localStorage.setItem(LAST_INDEX,String(i));localStorage.setItem(LAST_KEY,leagueKey(x));}catch{}
  }

  function switcherMarkup(idx){
    const ls=leagues(),x=ls[idx]||ls[0]||{};
    const options=ls.map((q,i)=>`<button type="button" class="fg34Option ${i===idx?'current':''}" data-fg34-index="${i}"><span class="fg34Icon">${q.platform==='ESPN'?'🏆':'🏈'}</span><span class="fg34OptionText"><b>${esc34(q.team||q.name||'Fantasy Team')}</b><small>${esc34(q.name||'League')} · ${esc34(q.platform||'')}</small></span>${i===idx?'<em>CURRENT</em>':'<em>OPEN</em>'}</button>`).join('');
    return `<button type="button" class="fg34Current" id="fg34Current" aria-haspopup="true" aria-expanded="false"><span class="fg34CurrentIcon">${x.platform==='ESPN'?'🏆':'🏈'}</span><span><b>${esc34(x.team||x.name||'Fantasy Team')}</b><small>${esc34(x.name||'League')} · ${esc34(x.platform||'')}</small></span><span class="fg34Chevron">⌄</span></button><div class="fg34Menu hidden" id="fg34Menu"><div class="fg34MenuHead">SWITCH TEAM / LEAGUE</div>${options}<button type="button" class="fg34Manage" id="fg34Manage">+ Add a League</button></div>`;
  }

  function closeMenu(){const m=document.getElementById('fg34Menu'),b=document.getElementById('fg34Current');if(m)m.classList.add('hidden');if(b)b.setAttribute('aria-expanded','false');}

  function renderSwitcher(idx=activeIndex()){
    const select=$('leagueSelect');if(!select)return;
    select.classList.add('fg34NativeSelect');select.setAttribute('aria-hidden','true');select.tabIndex=-1;
    let host=document.getElementById('fg34LeagueSwitcher');
    if(!host){host=document.createElement('div');host.id='fg34LeagueSwitcher';host.className='fg34Switcher';select.parentNode.insertBefore(host,select);}
    host.innerHTML=switcherMarkup(idx);
    const current=document.getElementById('fg34Current'),menu=document.getElementById('fg34Menu');
    if(current&&menu)current.onclick=e=>{e.stopPropagation();const opening=menu.classList.contains('hidden');menu.classList.toggle('hidden',!opening);current.setAttribute('aria-expanded',opening?'true':'false');};
    host.querySelectorAll('[data-fg34-index]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const i=Number(b.dataset.fg34Index);closeMenu();if(i===activeIndex())return;await openLeague(i);});
    const manage=document.getElementById('fg34Manage');if(manage)manage.onclick=e=>{e.stopPropagation();closeMenu();showAddForm();};
  }

  document.addEventListener('click',e=>{const h=document.getElementById('fg34LeagueSwitcher');if(h&&!h.contains(e.target))closeMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});

  const baseRenderShell=renderShell;
  renderShell=function(idx){const out=baseRenderShell(idx);renderSwitcher(idx);return out;};

  const baseOpen=openLeague;
  openLeague=async function(i){
    const out=await baseOpen(i);
    const x=leagues()[i];
    const loaded=!!(x&&C&&String(x.id)===String(C?.league?.id)&&String(x.platform).toLowerCase()===String(C?.platform).toLowerCase());
    if(loaded){remember(i);renderSwitcher(i);}
    return out;
  };

  const preferred=rememberedIndex();
  if(preferred>0)document.body.classList.add('fg34RestoringLeague');
  function restorePreferred(){
    if(preferred<=0){renderSwitcher(activeIndex());return;}
    if(loadingLeague){setTimeout(restorePreferred,50);return;}
    if(activeIndex()===preferred&&C){renderSwitcher(preferred);document.body.classList.remove('fg34RestoringLeague');return;}
    Promise.resolve(openLeague(preferred)).finally(()=>document.body.classList.remove('fg34RestoringLeague'));
  }
  setTimeout(restorePreferred,0);

  const style=document.createElement('style');style.textContent=`
    .fg34NativeSelect{display:none!important}
    .fg34Switcher{position:relative;width:100%;margin-bottom:7px}
    .fg34Current{width:100%;display:grid;grid-template-columns:28px minmax(0,1fr) 18px;gap:7px;align-items:center;text-align:left;background:#07111e;color:#f8fafc;border:1px solid #2c4d6b;border-radius:10px;padding:9px 8px;box-shadow:0 5px 18px rgba(0,0,0,.12)}
    .fg34Current:hover,.fg34Current[aria-expanded="true"]{border-color:#38bdf8;background:#0a1a2b}
    .fg34CurrentIcon{font-size:18px}.fg34Current b{display:block;font-size:10px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fg34Current small{display:block;font-size:8px;color:#8fa6bf;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fg34Chevron{color:#7dd3fc;font-size:16px;text-align:right}
    .fg34Menu{position:absolute;left:0;top:calc(100% + 6px);z-index:500;width:310px;max-width:min(310px,calc(100vw - 24px));background:#0b1627;border:1px solid #35506b;border-radius:12px;padding:7px;box-shadow:0 18px 48px rgba(0,0,0,.46)}
    .fg34MenuHead{padding:5px 7px 7px;color:#7890a7;font-size:8px;font-weight:900;letter-spacing:.08em}
    .fg34Option{width:100%;display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;background:#07111e;color:#e8f2ff;border:1px solid #20364e;border-radius:9px;padding:9px;margin-bottom:6px}.fg34Option:hover{border-color:#38bdf8;background:#0b2033}.fg34Option.current{border-color:#216a56;background:#0a201c}.fg34Icon{font-size:18px}.fg34OptionText b{display:block;font-size:11px}.fg34OptionText small{display:block;font-size:8px;color:#8fa6bf;margin-top:2px}.fg34Option em{font-style:normal;font-size:7px;font-weight:900;color:#b9dcf5;border:1px solid #2d5e86;border-radius:999px;padding:3px 5px}.fg34Option.current em{color:#9df5ca;border-color:#216a56;background:#0c2b26}
    .fg34Manage{width:100%;border:1px dashed #35506b;background:#0b1b2d;color:#b9dcf5;border-radius:9px;padding:8px;font-size:9px;font-weight:900}.fg34Manage:hover{border-color:#38bdf8;color:#fff}
    body.fg34RestoringLeague #shell{visibility:hidden!important}
    @media(max-width:700px){.fg34Menu{width:100%;max-width:none;position:relative;top:auto;margin-top:6px}.fg34Current b{font-size:12px}.fg34Current small{font-size:9px}}
  `;document.head.appendChild(style);
})();
