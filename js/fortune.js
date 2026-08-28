(() => {
  const $ = selector => document.querySelector(selector);
  let heroicClaimed = false;
  let popupShownForRoll = false;
  let scheduled = false;

  function setHidden(element, hidden) {
    if (element && element.hidden !== hidden) element.hidden = hidden;
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
      $('#bonus-d8-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function firstRollNotStarted() {
    const stage = $('#fortune-die');
    const count = $('#fortune-roll-count')?.textContent || '';
    return count.includes('0 of 3') && !stage?.classList.contains('is-rolling');
  }

  function natural20() {
    return ($('#fortune-die-value')?.textContent || '').trim() === '20' &&
      !($('#fortune-roll-count')?.textContent || '').includes('0 of 3') &&
      ($('#fortune-experience')?.textContent || '').includes('Heroic Fortune');
  }

  function updateD8() {
    setHidden($('#bonus-d8-panel'), !(natural20() && heroicClaimed));
  }

  function inspect() {
    scheduled = false;
    if (firstRollNotStarted()) {
      const value = $('#fortune-die-value');
      if (value?.textContent) value.textContent = '';
      setHidden($('#fortune-reward'), true);
    }
    const heroic = natural20();
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
    createPopup();
    inspect();
    const target = $('[data-step="4"]');
    if (target) new MutationObserver(scheduleInspect).observe(target, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once:true });
  else initialize();
})();
