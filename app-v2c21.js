/* Visible Compare Players selection tray synced to searchable picker rows. */
(function(){
  function esc21(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function findPlayer(side,id){
    const pool=side==='drop'?(typeof mineTeam==='function'?(mineTeam()?.players||[]):[]):(typeof waiverPool==='function'?waiverPool():[]);
    return (pool||[]).find(p=>ident(p)===String(id))||null;
  }
  function selectedCard(side,id){
    const p=findPlayer(side,id),label=side==='drop'?'DROP':'ADD';
    if(!p)return `<div class="fg21Selected empty"><span>${label}</span><b>Choose a player</b></div>`;
    const w=finite(p.weekly_points)?Number(p.weekly_points).toFixed(1):'—',r=finite(p.ros_points)?Number(p.ros_points).toFixed(1):'—';
    return `<div class="fg21Selected ${side}"><span>${label}</span><div><b>${esc21(p.name)}</b><small>${esc21(pos(p.position))}${p.team?' · '+esc21(p.team):''}</small></div><div class="fg21SelNums"><em>${w}<small>WEEK</small></em><em>${r}<small>ROS</small></em></div></div>`;
  }
  function updateTray(){
    const tray=document.querySelector('.fg21Tray'),drop=$('fg17Drop'),add=$('fg17Add');if(!tray||!drop||!add)return;
    tray.innerHTML=`${selectedCard('drop',drop.value)}<div class="fg21Vs">⇄</div>${selectedCard('add',add.value)}`;
  }
  function enhance(){
    const drop=$('fg17Drop'),add=$('fg17Add'),pickers=document.querySelector('.fg20Pickers');if(!drop||!add||!pickers)return;
    if(!document.querySelector('.fg21Tray'))pickers.insertAdjacentHTML('beforebegin','<div class="fg21Tray"></div>');
    updateTray();
    if(!drop.dataset.fg21){drop.dataset.fg21='1';drop.addEventListener('change',()=>setTimeout(updateTray,0))}
    if(!add.dataset.fg21){add.dataset.fg21='1';add.addEventListener('change',()=>setTimeout(updateTray,0))}
    document.querySelectorAll('.fg20Row').forEach(row=>{if(row.dataset.fg21)return;row.dataset.fg21='1';row.addEventListener('click',()=>setTimeout(updateTray,0))});
  }
  const style=document.createElement('style');style.textContent=`
    .fg21Tray{display:grid;grid-template-columns:minmax(0,1fr) 42px minmax(0,1fr);gap:8px;align-items:center;margin:8px 0 10px}.fg21Selected{min-height:58px;border:1px solid #2a4967;background:#081827;border-radius:10px;padding:9px 10px;display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:9px;align-items:center}.fg21Selected>span{font-size:9px;font-weight:900;color:#8fa6bf}.fg21Selected.drop>span{color:#fda4af}.fg21Selected.add>span{color:#86efac}.fg21Selected>div>b{display:block;font-size:12px;color:#e8f2ff}.fg21Selected>div>small{display:block;font-size:8px;color:#8fa6bf;margin-top:2px}.fg21SelNums{display:flex;gap:12px}.fg21SelNums em{font-style:normal;font-size:11px;font-weight:900;text-align:center;color:#e8f2ff}.fg21SelNums small{display:block!important;font-size:7px!important;color:#71879e!important;margin-top:1px!important}.fg21Vs{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:1px solid #31506d;background:#091827;color:#7dd3fc;font-size:16px;font-weight:900}.fg21Selected.empty{grid-template-columns:48px 1fr}.fg21Selected.empty>b{font-size:11px;color:#71879e}.fg20Row{transition:border-color .12s ease,background .12s ease,transform .08s ease}.fg20Row:active{transform:scale(.995)}
    @media(max-width:700px){.fg21Tray{grid-template-columns:1fr;gap:6px}.fg21Vs{justify-self:center;transform:rotate(90deg)}.fg21Selected{grid-template-columns:42px minmax(0,1fr) auto}.fg21SelNums{gap:8px}}
  `;document.head.appendChild(style);
  const obs=new MutationObserver(()=>requestAnimationFrame(enhance));obs.observe(document.documentElement,{subtree:true,childList:true});document.addEventListener('click',e=>{if(e.target.closest?.('.fg20Row'))setTimeout(enhance,0)});setTimeout(enhance,0);
})();
