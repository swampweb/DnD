(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');

  let activeItemId = null;
  let activeItemName = '';

  function installStyles() {
    if ($('#item-ownership-fix-styles')) return;
    const style = document.createElement('style');
    style.id = 'item-ownership-fix-styles';
    style.textContent = `
      .current-owners-card{margin:12px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#110e0c;overflow:hidden}
      .current-owners-heading{display:flex;align-items:start;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(229,111,29,.16)}
      .current-owners-heading h3{margin:0;color:#dfbd87;font:1.1rem Georgia,serif}
      .current-owners-heading p{margin:4px 0 0;color:#968a80;font-size:.73rem;line-height:1.45}
      .current-owners-heading span{padding:4px 8px;border:1px solid #5d4636;border-radius:999px;color:#d0bca5;font-size:.64rem;white-space:nowrap}
      .current-owners-list{display:grid;gap:7px;padding:12px}
      .current-owner-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:7px;background:#090807}
      .current-owner-row div{display:grid;gap:3px}
      .current-owner-row strong{color:#dec29e;font-size:.82rem}
      .current-owner-row span{color:#94887e;font-size:.69rem}
      .current-owner-row small{color:#d3a664;font-size:.64rem}
      .current-owner-row button{border:1px solid rgba(196,70,58,.48);border-radius:6px;padding:8px 10px;color:#ffaaa1;background:rgba(104,29,23,.2);cursor:pointer}
      .current-owner-row button:hover{border-color:#d84e42;background:rgba(140,38,30,.28)}
      .owners-empty,.owners-loading,.owners-error{padding:22px;color:#92867c;text-align:center}
      .owners-error{color:#ffaaa1}
      .ownership-warning{margin:0 12px 12px;padding:9px;border:1px solid rgba(209,145,52,.28);border-radius:6px;color:#d4b16f;background:rgba(112,73,17,.12);font-size:.69rem;line-height:1.45}
      @media(max-width:650px){.current-owner-row{grid-template-columns:1fr}.current-owner-row button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function installPanel() {
    if ($('#current-item-owners-card')) return;
    const history = document.querySelector('.history-card');
    if (!history) return;
    history.insertAdjacentHTML('beforebegin', `
      <section class="current-owners-card" id="current-item-owners-card">
        <div class="current-owners-heading">
          <div>
            <h3>Characters Currently Owning This Item</h3>
            <p>Inventory ownership is separate from the current automatic distribution rule.</p>
          </div>
          <span id="current-owner-count">0 Owners</span>
        </div>
        <div class="ownership-warning">
          Changing or removing a distribution rule does not remove Items already placed in Inventory. Use Remove From Character to correct an old test grant or assignment.
        </div>
        <div class="current-owners-list" id="current-item-owners-list">
          <p class="owners-empty">Select an Item to review current owners.</p>
        </div>
      </section>
    `);
  }

  async function loadOwners(itemId, itemName) {
    activeItemId = itemId;
    activeItemName = itemName || 'Item';
    const list = $('#current-item-owners-list');
    if (!list) return;
    list.innerHTML = '<p class="owners-loading">Loading current owners...</p>';

    const { data, error } = await window.DND.client.rpc('admin_get_item_owners', {
      p_item_id: itemId
    });

    if (error) {
      list.innerHTML = `<p class="owners-error">${esc(error.message)}</p>`;
      return;
    }

    const owners = data || [];
    $('#current-owner-count').textContent = `${owners.length} Owner${owners.length === 1 ? '' : 's'}`;
    list.innerHTML = owners.length ? owners.map(owner => {
      const slots = Array.isArray(owner.equipped_slots) && owner.equipped_slots.length
        ? `Equipped: ${owner.equipped_slots.join(', ')}`
        : 'Not currently equipped';
      return `
        <article class="current-owner-row">
          <div>
            <strong>${esc(owner.character_name)}</strong>
            <span>${esc(owner.class_name || 'Unknown Class')} • ${esc(owner.adventurer_name || 'Unknown Adventurer')} • Quantity ${Number(owner.quantity) || 0}</span>
            <small>${esc(slots)}</small>
          </div>
          <button type="button" data-revoke-owner="${esc(owner.character_id)}" data-owner-name="${esc(owner.character_name)}">Remove From Character</button>
        </article>`;
    }).join('') : '<p class="owners-empty">No Character currently owns this Item.</p>';
  }

  async function revoke(button) {
    if (!activeItemId) return;
    const characterId = button.dataset.revokeOwner;
    const characterName = button.dataset.ownerName || 'Character';
    const confirmed = await window.DNDModal.confirm({
      type: 'danger',
      kicker: 'Item Ownership',
      title: 'Remove Item From Character',
      message: `Remove ${activeItemName} from ${characterName}?\n\nIf the Item is equipped, it will be unequipped first. The Item definition and distribution rule will not be changed.`,
      confirmText: 'Remove Item',
      cancelText: 'Cancel',
      focusCancel: true
    });
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = 'Removing...';
    const { error } = await window.DND.client.rpc('admin_revoke_item_from_character', {
      p_item_id: activeItemId,
      p_character_id: characterId,
      p_note: 'Removed from Item Distribution ownership review'
    });
    if (error) {
      button.disabled = false;
      button.textContent = 'Remove From Character';
      window.DND.toast(error.message, 'error');
      return;
    }

    window.DND.toast(`${activeItemName} removed from ${characterName}.`, 'success');
    await loadOwners(activeItemId, activeItemName);
  }

  function observeItemSelection() {
    const name = $('#selected-item-name');
    const content = $('#distribution-content');
    if (!name || !content) return;

    const refresh = () => {
      if (content.hidden) return;
      const selectedButton = document.querySelector('.distribution-item.selected[data-item-id]');
      const itemId = selectedButton?.dataset.itemId;
      const itemName = name.textContent.trim();
      if (itemId && itemId !== activeItemId) loadOwners(itemId, itemName);
    };

    new MutationObserver(refresh).observe(name, { childList: true, characterData: true, subtree: true });
    new MutationObserver(refresh).observe(content, { attributes: true, attributeFilter: ['hidden'] });
    $('#distribution-item-list')?.addEventListener('click', () => setTimeout(refresh, 0));
  }

  window.addEventListener('dnd:navigation-ready', event => {
    if (!event.detail.isAdmin) return;
    installStyles();
    installPanel();
    observeItemSelection();
    $('#current-item-owners-list')?.addEventListener('click', event => {
      const button = event.target.closest('[data-revoke-owner]');
      if (button) revoke(button);
    });
  }, { once: true });
})();
