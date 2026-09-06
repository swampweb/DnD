(() => {
  const $ = selector => document.querySelector(selector);
  const ADVENTURES = [
    { id:'viking', name:'Viking Adventure', available:true },
    { id:'cajun', name:'Cajun Adventure', available:false },
    { id:'fantasy', name:'Fantasy Adventure', available:false }
  ];
  let catalog = new Map();
  let selectedItemId = null;

  const siteUrl = path => window.DND?.siteUrl ? window.DND.siteUrl(path) : `/${String(path).replace(/^\//,'')}`;
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  async function fetchJson(path) {
    const response = await fetch(encodeURI(siteUrl(path)), { cache:'no-cache' });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return response.json();
  }

  async function loadAdventure(adventure) {
    if (!adventure.available) return { adventure, classes:[] };
    const manifest = await fetchJson(`assets/classes/${adventure.id}/classes.json`);
    const classes = [];
    for (const classId of manifest.classes || []) {
      const classData = await fetchJson(`assets/classes/${adventure.id}/${classId}/class.json`);
      const adventurers = [];
      for (const heroId of classData.heroes || []) {
        try {
          const hero = await fetchJson(`assets/classes/${adventure.id}/${classId}/${heroId}/${heroId}.json`);
          adventurers.push({ id:heroId, name:hero.name || heroId });
        } catch {
          adventurers.push({ id:heroId, name:heroId });
        }
      }
      classes.push({ id:classId, name:classData.name || classId, adventurers });
    }
    return { adventure, classes };
  }

  async function buildCatalog() {
    catalog = new Map();
    for (const adventure of ADVENTURES) {
      try { catalog.set(adventure.id, await loadAdventure(adventure)); }
      catch (error) {
        console.error(`Could not load ${adventure.name}:`, error);
        catalog.set(adventure.id, { adventure:{...adventure,available:false}, classes:[] });
      }
    }
  }

  function installFields() {
    if ($('#adventure-scope-field')) return;
    const typeField = $('#distribution-type')?.closest('label');
    if (!typeField) return;
    typeField.insertAdjacentHTML('afterend', `
      <label id="adventure-scope-field" hidden>Adventure
        <select id="distribution-adventure">
          ${ADVENTURES.map(a => `<option value="${a.id}" ${a.available?'':'disabled'}>${esc(a.name)}${a.available?'':' (Coming Soon)'}</option>`).join('')}
        </select>
      </label>`);
    const select = $('#distribution-type');
    if (select && !select.querySelector('option[value="adventure"]')) {
      const classOption = select.querySelector('option[value="class"]');
      classOption?.insertAdjacentHTML('beforebegin','<option value="adventure">Specific Adventure</option>');
    }
  }

  function fillClasses(selected='') {
    const adventureId = $('#distribution-adventure')?.value || 'viking';
    const rows = catalog.get(adventureId)?.classes || [];
    const control = $('#distribution-class');
    if (!control) return;
    control.innerHTML = '<option value="">Select a Class</option>' + rows.map(row => `<option value="${esc(row.name)}" data-class-id="${esc(row.id)}" ${row.name===selected?'selected':''}>${esc(row.name)}</option>`).join('');
  }

  function fillAdventurers(selected='') {
    const adventureId = $('#distribution-adventure')?.value || 'viking';
    const className = $('#distribution-class')?.value || '';
    const classData = (catalog.get(adventureId)?.classes || []).find(row => row.name === className);
    const control = $('#distribution-adventurer');
    if (!control) return;
    control.innerHTML = '<option value="">Select an Adventurer</option>' + (classData?.adventurers || []).map(row => `<option value="${esc(row.name)}" ${row.name===selected?'selected':''}>${esc(row.name)}</option>`).join('');
  }

  function updateVisibility() {
    const type = $('#distribution-type')?.value || 'none';
    $('#adventure-scope-field').hidden = !['adventure','class','adventurer'].includes(type);
    $('#class-scope-field').hidden = !['class','adventurer'].includes(type);
    $('#adventurer-scope-field').hidden = type !== 'adventurer';
    const notice = $('#rule-notice');
    if (!notice) return;
    notice.textContent = {
      none:'This Item remains Catalog-only and appears only when an Admin gifts it.',
      global:'Saving grants this Item to every existing Character and automatically to every new Character.',
      adventure:'Saving grants this Item to existing and future Characters in the selected Adventure.',
      class:'Saving grants this Item to existing and future Characters matching the selected Adventure and Class.',
      adventurer:'Saving grants this Item to existing and future Characters matching the selected Adventure, Class, and Adventurer.'
    }[type];
  }

  async function getRule(itemId) {
    if (!itemId) return null;
    const { data } = await window.DND.client.from('item_distributions').select('*').eq('item_id',itemId).eq('active',true).maybeSingle();
    return data || null;
  }

  async function restoreRule(itemId) {
    const rule = await getRule(itemId);
    const adventureId = rule?.adventure_id || 'viking';
    $('#distribution-type').value = rule?.distribution_type || 'none';
    $('#distribution-adventure').value = ADVENTURES.some(a=>a.id===adventureId) ? adventureId : 'viking';
    fillClasses(rule?.class_name || '');
    fillAdventurers(rule?.adventurer_name || '');
    $('#distribution-quantity').value = rule?.quantity || 1;
    updateVisibility();
  }

  async function saveRule(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!selectedItemId) return;
    const type = $('#distribution-type').value;
    if (type === 'none') return;
    const adventureId = $('#distribution-adventure').value || null;
    const adventureName = ADVENTURES.find(a=>a.id===adventureId)?.name || null;
    const className = $('#distribution-class').value || null;
    const adventurerName = $('#distribution-adventurer').value || null;
    if (['adventure','class','adventurer'].includes(type) && !adventureId) return window.DND.toast('Select an Adventure.','error');
    if (['class','adventurer'].includes(type) && !className) return window.DND.toast('Select a Class.','error');
    if (type === 'adventurer' && !adventurerName) return window.DND.toast('Select an Adventurer.','error');
    const { data, error } = await window.DND.client.rpc('admin_set_item_distribution_v2', {
      p_item_id:selectedItemId,
      p_distribution_type:type,
      p_adventure_id:adventureId,
      p_adventure_name:adventureName,
      p_class_name:className,
      p_adventurer_name:adventurerName,
      p_quantity:Math.max(1,Number($('#distribution-quantity').value)||1)
    });
    if (error) return window.DND.toast(error.message,'error');
    window.DND.toast(`Distribution saved. ${data?.granted || 0} Character Inventories updated.`,'success');
    location.reload();
  }

  function monitorSelection() {
    $('#distribution-item-list')?.addEventListener('click', event => {
      const button = event.target.closest('[data-item-id]');
      if (!button) return;
      selectedItemId = button.dataset.itemId;
      setTimeout(() => restoreRule(selectedItemId), 100);
    }, true);
  }

  window.addEventListener('dnd:navigation-ready', async event => {
    if (!event.detail.isAdmin) return;
    installFields();
    await buildCatalog();
    fillClasses();
    fillAdventurers();
    updateVisibility();
    $('#distribution-type')?.addEventListener('change', updateVisibility, true);
    $('#distribution-adventure')?.addEventListener('change', () => { fillClasses(); fillAdventurers(); }, true);
    $('#distribution-class')?.addEventListener('change', () => fillAdventurers(), true);
    $('#distribution-rule-form')?.addEventListener('submit', saveRule, true);
    monitorSelection();
  }, {once:true});
})();
