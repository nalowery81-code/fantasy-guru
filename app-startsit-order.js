/* Start / Sit roster grouping: current starters first, bench second. */
(function(){
  function sectionRow(label,count){
    const tr=document.createElement('tr');
    tr.className='ss2SectionRow';
    tr.innerHTML=`<td colspan="8"><span>${label}</span><small>${count}</small></td>`;
    return tr;
  }

  function regroupStartSitRows(){
    if(typeof currentView==='undefined'||currentView!=='startsit')return;
    const body=document.getElementById('ss2Body');
    if(!body)return;
    const rows=[...body.querySelectorAll('tr')].filter(r=>!r.classList.contains('ss2SectionRow'));
    if(!rows.length||rows.some(r=>r.querySelector('.ss2Empty')))return;
    const active=document.querySelector('.ss2Filters button.active')?.dataset?.filter||'ALL';
    const starters=rows.filter(r=>r.dataset.started==='1');
    const bench=rows.filter(r=>r.dataset.started!=='1');
    body.innerHTML='';
    if(active==='STARTERS'){
      starters.forEach(r=>body.appendChild(r));
      return;
    }
    if(active==='BENCH'){
      bench.forEach(r=>body.appendChild(r));
      return;
    }
    if(starters.length){body.appendChild(sectionRow('Current Starters',starters.length));starters.forEach(r=>body.appendChild(r));}
    if(bench.length){body.appendChild(sectionRow('Bench',bench.length));bench.forEach(r=>body.appendChild(r));}
  }

  const baseShowView=showView;
  showView=function(v){const out=baseShowView(v);if(v==='startsit')regroupStartSitRows();return out};
  document.addEventListener('click',e=>{if(e.target.closest?.('.ss2Filters button'))queueMicrotask(regroupStartSitRows)});
  document.addEventListener('input',e=>{if(e.target?.id==='ss2Search')queueMicrotask(regroupStartSitRows)});

  const style=document.createElement('style');
  style.textContent=`.ss2SectionRow td{padding:5px 9px!important;background:#0c2134!important;border-top:1px solid #2d5876!important;border-bottom:1px solid #183149!important;color:#d8e9f7;text-transform:uppercase;font-size:8px;font-weight:950;letter-spacing:.07em}.ss2SectionRow td{display:table-cell}.ss2SectionRow span{color:#5fd4ff}.ss2SectionRow small{margin-left:7px;color:#7f9ab1;font-size:7px;font-weight:800}`;
  document.head.appendChild(style);
})();
