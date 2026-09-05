(() => {
  const DRAFT_KEYS = ['three-realms-character-draft-v5','three-realms-character-draft'];
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  let currentAdventurerId = null;
  let lastDiagnostics = [];

  function draftContext() {
    for (const key of DRAFT_KEYS) {
      try {
        const value = JSON.parse(sessionStorage.getItem(key) || '{}');
        if (value.classId) return value;
      } catch (_) {}
    }
    return {};
  }

  function installStylesheet() {
    if (document.querySelector('link[data-preview-defaults-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../../css/creator-preview-defaults.css';
    link.dataset.previewDefaultsCss = 'true';
    document.head.appendChild(link);
  }

  function addSourceBadge(text, state='database') {
    const heading = $('.creator-preview .preview-attributes')?.previousElementSibling;
    if (!heading) return;
    let badge = $('#preview-default-source');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'preview-default-source';
      heading.appendChild(badge);
    }
    badge.className = `preview-default-source ${state}`;
    badge.textContent = text;
  }

  function updateAttributeCards(values) {
    const cards = $$('.creator-preview .preview-attributes span');
    const ordered = [values.strength, values.dexterity, values.constitution, values.intelligence, values.wisdom, values.charisma];
    cards.forEach((card, index) => {
      const label = card.querySelector('b');
      card.textContent = String(Number(ordered[index]) || 0);
      if (label) card.prepend(label);
    });
  }

  async function loadAdminDefaults(adventurerId) {
    const context = draftContext();
    const classId = context.classId;
    if (!classId || !adventurerId || !window.DND?.client) return;

    addSourceBadge('Checking Admin Defaults…','loading');
    const { data, error } = await window.DND.client
      .from('character_creation_defaults')
      .select('strength,dexterity,constitution,intelligence,wisdom,charisma')
      .eq('adventure_id','viking')
      .eq('class_id',classId)
      .eq('adventurer_id',adventurerId)
      .maybeSingle();

    if (error) {
      addSourceBadge('Defaults could not load','error');
      addDiagnostic({
        type:'defaults',
        title:'Admin Defaults Query Failed',
        name:adventurerId,
        requested:'character_creation_defaults',
        message:error.message
      });
      return;
    }

    if (data) {
      updateAttributeCards(data);
      addSourceBadge('Admin-managed defaults','database');
    } else {
      addSourceBadge('JSON fallback values','fallback');
    }
  }

  function diagnosticPanel() {
    let panel = $('#preview-asset-diagnostics');
    if (panel) return panel;
    const columns = $('.creator-preview .preview-columns');
    if (!columns) return null;
    panel = document.createElement('section');
    panel.id = 'preview-asset-diagnostics';
    panel.className = 'preview-asset-diagnostics';
    panel.innerHTML = '<div class="preview-diagnostic-heading"><div><span>Template Check</span><h3>Asset Diagnostics</h3></div><strong id="preview-diagnostic-count">0 issues</strong></div><div id="preview-diagnostic-list"></div>';
    columns.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function addDiagnostic(issue) {
    const key = `${issue.type}|${issue.requested}`;
    if (lastDiagnostics.some(item => item.key === key)) return;
    lastDiagnostics.push({...issue,key});
    const panel = diagnosticPanel();
    if (!panel) return;
    const count = $('#preview-diagnostic-count');
    count.textContent = `${lastDiagnostics.length} issue${lastDiagnostics.length === 1 ? '' : 's'}`;
    $('#preview-diagnostic-list').insertAdjacentHTML('beforeend', `
      <article class="preview-diagnostic-item">
        <div><span>${esc(issue.type === 'image' ? 'Broken Image Reference' : 'Data Error')}</span><strong>${esc(issue.title || issue.name || 'Template issue')}</strong><p>${esc(issue.message || 'The requested resource could not be loaded.')}</p><code>${esc(issue.requested || '')}</code></div>
        <button type="button" data-copy-diagnostic="${esc(issue.requested || '')}">Copy Path</button>
      </article>`);
  }

  function watchPreviewImages() {
    const preview = $('#preview-content');
    if (!preview) return;
    $$('img', preview).forEach(image => {
      if (image.dataset.diagnosticReady === 'true') return;
      image.dataset.diagnosticReady = 'true';
      image.addEventListener('error', () => {
        const row = image.closest('li');
        const itemName = row?.querySelector('strong')?.textContent?.trim() || image.alt || 'Preview image';
        addDiagnostic({
          type:'image',
          title:itemName,
          name:itemName,
          requested:decodeURI(image.currentSrc || image.src || ''),
          message:'The exact requested path did not return an image. Check filename spelling, capitalization, extension, and the icon value in the Adventurer JSON.'
        });
        row?.classList.add('preview-item-error');
      }, {once:true});
      if (image.complete && image.naturalWidth === 0) image.dispatchEvent(new Event('error'));
    });
  }

  function afterPreviewOpen() {
    lastDiagnostics = [];
    requestAnimationFrame(() => {
      loadAdminDefaults(currentAdventurerId);
      watchPreviewImages();
    });
  }

  window.addEventListener('dnd:navigation-ready', () => {
    installStylesheet();
    document.addEventListener('click', event => {
      const previewButton = event.target.closest('[data-preview-adventurer]');
      if (previewButton) {
        currentAdventurerId = previewButton.dataset.previewAdventurer;
        setTimeout(afterPreviewOpen, 0);
      }
      const copy = event.target.closest('[data-copy-diagnostic]');
      if (copy) {
        navigator.clipboard?.writeText(copy.dataset.copyDiagnostic || '');
        const old = copy.textContent;
        copy.textContent = 'Copied';
        setTimeout(() => copy.textContent = old, 1200);
      }
    });

    const previewContent = $('#preview-content');
    if (previewContent) new MutationObserver(watchPreviewImages).observe(previewContent,{childList:true,subtree:true});
  }, {once:true});
})();
