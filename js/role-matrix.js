(() => {
  const $ = selector => document.querySelector(selector);
  const ROLES = ['user','manager','admin'];
  const PERMISSIONS = [
    ['view_administration','See Administration navigation','Show the Administration area in site navigation.'],
    ['view_management','See Management navigation','Show the Management area in site navigation.'],
    ['view_users','View User Management','View registered users and character counts.'],
    ['edit_user_roles','Edit User Roles','Change a user between User, Manager, and Admin.'],
    ['view_created_characters','View Created Characters','View the characters created by players.'],
    ['manage_invitations','Manage Invitations','Send, resend, and remove invitation records.'],
    ['edit_character_defaults','Edit Character Creation Defaults','Change attributes used for newly created characters.'],
    ['view_role_matrix','View Role Matrix','View this permissions matrix.'],
    ['edit_role_matrix','Edit Role Matrix','Change and save role permissions.'],
    ['create_classes','Create Classes','Reserved for the future Class creation workflow.'],
    ['create_adventurers','Create Adventurers','Reserved for the future Adventurer creation workflow.']
  ];
  let currentRole = 'user';
  let loaded = false;

  async function getCurrentRole(session) {
    const {data,error}=await window.DND.client.from('profiles').select('role').eq('id',session.user.id).single();
    if(error) throw error;
    return String(data?.role||'user').toLowerCase();
  }

  async function loadMatrix() {
    const body=$('#role-matrix-body');
    body.innerHTML='<tr><td colspan="4" class="loading-cell">Loading role permissions...</td></tr>';
    const {data,error}=await window.DND.client.from('role_permissions').select('role_name,permission_key,allowed');
    if(error){body.innerHTML=`<tr><td colspan="4" class="empty-cell">${error.message}</td></tr>`;$('#role-matrix-status').className='defaults-status error';$('#role-matrix-status').textContent=error.message;return}
    const map=new Map((data||[]).map(row=>[`${row.permission_key}:${row.role_name}`,!!row.allowed]));
    body.innerHTML=PERMISSIONS.map(([key,label,help])=>`<tr><td><span class="permission-copy"><strong>${label}</strong><small>${help}</small></span></td>${ROLES.map(role=>`<td><label class="matrix-check role-${role}"><input type="checkbox" data-permission="${key}" data-role="${role}" ${map.get(`${key}:${role}`)?'checked':''} ${currentRole==='admin'?'':'disabled'}><span class="sr-only">${label} for ${role}</span></label></td>`).join('')}</tr>`).join('');
    $('#role-matrix-status').className=currentRole==='admin'?'defaults-status':'defaults-status manager-view-banner';
    $('#role-matrix-status').textContent=currentRole==='admin'?'Admin editing is enabled. Select Save Role Matrix after making changes.':'Manager view is read-only. Only Admin can change permissions.';
    $('#role-matrix-mode').textContent=currentRole==='admin'?'Admin: Edit mode':'Manager: View only';
    $('#save-role-matrix').hidden=currentRole!=='admin';
    loaded=true;
  }

  async function saveMatrix() {
    if(currentRole!=='admin') return;
    const button=$('#save-role-matrix');button.disabled=true;button.textContent='Saving...';
    const rows=[...document.querySelectorAll('#role-matrix-body input[data-permission]')].map(input=>({role_name:input.dataset.role,permission_key:input.dataset.permission,allowed:input.checked,updated_by:window.DND.session?.user?.id||null}));
    const adminEdit=rows.find(row=>row.role_name==='admin'&&row.permission_key==='edit_role_matrix');
    const adminView=rows.find(row=>row.role_name==='admin'&&row.permission_key==='view_role_matrix');
    if(!adminEdit?.allowed||!adminView?.allowed){button.disabled=false;button.textContent='Save Role Matrix';$('#role-matrix-status').className='defaults-status error';$('#role-matrix-status').textContent='Admin View Role Matrix and Edit Role Matrix must remain enabled to prevent lockout.';return}
    const {error}=await window.DND.client.from('role_permissions').upsert(rows,{onConflict:'role_name,permission_key'});
    button.disabled=false;button.textContent='Save Role Matrix';
    if(error){$('#role-matrix-status').className='defaults-status error';$('#role-matrix-status').textContent=error.message;window.DND.toast('Role Matrix could not be saved.','error');return}
    $('#role-matrix-status').className='defaults-status saved';$('#role-matrix-status').textContent='Role Matrix saved.';window.DND.toast('Role Matrix saved.','success');
  }

  window.addEventListener('dnd:navigation-ready',async event=>{
    try{currentRole=await getCurrentRole(event.detail.session)}catch(error){return}
    if(currentRole==='manager') document.body.classList.add('manager-only-matrix');
    const panel=$('#role-matrix-panel');
    panel.addEventListener('toggle',()=>{if(panel.open&&!loaded)loadMatrix()});
    $('#save-role-matrix').addEventListener('click',saveMatrix);
  });
})();
