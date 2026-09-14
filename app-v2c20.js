/* Compare Players picker UX: searchable/filterable/sortable lists synced to existing deterministic selects. */
(function(){
  function esc20(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function playerPoolFor(side){
    if(side==='drop')return (typeof mineTeam==='function'?(mineTeam()?.players||[]):[]).filter(Boolean);
    return (typeof waiverPool==='function'?waiverPool():[]).filter(Boolean);
  }
  function metrics(p){return{week:finite(p?.weekly_points)?Number(p.weekly_points):null,ros:finite(p?.ros_points)?Number(p.ros_points):null,name:String(p?.name||''),position:pos(p?.position)}}
  function sortRows(rows,mode){return [...rows].sort((a,b)=>{const A=metrics(a),B=metrics(b);if(mode==='week')return (B.week??-Infinity)-(A.week??-Infinity)||A.name.localeCompare(B.name);if(mode==='name')return A.name.localeCompare(B.name);if(mode==='position')return A.position.localeCompare(B.position)||A.name.localeCompare(B.name);return (B.ros??-Infinity)-(A.ros??-Infinity)||A.name.localeCompare(B.name)})}
  function pickerHTML(side){
    const label=side==='drop'?'MY ROSTER':'AVAILABLE PLAYERS';
    return `<div class="fg20Picker" data-side="${side}"><div class="fg20PickerHead"><b>${label}</b><span>${side==='drop'?'Choose who you would drop':'Choose who you would add'}</span></div><div class="fg20Controls"><input class="fg20Search" placeholder="Type player name…"><select class="fg20Pos"><option value="ALL">All positions</option>${['QB','RB','WR','TE','K','DEF'].map(p=>`<option value="${p}">${p}</option>`).join('')}</select><select class="fg20Sort"><option value="ros">Sort: ROS</option><option value="week">Sort: Week Proj</option><option value="position">Sort: Position</option><option value="name">Sort: Name</option></select></div><div class="fg20List"></div></div>`
  }
  function renderList(box,select){
    const side=box.dataset.side,q=String(box.querySelector('.fg20Search')?.value||'').trim().toLowerCase(),pf=box.querySelector('.fg20Pos')?.value||'ALL',sm=box.querySelector('.fg20Sort')?.value||'ros';
    let rows=playerPoolFor(side);if(pf!=='ALL')rows=rows.filter(p=>pos(p.position)===pf);if(q)rows=rows.filter(p=>String(p.name||'').toLowerCase().includes(q));rows=sortRows(rows,sm).slice(0,80);
    const selected=select.value;
    box.querySelector('.fg20List').innerHTML=rows.length?rows.map(p=>{const id=ident(p),m=metrics(p),active=id===selected;return `<button type="button" class="fg20Row ${active?'active':''}" data-id="${esc20(id)}"><span><b>${esc20(p.name)}</b><small>${esc20(m.position)}${p.team?' · '+esc20(p.team):''}</small></span><span><b>${m.week==null?'—':m.week.toFixed(1)}</b><small>WEEK</small></span><span><b>${m.ros==null?'—':m.ros.toFixed(1)}</b><small>ROS</small></span></button>`}).join(''):'<div class="fg20Empty">No players match that search/filter.</div>';
    box.querySelectorAll('.fg20Row').forEach(b=>b.onclick=()=>{select.value=b.dataset.id;select.dispatchEvent(new Event('change',{bubbles:true}));box.querySelectorAll('.fg20Row').forEach(x=>x.classList.toggle('active',x===b));});
  }
  function enhanceCompare(){
    const drop=$('fg17Drop'),add=$('fg17Add');if(!drop||!add)return false;if(document.querySelector('.fg20CompareEnhance'))return true;
    const host=document.querySelector('.fg17ComparePick');if(!host)return false;
    host.classList.add('fg20CompareEnhance');
    drop.closest('label')?.classList.add('fg20LegacySelect');add.closest('label')?.classList.add('fg20LegacySelect');const swap=host.querySelector('.fg17Swap');if(swap)swap.style.display='none';
    host.insertAdjacentHTML('afterend',`<div class="fg20Pickers">${pickerHTML('drop')}${pickerHTML('add')}</div>`);
    document.querySelectorAll('.fg20Picker').forEach(box=>{const sel=box.dataset.side==='drop'?drop:add;box.querySelector('.fg20Search').addEventListener('input',()=>renderList(box,sel));box.querySelector('.fg20Pos').onchange=()=>renderList(box,sel);box.querySelector('.fg20Sort').onchange=()=>renderList(box,sel);renderList(box,sel)});
    drop.addEventListener('change',()=>{const box=document.querySelector('.fg20Picker[data-side="drop"]');if(box)renderList(box,drop)});add.addEventListener('change',()=>{const box=document.querySelector('.fg20Picker[data-side="add"]');if(box)renderList(box,add)});
    return true;
  }
  function scheduleEnhance(attempt=0){requestAnimationFrame(()=>{if(enhanceCompare())return;if(attempt<4)setTimeout(()=>scheduleEnhance(attempt+1),25)})}
  const style=document.createElement('style');style.textContent=`
    .fg20LegacySelect{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}.fg20Pickers{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}.fg20Picker{border:1px solid #28405d;border-radius:10px;background:#071524;padding:9px;min-width:0}.fg20PickerHead{display:flex;justify-content:space-between;gap:8px;align-items:end;margin-bottom:7px}.fg20PickerHead b{font-size:10px;color:#7dd3fc}.fg20PickerHead span{font-size:8px;color:#8fa6bf}.fg20Controls{display:grid;grid-template-columns:minmax(0,1fr) 115px 130px;gap:6px;margin-bottom:7px}.fg20Controls input,.fg20Controls select{width:100%;background:#07111e;color:#e8f2ff;border:1px solid #28405d;border-radius:7px;padding:7px 8px;font-size:10px}.fg20List{display:grid;gap:4px;max-height:330px;overflow:auto;padding-right:2px}.fg20Row{display:grid;grid-template-columns:minmax(0,1fr) 62px 62px;gap:8px;align-items:center;width:100%;border:1px solid #20364e;background:#091827;color:#e8f2ff;border-radius:7px;padding:7px 8px;text-align:left;cursor:pointer}.fg20Row:hover{border-color:#3d82b5;background:#0c2238}.fg20Row.active{border-color:#38bdf8;background:#0d2a42;box-shadow:inset 0 0 0 1px #38bdf8}.fg20Row span:not(:first-child){text-align:center}.fg20Row b{display:block;font-size:10px}.fg20Row small{display:block;color:#8fa6bf;font-size:7.5px;margin-top:2px}.fg20Empty{padding:14px;color:#8fa6bf;font-size:10px;text-align:center;border:1px dashed #28405d;border-radius:7px}
    @media(max-width:900px){.fg20Pickers{grid-template-columns:1fr}.fg20Controls{grid-template-columns:1fr 100px 120px}}
    @media(max-width:700px){.fg20Controls{grid-template-columns:1fr 1fr}.fg20Controls .fg20Search{grid-column:1/-1}.fg20List{max-height:280px}.fg20Picker{padding:8px}.fg20PickerHead{display:block}.fg20PickerHead span{display:block;margin-top:2px}}
  `;document.head.appendChild(style);
  document.addEventListener('click',e=>{const tab=e.target.closest?.('.fg17Tab');if(tab?.dataset.tab==='compare')setTimeout(()=>scheduleEnhance(),0)});
  const baseShow=showView;showView=function(v){const out=baseShow(v);if(v==='playerhub')setTimeout(()=>scheduleEnhance(),0);return out};
  setTimeout(()=>scheduleEnhance(),0);
})();