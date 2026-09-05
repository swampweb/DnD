(() => {
  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  let activeCharacter = null;
  let lastReport = null;

  function installStylesheet() {
    if (document.querySelector('link[data-character-repair-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../../css/character-repair.css';
    link.dataset.characterRepairCss = 'true';
    document.head.appendChild(link);
  }

  function installModal() {
    if ($('#character-repair-modal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="repair-backdrop" id="character-repair-modal" hidden>
        <section class="repair-modal" role="dialog" aria-modal="true" aria-labelledby="repair-modal-title">
          <button class="repair-modal-close" id="repair-modal-close" type="button" aria-label="Close">×</button>
          <header class="repair-modal-header">
            <div class="repair-emblem" aria-hidden="true">✦</div>
            <div><p>Character Management</p><h2 id="repair-modal-title">Character Health Check</h2><span id="repair-character-copy">Select a Character to inspect.</span></div>
          </header>
          <div class="repair-summary" id="repair-summary"></div>
          <div class="repair-results" id="repair-results"></div>
          <footer class="repair-modal-actions">
            <button class="repair-secondary" id="repair-close" type="button">Close</button>
            <button class="repair-primary" id="repair-run" type="button">Run Health Check</button>
            <button class="repair-warning" id="repair-apply" type="button" hidden>Apply Safe Repairs</button>
          </footer>
        </section>
      </div>`);

    const close = () => { $('#character-repair-modal').hidden = true; };
    $('#repair-modal-close').addEventListener('click', close);
    $('#repair-close').addEventListener('click', close);
    $('#character-repair-modal').addEventListener('click', event => {
      if (event.target.id === 'character-repair-modal') close();
    });
    $('#repair-run').addEventListener('click', runHealthCheck);
    $('#repair-apply').addEventListener('click', applyRepairs);
  }

  function installRepairButtons() {
    const body = $('#admin-characters-body');
    if (!body) return;
    body.querySelectorAll('tr').forEach(row => {
      const actions = row.querySelector('.character-admin-actions');
      const view = actions?.querySelector('a[href*="characters/view.html"]');
      if (!actions || !view || actions.querySelector('[data-repair-character]')) return;
      const id = new URL(view.href, location.href).searchParams.get('id');
      const name = row.cells?.[0]?.textContent?.trim() || 'Character';
      const player = row.cells?.[1]?.textContent?.trim() || 'Unknown Player';
      if (!id) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-repair-button';
      button.dataset.repairCharacter = id;
      button.dataset.repairName = name;
      button.dataset.repairPlayer = player;
      button.textContent = 'Repair';
      actions.insertBefore(button, actions.querySelector('[data-admin-delete-character]'));
    });
  }

  function watchCharacterRows() {
    const body = $('#admin-characters-body');
    if (!body || body.dataset.repairObserver === 'true') return;
    body.dataset.repairObserver = 'true';
    installRepairButtons();
    new MutationObserver(installRepairButtons).observe(body, { childList: true, subtree: true });
    body.addEventListener('click', event => {
      const button = event.target.closest('[data-repair-character]');
      if (!button) return;
      activeCharacter = {
        id: button.dataset.repairCharacter,
        name: button.dataset.repairName,
        player: button.dataset.repairPlayer
      };
      openRepairModal();
    });
  }

  function openRepairModal() {
    lastReport = null;
    $('#repair-character-copy').textContent = `${activeCharacter.name} • ${activeCharacter.player}`;
    $('#repair-summary').innerHTML = '<div class="repair-summary-card neutral"><span>Status</span><strong>Not Checked</strong><small>Run the health check to inspect this character.</small></div>';
    $('#repair-results').innerHTML = '<div class="repair-empty">No diagnostics have been run.</div>';
    $('#repair-apply').hidden = true;
    $('#repair-run').disabled = false;
    $('#repair-run').textContent = 'Run Health Check';
    $('#character-repair-modal').hidden = false;
  }

  function severityLabel(report) {
    if (report.repairable_count > 0) return ['Repair Available', 'repair'];
    if (report.warning_count > 0) return ['Warnings Found', 'warning'];
    return ['Healthy', 'healthy'];
  }

  function renderReport(report) {
    lastReport = report;
    const [label, className] = severityLabel(report);
    const details = report.character || {};
    const counts = report.usage || {};
    const attrs = details.attributes || {};
    $('#repair-summary').innerHTML = `
      <section class="repair-character-overview">
        <div class="repair-character-portrait">${details.portrait_url ? `<img src="${escapeHtml(details.portrait_url)}" alt="${escapeHtml(details.name || 'Character')} portrait">` : '<span>No Portrait</span>'}</div>
        <div class="repair-character-identity"><p>Character Summary</p><h3>${escapeHtml(details.name || activeCharacter.name)}</h3><span>${escapeHtml(details.class || 'Unknown Class')} • ${escapeHtml(details.adventurer || 'Unknown Adventurer')}</span><div class="repair-identity-grid"><b>Owner<small>${escapeHtml(details.owner_name || activeCharacter.player)}</small></b><b>Role<small>${escapeHtml(details.owner_role || 'Unknown')}</small></b><b>Level<small>${escapeHtml(details.level ?? '—')}</small></b><b>Status<small>${escapeHtml(details.status || '—')}</small></b><b>Created<small>${escapeHtml(details.created_display || '—')}</small></b><b>Updated<small>${escapeHtml(details.updated_display || '—')}</small></b></div></div>
        <div class="repair-resource-snapshot"><div><span>HP</span><strong>${details.current_hp ?? 0} / ${details.max_hp ?? 0}</strong></div><div><span>Mana</span><strong>${details.current_mana ?? 0} / ${details.max_mana ?? 0}</strong></div><div><span>XP</span><strong>${details.experience ?? 0} / ${details.experience_to_next ?? 0}</strong></div></div>
      </section>
      <div class="repair-summary-grid">
        <div class="repair-summary-card ${className}"><span>Overall Status</span><strong>${escapeHtml(label)}</strong><small>${report.issue_count} issue${report.issue_count === 1 ? '' : 's'} found</small></div>
        <div class="repair-summary-card"><span>Safe Repairs</span><strong>${report.repairable_count}</strong><small>Can be corrected automatically</small></div>
        <div class="repair-summary-card"><span>Warnings</span><strong>${report.warning_count}</strong><small>Information or manual review</small></div>
      </div>
      <section class="repair-usage-section"><h3>Usage Snapshot</h3><div class="repair-usage-grid">${[['Inventory',counts.inventory],['Skills',counts.skills],['Journal',counts.journal],['Campaigns',counts.campaigns],['Achievements',counts.achievements]].map(([name,value])=>`<div><span>${name}</span><strong>${value ?? 0}</strong></div>`).join('')}</div></section>
      <section class="repair-attribute-section"><h3>Attributes</h3><div class="repair-attribute-grid">${[['STR',attrs.str],['DEX',attrs.dex],['CON',attrs.con],['INT',attrs.int],['WIS',attrs.wis],['CHA',attrs.cha]].map(([name,value])=>`<div><span>${name}</span><strong>${value ?? 0}</strong></div>`).join('')}</div></section>`;

    const groups = report.checks.reduce((map, check) => {
      const category = check.category || 'General';
      if (!map.has(category)) map.set(category, []);
      map.get(category).push(check);
      return map;
    }, new Map());

    $('#repair-results').innerHTML = [...groups.entries()].map(([category, checks]) => `
      <section class="repair-check-group">
        <h3>${escapeHtml(category)}</h3>
        ${checks.map(check => `
          <article class="repair-check ${escapeHtml(check.state)}">
            <span class="repair-check-icon">${check.state === 'healthy' ? '✓' : check.state === 'repair' ? '!' : '•'}</span>
            <div><strong>${escapeHtml(check.label)}</strong><p>${escapeHtml(check.message)}</p></div>
            <span class="repair-check-state">${escapeHtml(check.state === 'healthy' ? 'Healthy' : check.state === 'repair' ? 'Repair' : 'Review')}</span>
          </article>`).join('')}
      </section>`).join('');

    $('#repair-apply').hidden = report.repairable_count === 0;
  }

  async function runHealthCheck() {
    if (!activeCharacter) return;
    const button = $('#repair-run');
    button.disabled = true;
    button.textContent = 'Checking...';
    const { data, error } = await window.DND.client.rpc('character_health_check', {
      p_character_id: activeCharacter.id
    });
    button.disabled = false;
    button.textContent = 'Run Health Check';
    if (error) {
      $('#repair-results').innerHTML = `<div class="repair-error">${escapeHtml(error.message)}</div>`;
      window.DND.toast('Character health check failed.', 'error');
      return;
    }
    renderReport(data);
  }

  async function applyRepairs() {
    if (!activeCharacter || !lastReport?.repairable_count) return;
    const confirmed = await window.DNDModal.confirm({
      type: 'warning',
      kicker: 'Character Repair Utility',
      title: 'Apply Safe Repairs',
      message: `Apply ${lastReport.repairable_count} safe repair${lastReport.repairable_count === 1 ? '' : 's'} to ${activeCharacter.name}?\n\nThe utility repairs invalid core values and removes empty relationship rows. It does not create Equipment, Skills, Journal entries, Campaigns, Achievements, or Inventory items.`,
      confirmText: 'Apply Repairs',
      cancelText: 'Cancel',
      focusCancel: true
    });
    if (!confirmed) return;

    const button = $('#repair-apply');
    button.disabled = true;
    button.textContent = 'Repairing...';
    const { data, error } = await window.DND.client.rpc('repair_character_safe', {
      p_character_id: activeCharacter.id
    });
    button.disabled = false;
    button.textContent = 'Apply Safe Repairs';
    if (error) {
      window.DND.toast(error.message || 'The character could not be repaired.', 'error');
      return;
    }
    window.DND.toast(`${activeCharacter.name} repairs applied.`, 'success');
    renderReport(data);
  }

  window.addEventListener('dnd:navigation-ready', event => {
    if (!event.detail.isAdmin) return;
    installStylesheet();
    installModal();
    watchCharacterRows();
  });
})();
