/* Start / Sit readability pass: use the available desktop canvas without changing lineup logic. */
(function(){
  const style=document.createElement('style');
  style.textContent=`
    body:not(.fg11GuruHidden) .fg25SS{max-width:none!important;width:100%!important}
    .fg25SS{max-width:none!important;width:100%!important}
    .fg25SSHead{align-items:center!important;margin-bottom:14px!important}
    .fg25SSHead h2{font-size:24px!important}
    .fg25SSHead span{font-size:12px!important}
    .fg25Gain{padding:11px 16px!important;min-width:120px!important}
    .fg25Gain span{font-size:9px!important}.fg25Gain b{font-size:22px!important}
    .fg25Summary{grid-template-columns:1fr 1fr!important;gap:14px!important;margin-bottom:14px!important}
    .fg25Summary section,.fg25Columns>section{padding:14px!important}
    .fg25Summary h3,.fg25ColHead h3{font-size:17px!important;margin-bottom:9px!important}
    .fg25Summary p,.fg25Good,.fg25Decision{font-size:12px!important}
    .fg25Columns{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:14px!important;width:100%!important}
    .fg25ColHead{padding:2px 2px 8px!important}.fg25ColHead h3{font-size:18px!important}.fg25ColHead span{font-size:11px!important}
    .fg25MiniHead,.fg25SSRow{grid-template-columns:110px minmax(220px,1fr) 78px 78px 72px!important;gap:10px!important}
    .fg25MiniHead{font-size:8.5px!important;padding:7px 10px!important}
    .fg25SSRow{padding:10px 10px!important;min-height:52px!important}
    .fg25SSRow b{font-size:12px!important}.fg25SSRow small{font-size:8.5px!important;margin-top:2px!important}
    .fg25Who b{font-size:13px!important}.fg25Who small{font-size:9px!important}
    .fg25Badge{font-size:9px!important;padding:4px 7px!important}
    @media(min-width:1500px){
      .fg25Summary section,.fg25Columns>section{padding:16px!important}
      .fg25MiniHead,.fg25SSRow{grid-template-columns:120px minmax(260px,1fr) 88px 88px 78px!important}
      .fg25SSRow{padding:11px 12px!important;min-height:56px!important}
      .fg25SSRow b{font-size:13px!important}.fg25Who b{font-size:14px!important}
    }
    @media(max-width:1050px){
      .fg25Summary{grid-template-columns:1fr!important}
      .fg25Columns{grid-template-columns:1fr!important}
    }
  `;
  document.head.appendChild(style);
})();
