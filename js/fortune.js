(() => {
  const $ = selector => document.querySelector(selector);
  let heroicClaimed = false;
  let popupShownForRoll = false;

  function createPopup() {
    if ($('#heroic-fortune-popup')) return;
    const popup = document.createElement('div');
    popup.id = 'heroic-fortune-popup';
    popup.className = 'heroic-popup-backdrop';
    popup.hidden = true;
    popup.innerHTML = `
      <section class="heroic-popup" role="dialog" aria-modal="true" aria-labelledby="heroic-popup-title">
        <img class="heroic-popup-runes" src="../../components/dice/wood/rune-circle.webp" alt="">
        <p class="step-kicker">Heroic Fortune</p>
        <h2 id="heroic-popup-title">Natural 20!</h2>
        <p>Fate has granted +4 Attribute Credits and unlocked the Bonus Wood D8.</p>
        <button id="heroic-popup-claim" class="creator-button primary" type="button">Claim Heroic Reward</button>
      </section>`;
    document.body.appendChild(popup);
    $('#heroic-popup-claim').addEventListener('click', () => {
      heroicClaimed = true;
      popup.hidden = true;
      document.body.classList.remove('creator-preview-open');
      updateD8Visibility();
      $('#bonus-d8-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function clearInitialValues() {
    const rollCount = $('#fortune-roll-count')?.textContent || '';
    if (rollCount.includes('0 of 3')) {
      const result = $('#fortune-die-value');
      if (result) result.textContent = '';
      const reward = $('#fortune-reward');
      if (reward) reward.hidden = true;
    }
  }

  function isNatural20() {
    return ($('#fortune-die-value')?.textContent || '').trim() === '20' &&
      !($('#fortune-roll-count')?.textContent || '').includes('0 of 3') &&
      ($('#fortune-experience')?.textContent || '').includes('Heroic Fortune');
  }

  function updateD8Visibility() {
    const panel = $('#bonus-d8-panel');
    if (!panel) return;
    panel.hidden = !(isNatural20() && heroicClaimed);
  }

  function inspectFortune() {
    clearInitialValues();
    if (isNatural20() && !popupShownForRoll) {
      popupShownForRoll = true;
      heroicClaimed = false;
      const popup = $('#heroic-fortune-popup');
      popup.hidden = false;
      document.body.classList.add('creator-preview-open');
      $('#heroic-popup-claim')?.focus();
    }
    if (!isNatural20()) {
      popupShownForRoll = false;
      heroicClaimed = false;
    }
    updateD8Visibility();
  }

  function initialize() {
    createPopup();
    inspectFortune();
    const target = $('[data-step="4"]') || document.body;
    new MutationObserver(inspectFortune).observe(target, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
