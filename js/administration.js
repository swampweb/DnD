let invitationRows = [];
let acceptedExpanded = false;

const formatDate = value => value
  ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const getFunctionErrorMessage = async (error, fallback) => {
  try {
    if (error?.context?.json) {
      const response = await error.context.json();
      return response?.error || response?.message || fallback;
    }
  } catch (_) {}
  return error?.message || fallback;
};

const installAdministrationPolish = () => {
  if (document.getElementById('invitation-polish-styles')) return;
  const style = document.createElement('style');
  style.id = 'invitation-polish-styles';
  style.textContent = `
    .invite-status-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid transparent;border-radius:999px;font-size:.65rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
    .invite-status-chip:before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}
    .invite-status-sent{border-color:rgba(225,169,56,.46);color:#efc967;background:rgba(188,132,28,.15)}
    .invite-status-accepted{border-color:rgba(71,158,83,.5);color:#9ed9a6;background:rgba(51,132,64,.17)}
    .invite-status-pending{border-color:rgba(72,136,188,.45);color:#9cc9ea;background:rgba(45,102,151,.16)}
    .invite-status-failed{border-color:rgba(201,68,57,.5);color:#ffaaa1;background:rgba(151,42,34,.17)}
    .invite-status-expired{border-color:rgba(145,123,103,.45);color:#c8b39f;background:rgba(93,75,61,.18)}
    .invite-group-row td{padding:0!important;border-top:1px solid rgba(229,111,29,.18)!important;border-bottom:1px solid rgba(229,111,29,.12)!important;background:linear-gradient(90deg,rgba(89,43,17,.32),rgba(15,12,10,.94))!important}
    .invite-group-heading{display:flex;align-items:center;justify-content:space-between;width:100%;border:0;padding:11px 13px;color:#dec091;background:transparent;text-align:left;cursor:default}
    button.invite-group-heading{cursor:pointer}
    .invite-group-title{display:flex;align-items:center;gap:9px;font:1rem Georgia,serif}
    .invite-group-count{min-width:26px;height:26px;display:grid;place-items:center;border:1px solid rgba(229,111,29,.3);border-radius:999px;color:#efbb7d;background:rgba(99,47,18,.28);font:700 .68rem Arial,sans-serif}
    .invite-group-chevron{color:#ad8e70;font-size:.75rem;transition:transform .18s ease}
    .invite-group-heading[aria-expanded='true'] .invite-group-chevron{transform:rotate(180deg)}
    .invitation-delete-button{border:1px solid rgba(150,68,59,.42)!important;border-radius:6px!important;padding:7px 10px!important;color:#d9c7c3!important;background:linear-gradient(#5b5050,#3e3737)!important;cursor:pointer!important;transition:background .18s ease,border-color .18s ease,color .18s ease,box-shadow .18s ease!important}
    .invitation-delete-button:hover,.invitation-delete-button:focus-visible{border-color:#db493b!important;color:#fff!important;background:linear-gradient(#a72f26,#741e18)!important;box-shadow:0 0 12px rgba(219,73,59,.28)!important;outline:none!important}
    .invitation-resend-button{border:1px solid rgba(77,139,184,.42);border-radius:6px;padding:7px 10px;color:#c5e2f7;background:rgba(42,94,134,.2);cursor:pointer}
    .inviter-name{color:#d7c2a9}.inviter-role{margin-left:5px;color:#8f8174;font-size:.62rem;text-transform:capitalize}
  `;
  document.head.appendChild(style);
};

const renderSummary = rows => {
  const count = status => rows.filter(row => row.status === status).length;
  document.getElementById('invite-total').textContent = rows.length;
  document.getElementById('invite-sent').textContent = count('sent');
  document.getElementById('invite-accepted').textContent = count('accepted');
  document.getElementById('invite-pending').textContent = count('pending');
  document.getElementById('invite-failed').textContent = count('failed');
  document.getElementById('invite-expired').textContent = count('expired');
};

