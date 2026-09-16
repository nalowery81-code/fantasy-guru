/* Accuracy cleanup: present playoff health as a categorical outlook, not false probability precision. */
(function(){
  function outlookLabelFromPercent(p){
    const n=Number(p);
    if(!Number.isFinite(n))return 'Unclear';
    if(n>=72)return 'Strong';
    if(n>=55)return 'Competitive';
    if(n>=38)return 'On the Bubble';
    return 'At Risk';
  }

  function cleanPlayoffOutlook(){
    if(currentView!=='dashboard')return;
    const card=document.querySelector('.fg30Outlook');
    if(!card)return;
    const primary=card.querySelector('.fg30OutGrid .primary');
    if(!primary)return;
    const label=primary.querySelector('span');
    const value=primary.querySelector('b');
    const note=primary.querySelector('small');
    const pct=value?Number(String(value.textContent||'').replace(/[^0-9.-]/g,'')):NaN;
    if(label)label.textContent='Playoff Outlook';
    if(value)value.textContent=outlookLabelFromPercent(pct);
    if(note){
      note.textContent='Directional team-health signal';
      note.title='Based on current record, rest-of-season team strength, league size and playoff settings. This is not a calibrated playoff probability.';
    }
  }

  const baseRenderDashboard=renderDashboard;
  renderDashboard=function(){const out=baseRenderDashboard();setTimeout(cleanPlayoffOutlook,30);return out};

  const baseShowView=showView;
  showView=function(v){const out=baseShowView(v);if(v==='dashboard')setTimeout(cleanPlayoffOutlook,30);return out};

  setTimeout(cleanPlayoffOutlook,120);
})();
