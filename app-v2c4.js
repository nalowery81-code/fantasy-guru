function leaguePlatformUrl(l){
  if(!l)return null;
  const platform=String(l.platform||'').toUpperCase();
  const id=encodeURIComponent(String(l.id||''));
  const rid=encodeURIComponent(String(l.rid||l.roster_id||''));
  if(platform==='SLEEPER'&&id)return `https://sleeper.com/leagues/${id}/team`;
  if(platform==='ESPN'&&id)return `https://fantasy.espn.com/football/team?leagueId=${id}${rid?`&teamId=${rid}`:''}`;
  return null;
}
function leaguePlatformLabel(l){return String(l?.platform||'League')+' ↗'}
function externalLeagueLink(l,compact=false){const u=leaguePlatformUrl(l);if(!u)return'';return `<a href="${u}" target="_blank" rel="noopener noreferrer" class="fgPlatformLink${compact?' compact':''}" title="Open this league on ${esc(l.platform)}">${esc(leaguePlatformLabel(l))}</a>`}
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .fgPlatformLink{display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:5px 9px;border:1px solid #35506e;border-radius:8px;color:#7dd3fc;text-decoration:none;font-size:11px;font-weight:700;white-space:nowrap;background:#0b1727}.fgPlatformLink:hover{border-color:#7dd3fc;background:#102238}.fgPlatformLink.compact{padding:3px 7px;font-size:10px;margin-left:7px}.fgLeagueChoice,.fgLeagueTile{position:relative}.fgLeagueChoice .fgInternal,.fgLeagueTile .fgInternal{all:unset;display:block;box-sizing:border-box;width:100%;cursor:pointer}.fgLeagueChoice .fgPlatformLink,.fgLeagueTile .fgPlatformLink{position:absolute;right:10px;top:50%;transform:translateY(-50%)}.fgLeagueChoice .fgInternal,.fgLeagueTile .fgInternal{padding-right:100px}@media(max-width:700px){.fgLeagueChoice .fgPlatformLink,.fgLeagueTile .fgPlatformLink{position:static;transform:none;margin-top:8px}.fgLeagueChoice .fgInternal,.fgLeagueTile .fgInternal{padding-right:0}}
  `;
  document.head.appendChild(style);

  const baseGateRender=gateRender;
  gateRender=function(){
    const ls=leagues();
    $('gateLeagues').innerHTML=ls.map((x,i)=>`<div class="leagueChoice fgLeagueChoice"><button class="fgInternal" data-i="${i}"><b>${esc(x.name)}</b><div class="leagueMeta">${esc(x.team)} · ${esc(x.platform)}</div></button>${externalLeagueLink(x)}</div>`).join('');
    $('gateLeagues').querySelectorAll('.fgInternal').forEach(b=>b.onclick=()=>openLeague(Number(b.dataset.i)));
  };

  const baseRenderShell=renderShell;
  renderShell=function(idx){
    baseRenderShell(idx);
    const l=leagues()[idx]||{platform:C?.platform,id:C?.league?.id,rid:C?.my_team?.roster_id};
    $('topTitle').innerHTML=`${esc(C.league.name)} — ${esc(C.my_team.team)} [${esc(C.platform)}] ${externalLeagueLink(l,true)}`;
  };

  const baseRenderDashboard=renderDashboard;
  renderDashboard=function(){
    baseRenderDashboard();
    const box=$('content')?.querySelector('.leagueTiles');
    if(!box)return;
    const ls=leagues();
    box.innerHTML=ls.map((x,i)=>`<div class="miniLeague fgLeagueTile ${String(x.id)===String(C?.league?.id)?'current':''}"><button class="fgInternal" data-i="${i}"><b>${esc(x.name)}</b><div class="leagueMeta">${esc(x.team)} · ${esc(x.platform)}</div></button>${externalLeagueLink(x)}</div>`).join('');
    box.querySelectorAll('.fgInternal').forEach(b=>b.onclick=()=>openLeague(Number(b.dataset.i)));
  };

  gateRender();
})();
