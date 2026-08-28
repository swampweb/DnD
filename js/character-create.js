(() => {
  const STORAGE_KEY = 'three-realms-character-draft-v3';
  const MANIFEST = 'assets/classes/viking/classes.json';
  const state = { step: 1, adventureId: null, classId: null, adventurerId: null, classes: [], selectedClass: null, adventurers: [], selectedAdventurer: null };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const siteUrl = path => window.DND?.siteUrl ? window.DND.siteUrl(path) : `/${String(path).replace(/^\//,'')}`;
  const assetUrl = path => encodeURI(siteUrl(path));

  async function fetchJson(path) {
    const response = await fetch(assetUrl(path), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return response.json();
  }

  function difficulty(value, maximum = 5) {
    const score = Math.max(0, Math.min(maximum, Number(value) || 0));
    return `<span class="difficulty" aria-label="Difficulty ${score} out of ${maximum}">${'★'.repeat(score)}${'☆'.repeat(maximum-score)}</span>`;
  }

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

  function setStatus(message = '', type = '') {
    const element = $('#creator-status');
    if (!element) return;
    element.textContent = message;
    element.className = `creator-status ${type}`.trim();
    element.hidden = !message;
  }

  function updateSummary() {
    const parts = [];
    if (state.adventureId) parts.push('Viking Adventure');
    if (state.selectedClass) parts.push(state.selectedClass.name);
    if (state.selectedAdventurer) parts.push(state.selectedAdventurer.name);
    $('#selection-summary').textContent = parts.length ? parts.join(' • ') : 'No selection yet';
  }

  function updateContinue() {
    const button = $('#creator-continue');
    if (state.step === 1) {
      button.hidden = false;
      button.disabled = !state.adventureId;
      button.textContent = 'Continue to Class';
    } else if (state.step === 2) {
      button.hidden = true;
    } else {
      button.hidden = false;
      button.disabled = !state.adventurerId;
      button.textContent = 'Continue to Fortune (Next Build)';
    }
    updateSummary();
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
    const manifest = await fetchJson(MANIFEST);
    state.classes = await Promise.all(manifest.classes.map(id => fetchJson(`assets/classes/viking/${id}/class.json`)));
    renderClasses();
    setStatus();
  }

  async function loadAdventurers(classData) {
    return Promise.all((classData.heroes || []).map(id =>
      fetchJson(`assets/classes/viking/${classData.id}/${id}/${id}.json`).then(data => ({ ...data, _folder: id }))
    ));
  }

  function heroAsset(hero, key) {
    return assetUrl(`assets/classes/viking/${state.selectedClass.id}/${hero._folder}/${hero.assets?.[key] || ''}`);
  }

  function renderClasses() {
    $('#class-grid').innerHTML = state.classes.map(item => `<article class="class-choice ${item.id === state.classId ? 'selected' : ''}">
      <div class="class-select-area">
        <img src="${assetUrl(`assets/classes/viking/${item.id}/${item.coin}`)}" alt="${esc(item.name)} Class coin">
        <span class="choice-copy"><strong>${esc(item.name)}</strong><small>${esc(item.role)}</small>${difficulty(item.difficulty)}</span>
      </div>
      <p>${esc(item.description)}</p>
      <div class="choice-meta"><span>${item.heroes?.length || 0} Adventurers</span></div>
      <div class="choice-actions single-action"><button type="button" class="primary" data-select-class="${esc(item.id)}">Select ${esc(item.name)}</button></div>
    </article>`).join('');
  }

  async function selectClassAndContinue(id) {
    setStatus('Loading Adventurers...');
    state.classId = id;
    state.selectedClass = state.classes.find(item => item.id === id) || null;
    state.adventurerId = null;
    state.selectedAdventurer = null;
    state.adventurers = await loadAdventurers(state.selectedClass);
    renderClasses();
    renderAdventurers();
    setStatus();
    saveDraft();
    changeStep(3);
  }

  function renderAdventurers() {
    if (!state.selectedClass) return;
    $('#adventurer-step-copy').textContent = `Choose one of the ${state.adventurers.length} ${state.selectedClass.name} Adventurers.`;
    $('#adventurer-grid').innerHTML = state.adventurers.map(hero => `<article class="adventurer-choice ${hero.id === state.adventurerId ? 'selected' : ''}">
      <button class="adventurer-art" type="button" data-select-adventurer="${esc(hero.id)}" aria-label="Select ${esc(hero.name)}">
        <img src="${heroAsset(hero,'previewCard')}" alt="${esc(hero.name)} preview card">
      </button>
      <div class="adventurer-copy"><h3>${esc(hero.name)}</h3><p>${esc(hero.role)}</p>${difficulty(hero.difficulty, hero.difficultyMax || 5)}</div>
      <div class="choice-actions"><button type="button" data-preview-adventurer="${esc(hero.id)}">Preview Details</button><button type="button" class="primary" data-select-adventurer="${esc(hero.id)}">Select ${esc(hero.name)}</button></div>
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

  function previewAdventurer(id) {
    const hero = state.adventurers.find(item => item.id === id);
    if (!hero) return;
    const attrs = hero.baseAttributes || {};
    const abilities = (hero.starterAbilities || []).map(item => `<li><img src="${assetUrl(`assets/classes/viking/${state.selectedClass.id}/${hero._folder}/${item.icon}`)}" alt=""><span><strong>${esc(item.name)}</strong><small>${esc(item.description)}</small></span></li>`).join('');
    const equipment = (hero.starterEquipment || []).map(item => `<li><img src="${assetUrl(`assets/classes/viking/${state.selectedClass.id}/${hero._folder}/${item.icon}`)}" alt=""><span><strong>${esc(item.name)}</strong><small>Quantity: ${Number(item.quantity) || 1}</small></span></li>`).join('');
    showPreview(`<div class="adventurer-preview-layout"><div class="preview-model"><img src="${heroAsset(hero,'model')}" alt="${esc(hero.name)} model"></div><div class="preview-details"><p class="step-kicker">Adventurer Details</p><h2 id="preview-title">${esc(hero.name)}</h2><p>${esc(hero.class)} • ${esc(hero.role)}</p>${difficulty(hero.difficulty, hero.difficultyMax || 5)}<p class="preview-description">${esc(hero.theme)}</p><h3>Base Attributes</h3><div class="preview-attributes">${['str','dex','con','int','wis','cha'].map(key => `<span><b>${key.toUpperCase()}</b>${Number(attrs[key]) || 0}</span>`).join('')}</div></div></div><div class="preview-columns"><section><h3>Starter Abilities</h3><ul class="preview-item-list">${abilities || '<li>No starter abilities listed.</li>'}</ul></section><section><h3>Starter Equipment</h3><ul class="preview-item-list">${equipment || '<li>No starter equipment listed.</li>'}</ul></section></div><button class="creator-button primary preview-select" type="button" data-modal-select-adventurer="${esc(hero.id)}">Select ${esc(hero.name)}</button>`);
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
      if (state.step === 1 && state.adventureId) {
        try { await loadClasses(); changeStep(2); } catch (error) { setStatus(`Classes could not load: ${error.message}`, 'error'); }
      } else if (state.step === 3 && state.adventurerId) {
        window.DNDModal.alert({ type:'info', title:'Selection Complete', message:`${state.selectedAdventurer.name} is selected. Roll Your Fortune is the next development stage.`, confirmText:'Close' });
      }
    });

    $('.creator-progress').addEventListener('click', event => {
      const button = event.target.closest('[data-step-button]');
      if (button && !button.disabled) changeStep(Number(button.dataset.stepButton));
    });

    $('#class-grid').addEventListener('click', async event => {
      const button = event.target.closest('[data-select-class]');
      if (!button) return;
      try { await selectClassAndContinue(button.dataset.selectClass); }
      catch (error) { setStatus(`Class data could not load: ${error.message}`, 'error'); }
    });

    $('#adventurer-grid').addEventListener('click', event => {
      const preview = event.target.closest('[data-preview-adventurer]');
      const select = event.target.closest('[data-select-adventurer]');
      if (preview) previewAdventurer(preview.dataset.previewAdventurer);
      else if (select) selectAdventurer(select.dataset.selectAdventurer);
    });

    $('#preview-close').addEventListener('click', closePreview);
    $('#creator-preview').addEventListener('click', event => {
      if (event.target.id === 'creator-preview') { closePreview(); return; }
      const select = event.target.closest('[data-modal-select-adventurer]');
      if (select) { selectAdventurer(select.dataset.modalSelectAdventurer); closePreview(); }
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#creator-preview').hidden) closePreview(); });
  }

  async function initialize() {
    restoreDraft();
    bindEvents();
    if (state.adventureId === 'viking') $('.adventure-choice.selectable').classList.add('selected');
    try {
      if (state.adventureId) await loadClasses();
      if (state.classId) {
        state.selectedClass = state.classes.find(item => item.id === state.classId) || null;
        if (state.selectedClass) {
          state.adventurers = await loadAdventurers(state.selectedClass);
          state.selectedAdventurer = state.adventurers.find(item => item.id === state.adventurerId) || null;
          renderAdventurers();
        }
      }
      renderClasses();
      changeStep(state.step);
    } catch (error) {
      state.step = 1;
      setStatus(`Saved selections could not be restored: ${error.message}`, 'error');
      changeStep(1);
    }
  }

  window.addEventListener('dnd:navigation-ready', initialize, { once:true });
})();
