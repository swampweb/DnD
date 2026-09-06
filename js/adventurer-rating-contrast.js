(() => {
  function upgradeRating(element) {
    if (!element || element.dataset.ratingContrast === 'true') return;
    const text = element.textContent.trim();
    const active = [...text].filter(char => char === '★').length;
    const inactive = [...text].filter(char => char === '☆').length;
    if (!active && !inactive) return;
    const total = active + inactive;
    element.dataset.ratingContrast = 'true';
    element.classList.add('difficulty-rating');
    element.setAttribute('aria-label', `Difficulty ${active} of ${total}`);
    element.innerHTML = `<span class="difficulty-stars-active" aria-hidden="true">${'★'.repeat(active)}</span><span class="difficulty-stars-inactive" aria-hidden="true">${'★'.repeat(inactive)}</span><small>${active}/${total}</small>`;
  }

  function upgradeAllRatings(root = document) {
    root.querySelectorAll('.library-card-copy > b, .library-stars').forEach(upgradeRating);
  }

  window.addEventListener('dnd:navigation-ready', () => {
    upgradeAllRatings();
    const targets = [document.getElementById('library-results'), document.getElementById('library-preview-content')].filter(Boolean);
    targets.forEach(target => new MutationObserver(() => upgradeAllRatings(target)).observe(target, {childList:true,subtree:true}));
  });
})();
