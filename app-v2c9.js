/* Roster Intel presentation polish: split starters/bench and emphasize status. */
function fg9StatusClass(s){const u=String(s||'ACTIVE').toUpperCase();if(/IR|PUP|NFI/.test(u))return'ir';if(/OUT|DOUBTFUL/.test(u))return'out';if(/QUESTION|LIMITED|DNP/.test(u))return'warn';return'active'}
function fg9PolishIntel(){
  const box=$('intelData');if(!box)return;
  const titles=[...box.querySelectorAll('.benchTitle')];if(titles.length<2)return;
  const rows=[...box.querySelectorAll('.intelRow')];
  rows.forEach(row=>{
    const meta=row.querySelector('.intelRow>div:first-child span:nth-child(2) .muted');
    const name=row.querySelector('.intelRow>div:first-child span:nth-child(2) > b');
    if(!meta||!name)return;
    const parts=meta.textContent.split('·').map(x=>x.trim()).filter(Boolean),status=parts.length?parts[parts.length-1]:'ACTIVE';
    if(/ACTIVE|QUESTION|LIMITED|DOUBTFUL|OUT|IR|PUP|NFI|DNP/i.test(status))parts.pop();
    meta.textContent=parts.join(' · ');
    if(!name.parentElement.querySelector('.fg9Status'))name.insertAdjacentHTML('afterend',` <span class="fg9Status ${fg9StatusClass(status)}">${esc(status)}</span>`);
  });
  const starterTitle=titles.find(x=>/START/i.test(x.textContent)),benchTitle=titles.find(x=>/BENCH/i.test(x.textContent));
  if(!starterTitle||!benchTitle)return;
  const starterRows=[],benchRows=[];let mode='';
  [...box.children].forEach(el=>{
    if(el===starterTitle){mode='start';return}
    if(el===benchTitle){mode='bench';return}
    if(el.classList?.contains('intelRow'))(mode==='bench'?benchRows:starterRows).push(el)
  });
  const teamName=(C.league_teams.find(t=>String(t.roster_id)===String(selectedIntel))||C.league_teams[0])?.team||'Roster';
  box.innerHTML=`<div class="fg9IntelTop"><b>${esc(teamName)}</b><span>Weekly and ROS values are kept next to each player for faster scanning.</span></div><div class="fg9IntelColumns"><section class="fg9IntelSection"><div class="fg9IntelHead"><b>STARTERS</b><span>${starterRows.length}</span></div><div class="fg9StarterRows"></div></section><section class="fg9IntelSection"><div class="fg9IntelHead"><b>BENCH</b><span>${benchRows.length}</span></div><div class="fg9BenchRows"></div></section></div>`;
  const a=box.querySelector('.fg9StarterRows'),b=box.querySelector('.fg9BenchRows');starterRows.forEach(x=>a.appendChild(x));benchRows.forEach(x=>b.appendChild(x));
}
(function(){
  const style=document.createElement('style');style.textContent=`
    #intelData{padding:9px!important;background:transparent!important;border:0!important}.fg9IntelTop{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:7px;padding:0 2px}.fg9IntelTop>b{font-size:14px}.fg9IntelTop>span{color:#8ea6c1;font-size:9px}.fg9IntelColumns{display:grid;grid-template-columns:1fr 1fr;gap:9px;align-items:start}.fg9IntelSection{background:#081524;border:1px solid #28405d;border-radius:10px;padding:8px 9px;min-width:0}.fg9IntelHead{display:flex;justify-content:space-between;align-items:center;padding:2px 0 7px;color:#7dd3fc;font-size:10px;border-bottom:1px solid #28405d}.fg9IntelHead span{background:#10263b;color:#bfe8ff;border-radius:999px;padding:2px 6px;font-size:8px}.fg9IntelSection .intelRow{padding:7px 0!important}.fg9IntelSection .intelRow>div:first-child{grid-template-columns:42px minmax(0,1fr) 48px 52px!important;gap:5px!important}.fg9IntelSection .intelRow>div:first-child>span:first-child{font-size:9px;font-weight:800;color:#c8d7e7}.fg9IntelSection .intelRow>div:last-child{margin:5px 0 0 42px!important;font-size:10px;line-height:1.35}.fg9IntelSection .intelRow .muted{font-size:9px}.fg9Status{display:inline-block;margin-left:5px;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:900;vertical-align:1px}.fg9Status.active{background:#113b2d;color:#86efac;border:1px solid #25664f}.fg9Status.warn{background:#49380f;color:#fde68a;border:1px solid #7b621b}.fg9Status.out{background:#4a1f28;color:#fecdd3;border:1px solid #7f3443}.fg9Status.ir{background:#38234f;color:#e9d5ff;border:1px solid #68438e}.fg9IntelSection .pill{white-space:nowrap}
    @media(max-width:1150px){.fg9IntelColumns{grid-template-columns:1fr}.fg9IntelTop{align-items:flex-start;flex-direction:column}.fg9IntelTop>span{display:none}}
  `;document.head.appendChild(style);
  const baseIntel=renderIntel;renderIntel=async function(force=false){await baseIntel(force);fg9PolishIntel()};
})();