const rowHtml = row => {
  const detail = row.error_message
    ? `Error: ${row.error_message}`
    : row.provider_message_id
      ? `Message ID: ${row.provider_message_id}`
      : row.expires_at
        ? `Expires: ${formatDate(row.expires_at)}`
        : '—';
  const resendButton = ['failed', 'expired'].includes(row.status)
    ? `<button class="invitation-resend-button" type="button" data-resend-id="${escapeHtml(row.id)}" data-resend-email="${escapeHtml(row.email)}">Resend</button>`
    : '';
  return `<tr>
    <td>${escapeHtml(row.email)}</td>
    <td title="${escapeHtml(row.invited_by || '')}"><span class="inviter-name">${escapeHtml(row.invited_by_display || 'Unknown User')}</span>${row.invited_by_role ? `<span class="inviter-role">(${escapeHtml(row.invited_by_role)})</span>` : ''}</td>
    <td>${formatDate(row.created_at)}</td>
    <td>${formatDate(row.sent_at)}</td>
    <td><span class="invite-status-chip invite-status-${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
    <td>${escapeHtml(detail)}</td>
    <td><div class="table-actions">${resendButton}<button class="invitation-delete-button" type="button" data-delete-id="${escapeHtml(row.id)}" data-delete-email="${escapeHtml(row.email)}">Delete</button></div></td>
  </tr>`;
};

const groupHeader = (label, count, collapsible = false) => `<tr class="invite-group-row"><td colspan="7">${collapsible
  ? `<button type="button" class="invite-group-heading" data-toggle-accepted aria-expanded="${acceptedExpanded}"><span class="invite-group-title">${label}<span class="invite-group-count">${count}</span></span><span class="invite-group-chevron">▼</span></button>`
  : `<div class="invite-group-heading"><span class="invite-group-title">${label}<span class="invite-group-count">${count}</span></span></div>`}</td></tr>`;

const renderTable = () => {
  const statusFilter = document.getElementById('status-filter').value;
  const search = document.getElementById('invite-search').value.trim().toLowerCase();
  const filtered = invitationRows.filter(row => {
    const statusMatch = statusFilter === 'all' || row.status === statusFilter;
    const inviter = `${row.invited_by_display || ''} ${row.invited_by_role || ''}`.toLowerCase();
    return statusMatch && (!search || row.email.toLowerCase().includes(search) || inviter.includes(search));
  });
  const body = document.getElementById('invite-table-body');
  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty-cell">No invitations match the selected filters.</td></tr>';
    return;
  }

  const sent = filtered.filter(row => row.status === 'sent');
  const accepted = filtered.filter(row => row.status === 'accepted');
  const other = filtered.filter(row => !['sent', 'accepted'].includes(row.status));
  let html = '';
  if (sent.length) html += groupHeader('Sent Invitations', sent.length) + sent.map(rowHtml).join('');
  if (accepted.length) {
    html += groupHeader('Accepted Invitations', accepted.length, true);
    if (acceptedExpanded) html += accepted.map(rowHtml).join('');
  }
  if (other.length) html += groupHeader('Other Invitations', other.length) + other.map(rowHtml).join('');
  body.innerHTML = html;
};

