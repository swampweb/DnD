(() => {
  const STORAGE_KEY = 'three-realms-character-draft-v2';
  const CLASS_MANIFEST = 'assets/classes/viking/classes.json';
  const state = { step: 1, adventureId: null, classId: null, adventurerId: null, classes: [], selectedClass: null, adventurers: [], selectedAdventurer: null };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const siteUrl = path => window.DND?.siteUrl ? window.DND.siteUrl(path) : `/${String(path).replace(/^\//, '')}`;
  const assetUrl = path => encodeURI(siteUrl(path));

  function saveDraft() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step: state.step, adventureId: state.adventureId, classId: state.classId, adventurerId: state.adventurerId }));
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
      state.step = Math.min(3, Math.max(1, Number(draft.step) || 1));
      state.adventureId = draft.adventureId || null;
      state.classId = draft.classId || null;
      state.adventurerId = draft.adventurerId || null;
    } catch { sessionStorage.removeItem(STORAGE_KEY); }
  }

  async function fetchJson(path) {
    const response = await fetch(assetUrl(path), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return response.json();
  }

  function difficulty(value, maximum = 5) {
    const score = Math.max(0, Math.min(maximum, Number(value) || 0));
    return `<span class="difficulty" aria-label="Difficulty ${score} out of ${maximum}">${'★'.repeat(score)}${'☆'.repeat(maximum - score)}</span>`;
  }

  function setStatus(message = '', type = '') {
    const element = $('#creator-status');
    if (!element) return;
    element.textContent = message;
    element.className = `creator-status ${type}`.trim();
    element.hidden = !message;
  }

  function updateContinue() {
    const button = $('#creator-continue');
    const valid = (state.step === 1 && state.adventureId) || (state.step === 2 && state.classId) || (state.step === 3 && state.adventurerId);
    button.disabled = !valid;
    button.textContent = state.step === 3 ? 'Continue to Fortune (Next Build)' : 'Continue';
    const parts = [];
    if (state.adventureId) parts.push('Viking Adventure');
    if (state.selectedClass) parts.push(state.selectedClass.name);
    if (state.selectedAdventurer) parts.push(state.selectedAdventurer.name);
    $('#selection-summary').textContent = parts.length ? parts.join(' • ') : 'No selection yet';
  }

  function changeStep(step) {
    state.step = Math.min(3, Math.max(1, step));
    $$('.creator-step').forEach(panel => {
      const active = Number(panel.dataset.step) === state.step;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    $$('[data-step-button]').forEach(button => {
      const number = Number(button.dataset.stepButton);
      button.classList.toggle('active', number === state.step);
      button.classList.toggle('complete', number < state.step);
      button.disabled = number > state.step || (number === 2 && !state.adventureId) || (number === 3 && !state.classId);
    });
    $('#creator-back').hidden = state.step === 1;
    updateContinue();
    saveDraft();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadClasses() {
    if (state.classes.length) return;
    setStatus('Loading Viking Classes...');
    const manifest = await fetchJson(CLASS_MANIFEST);
    state.classes = await Promise.all(manifest.classes.map(id => fetchJson(`assets/classes/viking/${id}/class.json`)));
    renderClasses();
    setStatus();
  }

  function renderClasses() {
    $('#class-grid').innerHTML = state.classes.map(item => `<article class="class-choice ${item.id === state.classId ? 'selected' : ''}">
      <button class="class-select-area" type="button" data-select-class="${esc(item.id)}">
        <img src="${assetUrl(`assets/classes/viking/${item.id}/${item.coin}`)}" alt="${esc(item.name)} Class coin">
        <span class="choice-copy"><strong>${esc(item.name)}</strong><small>${esc(item.role)}</small>${difficulty(item.difficulty)}</span>
      </button>
      <p>${esc(item.description)}</p>
      <div class="choice-meta"><span>${item.heroes?.length || 0} Adventurers</span></div>
      <div class="choice-actions"><button type="button" data-preview-class="${esc(item.id)}">Preview</button><button type="button" class="primary" data-select-class="${esc(item.id)}">Select</button></div>
    </article>`).join('');
  }

  async function loadHeroesForClass(classData) {
    return Promise.all((classData.heroes || []).map(id => fetchJson(`assets/classes/viking/${classData.id}/${id}/${id}.json`).then(data => ({ ...data, _folder: id }))));
  }

  async function selectClass(id) {
    state.classId = id;
    state.selectedClass = state.classes.find(item => item.id === id) || null;
    state.adventurerId = null;
    state.selectedAdventurer = null;
    state.adventurers = state.selectedClass ? await loadHeroesForClass(state.selectedClass) : [];
    renderClasses();
    renderAdventurers();
    updateContinue();
    saveDraft();
  }

  function heroAsset(classId, hero, key) {
    return assetUrl(`assets/classes/viking/${classId}/${hero._folder}/${hero.assets?.[key] || ''}`);
  }

  function renderAdventurers() {
    if (!state.selectedClass) return;
    $('#adventurer-step-copy').textContent = `Choose one of the ${state.adventurers.length} ${state.selectedClass.name} Adventurers.`;
    $('#adventurer-grid').innerHTML = state.adventurers.map(item => `<article class="adventurer-choice ${item.id === state.adventurerId ? 'selected' : ''}">
      <button class="adventurer-art" type="button" data-preview-adventurer="${esc(item.id)}"><img src="${heroAsset(state.selectedClass.id, item, 'previewCard')}" alt="${esc(item.name)} preview card"></button>
      <div class="adventurer-copy"><h3>${esc(item.name)}</h3><p>${esc(item.role)}</p>${difficulty(item.difficulty, item.difficultyMax || 5)}</div>
      <div class="choice-actions"><button type="button" data-preview-adventurer="${esc(item.id)}">Preview</button><button type="button" class="primary" data-select-adventurer="${esc(item.id)}">Select</button></div>
    </article>`).join('');
  }

  function selectAdventurer(id) {
    state.adventurerId = id;
    state.selectedAdventurer = state.adventurers.find(item => item.id === id) || null;
    renderAdventurers();
    updateContinue();
    saveDraft();
  }

  function showPreview(html) {
    $('#preview-content').innerHTML = html;
    $('#creator-preview').hidden = false;
    document.body.classList.add('creator-preview-open');
    $('#preview-close').focus();
  }

  function closePreview() {
    $('#creator-preview').hidden = true;
    document.body.classList.remove('creator-preview-open');
  }

  async function previewClass(id) {
    const item = state.classes.find(entry => entry.id === id);
    if (!item) return;
    setStatus(`Loading ${item.name} Adventurers...`);
    const heroes = await loadHeroesForClass(item);
    setStatus();
    const gallery = heroes.map(hero => `<article class="hero-card" data-hero-card="${esc(hero.id)}">
      <button class="hero-model-button" type="button" data-modal-select-hero="${esc(hero.id)}" data-modal-class="${esc(item.id)}" aria-label="Select ${esc(hero.name)}">
        <img src="${heroAsset(item.id, hero, 'model')}" alt="${esc(hero.name)} model">
      </button>
      <div class="hero-card-copy"><h4>${esc(hero.name)}</h4><p>${esc(hero.role || 'Adventurer')}</p>${difficulty(hero.difficulty, hero.difficultyMax || 5)}</div>
      <button class="hero-select-button" type="button" data-modal-select-hero="${esc(hero.id)}" data-modal-class="${esc(item.id)}">Select ${esc(hero.name)}</button>
    </article>`).join('');

    showPreview(`<div class="class-preview-header">
      <img src="${assetUrl(`assets/classes/viking/${item.id}/${item.coin}`)}" alt="${esc(item.name)} Class coin">
      <div><p class="step-kicker">Class Preview</p><h2 id="preview-title">${esc(item.name)}</h2><p>${esc(item.role)}</p>${difficulty(item.difficulty)}</div>
    </div>
    <p class="preview-description">${esc(item.description)}</p>
    <h3 class="hero-gallery-title">Available Adventurers</h3>
    <p class="hero-gallery-help">Move the pointer over an Adventurer to reveal the full-color model. Select a model to continue.</p>
    <div class="hero-gallery">${gallery}</div>`);
  }

  function previewAdventurer(id) {
    const item = state.adventurers.find(entry => entry.id === id);
    if (!item) return;
    const abilities = (item.starterAbilities || []).map(entry => `<li><img src="${assetUrl(`assets/classes/viking/${state.selectedClass.id}/${item._folder}/${entry.icon}`)}" alt=""><span><strong>${esc(entry.name)}</strong><small>${esc(entry.description)}</small></span></li>`).join('');
    const equipment = (item.starterEquipment || []).map(entry => `<li><img src="${assetUrl(`assets/classes/viking/${state.selectedClass.id}/${item._folder}/${entry.icon}`)}" alt=""><span><strong>${esc(entry.name)}</strong><small>Quantity: ${Number(entry.quantity) || 1}</small></span></li>`).join('');
    const attrs = item.baseAttributes || {};
    showPreview(`<div class="adventurer-preview-layout"><div class="preview-model"><img src="${heroAsset(state.selectedClass.id, item, 'model')}" alt="${esc(item.name)} model"></div><div class="preview-details"><p class="step-kicker">Adventurer Preview</p><h2 id="preview-title">${esc(item.name)}</h2><p>${esc(item.class)} • ${esc(item.role)}</p>${difficulty(item.difficulty, item.difficultyMax || 5)}<p class="preview-description">${esc(item.theme)}</p><h3>Base Attributes</h3><div class="preview-attributes">${['str','dex','con','int','wis','cha'].map(key => `<span><b>${key.toUpperCase()}</b>${Number(attrs[key]) || 0}</span>`).join('')}</div></div></div><div class="preview-columns"><section><h3>Starter Abilities</h3><ul class="preview-item-list">${abilities || '<li>No starter abilities listed.</li>'}</ul></section><section><h3>Starter Equipment</h3><ul class="preview-item-list">${equipment || '<li>No starter equipment listed.</li>'}</ul></section></div><button class="creator-button primary preview-select" type="button" data-modal-select-adventurer="${esc(item.id)}">Select ${esc(item.name)}</button>`);
  }

  function bindEvents() {
    $('.adventure-choice.selectable').addEventListener('click', async () => {
      state.adventureId = 'viking';
      $('.adventure-choice.selectable').classList.add('selected');
      updateContinue(); saveDraft();
      try { await loadClasses(); } catch (error) { setStatus(`Classes could not load: ${error.message}`, 'error'); }
    });
    $('#creator-back').addEventListener('click', () => changeStep(state.step - 1));
    $('#creator-continue').addEventListener('click', async () => {
      if (state.step === 1 && state.adventureId) { try { await loadClasses(); changeStep(2); } catch (error) { setStatus(`Classes could not load: ${error.message}`, 'error'); } }
      else if (state.step === 2 && state.classId) changeStep(3);
      else if (state.step === 3 && state.adventurerId) window.DNDModal.alert({ type: 'info', title: 'Selection Complete', message: `${state.selectedAdventurer.name} is selected. Roll Your Fortune is the next development stage.`, confirmText: 'Close' });
    });
    $('.creator-progress').addEventListener('click', event => { const button = event.target.closest('[data-step-button]'); if (button && !button.disabled) changeStep(Number(button.dataset.stepButton)); });
    $('#class-grid').addEventListener('click', async event => {
      const preview = event.target.closest('[data-preview-class]');
      const select = event.target.closest('[data-select-class]');
      try { if (preview) await previewClass(preview.dataset.previewClass); else if (select) await selectClass(select.dataset.selectClass); }
      catch (error) { setStatus(`Class data could not load: ${error.message}`, 'error'); }
    });
    $('#adventurer-grid').addEventListener('click', event => {
      const preview = event.target.closest('[data-preview-adventurer]');
      const select = event.target.closest('[data-select-adventurer]');
      if (preview) previewAdventurer(preview.dataset.previewAdventurer); else if (select) selectAdventurer(select.dataset.selectAdventurer);
    });
    $('#preview-close').addEventListener('click', closePreview);
    $('#creator-preview').addEventListener('click', async event => {
      if (event.target.id === 'creator-preview') { closePreview(); return; }
      const heroButton = event.target.closest('[data-modal-select-hero]');
      const adventurerButton = event.target.closest('[data-modal-select-adventurer]');
      if (heroButton) {
        const classId = heroButton.dataset.modalClass;
        const heroId = heroButton.dataset.modalSelectHero;
        state.classId = classId;
        state.selectedClass = state.classes.find(item => item.id === classId) || null;
        state.adventurers = await loadHeroesForClass(state.selectedClass);
        state.adventurerId = heroId;
        state.selectedAdventurer = state.adventurers.find(item => item.id === heroId) || null;
        renderClasses(); renderAdventurers(); updateContinue(); saveDraft(); closePreview(); changeStep(3);
      } else if (adventurerButton) { selectAdventurer(adventurerButton.dataset.modalSelectAdventurer); closePreview(); }
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#creator-preview').hidden) closePreview(); });
  }

  async function initialize() {
    restoreDraft(); bindEvents();
    if (state.adventureId === 'viking') $('.adventure-choice.selectable').classList.add('selected');
    try {
      if (state.adventureId) await loadClasses();
      if (state.classId) { state.selectedClass = state.classes.find(item => item.id === state.classId) || null; if (state.selectedClass) { state.adventurers = await loadHeroesForClass(state.selectedClass); renderAdventurers(); } }
      if (state.adventurerId) state.selectedAdventurer = state.adventurers.find(item => item.id === state.adventurerId) || null;
      renderClasses(); changeStep(state.step);
    } catch (error) { state.step = 1; setStatus(`Saved selections could not be restored: ${error.message}`, 'error'); changeStep(1); }
  }

  window.addEventListener('dnd:navigation-ready', initialize, { once: true });
})();
