(() => {
  const ensureModal = () => {
    let root = document.getElementById('dnd-modal-root');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'dnd-modal-root';
    root.className = 'dnd-modal-backdrop';
    root.hidden = true;
    root.innerHTML = `
      <section class="dnd-modal" role="dialog" aria-modal="true" aria-labelledby="dnd-modal-title" aria-describedby="dnd-modal-message">
        <button class="dnd-modal-x" type="button" aria-label="Close dialog">×</button>
        <div class="dnd-modal-emblem" aria-hidden="true"><span id="dnd-modal-symbol">✦</span></div>
        <p class="dnd-modal-kicker" id="dnd-modal-kicker">Three Realms</p>
        <h2 id="dnd-modal-title">Notice</h2>
        <div class="dnd-modal-message" id="dnd-modal-message"></div>
        <div class="dnd-modal-actions">
          <button class="dnd-modal-button secondary" id="dnd-modal-cancel" type="button">Cancel</button>
          <button class="dnd-modal-button primary" id="dnd-modal-confirm" type="button">Confirm</button>
        </div>
      </section>`;
    document.body.appendChild(root);
    return root;
  };

  const symbolFor = type => ({
    danger: '⚔',
    warning: '!',
    success: '✓',
    info: '✦'
  }[type] || '✦');

  window.DNDModal = {
    show(options = {}) {
      const root = ensureModal();
      const dialog = root.querySelector('.dnd-modal');
      const title = root.querySelector('#dnd-modal-title');
      const message = root.querySelector('#dnd-modal-message');
      const kicker = root.querySelector('#dnd-modal-kicker');
      const symbol = root.querySelector('#dnd-modal-symbol');
      const confirm = root.querySelector('#dnd-modal-confirm');
      const cancel = root.querySelector('#dnd-modal-cancel');
      const close = root.querySelector('.dnd-modal-x');
      const type = options.type || 'info';

      dialog.dataset.type = type;
      title.textContent = options.title || 'Three Realms';
      kicker.textContent = options.kicker || 'Three Realms Adventures';
      symbol.textContent = options.symbol || symbolFor(type);
      message.textContent = options.message || '';
      confirm.textContent = options.confirmText || 'Confirm';
      cancel.textContent = options.cancelText || 'Cancel';
      cancel.hidden = options.showCancel === false;
      root.hidden = false;
      document.body.classList.add('dnd-modal-open');

      return new Promise(resolve => {
        const finish = result => {
          root.hidden = true;
          document.body.classList.remove('dnd-modal-open');
          confirm.removeEventListener('click', onConfirm);
          cancel.removeEventListener('click', onCancel);
          close.removeEventListener('click', onCancel);
          root.removeEventListener('click', onBackdrop);
          document.removeEventListener('keydown', onKeydown);
          resolve(result);
        };
        const onConfirm = () => finish(true);
        const onCancel = () => finish(false);
        const onBackdrop = event => { if (event.target === root) finish(false); };
        const onKeydown = event => {
          if (event.key === 'Escape') finish(false);
          if (event.key === 'Enter' && options.enterConfirms !== false) finish(true);
        };

        confirm.addEventListener('click', onConfirm);
        cancel.addEventListener('click', onCancel);
        close.addEventListener('click', onCancel);
        root.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKeydown);
        window.setTimeout(() => (options.focusCancel ? cancel : confirm).focus(), 30);
      });
    },

    confirm(options = {}) {
      return this.show({ ...options, showCancel: true });
    },

    alert(options = {}) {
      return this.show({ ...options, showCancel: false, confirmText: options.confirmText || 'Close' });
    }
  };
})();
