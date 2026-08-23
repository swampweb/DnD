const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
window.addEventListener('dnd:navigation-ready', async event => {
  const { session } = event.detail;
  const library = document.getElementById('character-library');
  const { data, error } = await window.DND.client.from('characters').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false});
  if(error){library.innerHTML=`<div class="empty-library"><h2>Characters Could Not Load</h2><p>${esc(error.message)}</p></div>`;return}
  if(!data?.length){library.innerHTML='<div class="empty-library"><h2>No Characters Yet</h2><p>Create a universal character to begin the Three Realms journey.</p><a href="create.html">Create Character</a></div>';return}
  library.innerHTML=data.map(c=>`<article class="character-card"><img src="${esc(c.portrait_url||'../../assets/images/shared/character-placeholder.png')}" alt="${esc(c.name)} portrait"><div class="character-card-content"><h2>${esc(c.name)}</h2><p class="subtitle">Level ${c.level||1} ${esc(c.race||'Unknown')} ${esc(c.class||'Adventurer')}</p><span class="status">${esc(c.status||'Active')}</span><div class="card-stat-row"><div><strong>${c.current_hp??0}</strong><span>HP</span></div><div><strong>${c.gold??0}</strong><span>Gold</span></div><div><strong>${c.experience??0}</strong><span>XP</span></div></div><div class="card-actions"><a href="view.html?id=${c.id}">View Sheet</a><a href="create.html?id=${c.id}">Edit</a></div></div></article>`).join('');
});
