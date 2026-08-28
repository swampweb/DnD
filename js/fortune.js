(() => {
  const $ = selector => document.querySelector(selector);
  let heroicClaimed = false;
  let popupShownForRoll = false;
  let observerBusy = false;

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
      setHidden(popup, true);
      document.body.classList.remove('creator-preview-open');
      updateD8Visibility();
      $('#bonus-d8-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function isFirstScreen() {
    return ($('#fortune-roll-count')?.textContent || '').includes('0 of 3');
  }

  function isNatural20() {
    return ($('#fortune-die-value')?.textContent || '').trim() === '20' &&
      !isFirstScreen() &&
      ($('#fortune-experience')?.textContent || '').includes('Heroic Fortune');
  }

  function updateD8Visibility() {
    setHidden($('#bonus-d8-panel'), !(isNatural20() && heroicClaimed));
  }

  function inspectFortune() {
    if (observerBusy) return;
    observerBusy = true;
    requestAnimationFrame(() => {
      if (isFirstScreen()) {
        const result = $('#fortune-die-value');
        if (result && result.textContent) result.textContent = '';
        setHidden($('#fortune-reward'), true);
      }
      const natural20 = isNatural20();
      if (natural20 && !popupShownForRoll) {
        popupShownForRoll = true;
        heroicClaimed = false;
        const popup = $('#heroic-fortune-popup');
        setHidden(popup, false);
        document.body.classList.add('creator-preview-open');
        $('#heroic-popup-claim')?.focus();
      } else if (!natural20) {
        popupShownForRoll = false;
        heroicClaimed = false;
      }
      updateD8Visibility();
      observerBusy = false;
    });
  }

  function initialize() {
    createPopup();
    inspectFortune();
    const target = $('[data-step="4"]');
    if (target) {
      new MutationObserver(inspectFortune).observe(target, {
        subtree: true,
        childList: true,
        characterData: true
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
