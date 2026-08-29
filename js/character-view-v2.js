let inventoryRows = [];
const characterId = new URLSearchParams(location.search).get('id');
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');
const equipmentSlots = ['Head','Neck','Chest','Hands','Legs','Feet','Main Hand','Off Hand','Ring 1','Ring 2','Artifact'];

function renderInventory(filter = 'all') {
  const rows = filter === 'all'
    ? inventoryRows
    : inventoryRows.filter(row => (row.items?.item_type || '').toLowerCase().includes(filter));

  $('#inventory-count').textContent = `${inventoryRows.length} Item${inventoryRows.length === 1 ? '' : 's'}`;
  $('#inventory-grid').innerHTML = rows.length
    ? rows.map(row => `<button class="inventory-slot-v2" type="button" data-item-index="${inventoryRows.indexOf(row)}">${row.items?.image_url ? `<img src="${esc(row.items.image_url)}" alt="${esc(row.items.name)}">` : '◇'}<b>${row.quantity || 1}</b></button>`).join('')
    : '<div class="inventory-empty-v2">No items in this category.</div>';
}

function showItem(row) {
  const item = row.items || {};
  $('#item-detail').innerHTML = `${item.image_url ? `<img src="${esc(item.image_url)}" alt="${esc(item.name)}">` : ''}<h3>${esc(item.name || 'Item')}</h3><p>${esc(item.rarity || 'Common')} • ${esc(item.item_type || 'Item')}</p><p>${esc(item.description || 'No item description.')}</p><p>Quantity: ${row.quantity || 1}</p>`;
}

window.addEventListener('dnd:navigation-ready', async event => {
  const { session, platformRole, isAdmin, canManage } = event.detail;

  if (!characterId) {
    location.href = 'index.html';
    return;
  }

  /*
    IMPORTANT:
    Do not filter the character query by the signed-in user's ID.
    RLS decides whether the viewer may read the requested character.
  */
  const { data: character, error: characterError } = await window.DND.client
    .from('characters')
    .select('*')
    .eq('id', characterId)
    .maybeSingle();

  if (characterError) {
    $('#sheet-loading').textContent = characterError.message;
    return;
  }

  if (!character) {
    $('#sheet-loading').textContent = 'Character not found or you do not have permission to view this Character Sheet.';
    return;
  }

  const isOwner = character.user_id === session.user.id;
  const isManagementViewer = Boolean(isAdmin || canManage || platformRole === 'admin' || platformRole === 'manager');

  if (!isOwner && !isManagementViewer) {
    $('#sheet-loading').textContent = 'You do not have permission to view this Character Sheet.';
    return;
  }

  const set = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? '—';
  };

  $('#sheet-portrait').src = character.portrait_url || '../../assets/images/shared/character-placeholder.png';
  set('sheet-name', character.name);
  set('sheet-race', character.race || 'Adventurer');
  set('sheet-class', character.class || 'Class');
  set('sheet-status', character.status || 'Active');
  set('sheet-level', character.level || 1);
  set('sheet-xp', character.experience || 0);
  set('sheet-next-xp', character.experience_to_next || 1000);
  set('sheet-background', character.background || 'No background has been added.');
  set('sheet-hp', `${character.current_hp ?? 0} / ${character.max_hp ?? 0}`);
  set('sheet-mana', `${character.current_mana ?? 0} / ${character.max_mana ?? 0}`);
  set('sheet-gold', character.gold ?? 0);
  set('sheet-silver', character.silver ?? 0);
  set('sheet-copper', character.copper ?? 0);
  set('sheet-biography', character.biography || 'No biography has been added.');

  $('#xp-meter').style.width = `${Math.min(100, Math.round(((character.experience || 0) / (character.experience_to_next || 1000)) * 100))}%`;

  const attributes = [
    ['STR','Strength',character.strength],
    ['DEX','Dexterity',character.dexterity],
    ['CON','Constitution',character.constitution],
    ['INT','Intelligence',character.intelligence],
    ['WIS','Wisdom',character.wisdom],
    ['CHA','Charisma',character.charisma]
  ];

  $('#attribute-list').innerHTML = attributes
    .map(([abbr, name, value]) => `<div class="sheet-attribute"><span>${abbr}</span><strong>${value ?? 0}</strong><small>${name}</small></div>`)
    .join('');

  $('#equipment-grid').innerHTML = equipmentSlots
    .map(slot => `<div class="equipment-slot-v2">${slot}</div>`)
    .join('');

  const { data: inventory, error: inventoryError } = await window.DND.client
    .from('inventory')
    .select('id,quantity,items(id,name,rarity,item_type,image_url,description)')
    .eq('character_id', characterId);

  inventoryRows = inventoryError ? [] : (inventory || []);
  renderInventory();

  $('#inventory-grid').addEventListener('click', click => {
    const button = click.target.closest('[data-item-index]');
    if (button) showItem(inventoryRows[Number(button.dataset.itemIndex)]);
  });

  document.querySelector('.inventory-filters')?.addEventListener('click', click => {
    const button = click.target.closest('[data-filter]');
    if (!button) return;
    document.querySelectorAll('[data-filter]').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    renderInventory(button.dataset.filter);
  });

  const editLink = $('#edit-character');
  const deleteButton = $('#delete-character');

  if (isOwner) {
    editLink.href = `edit.html?id=${encodeURIComponent(characterId)}`;
  } else {
    /* Management may inspect the sheet, but profile editing remains owner-only. */
    editLink.hidden = true;
    deleteButton.hidden = true;
  }

  deleteButton?.addEventListener('click', async () => {
    if (!isOwner) return;
    const confirmed = await window.DNDModal.confirm({
      type: 'danger',
      kicker: 'Character Management',
      title: 'Delete Character',
      message: `Delete ${character.name}? This cannot be undone.`,
      confirmText: 'Delete Character',
      cancelText: 'Keep Character',
      focusCancel: true
    });
    if (!confirmed) return;

    const { error: deleteError } = await window.DND.client
      .from('characters')
      .delete()
      .eq('id', characterId)
      .eq('user_id', session.user.id);

    if (deleteError) {
      window.DND.toast(deleteError.message, 'error');
      return;
    }
    location.href = 'index.html';
  });

  $('#sheet-loading').hidden = true;
  $('#character-sheet').hidden = false;
});
