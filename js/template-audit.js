(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const siteUrl = path => window.DND?.siteUrl ? window.DND.siteUrl(path) : `/${String(path).replace(/^\//,'')}`;
  let running = false;

  async function getJson(path) {
    const response = await fetch(encodeURI(siteUrl(path)), { cache:'no-cache' });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return response.json();
  }

  async function exists(path) {
    try { return (await fetch(encodeURI(siteUrl(path)), { cache:'no-cache' })).ok; }
    catch { return false; }
  }

  function assetsFor(classId, heroId, json) {
    const root = `assets/classes/viking/${classId}/${heroId}`;
    const assets = [];
    const characterAssets = { portrait:'Portrait', model:'Model Render', boardPiece:'Board Piece', banner:'Preview Banner', previewCard:'Preview Card' };
    Object.entries(characterAssets).forEach(([key,label]) => assets.push({label,file:json.assets?.[key],type:'Character Asset'}));
    (json.starterAbilities || []).forEach(item => assets.push({label:item.name || item.id,file:item.icon,type:'Ability Icon'}));
    (json.starterEquipment || []).forEach(item => assets.push({label:item.name || item.id,file:item.icon,type:'Equipment Icon'}));
    return assets.map(item => ({...item,path:item.file ? `${root}/${item.file}` : ''}));
  }

  async function auditHero(classData, heroId) {
    const jsonPath = `assets/classes/viking/${classData.id}/${heroId}/${heroId}.json`;
    const result = {classId:classData.id,className:classData.name || classData.id,heroId,heroName:heroId,jsonPath,issues:[],checks:[]};
    let json;
    try {
      json = await getJson(jsonPath);
      result.heroName = json.name || heroId;
      result.checks.push({label:'Adventurer JSON',state:'pass',detail:'JSON loaded.'});
    } catch (error) {
      result.issues.push({label:'Adventurer JSON',path:jsonPath,detail:error.message});
      result.checks.push({label:'Adventurer JSON',state:'fail',detail:error.message});
      return result;
    }

    for (const asset of assetsFor(classData.id,heroId,json)) {
      if (!asset.file) {
        result.issues.push({label:asset.label,path:'Not defined in JSON',detail:`${asset.type} filename is missing.`});
        result.checks.push({label:asset.label,state:'fail',detail:'Filename missing.'});
        continue;
      }
      const found = await exists(asset.path);
      result.checks.push({label:asset.label,state:found?'pass':'fail',detail:found?asset.file:`Missing: ${asset.file}`});
      if (!found) result.issues.push({label:asset.label,path:siteUrl(asset.path),detail:`${asset.type}: exact JSON path did not return a file.`});
    }

    const base = json.baseAttributes || {};
    const attributesValid = ['str','dex','con','int','wis','cha'].every(key => Number.isFinite(Number(base[key])));
    result.checks.push({label:'JSON Attribute Structure',state:attributesValid?'pass':'fail',detail:attributesValid?'Six numeric keys found.':'Expected numeric str, dex, con, int, wis, and cha.'});
    if (!attributesValid) result.issues.push({label:'JSON Attribute Structure',path:jsonPath,detail:'baseAttributes is missing or invalid.'});

    const {data,error} = await window.DND.client.from('character_creation_defaults')
      .select('strength,dexterity,constitution,intelligence,wisdom,charisma')
      .eq('adventure_id','viking').eq('class_id',classData.id).eq('adventurer_id',heroId).maybeSingle();
    if (error) {
      result.checks.push({label:'Admin Defaults',state:'fail',detail:error.message});
      result.issues.push({label:'Admin Defaults',path:'character_creation_defaults',detail:error.message});
    } else if (data) {
      result.checks.push({label:'Admin Defaults',state:'pass',detail:`STR ${data.strength} • DEX ${data.dexterity} • CON ${data.constitution} • INT ${data.intelligence} • WIS ${data.wisdom} • CHA ${data.charisma}`});
    } else {
      result.checks.push({label:'Admin Defaults',state:'warning',detail:'No Supabase override. JSON fallback will be used.'});
    }
    return result;
  }

  const checkPriority = state => state === 'fail' ? 0 : state === 'warning' ? 1 : 2;
  const heroPriority = hero => hero.issues.length ? 0 : hero.checks.some(check => check.state === 'warning') ? 1 : 2;

  function heroCard(hero) {
    const failed = hero.issues.length;
    const warnings = hero.checks.filter(check => check.state === 'warning').length;
    const state = failed ? 'failed' : warnings ? 'warning' : 'healthy';
    const passed = hero.checks.filter(check => check.state === 'pass').length;
    const total = hero.checks.length || 1;
    const score = Math.round((passed / total) * 100);
    const sortedChecks = [...hero.checks].sort((a,b) => checkPriority(a.state) - checkPriority(b.state));
    return `<article class="audit-hero-card ${state}">
      <div class="audit-hero-heading"><div><span>${esc(hero.className)}</span><h4>${esc(hero.heroName)}</h4></div><b>${score}%</b></div>
      <div class="audit-health-line"><i style="width:${score}%"></i></div>
      <div class="audit-status-row"><span>${failed ? `${failed} issue${failed===1?'':'s'}` : warnings ? `${warnings} warning${warnings===1?'':'s'}` : 'Template healthy'}</span><strong>${state}</strong></div>
      <details class="audit-checks" ${failed ? 'open' : ''}><summary>View checks <span>${failed ? `${failed} issue${failed===1?'':'s'}` : warnings ? `${warnings} warning${warnings===1?'':'s'}` : `${passed} passed`}</span></summary><div class="audit-check-list">${sortedChecks.map(check => `<div class="${check.state}"><span>${check.state==='pass'?'✓':'!'}</span><p><b>${esc(check.label)}</b><small>${esc(check.detail)}</small></p></div>`).join('')}</div></details>
      ${hero.issues.length ? `<div class="audit-issue-list"><h5>Items requiring attention</h5>${hero.issues.map(issue => `<div><b>${esc(issue.label)}</b><p>${esc(issue.detail)}</p><code>${esc(issue.path)}</code><button data-copy-audit-path="${esc(issue.path)}">Copy Path</button></div>`).join('')}</div>` : ''}
      <div class="audit-card-actions"><a href="${esc(siteUrl(hero.jsonPath))}" target="_blank" rel="noopener">View JSON</a><button data-copy-audit-path="${esc(siteUrl(`assets/classes/viking/${hero.classId}/${hero.heroId}/`))}">Copy Folder Path</button></div>
    </article>`;
  }

  function render(results) {
    const groups = results.reduce((map,item) => {
      if (!map.has(item.className)) map.set(item.className,[]);
      map.get(item.className).push(item);
      return map;
    }, new Map());

    const sortedGroups = [...groups.entries()].sort(([,a],[,b]) => {
      const aIssues = a.reduce((sum,item)=>sum+item.issues.length,0);
      const bIssues = b.reduce((sum,item)=>sum+item.issues.length,0);
      const aWarnings = a.reduce((sum,item)=>sum+item.checks.filter(c=>c.state==='warning').length,0);
      const bWarnings = b.reduce((sum,item)=>sum+item.checks.filter(c=>c.state==='warning').length,0);
      return (bIssues-aIssues) || (bWarnings-aWarnings);
    });

    $('#template-audit-results').innerHTML = sortedGroups.map(([className,heroes]) => {
      heroes.sort((a,b) => heroPriority(a)-heroPriority(b));
      const issueCount = heroes.reduce((sum,hero)=>sum+hero.issues.length,0);
      const warningCount = heroes.reduce((sum,hero)=>sum+hero.checks.filter(c=>c.state==='warning').length,0);
      const healthyCount = heroes.filter(hero=>hero.issues.length===0 && !hero.checks.some(c=>c.state==='warning')).length;
      const status = issueCount ? 'failed' : warningCount ? 'warning' : 'healthy';
      const open = issueCount || warningCount ? 'open' : '';
      return `<details class="audit-class-group ${status}" ${open}>
        <summary class="audit-class-summary"><div><span>Class</span><h3>${esc(className)}</h3></div><div class="audit-class-metrics"><b>${healthyCount}/${heroes.length} Healthy</b>${issueCount?`<em class="issues">${issueCount} issue${issueCount===1?'':'s'}</em>`:''}${warningCount?`<em class="warnings">${warningCount} warning${warningCount===1?'':'s'}</em>`:''}<i>⌄</i></div></summary>
        <div class="audit-hero-grid">${heroes.map(heroCard).join('')}</div>
      </details>`;
    }).join('');
  }

  async function run() {
    if (running) return;
    running = true;
    const button = $('#run-template-audit');
    const progress = $('#template-audit-progress');
    button.disabled = true; button.textContent = 'Scanning...'; progress.hidden = false;
    $('#template-audit-results').innerHTML = '<div class="template-audit-empty">Scanning templates and assets...</div>';
    const output = [];
    try {
      const manifest = await getJson('assets/classes/viking/classes.json');
      const classes = [];
      for (const id of manifest.classes || []) {
        try { classes.push(await getJson(`assets/classes/viking/${id}/class.json`)); }
        catch (error) { output.push({classId:id,className:id,heroId:'class',heroName:'Class Definition',jsonPath:`assets/classes/viking/${id}/class.json`,issues:[{label:'Class JSON',path:`assets/classes/viking/${id}/class.json`,detail:error.message}],checks:[{label:'Class JSON',state:'fail',detail:error.message}]}); }
      }
      const total = classes.reduce((sum,item)=>sum+(item.heroes||[]).length,0);
      let completed = 0;
      for (const classData of classes) for (const heroId of classData.heroes || []) {
        $('#template-audit-progress-copy').textContent = `Scanning ${classData.name || classData.id} • ${heroId}`;
        $('#template-audit-progress-bar').style.width = `${total ? completed/total*100 : 0}%`;
        output.push(await auditHero(classData,heroId)); completed++;
      }
      $('#template-audit-progress-bar').style.width = '100%';
      const healthy = output.filter(item=>item.issues.length===0 && !item.checks.some(c=>c.state==='warning')).length;
      const issues = output.reduce((sum,item)=>sum+item.issues.length,0);
      const warnings = output.reduce((sum,item)=>sum+item.checks.filter(c=>c.state==='warning').length,0);
      $('#template-audit-summary').textContent = `${healthy} of ${output.length} templates fully healthy • ${issues} issue${issues===1?'':'s'} • ${warnings} warning${warnings===1?'':'s'}`;
      render(output);
    } catch (error) {
      $('#template-audit-results').innerHTML = `<div class="template-audit-error">${esc(error.message)}</div>`;
      $('#template-audit-summary').textContent = 'Template scan failed.';
    } finally {
      running = false; button.disabled = false; button.textContent = 'Scan All Templates';
      setTimeout(()=>progress.hidden=true,700);
    }
  }

  window.addEventListener('dnd:navigation-ready', event => {
    if (!event.detail.isAdmin) return;
    $('#template-audit-panel')?.addEventListener('toggle', event => {
      if (event.currentTarget.open && !event.currentTarget.dataset.scanned) { event.currentTarget.dataset.scanned='1'; run(); }
    });
    $('#run-template-audit')?.addEventListener('click', run);
    $('#template-audit-results')?.addEventListener('click', event => {
      const button = event.target.closest('[data-copy-audit-path]');
      if (!button) return;
      navigator.clipboard?.writeText(button.dataset.copyAuditPath || '');
      const previous = button.textContent; button.textContent='Copied'; setTimeout(()=>button.textContent=previous,1200);
    });
  });
})();
