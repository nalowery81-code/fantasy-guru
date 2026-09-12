/* Matchup readability polish: fold status into player column to reclaim width. */
function fg12PolishMatchup(){
  document.querySelectorAll('.fg10ColHead').forEach(h=>{const c=[...h.children];if(c[2]?.textContent?.trim()==='STATUS')c[2].remove()});
  document.querySelectorAll('.fg10PlayerMain').forEach(r=>{
    const c=[...r.children],id=r.querySelector('.fg10Identity');
    if(c.length>=8&&id&&c[2]?.querySelector('.fg10Status')){const badge=c[2].querySelector('.fg10Status');const name=id.querySelector('b');if(name&&!id.querySelector('.fg12StatusWrap')){const w=document.createElement('span');w.className='fg12StatusWrap';w.appendChild(badge);name.insertAdjacentElement('afterend',w)}c[2].remove()}
  })
}
(function(){
  const s=document.createElement('style');s.textContent=`
    .fg10ColHead,.fg10PlayerMain{grid-template-columns:42px minmax(170px,1.3fr) 46px 54px 60px minmax(180px,1.7fr) 18px!important}
    .fg12StatusWrap{display:inline-flex;margin-left:7px;vertical-align:middle}.fg10Identity>b{display:inline!important}.fg10Identity{min-width:0}.fg10Identity small{display:block!important}.fg10Intel{min-width:0}
    body.fg11Focus .fg10ColHead,body.fg11Focus .fg10PlayerMain{grid-template-columns:52px minmax(210px,1.35fr) 58px 66px 72px minmax(260px,1.85fr) 22px!important;gap:8px!important}
    body.fg11Focus .fg12StatusWrap{margin-left:8px}.fg10Status{vertical-align:1px}
    @media(max-width:1450px){body.fg11Focus .fg10ColHead,body.fg11Focus .fg10PlayerMain{grid-template-columns:46px minmax(170px,1.25fr) 52px 58px 64px minmax(190px,1.5fr) 18px!important;gap:6px!important}}
    @media(max-width:1180px){.fg10ColHead,.fg10PlayerMain{grid-template-columns:40px minmax(155px,1.2fr) 46px 52px 56px minmax(150px,1.4fr) 16px!important}}
  `;document.head.appendChild(s);
  const base=renderMatchup;renderMatchup=async function(){const out=await base();fg12PolishMatchup();return out};
  if(currentView==='matchup')setTimeout(fg12PolishMatchup,0);
})();
