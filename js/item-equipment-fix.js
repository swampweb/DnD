(() => {
  const $ = selector => document.querySelector(selector);
  const characterId = new URLSearchParams(location.search).get('id');
  const slotColumns = {
    'Head':'head_item_id','Neck':'neck_item_id','Chest':'chest_item_id','Hands':'hands_item_id',
    'Legs':'legs_item_id','Feet':'feet_item_id','Main Hand':'main_hand_item_id','Off Hand':'off_hand_item_id',
    'Ring 1':'ring_1_item_id','Ring 2':'ring_2_item_id','Artifact':'artifact_item_id'
  };
  let inventory = [];
  let draggedItemId = null;
  let isOwner = false;

  function allowedSlots(item) {
    if (Array.isArray(item?.allowed_slots) && item.allowed_slots.length) return item.allowed_slots;
    return item?.equip_slot ? [item.equip_slot] : [];
  }

  async function refreshData() {
    if (!characterId) return;
    const [{data:character},{data:rows,error}] = await Promise.all([
      window.DND.client.from('characters').select('*').eq('id',characterId).maybeSingle(),
      window.DND.client.from('inventory').select('id,quantity,items(*)').eq('character_id',characterId)
    ]);
    if (error) throw error;
    inventory = rows || [];
    isOwner = character?.user_id === window.DND.session?.user?.id;
    document.querySelectorAll('.inventory-slot-v2[data-item-id]').forEach(button => {
      button.draggable = isOwner;
      button.querySelectorAll('img').forEach(image => image.draggable = false);
    });
    await recalculateStats(character);
  }

  async function recalculateStats(character = null) {
    if (!characterId) return;
    if (!character) {
      const response = await window.DND.client.from('characters').select('*').eq('id',characterId).maybeSingle();
      character = response.data;
    }
    const {data:equipment} = await window.DND.client.from('character_equipment').select('*').eq('character_id',characterId).maybeSingle();
    if (!character || !equipment) return;
    const equippedIds = [...new Set(Object.values(slotColumns).map(column => equipment[column]).filter(Boolean))];
    let equippedItems = [];
    if (equippedIds.length) {
      const response = await window.DND.client.from('items').select('*').in('id',equippedIds);
      equippedItems = response.data || [];
    }
    const bonus = {strength_bonus:0,dexterity_bonus:0,constitution_bonus:0,intelligence_bonus:0,wisdom_bonus:0,charisma_bonus:0,hp_bonus:0,mana_bonus:0};
    equippedItems.forEach(item => Object.keys(bonus).forEach(key => bonus[key] += Number(item[key]) || 0));
    const attributes = [
      ['STR','Strength','strength','strength_bonus'],['DEX','Dexterity','dexterity','dexterity_bonus'],
      ['CON','Constitution','constitution','constitution_bonus'],['INT','Intelligence','intelligence','intelligence_bonus'],
      ['WIS','Wisdom','wisdom','wisdom_bonus'],['CHA','Charisma','charisma','charisma_bonus']
    ];
    const list = $('#attribute-list');
    if (list) list.innerHTML = attributes.map(([abbr,name,key,bonusKey]) => {
      const base = Number(character[key]) || 0;
      const equipmentBonus = bonus[bonusKey];
      return `<div class="sheet-attribute"><span>${abbr}</span><strong>${base + equipmentBonus}</strong>${equipmentBonus ? `<em>${equipmentBonus > 0 ? '+' : ''}${equipmentBonus} Equipment</em>` : '<em class="no-equipment-bonus">Base</em>'}<small>${name}</small></div>`;
    }).join('');
    const hp = $('#sheet-hp');
    if (hp) hp.innerHTML = `${character.current_hp ?? 0} / ${(Number(character.max_hp)||0)+bonus.hp_bonus}${bonus.hp_bonus ? `<small>${bonus.hp_bonus>0?'+':''}${bonus.hp_bonus} Equipment</small>` : ''}`;
    const mana = $('#sheet-mana');
    if (mana) mana.innerHTML = `${character.current_mana ?? 0} / ${(Number(character.max_mana)||0)+bonus.mana_bonus}${bonus.mana_bonus ? `<small>${bonus.mana_bonus>0?'+':''}${bonus.mana_bonus} Equipment</small>` : ''}`;
  }

  function clearHighlights() {
    draggedItemId = null;
    $('#equipment-grid')?.classList.remove('dragging','equipment-drag-active');
    document.querySelectorAll('[data-equipment-slot]').forEach(slot => slot.classList.remove('valid-drop','invalid-drop','drag-over'));
  }

  function startDrag(event) {
    const button = event.target.closest('.inventory-slot-v2[data-item-id]');
    if (!button || !isOwner) return;
    draggedItemId = button.dataset.itemId;
    const row = inventory.find(entry => entry.items?.id === draggedItemId);
    if (!row) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedItemId);
    const allowed = allowedSlots(row.items);
    $('#equipment-grid')?.classList.add('dragging','equipment-drag-active');
    document.querySelectorAll('[data-equipment-slot]').forEach(slot => {
      const valid = allowed.includes(slot.dataset.equipmentSlot);
      slot.classList.toggle('valid-drop', valid);
      slot.classList.toggle('invalid-drop', !valid);
    });
  }

  async function dropItem(event) {
    const slot = event.target.closest('[data-equipment-slot]');
    if (!slot || !draggedItemId || !slot.classList.contains('valid-drop')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const itemId = draggedItemId;
    const slotName = slot.dataset.equipmentSlot;
    clearHighlights();
    const {error} = await window.DND.client.rpc('equip_character_item', {
      p_character_id: characterId,
      p_item_id: itemId,
      p_slot: slotName
    });
    if (error) {
      window.DND.toast(error.message, 'error');
      return;
    }
    window.DND.toast(`Item equipped to ${slotName}.`, 'success');
    location.reload();
  }

  function bind() {
    const inventoryGrid = $('#inventory-grid');
    const equipmentGrid = $('#equipment-grid');
    if (!inventoryGrid || !equipmentGrid) return;
    inventoryGrid.addEventListener('dragstart', startDrag, true);
    document.addEventListener('dragend', clearHighlights, true);
    equipmentGrid.addEventListener('dragover', event => {
      const slot = event.target.closest('[data-equipment-slot]');
      if (slot?.classList.contains('valid-drop')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        slot.classList.add('drag-over');
      }
    }, true);
    equipmentGrid.addEventListener('dragleave', event => event.target.closest('[data-equipment-slot]')?.classList.remove('drag-over'), true);
    equipmentGrid.addEventListener('drop', dropItem, true);
    new MutationObserver(() => refreshData().catch(console.error)).observe(inventoryGrid,{childList:true,subtree:true});
  }

  window.addEventListener('dnd:navigation-ready', () => {
    const wait = setInterval(() => {
      if ($('#character-sheet') && !$('#character-sheet').hidden && $('#inventory-grid') && $('#equipment-grid')) {
        clearInterval(wait);
        bind();
        refreshData().catch(error => console.error('Equipment fix failed:',error));
      }
    },100);
  },{once:true});
})();
