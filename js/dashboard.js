window.addEventListener('dnd:navigation-ready', async event => {
  const { session, isAdmin, canManage } = event.detail;

  document.querySelectorAll('[data-admin-only]').forEach(element => element.hidden = !isAdmin);
  document.getElementById('management-panel').hidden = !canManage;

  const { count: characterCount } = await window.DND.client
    .from('characters')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id);

  const totalCharacters = characterCount ?? 0;
  document.getElementById('character-count').textContent = totalCharacters;
  if (totalCharacters > 0) {
    document.getElementById('character-summary-title').textContent = `${totalCharacters} Character${totalCharacters === 1 ? '' : 's'}`;
    document.getElementById('character-summary-text').textContent = 'Open Characters to manage your heroes.';
  }

  if (!canManage) return;

  const modal = document.getElementById('invite-modal');
  const form = document.getElementById('invite-form');
  const submitButton = form?.querySelector('button[type="submit"]');

  const closeModal = () => {
    modal.hidden = true;
    form.reset();
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Send Invite';
    }
  };

  document.getElementById('invite-adventurer-button')?.addEventListener('click', () => {
    modal.hidden = false;
    document.getElementById('invite-email')?.focus();
  });
  document.getElementById('invite-close')?.addEventListener('click', closeModal);
  document.getElementById('invite-cancel')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.getElementById('invite-email').value.trim().toLowerCase();

    submitButton.disabled = true;
    submitButton.textContent = 'Sending Invite...';

    const { data, error } = await window.DND.client.functions.invoke('send-adventure-invite', {
      body: { email },
    });

    if (error || !data?.success) {
      submitButton.disabled = false;
      submitButton.textContent = 'Send Invite';
      const message = data?.error || error?.message || 'The invitation could not be sent.';
      window.DND.toast(message, 'error');
      return;
    }

    closeModal();
    window.DND.toast(`Invitation sent to ${email}.`, 'success');
  });
});
