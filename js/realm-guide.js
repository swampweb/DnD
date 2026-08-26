(() => {
  const sections = [...document.querySelectorAll('.codex-section')];
  const sectionButtons = [...document.querySelectorAll('[data-section], [data-jump]')];
  const searchInput = document.getElementById('codex-search-input');
  const noResults = document.getElementById('codex-no-results');
  const sidebar = document.getElementById('codex-sidebar');
  const mobileToggle = document.getElementById('mobile-codex-toggle');

  function showSection(id) {
    const target = document.getElementById(id);
    if (!target) return;
    sections.forEach(section => section.classList.toggle('active', section === target));
    document.querySelectorAll('[data-section]').forEach(button => {
      button.classList.toggle('active', button.dataset.section === id);
    });
    noResults.hidden = true;
    if (searchInput) searchInput.value = '';
    if (window.innerWidth <= 850 && sidebar) {
      sidebar.classList.remove('open');
      mobileToggle?.setAttribute('aria-expanded', 'false');
    }
    document.querySelector('.realm-guide-heading')?.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  sectionButtons.forEach(button => {
    button.addEventListener('click', () => showSection(button.dataset.section || button.dataset.jump));
  });

  document.querySelectorAll('.codex-nav-parent').forEach(button => {
    button.addEventListener('click', () => {
      const group = button.closest('.codex-nav-group');
      const isOpen = group.classList.toggle('open');
      button.setAttribute('aria-expanded', String(isOpen));
    });
  });

  searchInput?.addEventListener('input', event => {
    const query = event.target.value.trim().toLowerCase();
    if (!query) {
      showSection('getting-started');
      return;
    }
    const match = sections.find(section => (section.dataset.search || '').toLowerCase().includes(query) || section.textContent.toLowerCase().includes(query));
    sections.forEach(section => section.classList.toggle('active', section === match));
    noResults.hidden = Boolean(match);
    document.querySelectorAll('[data-section]').forEach(button => button.classList.toggle('active', Boolean(match) && button.dataset.section === match.id));
  });

  mobileToggle?.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    mobileToggle.setAttribute('aria-expanded', String(isOpen));
  });
})();
