(() => {
  const $=s=>document.querySelector(s), characterId=new URLSearchParams(location.search).get('id');
  let rows=[],storage=[],active=null,drag=null,rotated=false,owner=false;
  const rowByInv=id=>rows.find(x=>x.id===id);
  async function load(){
    const session=(await window.DND.client.auth.getSession()).data?.session;
    const [c,i,s,a]=await Promise.all([
      window.DND.client.from('characters').select('user_id').eq('id',characterId).maybeSingle(),
      window.DND.client.from('inventory').select('id,quantity,items(*)').eq('character_id',characterId),
      window.DND.client.from('character_item_storage').select('*').eq('character_id',characterId),
      window.DND.client.from('character_storage_config').select('*').eq('character_id',characterId).maybeSingle()
    ]);
    owner=c.data?.user_id===session?.user?.id;rows=i.data||[];storage=s.data||[];active=a.data||{};
    if(owner){await window.DND.client.rpc('ensure_character_storage_rows',{p_character_id:characterId});storage=(await window.DND.client.from('character_item_storage').select('*').eq('character_id',characterId)).data||storage}
    render();window.dispatchEvent(new CustomEvent('dnd:storage-updated'));
  }
  function ensureActivePanel(){
    if($('#active-backpack-slot'))return;
    const grid=$('#backpack-grid');if(!grid)return;
    grid.closest('.backpack-area')?.insertAdjacentHTML('afterbegin','<div class="active-backpack"><div><h3>Active Backpack</h3><p>Drag a Backpack Item here to open its storage grid.</p></div><div id="active-backpack-slot" class="active-backpack-slot"><span>No active Backpack</span></div></div>');
  }
  function render(){
    ensureActivePanel();
    const activeRow=rowByInv(active?.active_backpack_inventory_id);
    $('#active-backpack-slot').innerHTML=activeRow?`${activeRow.items.image_url?`<img src="${activeRow.items.image_url}" draggable="false">`:''}<div><strong>${activeRow.items.name}</strong><small>${activeRow.items.backpack_columns} × ${activeRow.items.backpack_rows} • ${activeRow.items.backpack_columns*activeRow.items.backpack_rows} cells</small></div><button type="button" id="clear-active-backpack" ${owner?'':'hidden'}>Remove</button>`:'<span>No active Backpack</span>';
    $('#clear-active-backpack')?.addEventListener('click',()=>rpc('clear_character_active_backpack',{p_character_id:characterId}));
    for(let n=1;n<=4;n++){const box=$(`[data-pocket-slot="${n}"]`),stored=storage.find(x=>x.location==='pocket'&&x.pocket_slot===n),row=stored&&rowByInv(stored.inventory_id);box.draggable=Boolean(row&&owner);box.dataset.storageInventory=row?.id||'';box.innerHTML=row?`${row.items.image_url?`<img src="${row.items.image_url}" draggable="false">`:''}<strong>${row.items.name}</strong>`:`<span>Pocket ${n}</span>`}
    const grid=$('#backpack-grid');if(!activeRow){grid.innerHTML='<p class="storage-empty">Select an active Backpack to unlock grid storage.</p>';return}
    const cols=activeRow.items.backpack_columns,rowsCount=activeRow.items.backpack_rows;grid.style.setProperty('--cols',cols);grid.style.setProperty('--rows',rowsCount);grid.innerHTML=Array.from({length:cols*rowsCount},(_,i)=>`<div class="backpack-cell" data-x="${i%cols}" data-y="${Math.floor(i/cols)}"></div>`).join('');
    storage.filter(x=>x.location==='backpack').forEach(st=>{const row=rowByInv(st.inventory_id);if(!row)return;const w=st.rotated?row.items.grid_height:row.items.grid_width,h=st.rotated?row.items.grid_width:row.items.grid_height;grid.insertAdjacentHTML('beforeend',`<button class="backpack-item" draggable="${owner}" data-storage-inventory="${row.id}" style="--x:${st.grid_x};--y:${st.grid_y};--w:${w};--h:${h}">${row.items.image_url?`<img src="${row.items.image_url}" draggable="false">`:''}<strong>${row.items.name}</strong><small>${w}×${h}</small></button>`)});
  }
  function start(e){const item=e.target.closest('[data-inventory-id]'),stored=e.target.closest('[data-storage-inventory]'),id=item?.dataset.inventoryId||stored?.dataset.storageInventory;if(!id||!owner)return;drag=rowByInv(id);if(!drag)return;e.dataTransfer.setData('text/plain',id);rotated=Boolean(storage.find(x=>x.inventory_id===id)?.rotated);document.body.classList.add('storage-dragging');$('#active-backpack-slot').classList.toggle('valid-storage-drop',Boolean(drag.items.is_backpack));document.querySelectorAll('[data-pocket-slot]').forEach(x=>x.classList.toggle('valid-storage-drop',Boolean(drag.items.pocket_eligible)))}
  function end(){drag=null;document.body.classList.remove('storage-dragging');document.querySelectorAll('.valid-storage-drop,.storage-over').forEach(x=>x.classList.remove('valid-storage-drop','storage-over'))}
  async function rpc(name,args){const {error}=await window.DND.client.rpc(name,args);if(error)return window.DND.toast(error.message,'error');await load()}
  function bind(){
    document.addEventListener('dragstart',start,true);document.addEventListener('dragend',end,true);
    document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r'&&drag?.items.can_rotate){rotated=!rotated;window.DND.toast(`Rotation ${rotated?'on':'off'}.`,'success')}});
    $('#active-backpack-slot').ondragover=e=>{if(drag?.items.is_backpack)e.preventDefault()};$('#active-backpack-slot').ondrop=e=>{if(drag?.items.is_backpack){e.preventDefault();rpc('set_character_active_backpack',{p_character_id:characterId,p_inventory_id:drag.id})}};
    document.querySelectorAll('[data-pocket-slot]').forEach(box => {
      box.ondragover = event => {
        if (drag?.items.pocket_eligible) event.preventDefault();
      };
      box.ondrop = event => {
        if (!drag) return;
        event.preventDefault();
        rpc('storage_move_to_pocket', {
          p_character_id: characterId,
          p_inventory_id: drag.id,
          p_pocket_slot: Number(box.dataset.pocketSlot)
        });
      };
    });
    $('#backpack-grid').ondragover=e=>{if(drag&&active?.active_backpack_inventory_id)e.preventDefault()};$('#backpack-grid').ondrop=e=>{const cell=e.target.closest('[data-x]');if(cell&&drag){e.preventDefault();rpc('storage_move_to_backpack',{p_character_id:characterId,p_inventory_id:drag.id,p_grid_x:Number(cell.dataset.x),p_grid_y:Number(cell.dataset.y),p_rotated:rotated})}};
    $('#inventory-grid').ondragover=e=>{if(drag)e.preventDefault()};$('#inventory-grid').ondrop=e=>{if(drag){e.preventDefault();rpc('storage_move_to_inventory',{p_character_id:characterId,p_inventory_id:drag.id})}};
  }
  window.addEventListener('dnd:navigation-ready',()=>{const wait=setInterval(()=>{if($('#character-sheet')&&!$('#character-sheet').hidden&&$('#backpack-grid')){clearInterval(wait);ensureActivePanel();bind();load()}},100)},{once:true});
})();
