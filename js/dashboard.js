window.addEventListener('dnd:navigation-ready', async event => {
  const { session, platformRole, isAdmin, canManage } = event.detail;

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

  if (platformRole === 'user') document.getElementById('management-panel').hidden = true;
});
