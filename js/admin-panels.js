(() => {
  const CLASS_MANIFEST = 'assets/classes/viking/classes.json';
  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const siteUrl = path => window.DND?.siteUrl ? window.DND.siteUrl(path) : `/${String(path).replace(/^\//,'')}`;
  let classes = [];
  let currentClass = null;
  let currentAdventurer = null;
  let currentJson = null;
  let usersLoaded = false;
  let charactersLoaded = false;

  async function fetchJson(path){const response=await fetch(encodeURI(siteUrl(path)),{cache:'no-cache'});if(!response.ok)throw new Error(`${path} returned ${response.status}`);return response.json()}
  function formatDate(value){if(!value)return '—';try{return new Intl.DateTimeFormat('en-US',{dateStyle:'medium'}).format(new Date(value))}catch{return '—'}}
  function displayUser(row){return row.email||row.username||row.display_name||row.full_name||row.id||'Unknown user'}

  async function loadUsers(){
    const body=$('#admin-users-body');body.innerHTML='<tr><td colspan="4" class="loading-cell">Loading users...</td></tr>';
    const [{data:profiles,error},{data:characters}] = await Promise.all([
      window.DND.client.from('profiles').select('*').order('created_at',{ascending:false}),
      window.DND.client.from('characters').select('id,user_id')
    ]);
    if(error){body.innerHTML=`<tr><td colspan="4" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;return}
    const counts=new Map();(characters||[]).forEach(row=>counts.set(row.user_id,(counts.get(row.user_id)||0)+1));
    const rows=profiles||[];$('#admin-user-count').textContent=`${rows.length} user${rows.length===1?'':'s'}`;
    body.innerHTML=rows.length?rows.map(row=>{
      const role=String(row.role||'user').toLowerCase();
      const allowedRoles=['user','manager','admin'];
      const options=allowedRoles.map(item=>`<option value="${item}" ${item===role?'selected':''}>${item.charAt(0).toUpperCase()+item.slice(1)}</option>`).join('');
      return `<tr><td>${escapeHtml(displayUser(row))}</td><td><div class="role-editor role-${escapeHtml(role)}"><span class="role-dot" aria-hidden="true"></span><select class="role-select" data-profile-id="${escapeHtml(row.id)}" data-original-role="${escapeHtml(role)}" aria-label="Role for ${escapeHtml(displayUser(row))}">${options}</select><span class="role-save-state" aria-live="polite"></span></div></td><td>${formatDate(row.created_at)}</td><td>${counts.get(row.id)||0}</td></tr>`;
    }).join(''):'<tr><td colspan="4" class="empty-cell">No users were returned.</td></tr>';
    usersLoaded=true;
  }

  async function updateUserRole(select){
    const profileId=select.dataset.profileId;
    const previousRole=select.dataset.originalRole||'user';
    const nextRole=select.value;
    const editor=select.closest('.role-editor');
    const state=editor.querySelector('.role-save-state');
    if(nextRole===previousRole)return;
    const confirmed=await window.DNDModal.confirm({type:'warning',kicker:'User Management',title:'Update User Role',message:`Change this user's role from ${previousRole} to ${nextRole}?`,confirmText:'Update Role',cancelText:'Cancel',focusCancel:true});
    if(!confirmed){select.value=previousRole;return}
    select.disabled=true;state.textContent='Saving...';
    const {error}=await window.DND.client.from('profiles').update({role:nextRole}).eq('id',profileId);
    select.disabled=false;
    if(error){select.value=previousRole;state.textContent='Not saved';window.DND.toast(error.message||'The role could not be updated.','error');return}
    select.dataset.originalRole=nextRole;editor.className=`role-editor role-${nextRole}`;state.textContent='Saved';window.DND.toast(`User role updated to ${nextRole}.`,'success');setTimeout(()=>{if(state.textContent==='Saved')state.textContent=''},2200);
  }

  async function loadCharacters(){
    const body=$('#admin-characters-body');body.innerHTML='<tr><td colspan="7" class="loading-cell">Loading characters...</td></tr>';
    const [{data:characters,error},{data:profiles}] = await Promise.all([
      window.DND.client.from('characters').select('*').order('created_at',{ascending:false}),
      window.DND.client.from('profiles').select('*')
    ]);
    if(error){body.innerHTML=`<tr><td colspan="7" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;return}
    const profileMap=new Map((profiles||[]).map(row=>[row.id,displayUser(row)]));const rows=characters||[];
    $('#admin-character-count').textContent=`${rows.length} character${rows.length===1?'':'s'}`;
    body.innerHTML=rows.length?rows.map(row=>`<tr><td>${escapeHtml(row.name||'Unnamed Character')}</td><td>${escapeHtml(profileMap.get(row.user_id)||row.user_id||'Unknown')}</td><td>${escapeHtml(row.adventure_id||row.adventure||row.realm||'—')}</td><td>${escapeHtml(row.class_id||row.class||'—')}</td><td>${escapeHtml(row.adventurer_id||row.specialization||row.race||'—')}</td><td>${escapeHtml(row.level??1)}</td><td>${formatDate(row.created_at)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty-cell">No characters were returned.</td></tr>';
    charactersLoaded=true;
  }

  async function loadClassList(){
    const manifest=await fetchJson(CLASS_MANIFEST);classes=await Promise.all(manifest.classes.map(id=>fetchJson(`assets/classes/viking/${id}/class.json`)));
    $('#defaults-class').innerHTML='<option value="">Select a Class</option>'+classes.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
  }

  async function handleClassChange(){
    const classId=$('#defaults-class').value;currentClass=classes.find(item=>item.id===classId)||null;currentAdventurer=null;currentJson=null;$('#defaults-fieldset').disabled=true;
    const select=$('#defaults-adventurer');
    if(!currentClass){select.disabled=true;select.innerHTML='<option value="">Select an Adventurer</option>';return}
    const adventurers=await Promise.all((currentClass.heroes||[]).map(id=>fetchJson(`assets/classes/viking/${currentClass.id}/${id}/${id}.json`).then(data=>({...data,_folder:id}))));
    currentClass._adventurers=adventurers;select.innerHTML='<option value="">Select an Adventurer</option>'+adventurers.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');select.disabled=false;
  }

  function fillAttributes(values){['strength','dexterity','constitution','intelligence','wisdom','charisma'].forEach(key=>{$(`#default-${key}`).value=Number(values[key]??0)})}
  function jsonAttributes(json){const base=json?.baseAttributes||{};return{strength:base.str??0,dexterity:base.dex??0,constitution:base.con??0,intelligence:base.int??0,wisdom:base.wis??0,charisma:base.cha??0}}

  async function handleAdventurerChange(){
    const id=$('#defaults-adventurer').value;currentAdventurer=currentClass?._adventurers?.find(item=>item.id===id)||null;currentJson=currentAdventurer;
    if(!currentAdventurer){$('#defaults-fieldset').disabled=true;return}
    $('#defaults-status').className='defaults-status';$('#defaults-status').textContent='Loading saved defaults...';
    const {data,error}=await window.DND.client.from('character_creation_defaults').select('*').eq('adventure_id','viking').eq('class_id',currentClass.id).eq('adventurer_id',currentAdventurer.id).maybeSingle();
    if(error){$('#defaults-status').className='defaults-status error';$('#defaults-status').textContent=error.message;return}
    fillAttributes(data||jsonAttributes(currentJson));$('#defaults-fieldset').disabled=false;$('#defaults-status').textContent=data?'Loaded Admin-managed defaults from Supabase.':'No database override found. Showing JSON fallback values.';
  }

  async function saveDefaults(event){
    event.preventDefault();if(!currentClass||!currentAdventurer)return;const button=event.currentTarget.querySelector('.save-defaults');button.disabled=true;button.textContent='Saving...';
    const payload={adventure_id:'viking',class_id:currentClass.id,adventurer_id:currentAdventurer.id,updated_by:window.DND.session?.user?.id||null};
    ['strength','dexterity','constitution','intelligence','wisdom','charisma'].forEach(key=>payload[key]=Number($(`#default-${key}`).value)||0);
    const {error}=await window.DND.client.from('character_creation_defaults').upsert(payload,{onConflict:'adventure_id,class_id,adventurer_id'});button.disabled=false;button.textContent='Save New Character Defaults';
    if(error){$('#defaults-status').className='defaults-status error';$('#defaults-status').textContent=error.message;window.DND.toast('Defaults could not be saved.','error');return}
    $('#defaults-status').className='defaults-status saved';$('#defaults-status').textContent='Defaults saved. These values will apply to future character creation.';window.DND.toast(`${currentAdventurer.name} defaults saved.`,'success');
  }

  function resetJsonDefaults(){if(!currentJson)return;fillAttributes(jsonAttributes(currentJson));$('#defaults-status').className='defaults-status';$('#defaults-status').textContent='JSON values loaded into the form. Select Save to make these the active defaults.'}

  window.addEventListener('dnd:navigation-ready',async event=>{
    if(!event.detail.isAdmin)return;
    try{await loadClassList()}catch(error){$('#defaults-status').className='defaults-status error';$('#defaults-status').textContent=`Class data could not load: ${error.message}`}
    $('#user-management-panel').addEventListener('toggle',()=>{if($('#user-management-panel').open&&!usersLoaded)loadUsers()});
    $('#created-characters-panel').addEventListener('toggle',()=>{if($('#created-characters-panel').open&&!charactersLoaded)loadCharacters()});
    $('#refresh-users').addEventListener('click',loadUsers);$('#refresh-characters').addEventListener('click',loadCharacters);
    $('#admin-users-body').addEventListener('change',event=>{const select=event.target.closest('.role-select');if(select)updateUserRole(select)});
    $('#defaults-class').addEventListener('change',handleClassChange);$('#defaults-adventurer').addEventListener('change',handleAdventurerChange);$('#creation-defaults-form').addEventListener('submit',saveDefaults);$('#reset-json-defaults').addEventListener('click',resetJsonDefaults);
  });
})();
