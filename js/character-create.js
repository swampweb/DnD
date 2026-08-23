window.addEventListener('dnd:navigation-ready', async event => {
  const { session } = event.detail;
  const form=document.getElementById('character-form');
  const params=new URLSearchParams(location.search);const editId=params.get('id');
  if(editId){
    const {data,error}=await window.DND.client.from('characters').select('*').eq('id',editId).eq('user_id',session.user.id).single();
    if(error){window.DND.toast(error.message,'error');return}
    const map={name:'character-name',title:'character-title',level:'character-level',race:'character-race',class:'character-class',background:'character-background',alignment:'character-alignment',age:'character-age',status:'character-status',strength:'stat-strength',dexterity:'stat-dexterity',constitution:'stat-constitution',intelligence:'stat-intelligence',wisdom:'stat-wisdom',charisma:'stat-charisma',current_hp:'current-hp',max_hp:'max-hp',current_mana:'current-mana',max_mana:'max-mana',experience:'experience',experience_to_next:'experience-next',gold:'gold',silver:'silver',portrait_url:'portrait-url',biography:'character-biography'};
    Object.entries(map).forEach(([key,id])=>{if(data[key]!==null&&data[key]!==undefined)document.getElementById(id).value=data[key]});
    document.querySelector('.save-character').textContent='Save Character';document.querySelector('.character-page-heading h1').textContent='Edit Character';
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Saving...';
    const n=id=>Number(document.getElementById(id).value)||0;
    const payload={user_id:session.user.id,name:document.getElementById('character-name').value.trim(),title:document.getElementById('character-title').value.trim()||null,level:n('character-level')||1,race:document.getElementById('character-race').value.trim()||null,class:document.getElementById('character-class').value.trim()||null,background:document.getElementById('character-background').value.trim()||null,alignment:document.getElementById('character-alignment').value.trim()||null,age:n('character-age')||null,status:document.getElementById('character-status').value,strength:n('stat-strength'),dexterity:n('stat-dexterity'),constitution:n('stat-constitution'),intelligence:n('stat-intelligence'),wisdom:n('stat-wisdom'),charisma:n('stat-charisma'),current_hp:n('current-hp'),max_hp:n('max-hp'),current_mana:n('current-mana'),max_mana:n('max-mana'),experience:n('experience'),experience_to_next:n('experience-next'),gold:n('gold'),silver:n('silver'),portrait_url:document.getElementById('portrait-url').value.trim()||null,biography:document.getElementById('character-biography').value.trim()||null,updated_at:new Date().toISOString()};
    const result=editId?await window.DND.client.from('characters').update(payload).eq('id',editId).eq('user_id',session.user.id):await window.DND.client.from('characters').insert(payload);
    if(result.error){button.disabled=false;button.textContent=editId?'Save Character':'Create Character';window.DND.toast(result.error.message,'error');return}
    await window.DNDModal.alert({type:'success',title:editId?'Character Updated':'Character Created',message:`${payload.name} is ready in the character library.`,confirmText:'View Characters'});location.href='index.html';
  });
});
