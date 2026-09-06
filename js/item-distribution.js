(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const siteUrl = path => window.DND?.siteUrl ? window.DND.siteUrl(path) : `/${String(path).replace(/^\//,'')}`;
  const COMING_SOON = [{id:'cajun',name:'Cajun Adventure'},{id:'fantasy',name:'Fantasy Adventure'}];
  let items = [], rules = [], gifts = [], templates = [], giftTargets = [], selectedItem = null;

  async function fetchJson(path) {
    const response = await fetch(encodeURI(siteUrl(path)), {cache:'no-cache'});
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return response.json();
  }

  async function loadManifestTemplates(adventureId, adventureName) {
    const result = [];
    try {
      const manifest = await fetchJson(`assets/classes/${adventureId}/classes.json`);
      for (const classId of manifest.classes || []) {
        const classData = await fetchJson(`assets/classes/${adventureId}/${classId}/class.json`);
        for (const adventurerId of classData.heroes || []) {
          let adventurerName = adventurerId;
          try {
            const hero = await fetchJson(`assets/classes/${adventureId}/${classId}/${adventurerId}/${adventurerId}.json`);
            adventurerName = hero.name || adventurerId;
          } catch {}
          result.push({adventure_id:adventureId,adventure_name:adventureName,class_id:classId,class_name:classData.name||classId,adventurer_id:adventurerId,adventurer_name:adventurerName,active:true});
        }
      }
    } catch (error) {
      console.warn(`${adventureName} manifest could not load`, error);
    }
    return result;
  }

  function mergeTemplates(...sets) {
    const map = new Map();
    sets.flat().forEach(row => {
      const key = `${row.adventure_id}|${row.class_id||row.class_name}|${row.adventurer_id||row.adventurer_name}`;
      if (!map.has(key)) map.set(key,row);
    });
    return [...map.values()].filter(row => row.active !== false);
  }

  async function loadData() {
    const [itemsResult,rulesResult,giftsResult,targetsResult,catalogResult,vikingManifest] = await Promise.all([
      window.DND.client.from('items').select('*').order('name'),
      window.DND.client.from('item_distributions').select('*').order('created_at',{ascending:false}),
      window.DND.client.from('item_grants').select('id,item_id,character_id,quantity,note,created_at,characters(name,class,race)').order('created_at',{ascending:false}).limit(200),
      window.DND.client.rpc('admin_get_gift_targets'),
      window.DND.client.from('adventure_template_catalog').select('*').eq('active',true).order('adventure_name').order('class_name').order('adventurer_name'),
      loadManifestTemplates('viking','Viking Adventure')
    ]);
    for (const result of [itemsResult,rulesResult,giftsResult,targetsResult]) if (result.error) throw result.error;
    items = itemsResult.data || [];
    rules = rulesResult.data || [];
    gifts = giftsResult.data || [];
    giftTargets = targetsResult.data || [];
    templates = mergeTemplates(catalogResult.error ? [] : catalogResult.data || [], vikingManifest);
    $('#summary-items').textContent = items.length;
    $('#summary-rules').textContent = rules.filter(rule => rule.active).length;
    $('#summary-characters').textContent = giftTargets.length;
    $('#summary-gifts').textContent = gifts.length;
    renderItems();
    fillGiftTargets();
    fillAdventures();
  }

  function activeRule(itemId) { return rules.find(rule => rule.item_id === itemId && rule.active); }
  function ruleLabel(rule) {
    if (!rule) return 'Catalog Only';
    if (rule.distribution_type === 'global') return 'Every Character';
    if (rule.distribution_type === 'adventure') return `Adventure: ${rule.adventure_name||rule.adventure_id}`;
    if (rule.distribution_type === 'class') return `${rule.adventure_name||rule.adventure_id} • ${rule.class_name}`;
    if (rule.distribution_type === 'adventurer') return `${rule.adventure_name||rule.adventure_id} • ${rule.class_name} • ${rule.adventurer_name}`;
    return 'Catalog Only';
  }

  function renderItems() {
    const search = $('#distribution-search').value.trim().toLowerCase();
    const rows = items.filter(item => !search || [item.name,item.item_type,item.rarity].join(' ').toLowerCase().includes(search));
    $('#distribution-item-list').innerHTML = rows.length ? rows.map(item => {
      const rule = activeRule(item.id);
      return `<button type="button" class="distribution-item ${selectedItem?.id===item.id?'selected':''}" data-item-id="${item.id}">${item.image_url?`<img src="${esc(item.image_url)}" alt="">`:'<span>◇</span>'}<div><strong>${esc(item.name)}</strong><small>${esc(item.rarity||'Common')} • ${esc(item.item_type||'Item')}</small><em class="${rule?'active':'catalog-only'}">${esc(ruleLabel(rule))}</em></div></button>`;
    }).join('') : '<p class="list-empty">No Items match the search.</p>';
  }

  function adventures() {
    return [...new Map(templates.map(row => [row.adventure_id,{id:row.adventure_id,name:row.adventure_name}])).values()];
  }
  function fillAdventures(selected='viking') {
    const existing = adventures();
    $('#distribution-adventure').innerHTML = existing.map(row => `<option value="${esc(row.id)}" ${row.id===selected?'selected':''}>${esc(row.name)}</option>`).join('') + COMING_SOON.filter(row => !existing.some(x=>x.id===row.id)).map(row => `<option value="${row.id}" disabled>${row.name} (Coming Soon)</option>`).join('');
  }
  function fillClasses(selected='') {
    const adventureId = $('#distribution-adventure').value;
    const rows = [...new Map(templates.filter(row => row.adventure_id===adventureId).map(row => [row.class_name,row])).values()];
    $('#distribution-class').innerHTML = '<option value="">Select a Class</option>' + rows.map(row => `<option value="${esc(row.class_name)}" ${row.class_name===selected?'selected':''}>${esc(row.class_name)}</option>`).join('');
  }
  function fillAdventurers(selected='') {
    const adventureId = $('#distribution-adventure').value;
    const className = $('#distribution-class').value;
    const rows = templates.filter(row => row.adventure_id===adventureId && row.class_name===className);
    $('#distribution-adventurer').innerHTML = '<option value="">Select an Adventurer</option>' + rows.map(row => `<option value="${esc(row.adventurer_name)}" ${row.adventurer_name===selected?'selected':''}>${esc(row.adventurer_name)}</option>`).join('');
  }

  function updateScope() {
    const type = $('#distribution-type').value;
    $('#adventure-scope-field').hidden = !['adventure','class','adventurer'].includes(type);
    $('#class-scope-field').hidden = !['class','adventurer'].includes(type);
    $('#adventurer-scope-field').hidden = type !== 'adventurer';
    $('#rule-notice').textContent = {
      none:'This Item remains Catalog-only and appears only when an Admin gifts it.',
      global:'Saving grants this Item to every existing Character and every new Character.',
      adventure:'Saving grants this Item to existing and future Characters in the selected Adventure.',
      class:'Saving grants this Item to existing and future Characters matching the selected Adventure and Class.',
      adventurer:'Saving grants this Item to existing and future Characters matching the selected Adventure, Class, and Adventurer.'
    }[type];
  }

  function fillGiftTargets() {
    const groups = new Map();
    giftTargets.forEach(target => { if (!groups.has(target.user_id)) groups.set(target.user_id,[]); groups.get(target.user_id).push(target); });
    $('#gift-character').innerHTML = '<option value="">Select User and Character</option>' + [...groups.values()].map(rows => {
      const user = rows[0];
      const label = user.email ? `${user.username} • ${user.email}` : user.username;
      return `<optgroup label="${esc(label)}">${rows.map(row => `<option value="${row.character_id}">${esc(row.character_name)} • ${esc(row.adventure_name)} • ${esc(row.class_name)} • ${esc(row.adventurer_name)}</option>`).join('')}</optgroup>`;
    }).join('');
  }
  function showGiftTarget() {
    const target = giftTargets.find(row => row.character_id === $('#gift-character').value);
    $('#gift-character-details').textContent = target ? `User: ${target.username}${target.email?` (${target.email})`:''} • Character: ${target.character_name} • ${target.adventure_name} • ${target.class_name} • ${target.adventurer_name}` : 'Select a User and Character.';
  }

  async function selectItem(id) {
    selectedItem = items.find(item => item.id===id);
    if (!selectedItem) return;
    renderItems();
    $('#distribution-empty').hidden = true;
    $('#distribution-content').hidden = false;
    $('#selected-item-image').src = selectedItem.image_url || '../../assets/images/shared/character-placeholder.png';
    $('#selected-item-name').textContent = selectedItem.name;
    $('#selected-item-meta').textContent = [selectedItem.rarity||'Common',selectedItem.item_type||'Item',selectedItem.equip_slot].filter(Boolean).join(' • ');
    const rule = activeRule(id);
    $('#distribution-type').value = rule?.distribution_type || 'none';
    fillAdventures(rule?.adventure_id || 'viking');
    fillClasses(rule?.class_name || '');
    fillAdventurers(rule?.adventurer_name || '');
    $('#distribution-quantity').value = rule?.quantity || 1;
    $('#remove-rule').hidden = !rule;
    $('#rule-status').textContent = ruleLabel(rule);
    updateScope();
    renderGiftHistory();
    await loadOwners();
  }

  function renderGiftHistory() {
    const rows = gifts.filter(gift => gift.item_id===selectedItem.id);
    $('#gift-history').innerHTML = rows.length ? rows.slice(0,20).map(gift => `<div><strong>${esc(gift.characters?.name||'Character')}</strong><span>${esc(gift.characters?.class||'Class')} • ${esc(gift.characters?.race||'Adventurer')}</span><b>Quantity ${gift.quantity}</b><small>${gift.note?esc(gift.note)+' • ':''}${new Date(gift.created_at).toLocaleString()}</small></div>`).join('') : '<p>No Admin gift history for this Item.</p>';
  }

  async function loadOwners() {
    $('#current-item-owners-list').innerHTML = '<p class="owners-loading">Loading current owners...</p>';
    const {data,error} = await window.DND.client.rpc('admin_get_item_owners',{p_item_id:selectedItem.id});
    if (error) return $('#current-item-owners-list').innerHTML = `<p class="owners-error">${esc(error.message)}</p>`;
    const owners = data || [];
    $('#current-owner-count').textContent = `${owners.length} Owner${owners.length===1?'':'s'}`;
    $('#current-item-owners-list').innerHTML = owners.length ? owners.map(owner => `<article class="current-owner-row"><div><strong>${esc(owner.character_name)}</strong><span>${esc(owner.class_name||'Unknown Class')} • ${esc(owner.adventurer_name||'Unknown Adventurer')} • Quantity ${Number(owner.quantity)||0}</span><small>${owner.equipped_slots?.length?`Equipped: ${esc(owner.equipped_slots.join(', '))}`:'Not currently equipped'}</small></div><button type="button" data-revoke-owner="${owner.character_id}" data-owner-name="${esc(owner.character_name)}">Remove From Character</button></article>`).join('') : '<p class="owners-empty">No Character currently owns this Item.</p>';
  }

  async function saveRule(event) {
    event.preventDefault();
    const type = $('#distribution-type').value;
    if (type==='none') return removeRule();
    const adventureId = $('#distribution-adventure').value || null;
    const adventureName = adventures().find(row=>row.id===adventureId)?.name || null;
    const className = $('#distribution-class').value || null;
    const adventurerName = $('#distribution-adventurer').value || null;
    if (['adventure','class','adventurer'].includes(type) && !adventureId) return window.DND.toast('Select an Adventure.','error');
    if (['class','adventurer'].includes(type) && !className) return window.DND.toast('Select a Class.','error');
    if (type==='adventurer' && !adventurerName) return window.DND.toast('Select an Adventurer.','error');
    const {data,error} = await window.DND.client.rpc('admin_set_item_distribution_v2',{p_item_id:selectedItem.id,p_distribution_type:type,p_adventure_id:adventureId,p_adventure_name:adventureName,p_class_name:className,p_adventurer_name:adventurerName,p_quantity:Math.max(1,Number($('#distribution-quantity').value)||1)});
    if (error) return window.DND.toast(error.message,'error');
    window.DND.toast(`Distribution saved. ${data?.granted||0} Character Inventories updated.`,'success');
    await loadData(); await selectItem(selectedItem.id);
  }
  async function removeRule() {
    const {error} = await window.DND.client.rpc('admin_remove_item_distribution',{p_item_id:selectedItem.id});
    if (error) return window.DND.toast(error.message,'error');
    window.DND.toast('Automatic distribution removed. Existing owned Items were not deleted.','success');
    await loadData(); await selectItem(selectedItem.id);
  }
  async function giftItem(event) {
    event.preventDefault();
    const characterId = $('#gift-character').value;
    if (!characterId) return window.DND.toast('Select a User and Character.','error');
    const {error} = await window.DND.client.rpc('admin_gift_item',{p_item_id:selectedItem.id,p_character_id:characterId,p_quantity:Math.max(1,Number($('#gift-quantity').value)||1),p_note:$('#gift-note').value.trim()||null});
    if (error) return window.DND.toast(error.message,'error');
    const target = giftTargets.find(row=>row.character_id===characterId);
    window.DND.toast(`${selectedItem.name} gifted to ${target?.username||'User'} / ${target?.character_name||'Character'}.`,'success');
    $('#gift-note').value='';
    await loadData(); await selectItem(selectedItem.id);
  }
  async function revokeOwner(button) {
    const characterName = button.dataset.ownerName;
    const confirmed = await window.DNDModal.confirm({type:'danger',kicker:'Item Ownership',title:'Remove Item From Character',message:`Remove ${selectedItem.name} from ${characterName}? If equipped, the Item will be unequipped first.`,confirmText:'Remove Item',cancelText:'Cancel',focusCancel:true});
    if (!confirmed) return;
    const {error} = await window.DND.client.rpc('admin_revoke_item_from_character',{p_item_id:selectedItem.id,p_character_id:button.dataset.revokeOwner,p_note:'Removed from Item Distribution ownership review'});
    if (error) return window.DND.toast(error.message,'error');
    window.DND.toast(`${selectedItem.name} removed from ${characterName}.`,'success');
    await loadOwners();
  }

  window.addEventListener('dnd:navigation-ready', async event => {
    if (!event.detail.isAdmin) { $('#distribution-denied').hidden=false; return; }
    $('#distribution-main').hidden=false;
    try { await loadData(); } catch (error) { window.DND.toast(error.message,'error'); }
    $('#distribution-search').addEventListener('input',renderItems);
    $('#distribution-item-list').addEventListener('click',event=>{const button=event.target.closest('[data-item-id]');if(button)selectItem(button.dataset.itemId)});
    $('#distribution-type').addEventListener('change',updateScope);
    $('#distribution-adventure').addEventListener('change',()=>{fillClasses();fillAdventurers()});
    $('#distribution-class').addEventListener('change',()=>fillAdventurers());
    $('#distribution-rule-form').addEventListener('submit',saveRule);
    $('#remove-rule').addEventListener('click',removeRule);
    $('#gift-form').addEventListener('submit',giftItem);
    $('#gift-character').addEventListener('change',showGiftTarget);
    $('#current-item-owners-list').addEventListener('click',event=>{const button=event.target.closest('[data-revoke-owner]');if(button)revokeOwner(button)});
    $('#refresh-distribution').addEventListener('click',async()=>{await loadData();if(selectedItem)await selectItem(selectedItem.id)});
  },{once:true});
})();
