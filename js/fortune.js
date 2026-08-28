(() => {
  const $ = selector => document.querySelector(selector);
  let heroicClaimed = false;
  let popupShownForRoll = false;
  let scheduled = false;

  function setHidden(element, hidden) {
    if (element && element.hidden !== hidden) element.hidden = hidden;
  }

  function arrangeFortuneLayout() {
    const stage = $('.fortune-stage');
    if (!stage || stage.querySelector('.fortune-details')) return;
    const details = document.createElement('div');
    details.className = 'fortune-details';
    ['#fortune-roll-count','#fortune-experience','#fortune-result-copy','#fortune-reward','.fortune-actions','#fortune-warning'].forEach(selector => {
      const element = stage.querySelector(selector);
      if (element) details.appendChild(element);
    });
    stage.appendChild(details);
  }

  function clearInitialDisplayOnce() {
    const rollCount = $('#fortune-roll-count')?.textContent || '';
    if (!rollCount.includes('0 of 3')) return;
    const result = $('#fortune-die-value');
    if (result) result.textContent = '';
    setHidden($('#fortune-reward'), true);
  }

  function createPopup() {
    if ($('#heroic-fortune-popup')) return;
    const popup = document.createElement('div');
    popup.id = 'heroic-fortune-popup';
    popup.className = 'heroic-popup-backdrop';
    popup.hidden = true;
    popup.innerHTML = `<section class="heroic-popup" role="dialog" aria-modal="true" aria-labelledby="heroic-popup-title"><img class="heroic-popup-runes" src="../../components/dice/wood/rune-circle.webp" alt=""><p class="step-kicker">Heroic Fortune</p><h2 id="heroic-popup-title">Natural 20!</h2><p>Fate has granted +4 Attribute Credits and unlocked the Bonus Wood D8.</p><button id="heroic-popup-claim" class="creator-button primary" type="button">Claim Heroic Reward</button></section>`;
    document.body.appendChild(popup);
    $('#heroic-popup-claim').addEventListener('click', () => {
      heroicClaimed = true;
      popup.hidden = true;
      document.body.classList.remove('creator-preview-open');
      updateD8();
      $('#bonus-d8-panel')?.scrollIntoView({ behavior:'smooth', block:'center' });
    });
  }

  function isNatural20() {
    return ($('#fortune-die-value')?.textContent || '').trim() === '20' &&
      !($('#fortune-roll-count')?.textContent || '').includes('0 of 3') &&
      ($('#fortune-experience')?.textContent || '').includes('Heroic Fortune');
  }

  function updateD8() {
    setHidden($('#bonus-d8-panel'), !(isNatural20() && heroicClaimed));
  }

  function inspect() {
    scheduled = false;
    const heroic = isNatural20();
    if (heroic && !popupShownForRoll) {
      popupShownForRoll = true;
      heroicClaimed = false;
      const popup = $('#heroic-fortune-popup');
      popup.hidden = false;
      document.body.classList.add('creator-preview-open');
      $('#heroic-popup-claim')?.focus();
    } else if (!heroic) {
      popupShownForRoll = false;
      heroicClaimed = false;
    }
    updateD8();
  }

  function scheduleInspect() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(inspect);
  }

  function initialize() {
    arrangeFortuneLayout();
    clearInitialDisplayOnce();
    createPopup();
    inspect();
    const target = $('[data-step="4"]');
    if (target) new MutationObserver(scheduleInspect).observe(target, { subtree:true, childList:true, characterData:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once:true });
  else initialize();
})();