const loadInvitations = async () => {
  const body = document.getElementById('invite-table-body');
  body.innerHTML = '<tr><td colspan="7" class="loading-cell">Loading invitation history...</td></tr>';
  const { data, error } = await window.DND.client.from('invitations')
    .select('id,email,status,email_provider,provider_message_id,error_message,sent_at,accepted_at,expires_at,created_at,invited_by')
    .order('created_at', { ascending: false });
  if (error) {
    body.innerHTML = `<tr><td colspan="7" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;
    window.DND.toast('Invitation history could not be loaded.', 'error');
    return;
  }

  const rows = data || [];
  const inviterIds = [...new Set(rows.map(row => row.invited_by).filter(Boolean))];
  const profileMap = new Map();
  if (inviterIds.length) {
    const { data: profiles } = await window.DND.client.from('profiles')
      .select('id,username,display_name,role').in('id', inviterIds);
    (profiles || []).forEach(profile => profileMap.set(profile.id, profile));
  }
  invitationRows = rows.map(row => {
    const profile = profileMap.get(row.invited_by);
    return {...row, invited_by_display: profile?.display_name || profile?.username || 'Unknown User', invited_by_role: profile?.role || ''};
  });
  renderSummary(invitationRows);
  renderTable();
};

const resendInvitation = async (id, email, button) => {
  button.disabled = true; button.textContent = 'Sending...';
  const { data, error } = await window.DND.client.functions.invoke('send-adventure-invite', { body: { email } });
  if (error || !data?.success) {
    button.disabled = false; button.textContent = 'Resend';
    window.DND.toast(data?.error || await getFunctionErrorMessage(error, 'The invitation could not be resent.'), 'error');
    return;
  }
  const { error: oldError } = await window.DND.client.from('invitations').delete().eq('id', id);
  window.DND.toast(oldError ? 'Invitation resent, but the older row could not be removed.' : `Invitation resent to ${email}.`, oldError ? 'error' : 'success');
  await loadInvitations();
};

const deleteInvitation = async (id, email) => {
  const confirmed = await window.DNDModal.confirm({type:'danger',kicker:'Invitation Management',title:'Delete Invitation',message:`Delete the invitation record for ${email}?\n\nThis permanently removes the invitation history record and cannot be undone.`,confirmText:'Delete Invitation',cancelText:'Keep Invitation',focusCancel:true});
  if (!confirmed) return;
  const { error } = await window.DND.client.from('invitations').delete().eq('id', id);
  if (error) { window.DND.toast(error.message || 'The invitation could not be deleted.', 'error'); return; }
  window.DND.toast(`Invitation record for ${email} was deleted.`, 'success');
  await loadInvitations();
};

const forceAdminCharacterSheetsIntoCurrentTab = () => {
  const body = document.getElementById('admin-characters-body');
  if (!body || body.dataset.sameTabReady === 'true') return;
  body.dataset.sameTabReady = 'true';
  body.addEventListener('click', event => {
    const link = event.target.closest('a[href*="/characters/view.html"],a[href*="characters/view.html"]');
    if (!link) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(link.href);
  }, true);
  const cleanTargets = () => body.querySelectorAll('a[href*="characters/view.html"]').forEach(link => link.removeAttribute('target'));
  cleanTargets();
  new MutationObserver(cleanTargets).observe(body, { childList: true, subtree: true });
};

window.addEventListener('dnd:navigation-ready', async event => {
  installAdministrationPolish();
  const { isAdmin } = event.detail;
  if (!isAdmin) { document.getElementById('access-denied').hidden = false; return; }
  document.getElementById('admin-content').hidden = false;
  forceAdminCharacterSheetsIntoCurrentTab();
  await loadInvitations();

  document.getElementById('status-filter').addEventListener('change', renderTable);
  document.getElementById('invite-search').addEventListener('input', renderTable);
  document.getElementById('refresh-admin').addEventListener('click', loadInvitations);
  document.getElementById('invite-table-body').addEventListener('click', async event => {
    const toggle = event.target.closest('[data-toggle-accepted]');
    if (toggle) { acceptedExpanded = !acceptedExpanded; renderTable(); return; }
    const resend = event.target.closest('[data-resend-id]');
    if (resend) { await resendInvitation(resend.dataset.resendId, resend.dataset.resendEmail, resend); return; }
    const remove = event.target.closest('[data-delete-id]');
    if (remove) await deleteInvitation(remove.dataset.deleteId, remove.dataset.deleteEmail);
  });

  const modal = document.getElementById('admin-invite-modal');
  const form = document.getElementById('admin-invite-form');
  const submit = form.querySelector('button[type="submit"]');
  const close = () => { modal.hidden = true; form.reset(); submit.disabled = false; submit.textContent = 'Send Invite'; };
  document.getElementById('admin-invite-button').addEventListener('click', () => { modal.hidden = false; document.getElementById('admin-invite-email').focus(); });
  document.getElementById('admin-invite-close').addEventListener('click', close);
  document.getElementById('admin-invite-cancel').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.getElementById('admin-invite-email').value.trim().toLowerCase();
    submit.disabled = true; submit.textContent = 'Sending...';
    const { data, error } = await window.DND.client.functions.invoke('send-adventure-invite', { body: { email } });
    if (error || !data?.success) {
      submit.disabled = false; submit.textContent = 'Send Invite';
      window.DND.toast(data?.error || await getFunctionErrorMessage(error, 'Invitation could not be sent.'), 'error');
      await loadInvitations(); return;
    }
    close(); window.DND.toast(`Invitation sent to ${email}.`, 'success'); await loadInvitations();
  });
});
