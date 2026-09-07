(() => {
  const q = selector => document.querySelector(selector);
  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  const characterId = new URLSearchParams(location.search).get('id');
  const slots = ['Head','Neck','Chest','Hands','Legs','Feet','Main Hand','Off Hand','Ring 1','Ring 2','Artifact','Backpack'];
  const cols = {
    'Head':'head_item_id',
    'Neck':'neck_item_id',
    'Chest':'chest_item_id',
    'Hands':'hands_item_id',
    'Legs':'legs_item_id',
    'Feet':'feet_item_id',
    'Main Hand':'main_hand_item_id',
    'Off Hand':'off_hand_item_id',
    'Ring 1':'ring_1_item_id',
    'Ring 2':'ring_2_item_id',
    'Artifact':'artifact_item_id',
    'Backpack':'backpack_item_id'
  };

  let character;
  let owner = false;
  let inventory = [];
  let equipment = {};
  let dragged = null;
  let activeFilter = 'all';

  const site = path => window.DND?.siteUrl
    ? window.DND.siteUrl(path)
    : `/${path.replace(/^\//, '')}`;

  function infer(name = '') {
    const value = name.toLowerCase();
    if (/tonic|elixir|draught|flask|vial/.test(value)) return {type:'Consumable',slot:null,allowed:[]};
    if (/armor|robe|leather|harness|garment|warplate/.test(value)) return {type:'Armor',slot:'Chest',allowed:['Chest']};
    if (/cloak|mantle/.test(value)) return {type:'Armor',slot:'Neck',allowed:['Neck']};
    if (/shield/.test(value)) return {type:'Weapon',slot:'Off Hand',allowed:['Off Hand']};
    if (/ring/.test(value)) return {type:'Armor',slot:'Ring 1',allowed:['Ring 1','Ring 2']};
    if (/staff|axe|spear|bow|blade|seax|knife|harp|drum|crook/.test(value)) return {type:'Weapon',slot:'Main Hand',allowed:['Main Hand','Off Hand']};
    if (/sigil|core|totem|prism|reliquary/.test(value)) return {type:'Quest',slot:'Artifact',allowed:['Artifact']};
    return {type:'Quest',slot:null,allowed:[]};
  }

  async function fetchJson(path) {
    const response = await fetch(encodeURI(site(path)), {cache:'no-cache'});
    if (!response.ok) throw new Error(path);
    return response.json();
  }

  async function syncStarter() {
    if (!owner) return;
    try {
      const manifest = await fetchJson('assets/classes/viking/classes.json');
      let found;
      for (const classId of manifest.classes || []) {
        const classData = await fetchJson(`assets/classes/viking/${classId}/class.json`);
        for (const heroId of classData.heroes || []) {
          const heroData = await fetchJson(`assets/classes/viking/${classId}/${heroId}/${heroId}.json`);
          if ((heroData.name || '').toLowerCase() === (character.race || '').toLowerCase() ||
              heroId === String(character.race || '').toLowerCase().replaceAll(' ', '-')) {
            found = {classData, heroData, heroId};
            break;
          }
        }
        if (found) break;
      }
      if (!found) return;

      const rows = (found.heroData.starterEquipment || []).map(item => {
        const inferred = infer(item.name);
        return {
          id: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          item_type: inferred.type,
          equip_slot: item.equipSlot || inferred.slot,
          allowed_slots: item.allowedSlots || inferred.allowed,
          image_url: site(`assets/classes/viking/${found.classData.id}/${found.heroId}/${item.icon}`),
          description: item.description || '',
          notes: item.notes || '',
          stackable: inferred.type === 'Consumable',
          max_stack: inferred.type === 'Consumable' ? 99 : 1
        };
      });

      await window.DND.client.rpc('sync_character_starter_items', {
        p_character_id: characterId,
        p_items: rows
      });
    } catch (error) {
      console.warn('Starter item sync skipped', error);
    }
  }

  async function load() {
    const {data: sessionData, error: sessionError} = await window.DND.client.auth.getSession();
    if (sessionError) console.error('Character inventory session check failed:', sessionError);
    const session = sessionData?.session || null;
    window.DND.session = session;

    const [
      {data: characterData},
      {data: inventoryData, error: inventoryError},
      {data: equipmentData},
      {data: activeBackpackData}
    ] = await Promise.all([
      window.DND.client.from('characters').select('*').eq('id', characterId).maybeSingle(),
      window.DND.client.from('inventory').select('id,quantity,items(*)').eq('character_id', characterId),
      window.DND.client.from('character_equipment').select('*').eq('character_id', characterId).maybeSingle(),
      window.DND.client.from('character_storage_config').select('active_backpack_inventory_id').eq('character_id', characterId).maybeSingle()
    ]);

    character = characterData;
    owner = Boolean(characterData?.user_id && session?.user?.id && characterData.user_id === session.user.id);

    if (owner && (!inventoryData || !inventoryData.length)) {
      await syncStarter();
      const result = await window.DND.client
        .from('inventory')
        .select('id,quantity,items(*)')
        .eq('character_id', characterId);
      inventory = result.data || [];
    } else {
      inventory = inventoryError ? [] : (inventoryData || []);
    }

    equipment = equipmentData || {};
    const storageResult = await window.DND.client.from('character_item_storage').select('inventory_id,location').eq('character_id', characterId);
    const storedIds = new Set(
      (storageResult.data || [])
        .filter(entry => entry.location !== 'inventory')
        .map(entry => entry.inventory_id)
    );
    if (activeBackpackData?.active_backpack_inventory_id) {
      storedIds.add(activeBackpackData.active_backpack_inventory_id);
    }
    inventory.forEach(entry => entry._stored = storedIds.has(entry.id));
    renderAll();
  }

  function allowed(item) {
    return item.allowed_slots?.length
      ? item.allowed_slots
      : (item.equip_slot ? [item.equip_slot] : []);
  }

  function isEquipped(id) {
    return slots.some(slot => equipment[cols[slot]] === id);
  }

  function renderInventory() {
    const looseInventory = inventory.filter(row => !row._stored);
    const rows = activeFilter === 'all'
      ? looseInventory
      : looseInventory.filter(row => (row.items?.item_type || '').toLowerCase().includes(activeFilter));

    q('#inventory-count').textContent = `${looseInventory.length} Item${looseInventory.length === 1 ? '' : 's'}`;
    q('#inventory-grid').innerHTML = rows.length
      ? rows.map(row => `<button class="inventory-slot-v2 item-system-inventory ${isEquipped(row.items.id) ? 'is-equipped' : ''}" draggable="${owner}" data-inventory-id="${row.id}" data-item-id="${row.items.id}" title="${esc(row.items.name)}">${row.items.image_url ? `<img src="${esc(row.items.image_url)}" alt="${esc(row.items.name)}" draggable="false">` : '◇'}<b>${row.quantity || 1}</b>${isEquipped(row.items.id) ? '<i>Equipped</i>' : ''}</button>`).join('')
      : '<div class="inventory-empty-v2">No items in this category.</div>';
  }

  function renderEquipment() {
    q('#equipment-grid').innerHTML = slots.map(slot => {
      const id = equipment[cols[slot]];
      const row = inventory.find(entry => entry.items?.id === id);
      return `<div class="equipment-slot-v2 item-system-slot ${row ? 'filled' : ''}" data-equipment-slot="${slot}">${row ? `${row.items.image_url ? `<img src="${esc(row.items.image_url)}" alt="${esc(row.items.name)}" draggable="false">` : ''}<strong>${esc(row.items.name)}</strong><button type="button" data-unequip="${slot}" ${owner ? '' : 'hidden'}>×</button>` : `<span>${slot}</span>`}</div>`;
    }).join('');
  }

  function bonuses() {
    const total = {
      strength_bonus:0,
      dexterity_bonus:0,
      constitution_bonus:0,
      intelligence_bonus:0,
      wisdom_bonus:0,
      charisma_bonus:0,
      hp_bonus:0,
      mana_bonus:0
    };
    slots.filter(slot => slot !== 'Backpack').forEach(slot => {
      const row = inventory.find(entry => entry.items?.id === equipment[cols[slot]]);
      if (row) Object.keys(total).forEach(key => total[key] += Number(row.items[key]) || 0);
    });
    return total;
  }

  function renderStats() {
    const itemBonuses = bonuses();
    const definitions = [
      ['STR','Strength','strength','strength_bonus'],
      ['DEX','Dexterity','dexterity','dexterity_bonus'],
      ['CON','Constitution','constitution','constitution_bonus'],
      ['INT','Intelligence','intelligence','intelligence_bonus'],
      ['WIS','Wisdom','wisdom','wisdom_bonus'],
      ['CHA','Charisma','charisma','charisma_bonus']
    ];
    q('#attribute-list').innerHTML = definitions.map(([abbr,name,key,bonusKey]) => `<div class="sheet-attribute"><span>${abbr}</span><strong>${(Number(character[key]) || 0) + itemBonuses[bonusKey]}</strong>${itemBonuses[bonusKey] ? `<em>+${itemBonuses[bonusKey]} Equipment</em>` : ''}<small>${name}</small></div>`).join('');
    q('#sheet-hp').innerHTML = `${character.current_hp ?? 0} / ${(Number(character.max_hp) || 0) + itemBonuses.hp_bonus}${itemBonuses.hp_bonus ? `<small>+${itemBonuses.hp_bonus}</small>` : ''}`;
    q('#sheet-mana').innerHTML = `${character.current_mana ?? 0} / ${(Number(character.max_mana) || 0) + itemBonuses.mana_bonus}${itemBonuses.mana_bonus ? `<small>+${itemBonuses.mana_bonus}</small>` : ''}`;
  }

  function show(row) {
    const item = row.items;
    const itemBonuses = Object.entries({
      STR:item.strength_bonus,
      DEX:item.dexterity_bonus,
      CON:item.constitution_bonus,
      INT:item.intelligence_bonus,
      WIS:item.wisdom_bonus,
      CHA:item.charisma_bonus,
      HP:item.hp_bonus,
      Mana:item.mana_bonus
    }).filter(([,value]) => Number(value));

    q('#item-detail').innerHTML = `${item.image_url ? `<img src="${esc(item.image_url)}" alt="${esc(item.name)}">` : ''}<h3>${esc(item.name)}</h3><p>${esc(item.rarity || 'Common')} • ${esc(item.item_type || 'Item')}${item.equip_slot ? ` • ${esc(item.equip_slot)}` : ''}</p><p>${esc(item.description || 'No item description.')}</p>${itemBonuses.length ? `<div class="item-effects"><h4>Effects</h4>${itemBonuses.map(([key,value]) => `<span>${key} <b>+${value}</b></span>`).join('')}</div>` : ''}<div class="item-notes"><h4>Notes</h4><p>${esc(item.notes || 'No item notes have been added.')}</p></div><p>Quantity: ${row.quantity || 1}</p>`;
  }

  function renderAll() {
    renderInventory();
    renderEquipment();
    renderStats();
  }

  async function equip(slot) {
    if (!dragged || !owner) return;
    const row = inventory.find(entry => entry.items?.id === dragged);
    if (!row || !allowed(row.items).includes(slot)) return;
    const {error} = await window.DND.client.rpc('equip_character_item', {
      p_character_id: characterId,
      p_item_id: dragged,
      p_slot: slot
    });
    if (error) {
      window.DND.toast(error.message, 'error');
      return;
    }
    await load();
    window.DND.toast(`${row.items.name} equipped to ${slot}.`, 'success');
  }

  function bind() {
    q('#inventory-grid').addEventListener('click', event => {
      const button = event.target.closest('[data-item-id]');
      if (button) show(inventory.find(row => row.items.id === button.dataset.itemId));
    });

    q('.inventory-filters')?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      activeFilter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(entry => entry.classList.toggle('active', entry === button));
      renderInventory();
    });

    q('#inventory-grid').addEventListener('dragstart', event => {
      const button = event.target.closest('[data-item-id]');
      if (!button || !owner) return;
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', button.dataset.itemId);
      dragged = button.dataset.itemId;
      q('#equipment-grid').classList.add('dragging');
      const row = inventory.find(entry => entry.items.id === dragged);
      document.querySelectorAll('[data-equipment-slot]').forEach(slot => {
        slot.classList.toggle('valid-drop', allowed(row.items).includes(slot.dataset.equipmentSlot));
      });
    });

    document.addEventListener('dragend', () => {
      dragged = null;
      q('#equipment-grid')?.classList.remove('dragging');
      document.querySelectorAll('[data-equipment-slot]').forEach(slot => slot.classList.remove('valid-drop','drag-over'));
    });

    q('#equipment-grid').addEventListener('dragover', event => {
      const slot = event.target.closest('[data-equipment-slot]');
      if (slot?.classList.contains('valid-drop')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        slot.classList.add('drag-over');
      }
    });

    q('#equipment-grid').addEventListener('dragleave', event => {
      event.target.closest('[data-equipment-slot]')?.classList.remove('drag-over');
    });

    q('#equipment-grid').addEventListener('drop', event => {
      const slot = event.target.closest('[data-equipment-slot]');
      if (!slot || !slot.classList.contains('valid-drop')) return;
      event.preventDefault();
      equip(slot.dataset.equipmentSlot);
    });

    q('#equipment-grid').addEventListener('click', async event => {
      const unequipButton = event.target.closest('[data-unequip]');
      if (unequipButton) {
        const {error} = await window.DND.client.rpc('unequip_character_slot', {
          p_character_id: characterId,
          p_slot: unequipButton.dataset.unequip
        });
        if (error) window.DND.toast(error.message, 'error');
        else await load();
        return;
      }
      const slot = event.target.closest('[data-equipment-slot]');
      if (slot) {
        const row = inventory.find(entry => entry.items.id === equipment[cols[slot.dataset.equipmentSlot]]);
        if (row) show(row);
      }
    });
  }

  window.addEventListener('dnd:storage-updated', load);
  window.addEventListener('dnd:navigation-ready', () => {
    const wait = setInterval(() => {
      if (q('#character-sheet') && !q('#character-sheet').hidden) {
        clearInterval(wait);
        bind();
        load();
      }
    }, 100);
  }, {once:true});
})();
