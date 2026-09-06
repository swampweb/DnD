(() => {
  const raw = window.DND_CONFIG || {};
  const cfg = {
    SUPABASE_URL: String(raw.SUPABASE_URL || '').trim(),
    SUPABASE_ANON_KEY: String(raw.SUPABASE_ANON_KEY || '').trim()
  };
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes('YOUR-PROJECT') &&
    !cfg.SUPABASE_ANON_KEY.includes('YOUR-PUBLIC');

  window.DND = window.DND || {};
  window.DND.isConfigured = Boolean(configured);
  window.DND.client = configured
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;
  window.DND.session = null;

  window.DND.sessionReady = configured
    ? window.DND.client.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        window.DND.session = data?.session || null;
        return window.DND.session;
      }).catch(error => {
        console.error('Supabase session could not be restored:', error);
        window.DND.session = null;
        return null;
      })
    : Promise.resolve(null);

  if (configured) {
    window.DND.client.auth.onAuthStateChange((_event, session) => {
      window.DND.session = session || null;
      window.dispatchEvent(new CustomEvent('dnd:session-changed', {
        detail: { session: window.DND.session }
      }));
    });
  }

  window.DND.getSession = async () => {
    if (window.DND.session) return window.DND.session;
    await window.DND.sessionReady;
    if (window.DND.session) return window.DND.session;
    if (!window.DND.client) return null;
    const { data, error } = await window.DND.client.auth.getSession();
    if (error) throw error;
    window.DND.session = data?.session || null;
    return window.DND.session;
  };

  window.DND.toast = (message, type = '') => {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    window.clearTimeout(window.DND.toastTimer);
    window.DND.toastTimer = window.setTimeout(() => toast.classList.remove('show'), 4200);
  };

  window.DND.requireConfig = () => {
    if (window.DND.isConfigured) return true;
    window.DND.toast('Add your Supabase URL and public anon key to js/config.js first.', 'error');
    return false;
  };
})();
