document.addEventListener('DOMContentLoaded', async () => {
  if (!window.DND.requireConfig()) return;
  const { data: { session } } = await window.DND.client.auth.getSession();
  if (!session) return window.location.replace('../login/index.html');

  const email = session.user.email || 'Adventurer';
  const metaName = session.user.user_metadata?.display_name;
  const fallbackName = email.split('@')[0];
  const displayName = metaName || fallbackName;
  document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = displayName);

  const { count: characterCount } = await window.DND.client
    .from('characters')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id);
  document.getElementById('character-count').textContent = characterCount ?? 0;

  document.getElementById('signout-button').addEventListener('click', async () => {
    await window.DND.client.auth.signOut();
    window.location.replace('../login/index.html');
  });
});
