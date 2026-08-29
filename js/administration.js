let invitationRows = [];

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

const renderSummary = rows => {
  const count = status => rows.filter(row => row.status === status).length;
  document.getElementById('invite-total').textContent = rows.length;
  document.getElementById('invite-sent').textContent = count('sent');
  document.getElementById('invite-accepted').textContent = count('accepted');
  document.getElementById('invite-pending').textContent = count('pending');
  document.getElementById('invite-failed').textContent = count('failed');
  document.getElementById('invite-expired').textContent = count('expired');
};

const renderTable = () => {
  const status = document.getElementById('status-filter').value;
  const search = document.getElementById('invite-search').value.trim().toLowerCase();
  const filtered = invitationRows.filter(row => {
    const statusMatch = status === 'all' || row.status === status;
    const inviter = row.invited_by || '';
    return statusMatch && (!search || row.email.includes(search) || inviter.toLowerCase().includes(search));
  });

  const body = document.getElementById('invite-table-body');
  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty-cell">No invitations match the selected filters.</td></tr>';
    return;
  }

  body.innerHTML = filtered.map(row => {
    const detail = row.error_message
      ? `Error: ${row.error_message}`
      : row.provider_message_id
        ? `Message ID: ${row.provider_message_id}`
        : row.expires_at
          ? `Expires: ${formatDate(row.expires_at)}`
          : '—';

    const resendButton = ['failed', 'expired'].includes(row.status)
      ? `<button class="row-action resend-action" data-resend-id="${row.id}" data-resend-email="${escapeHtml(row.email)}" type="button">Resend</button>`
      : '';

    return `<tr>
      <td>${escapeHtml(row.email)}</td>
      <td>${escapeHtml(row.invited_by || 'Unknown')}</td>
      <td>${formatDate(row.created_at)}</td>
      <td>${formatDate(row.sent_at)}</td>
      <td><span class="status-badge ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
      <td class="detail-text">${escapeHtml(detail)}</td>
      <td class="action-cell">
        ${resendButton}
        <button class="row-action delete-action" data-delete-id="${row.id}" data-delete-email="${escapeHtml(row.email)}" type="button">Delete</button>
      </td>
    </tr>`;
  }).join('');
};

const loadInvitations = async () => {
  const body = document.getElementById('invite-table-body');
  body.innerHTML = '<tr><td colspan="7" class="loading-cell">Loading invitation history...</td></tr>';

  const { data, error } = await window.DND.client
    .from('invitations')
    .select('id,email,status,email_provider,provider_message_id,error_message,sent_at,accepted_at,expires_at,created_at,invited_by')
    .order('created_at', { ascending: false });

  if (error) {
    body.innerHTML = `<tr><td colspan="7" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;
    window.DND.toast('Invitation history could not be loaded.', 'error');
    return;
  }

  invitationRows = data || [];
  renderSummary(invitationRows);
  renderTable();
};

const resendInvitation = async (id, email, button) => {
  button.disabled = true;
  button.textContent = 'Sending...';

  const { data, error } = await window.DND.client.functions.invoke('send-adventure-invite', {
    body: { email }
  });

  if (error || !data?.success) {
    button.disabled = false;
    button.textContent = 'Resend';
    const message = data?.error || await getFunctionErrorMessage(error, 'The invitation could not be resent.');
    window.DND.toast(message, 'error');
    return;
  }

  // The Edge Function creates a new sent record. Remove the older failed/expired row
  // so the history does not show two active entries for the same resend action.
  const { error: deleteOldError } = await window.DND.client
    .from('invitations')
    .delete()
    .eq('id', id);

  if (deleteOldError) {
    window.DND.toast('Invitation resent, but the older history row could not be removed.', 'error');
  } else {
    window.DND.toast(`Invitation resent to ${email}.`, 'success');
  }
  await loadInvitations();
};

const deleteInvitation = async (id, email) => {
  const confirmed = await window.DNDModal.confirm({
    type: 'danger',
    kicker: 'Invitation Management',
    title: 'Delete Invitation',
    message: `Delete the invitation record for ${email}?\n\nThis permanently removes the invitation history record and cannot be undone.`,
    confirmText: 'Delete Invitation',
    cancelText: 'Keep Invitation',
    focusCancel: true
  });
  if (!confirmed) return;

  const { error } = await window.DND.client
    .from('invitations')
    .delete()
    .eq('id', id);

  if (error) {
    window.DND.toast(error.message || 'The invitation could not be deleted.', 'error');
    return;
  }

  window.DND.toast(`Invitation record for ${email} was deleted.`, 'success');
  await loadInvitations();
};

window.addEventListener('dnd:navigation-ready', async event => {
  const { isAdmin, session } = event.detail;
  let currentRole = isAdmin ? 'admin' : 'user';
  if (!isAdmin && session?.user?.id) {
    const { data } = await window.DND.client.from('profiles').select('role').eq('id', session.user.id).single();
    currentRole = String(data?.role || 'user').toLowerCase();
  }
  if (!isAdmin && currentRole !== 'manager') {
    document.getElementById('access-denied').hidden = false;
    return;
  }

  document.getElementById('admin-content').hidden = false;
  if (currentRole === 'manager') return;
  await loadInvitations();

  document.getElementById('status-filter').addEventListener('change', renderTable);
  document.getElementById('invite-search').addEventListener('input', renderTable);
  document.getElementById('refresh-admin').addEventListener('click', loadInvitations);

  document.getElementById('invite-table-body').addEventListener('click', async event => {
    const resend = event.target.closest('[data-resend-id]');
    if (resend) {
      await resendInvitation(resend.dataset.resendId, resend.dataset.resendEmail, resend);
      return;
    }

    const remove = event.target.closest('[data-delete-id]');
    if (remove) {
      await deleteInvitation(remove.dataset.deleteId, remove.dataset.deleteEmail);
    }
  });

  const modal = document.getElementById('admin-invite-modal');
  const form = document.getElementById('admin-invite-form');
  const submit = form.querySelector('button[type="submit"]');
  const close = () => {
    modal.hidden = true;
    form.reset();
    submit.disabled = false;
    submit.textContent = 'Send Invite';
  };

  document.getElementById('admin-invite-button').addEventListener('click', () => {
    modal.hidden = false;
    document.getElementById('admin-invite-email').focus();
  });
  document.getElementById('admin-invite-close').addEventListener('click', close);
  document.getElementById('admin-invite-cancel').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.getElementById('admin-invite-email').value.trim().toLowerCase();
    submit.disabled = true;
    submit.textContent = 'Sending...';

    const { data, error } = await window.DND.client.functions.invoke('send-adventure-invite', { body: { email } });
    if (error || !data?.success) {
      submit.disabled = false;
      submit.textContent = 'Send Invite';
      const message = data?.error || await getFunctionErrorMessage(error, 'Invitation could not be sent.');
      window.DND.toast(message, 'error');
      await loadInvitations();
      return;
    }

    close();
    window.DND.toast(`Invitation sent to ${email}.`, 'success');
    await loadInvitations();
  });
});
