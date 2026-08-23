(() => {
  const cfg = window.DND_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes('YOUR-PROJECT') &&
    !cfg.SUPABASE_ANON_KEY.includes('YOUR-PUBLIC');

  window.DND = window.DND || {};
  window.DND.isConfigured = Boolean(configured);
  window.DND.client = configured
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

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
