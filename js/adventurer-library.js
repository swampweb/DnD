(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const siteUrl = path => window.DND?.siteUrl ? window.DND.siteUrl(path) : `/${String(path).replace(/^\//,'')}`;
  let classes = [];
  let adventurers = [];

  async function fetchJson(path) {
    const response = await fetch(encodeURI(siteUrl(path)), { cache:'no-cache' });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return response.json();
  }

  function fullAssetPath(item, file) {
    return file ? siteUrl(`assets/classes/viking/${item.classId}/${item.folder}/${file}`) : '';
  }

  async function loadLibrary() {
    const manifest = await fetchJson('assets/classes/viking/classes.json');
    classes = [];
    adventurers = [];

    for (const classId of manifest.classes || []) {
      const classData = await fetchJson(`assets/classes/viking/${classId}/class.json`);
      classes.push(classData);
      for (const folder of classData.heroes || []) {
        try {
          const hero = await fetchJson(`assets/classes/viking/${classId}/${folder}/${folder}.json`);
          adventurers.push({...hero,classId,className:classData.name || classId,classRole:classData.role || '',folder});
        } catch (error) {
          console.error(error);
        }
      }
    }

    $('#library-class').innerHTML = '<option value="all">All Classes</option>' + classes.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
    renderLibrary();
  }

  function filteredAdventurers() {
    const classId = $('#library-class').value;
    const search = $('#library-search').value.trim().toLowerCase();
    return adventurers.filter(item => {
      const classMatch = classId === 'all' || item.classId === classId;
      const text = [item.name,item.className,item.role,item.theme,item.specialization].join(' ').toLowerCase();
      return classMatch && (!search || text.includes(search));
    });
  }

  function renderLibrary() {
    const rows = filteredAdventurers();
    $('#library-count').textContent = rows.length;
    $('#library-status').textContent = rows.length ? `${rows.length} Adventurer${rows.length === 1 ? '' : 's'} available to browse.` : 'No Adventurers match the selected filters.';

    const byClass = rows.reduce((map,item) => {
      if (!map.has(item.className)) map.set(item.className,[]);
      map.get(item.className).push(item);
      return map;
    }, new Map());

    $('#library-results').innerHTML = rows.length ? [...byClass.entries()].map(([className,items]) => `
      <section class="library-class-section">
        <header><div><p>Class</p><h2>${esc(className)}</h2></div><span>${items.length} Adventurer${items.length === 1 ? '' : 's'}</span></header>
        <div class="library-card-grid">${items.map(item => {
          const preview = fullAssetPath(item,item.assets?.previewCard);
          const difficulty = Math.max(1,Math.min(5,Number(item.difficulty)||1));
          return `<article class="library-card">
            <button type="button" data-library-preview="${esc(item.classId)}|${esc(item.folder)}">
              <span class="library-card-art">${preview ? `<img src="${esc(preview)}" alt="${esc(item.name)} preview card">` : '<em>No Preview Card</em>'}</span>
              <span class="library-card-copy"><span><small>${esc(item.className)}</small><strong>${esc(item.name)}</strong><em>${esc(item.role || item.classRole || 'Adventurer')}</em></span><b aria-label="Difficulty">${'★'.repeat(difficulty)}${'☆'.repeat(5-difficulty)}</b></span>
            </button>
          </article>`;
        }).join('')}</div>
      </section>`).join('') : '<div class="library-empty">No Adventurers match the selected filters.</div>';
  }

  async function loadDefaults(item) {
    const base = item.baseAttributes || {};
    const fallback = {strength:base.str||0,dexterity:base.dex||0,constitution:base.con||0,intelligence:base.int||0,wisdom:base.wis||0,charisma:base.cha||0,source:'JSON Defaults'};
    const {data,error} = await window.DND.client.from('character_creation_defaults')
      .select('strength,dexterity,constitution,intelligence,wisdom,charisma')
      .eq('adventure_id','viking').eq('class_id',item.classId).eq('adventurer_id',item.id).maybeSingle();
    return !error && data ? {...data,source:'Admin-managed Defaults'} : fallback;
  }

  function listRows(item,rows,type) {
    return (rows || []).map(row => `<li>${row.icon ? `<img src="${esc(fullAssetPath(item,row.icon))}" alt="">` : ''}<span><strong>${esc(row.name || row.id)}</strong><small>${type === 'ability' ? esc(row.description || 'No description available.') : `Quantity: ${Number(row.quantity)||1}`}</small></span></li>`).join('');
  }

  async function openPreview(classId,folder) {
    const item = adventurers.find(row => row.classId === classId && row.folder === folder);
    if (!item) return;
    const defaults = await loadDefaults(item);
    const model = fullAssetPath(item,item.assets?.model);
    const attrs = [['STR',defaults.strength],['DEX',defaults.dexterity],['CON',defaults.constitution],['INT',defaults.intelligence],['WIS',defaults.wisdom],['CHA',defaults.charisma]];
    $('#library-preview-content').innerHTML = `
      <div class="library-preview-layout">
        <div class="library-preview-model">${model ? `<img src="${esc(model)}" alt="${esc(item.name)} model render">` : '<span>No Model Render</span>'}</div>
        <div class="library-preview-details">
          <p class="library-kicker">Adventurer Details</p>
          <h2 id="library-preview-title">${esc(item.name)}</h2>
          <h3>${esc(item.className)} • ${esc(item.role || item.classRole || 'Adventurer')}</h3>
          <div class="library-stars">${'★'.repeat(Math.max(1,Math.min(5,Number(item.difficulty)||1)))}${'☆'.repeat(5-Math.max(1,Math.min(5,Number(item.difficulty)||1)))}</div>
          <p class="library-theme">${esc(item.theme || 'No Adventurer description is available.')}</p>
          <div class="library-attribute-heading"><h3>Base Attributes</h3><span>${esc(defaults.source)}</span></div>
          <div class="library-attributes">${attrs.map(([key,value]) => `<div><span>${key}</span><strong>${Number(value)||0}</strong></div>`).join('')}</div>
        </div>
      </div>
      <div class="library-preview-columns">
        <section><h3>Starter Abilities</h3><ul>${listRows(item,item.starterAbilities,'ability') || '<li class="empty">No starter Abilities listed.</li>'}</ul></section>
        <section><h3>Starter Equipment</h3><ul>${listRows(item,item.starterEquipment,'equipment') || '<li class="empty">No starter Equipment listed.</li>'}</ul></section>
      </div>
      <div class="library-preview-actions"><a href="../characters/create.html">Create a Character</a></div>`;
    $('#library-preview').hidden = false;
  }

  function closePreview() { $('#library-preview').hidden = true; }

  window.addEventListener('dnd:navigation-ready', async event => {
    if (!event.detail.session) { $('#library-access').hidden = false; return; }
    $('#library-main').hidden = false;
    try { await loadLibrary(); }
    catch (error) { $('#library-status').textContent = `Adventurer Library could not load: ${error.message}`; }

    $('#library-class').addEventListener('change',renderLibrary);
    $('#library-search').addEventListener('input',renderLibrary);
    $('#library-clear').addEventListener('click',() => { $('#library-class').value='all'; $('#library-search').value=''; renderLibrary(); });
    $('#library-results').addEventListener('click',event => {
      const button = event.target.closest('[data-library-preview]');
      if (!button) return;
      const [classId,folder] = button.dataset.libraryPreview.split('|');
      openPreview(classId,folder);
    });
    $('#library-preview-close').addEventListener('click',closePreview);
    $('#library-preview').addEventListener('click',event => { if (event.target.id === 'library-preview') closePreview(); });
    document.addEventListener('keydown',event => { if (event.key === 'Escape') closePreview(); });
  });
})();
