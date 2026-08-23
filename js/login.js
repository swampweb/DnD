document.addEventListener('DOMContentLoaded', async () => {
  const tabs = document.querySelectorAll('[data-auth-tab]');
  const forms = document.querySelectorAll('.auth-form');
  const resetModal = document.getElementById('reset-modal');

  const openTab = (name) => {
    tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.authTab === name));
    forms.forEach(form => form.classList.toggle('active', form.id === `${name}-form`));
  };

  tabs.forEach(btn => btn.addEventListener('click', () => openTab(btn.dataset.authTab)));
  document.getElementById('forgot-button').addEventListener('click', () => resetModal.classList.add('open'));
  document.getElementById('close-reset').addEventListener('click', () => resetModal.classList.remove('open'));
  resetModal.addEventListener('click', event => {
    if (event.target === resetModal) resetModal.classList.remove('open');
  });

  if (window.DND.isConfigured) {
    const { data } = await window.DND.client.auth.getSession();
    if (data.session) window.location.replace('../dashboard/index.html');
  }

  document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!window.DND.requireConfig()) return;
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Opening the gates...';
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const { error } = await window.DND.client.auth.signInWithPassword({ email, password });
    button.disabled = false;
    button.textContent = 'Enter Three Realms';
    if (error) return window.DND.toast(error.message, 'error');
    window.location.replace('../dashboard/index.html');
  });

  document.getElementById('register-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!window.DND.requireConfig()) return;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    if (password !== confirmPassword) return window.DND.toast('The passwords do not match.', 'error');
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Creating account...';
    const email = document.getElementById('register-email').value.trim();
    const displayName = document.getElementById('register-name').value.trim();
    const { data, error } = await window.DND.client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    });
    button.disabled = false;
    button.textContent = 'Create Adventurer Account';
    if (error) return window.DND.toast(error.message, 'error');
    if (data.session) window.location.replace('../dashboard/index.html');
    else window.DND.toast('Account created. Check your email to confirm the account.', 'success');
  });

  document.getElementById('reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!window.DND.requireConfig()) return;
    const email = document.getElementById('reset-email').value.trim();
    const redirectTo = new URL('../login/index.html?reset=1', window.location.href).href;
    const { error } = await window.DND.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return window.DND.toast(error.message, 'error');
    resetModal.classList.remove('open');
    window.DND.toast('Password reset email sent.', 'success');
  });
});
