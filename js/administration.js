let invitationRows = [];

const formatDate = value => value
  ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

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
    const inviter = row.inviter?.display_name || row.inviter?.username || '';
    const searchMatch = !search || row.email.includes(search) || inviter.toLowerCase().includes(search);
    return statusMatch && searchMatch;
  });

  const body = document.getElementById('invite-table-body');
  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-cell">No invitations match the selected filters.</td></tr>';
    return;
  }

  body.innerHTML = filtered.map(row => {
    const inviter =
  row.invited_by || 'Unknown';
    const detail = row.error_message
      ? `Error: ${row.error_message}`
      : row.provider_message_id
        ? `Message ID: ${row.provider_message_id}`
        : row.expires_at
          ? `Expires: ${formatDate(row.expires_at)}`
          : '—';
    return `<tr>
      <td>${escapeHtml(row.email)}</td>
      <td>${escapeHtml(inviter)}</td>
      <td>${formatDate(row.created_at)}</td>
      <td>${formatDate(row.sent_at)}</td>
      <td><span class="status-badge ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
      <td class="detail-text">${escapeHtml(detail)}</td>
    </tr>`;
  }).join('');
};

const loadInvitations = async () => {
  const body = document.getElementById('invite-table-body');
  body.innerHTML = '<tr><td colspan="6" class="loading-cell">Loading invitation history...</td></tr>';

const { data, error } = await window.DND.client
  .from('invitations')
  .select(`
    id,
    email,
    status,
    email_provider,
    provider_message_id,
    error_message,
    sent_at,
    accepted_at,
    expires_at,
    created_at,
    invited_by
  `)
  .order('created_at', { ascending: false });

  if (error) {
    body.innerHTML = `<tr><td colspan="6" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;
    window.DND.toast('Invitation history could not be loaded.', 'error');
    return;
  }

  invitationRows = data || [];
  renderSummary(invitationRows);
  renderTable();
};

window.addEventListener('dnd:navigation-ready', async event => {
  const { isAdmin } = event.detail;
  if (!isAdmin) {
    document.getElementById('access-denied').hidden = false;
    return;
  }

  document.getElementById('admin-content').hidden = false;
  await loadInvitations();

  document.getElementById('status-filter').addEventListener('change', renderTable);
  document.getElementById('invite-search').addEventListener('input', renderTable);
  document.getElementById('refresh-admin').addEventListener('click', loadInvitations);

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
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('admin-invite-email').value.trim().toLowerCase();
    submit.disabled = true;
    submit.textContent = 'Sending...';

    const { data, error } = await window.DND.client.functions.invoke('send-adventure-invite', { body: { email } });
    if (error || !data?.success) {
      submit.disabled = false;
      submit.textContent = 'Send Invite';
      window.DND.toast(data?.error || error?.message || 'Invitation could not be sent.', 'error');
      await loadInvitations();
      return;
    }

    close();
    window.DND.toast(`Invitation sent to ${email}.`, 'success');
    await loadInvitations();
  });
});
