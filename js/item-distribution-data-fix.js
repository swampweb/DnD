(() => {
  const $ = selector => document.querySelector(selector);
  let characterTemplates = [];

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean).map(value => String(value).trim()).filter(Boolean))]
      .sort((a,b) => a.localeCompare(b));
  }

  function option(value, selected = '') {
    const safe = String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    return `<option value="${safe}" ${value === selected ? 'selected' : ''}>${safe}</option>`;
  }

  async function loadCharacterTemplates() {
    const { data, error } = await window.DND.client
      .from('characters')
      .select('class,race');
    if (error) throw error;
    characterTemplates = data || [];
  }

  function populateClasses(selected = '') {
    const control = $('#distribution-class');
    if (!control) return;
    const classes = uniqueSorted(characterTemplates.map(row => row.class));
    control.innerHTML = '<option value="">Select a Class</option>' + classes.map(value => option(value, selected)).join('');
  }

  function populateAdventurers(className, selected = '') {
    const control = $('#distribution-adventurer');
    if (!control) return;
    const names = uniqueSorted(characterTemplates
      .filter(row => !className || row.class === className)
      .map(row => row.race));
    control.innerHTML = '<option value="">Select an Adventurer</option>' + names.map(value => option(value, selected)).join('');
  }

  function updateVisibility() {
    const type = $('#distribution-type')?.value || 'none';
    const classField = $('#class-scope-field');
    const adventurerField = $('#adventurer-scope-field');
    if (classField) classField.hidden = !['class','adventurer'].includes(type);
    if (adventurerField) adventurerField.hidden = type !== 'adventurer';
  }

  async function initialize() {
    try {
      await loadCharacterTemplates();
      populateClasses($('#distribution-class')?.value || '');
      populateAdventurers($('#distribution-class')?.value || '', $('#distribution-adventurer')?.value || '');
      updateVisibility();
    } catch (error) {
      console.error('Distribution Character options could not load:', error);
      window.DND.toast(`Character options could not load: ${error.message}`, 'error');
    }

    $('#distribution-type')?.addEventListener('change', updateVisibility);
    $('#distribution-class')?.addEventListener('change', event => populateAdventurers(event.target.value));

    const selectedName = $('#selected-item-name');
    if (selectedName) {
      new MutationObserver(() => {
        setTimeout(() => {
          populateClasses($('#distribution-class')?.value || '');
          populateAdventurers($('#distribution-class')?.value || '', $('#distribution-adventurer')?.value || '');
          updateVisibility();
        }, 0);
      }).observe(selectedName, {childList:true,subtree:true,characterData:true});
    }
  }

  window.addEventListener('dnd:navigation-ready', event => {
    if (!event.detail.isAdmin) return;
    setTimeout(initialize, 100);
  }, {once:true});
})();
