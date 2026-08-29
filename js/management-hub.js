(() => {
  window.addEventListener('dnd:navigation-ready', event => {
    const main = document.getElementById('management-main');
    const denied = document.getElementById('management-denied');
    if (event.detail.canManage) {
      main.hidden = false;
      document.getElementById('management-access').textContent = `${event.detail.platformRole || 'Management'} Access`;
    } else {
      denied.hidden = false;
    }
  });
})();
