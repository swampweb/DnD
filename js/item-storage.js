(() => {
  const $ = selector => document.querySelector(selector);
  const characterId = new URLSearchParams(location.search).get('id');
  let inventory = [];
  let storage = [];
  let activeBackpack = null;
  let draggedRow = null;
  let rotated = false;
  let owner = false;

  const inventoryRow = inventoryId => inventory.find(row => row.id === inventoryId);
  const storageRow = inventoryId => storage.find(row => row.inventory_id === inventoryId);

  async function load() {
    const session = (await window.DND.client.auth.getSession()).data?.session;
    const [characterResult, inventoryResult, storageResult, activeResult] = await Promise.all([
      window.DND.client.from('characters').select('user_id').eq('id', characterId).maybeSingle(),
      window.DND.client.from('inventory').select('id,quantity,items(*)').eq('character_id', characterId),
      window.DND.client.from('character_item_storage').select('*').eq('character_id', characterId),
      window.DND.client.from('character_storage_config').select('*').eq('character_id', characterId).maybeSingle()
    ]);

    owner = characterResult.data?.user_id === session?.user?.id;
    inventory = inventoryResult.data || [];
    storage = storageResult.data || [];
    activeBackpack = activeResult.data || {};

    if (owner) {
      await window.DND.client.rpc('ensure_character_storage_rows', { p_character_id: characterId });
      const refreshed = await window.DND.client
        .from('character_item_storage')
        .select('*')
        .eq('character_id', characterId);
      storage = refreshed.data || storage;
    }

    render();
    window.dispatchEvent(new CustomEvent('dnd:storage-updated'));
  }

  function ensureActiveBackpackPanel() {
    if ($('#active-backpack-slot')) return;
    const grid = $('#backpack-grid');
    if (!grid) return;
    grid.closest('.backpack-area')?.insertAdjacentHTML('afterbegin', `
      <div class="active-backpack">
        <div class="active-backpack-copy">
          <h3>Active Backpack</h3>
          <p>Drag a Backpack Item here to open its storage grid.</p>
        </div>
        <div id="active-backpack-slot" class="active-backpack-slot">
          <span>No active Backpack</span>
        </div>
      </div>`);
  }

  function renderPocketSlot(slotNumber) {
    const slot = $(`[data-pocket-slot="${slotNumber}"]`);
    const placement = storage.find(row => row.location === 'pocket' && row.pocket_slot === slotNumber);
    const row = placement ? inventoryRow(placement.inventory_id) : null;

    slot.className = `pocket-slot item-system-slot ${row ? 'filled' : ''}`;
    slot.draggable = Boolean(row && owner);
    slot.dataset.storageInventory = row?.id || '';
    slot.dataset.itemId = row?.items?.id || '';
    slot.title = row?.items?.name || `Pocket ${slotNumber}`;

    slot.innerHTML = row
      ? `${row.items.image_url ? `<img src="${row.items.image_url}" alt="${row.items.name}" draggable="false">` : '<span class="pocket-placeholder">◇</span>'}
         <strong>${row.items.name}</strong>
         <small>Pocket ${slotNumber}</small>`
      : `<span class="pocket-label">Pocket ${slotNumber}</span>`;
  }

  function render() {
    ensureActiveBackpackPanel();
    const activeRow = inventoryRow(activeBackpack?.active_backpack_inventory_id);
    const activeSlot = $('#active-backpack-slot');

    activeSlot.innerHTML = activeRow
      ? `${activeRow.items.image_url ? `<img src="${activeRow.items.image_url}" alt="${activeRow.items.name}" draggable="false">` : ''}
         <div><strong>${activeRow.items.name}</strong><small>${activeRow.items.backpack_columns} × ${activeRow.items.backpack_rows} • ${activeRow.items.backpack_columns * activeRow.items.backpack_rows} cells</small></div>
         <button type="button" id="clear-active-backpack" ${owner ? '' : 'hidden'}>Remove</button>`
      : '<span>No active Backpack</span>';

    $('#clear-active-backpack')?.addEventListener('click', () => rpc('clear_character_active_backpack', {
      p_character_id: characterId
    }));

    for (let slot = 1; slot <= 4; slot += 1) renderPocketSlot(slot);

    const grid = $('#backpack-grid');
    if (!activeRow) {
      grid.innerHTML = '<p class="storage-empty">Select an active Backpack to unlock grid storage.</p>';
      grid.style.removeProperty('--cols');
      grid.style.removeProperty('--rows');
      return;
    }

    const columns = activeRow.items.backpack_columns;
    const rows = activeRow.items.backpack_rows;
    grid.style.setProperty('--cols', columns);
    grid.style.setProperty('--rows', rows);
    grid.innerHTML = Array.from({ length: columns * rows }, (_, index) =>
      `<div class="backpack-cell" data-x="${index % columns}" data-y="${Math.floor(index / columns)}"></div>`
    ).join('');

    storage.filter(row => row.location === 'backpack').forEach(placement => {
      const row = inventoryRow(placement.inventory_id);
      if (!row) return;
      const width = placement.rotated ? row.items.grid_height : row.items.grid_width;
      const height = placement.rotated ? row.items.grid_width : row.items.grid_height;
      grid.insertAdjacentHTML('beforeend', `
        <button class="backpack-item" draggable="${owner}" data-storage-inventory="${row.id}"
          style="--x:${placement.grid_x};--y:${placement.grid_y};--w:${width};--h:${height}">
          ${row.items.image_url ? `<img src="${row.items.image_url}" alt="${row.items.name}" draggable="false">` : ''}
          <strong>${row.items.name}</strong><small>${width} × ${height}</small>
        </button>`);
    });
  }

  function startDrag(event) {
    const inventoryItem = event.target.closest('[data-inventory-id]');
    const storedItem = event.target.closest('[data-storage-inventory]');
    const inventoryId = inventoryItem?.dataset.inventoryId || storedItem?.dataset.storageInventory;
    if (!inventoryId || !owner) return;

    draggedRow = inventoryRow(inventoryId);
    if (!draggedRow) return;

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', inventoryId);
    rotated = Boolean(storageRow(inventoryId)?.rotated);
    document.body.classList.add('storage-dragging');
    $('#active-backpack-slot').classList.toggle('valid-storage-drop', Boolean(draggedRow.items.is_backpack));
    document.querySelectorAll('[data-pocket-slot]').forEach(slot =>
      slot.classList.toggle('valid-storage-drop', Boolean(draggedRow.items.pocket_eligible))
    );
  }

  function endDrag() {
    draggedRow = null;
    document.body.classList.remove('storage-dragging');
    document.querySelectorAll('.valid-storage-drop,.storage-over').forEach(element =>
      element.classList.remove('valid-storage-drop', 'storage-over')
    );
  }

  async function rpc(name, args) {
    const { error } = await window.DND.client.rpc(name, args);
    if (error) return window.DND.toast(error.message, 'error');
    await load();
  }

  function bind() {
    document.addEventListener('dragstart', startDrag, true);
    document.addEventListener('dragend', endDrag, true);
    document.addEventListener('keydown', event => {
      if (event.key.toLowerCase() === 'r' && draggedRow?.items.can_rotate) {
        rotated = !rotated;
        window.DND.toast(`Rotation ${rotated ? 'on' : 'off'}.`, 'success');
      }
    });

    $('#active-backpack-slot').ondragover = event => {
      if (draggedRow?.items.is_backpack) event.preventDefault();
    };
    $('#active-backpack-slot').ondrop = event => {
      if (!draggedRow?.items.is_backpack) return;
      event.preventDefault();
      rpc('set_character_active_backpack', {
        p_character_id: characterId,
        p_inventory_id: draggedRow.id
      });
    };

    document.querySelectorAll('[data-pocket-slot]').forEach(slot => {
      slot.ondragover = event => {
        if (draggedRow?.items.pocket_eligible) {
          event.preventDefault();
          slot.classList.add('storage-over');
        }
      };
      slot.ondragleave = () => slot.classList.remove('storage-over');
      slot.ondrop = event => {
        if (!draggedRow?.items.pocket_eligible) return;
        event.preventDefault();
        rpc('storage_move_to_pocket', {
          p_character_id: characterId,
          p_inventory_id: draggedRow.id,
          p_pocket_slot: Number(slot.dataset.pocketSlot)
        });
      };
    });

    $('#backpack-grid').ondragover = event => {
      if (draggedRow && activeBackpack?.active_backpack_inventory_id) event.preventDefault();
    };
    $('#backpack-grid').ondrop = event => {
      const cell = event.target.closest('[data-x]');
      if (!cell || !draggedRow) return;
      event.preventDefault();
      rpc('storage_move_to_backpack', {
        p_character_id: characterId,
        p_inventory_id: draggedRow.id,
        p_grid_x: Number(cell.dataset.x),
        p_grid_y: Number(cell.dataset.y),
        p_rotated: rotated
      });
    };

    $('#inventory-grid').ondragover = event => {
      if (draggedRow) event.preventDefault();
    };
    $('#inventory-grid').ondrop = event => {
      if (!draggedRow) return;
      event.preventDefault();
      rpc('storage_move_to_inventory', {
        p_character_id: characterId,
        p_inventory_id: draggedRow.id
      });
    };
  }

  window.addEventListener('dnd:navigation-ready', () => {
    const wait = setInterval(() => {
      if ($('#character-sheet') && !$('#character-sheet').hidden && $('#backpack-grid')) {
        clearInterval(wait);
        ensureActiveBackpackPanel();
        bind();
        load();
      }
    }, 100);
  }, { once: true });
})();
