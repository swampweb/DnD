(() => {
  const getSiteRoot = () => {
    if (window.location.hostname.endsWith('github.io')) {
      const repository = window.location.pathname.split('/').filter(Boolean)[0];
      return repository ? `/${repository}` : '';
    }
    return '';
  };

  const siteRoot = getSiteRoot();
  window.DND = window.DND || {};
  window.DND.siteRoot = siteRoot;
  window.DND.siteUrl = path => `${siteRoot}/${String(path).replace(/^\//, '')}`;

  const initializeNavigation = async () => {
    const mount = document.getElementById('site-navigation');
    if (!mount) return;

    try {
      const response = await fetch(window.DND.siteUrl('components/navigation.html'), { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Navigation returned ${response.status}`);
      mount.innerHTML = await response.text();

      mount.querySelectorAll('[data-site-path]').forEach(element => {
        const path = element.dataset.sitePath;
        const url = window.DND.siteUrl(path);
        if (element.tagName === 'IMG') element.src = encodeURI(url);
        else element.href = url;
      });

      const activePage = mount.dataset.activePage || '';
      mount.querySelector(`[data-page="${activePage}"]`)?.classList.add('active');

      if (!window.DND.requireConfig()) return;
      const { data: { session } } = await window.DND.client.auth.getSession();
      if (!session) {
        window.location.replace(window.DND.siteUrl('pages/login/index.html'));
        return;
      }

      const email = session.user.email || 'Adventurer';
      let displayName = session.user.user_metadata?.display_name || email.split('@')[0];
      let platformRole = 'user';

      const { data: profile } = await window.DND.client
        .from('profiles')
        .select('display_name, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        displayName = profile.display_name || displayName;
        platformRole = profile.role || 'user';
      }

      mount.querySelectorAll('[data-user-name]').forEach(element => element.textContent = displayName);
      const badge = mount.querySelector('#role-badge');
      if (badge) badge.textContent = platformRole;

      const isAdmin = platformRole === 'admin';
      const canManage = isAdmin || platformRole === 'manager';
      mount.querySelectorAll('[data-role-link="manager"]').forEach(element => element.hidden = !canManage);
      mount.querySelectorAll('[data-role-link="admin"]').forEach(element => element.hidden = !isAdmin);

      mount.querySelector('#signout-button')?.addEventListener('click', async () => {
        await window.DND.client.auth.signOut();
        window.location.replace(window.DND.siteUrl('pages/login/index.html'));
      });

      window.dispatchEvent(new CustomEvent('dnd:navigation-ready', {
        detail: { session, displayName, platformRole, isAdmin, canManage }
      }));
    } catch (error) {
      console.error(error);
      mount.innerHTML = '<div class="navigation-error">Navigation could not be loaded.</div>';
    }
  };

  document.addEventListener('DOMContentLoaded', initializeNavigation);
})();
