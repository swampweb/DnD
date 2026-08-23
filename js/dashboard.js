document.addEventListener('DOMContentLoaded', async () => {
  if (!window.DND.requireConfig()) return;

  const { data: { session } } = await window.DND.client.auth.getSession();
  if (!session) return window.location.replace('../login/index.html');

  const email = session.user.email || 'Adventurer';
  let displayName = session.user.user_metadata?.display_name || email.split('@')[0];
  let platformRole = 'user';

  const { data: profile, error: profileError } = await window.DND.client
    .from('profiles')
    .select('display_name, role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profileError && profile) {
    displayName = profile.display_name || displayName;
    platformRole = profile.role || 'user';
  }

  document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = displayName);
  document.getElementById('role-badge').textContent = platformRole;

  const isAdmin = platformRole === 'admin';
  const canManage = isAdmin || platformRole === 'manager';
  document.querySelectorAll('[data-role-link="manager"]').forEach(el => el.hidden = !canManage);
  document.querySelectorAll('[data-role-link="admin"]').forEach(el => el.hidden = !isAdmin);
  document.querySelectorAll('[data-admin-only]').forEach(el => el.hidden = !isAdmin);
  document.getElementById('management-panel').classList.toggle('visible', canManage);

  const { count: characterCount, error: characterError } = await window.DND.client
    .from('characters')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id);
  if (!characterError) document.getElementById('character-count').textContent = characterCount ?? 0;

  document.getElementById('signout-button').addEventListener('click', async () => {
    await window.DND.client.auth.signOut();
    window.location.replace('../login/index.html');
  });
});
