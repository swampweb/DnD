(() => {
  const $=selector=>document.querySelector(selector);
  const ATTRS=[
    ['str','Strength','STR','Physical power used for melee attacks, heavy lifting, grappling, pushing, and carrying capacity.'],
    ['dex','Dexterity','DEX','Agility and coordination used for ranged accuracy, stealth, initiative, balance, and quick reactions.'],
    ['con','Constitution','CON','Toughness and endurance used for health, stamina, survival, and resistance to physical hardship.'],
    ['int','Intelligence','INT','Knowledge and reasoning used for research, memory, crafting, investigation, and understanding magic.'],
    ['wis','Wisdom','WIS','Awareness and intuition used for perception, survival, tracking, judgment, and spiritual insight.'],
    ['cha','Charisma','CHA','Presence and influence used for leadership, persuasion, negotiation, performance, and social interaction.']
  ];
  let base={str:0,dex:0,con:0,int:0,wis:0,cha:0};
  let added={str:0,dex:0,con:0,int:0,wis:0,cha:0};
  let awarded=0;
  let active=false;

  function getDraft(){for(const key of Object.keys(sessionStorage)){if(key.startsWith('three-realms-character-draft')){try{const value=JSON.parse(sessionStorage.getItem(key));if(value?.adventurerId)return{key,value}}catch{}}}return null}
  function saveDraft(){const draft=getDraft();if(!draft)return;draft.value.attributes={baseAttributes:base,attributeAllocations:added,finalAttributes:Object.fromEntries(ATTRS.map(([key])=>[key,base[key]+added[key]])),attributeCreditsAwarded:awarded,attributeCreditsRemaining:remaining()};draft.value.step=5;sessionStorage.setItem(draft.key,JSON.stringify(draft.value))}
  function remaining(){return awarded-Object.values(added).reduce((sum,value)=>sum+value,0)}
  function render(){const left=remaining();$('#attribute-credits-remaining').textContent=left;$('#attribute-credits-total').textContent=`${awarded} awarded`;$('#attribute-grid').innerHTML=ATTRS.map(([key,name,abbr,description])=>`<article class="attribute-card" data-attribute-card="${key}"><div class="attribute-title"><span class="attribute-name-row"><strong>${name}</strong><button class="attribute-info-button" type="button" data-attribute-info="${key}" aria-expanded="false" aria-label="Show information about ${name}"><span aria-hidden="true">i</span></button></span><small>${abbr}</small></div><div class="attribute-values"><button class="attribute-button" type="button" data-attribute="${key}" data-direction="minus" ${added[key]===0?'disabled':''}>−</button><span class="attribute-score"><strong>${base[key]+added[key]}</strong><small>Base ${base[key]} +${added[key]}</small></span><button class="attribute-button" type="button" data-attribute="${key}" data-direction="plus" ${left===0||added[key]>=2?'disabled':''}>+</button></div><div class="attribute-added" aria-label="${added[key]} of 2 bonus points used"><span class="${added[key]>=1?'used':''}"></span><span class="${added[key]>=2?'used':''}"></span></div><div class="attribute-info-popover" id="attribute-info-${key}" hidden><div class="attribute-info-heading"><strong>${name} (${abbr})</strong><button type="button" data-close-attribute-info="${key}" aria-label="Close ${name} information">×</button></div><p>${description}</p></div></article>`).join('');$('#attribute-status').className=left===0?'attribute-status complete':'attribute-status';$('#attribute-status').textContent=left===0?'All Attribute Credits assigned. Continue is ready.':`Assign ${left} remaining Credit${left===1?'':'s'}. Maximum +2 per Attribute.`;const button=$('#creator-continue');button.disabled=left!==0;button.textContent=left===0?'Continue to Review (Next Build)':'Assign All Credits';saveDraft()}
  async function loadDefaults(){const draft=getDraft();if(!draft)throw new Error('Character draft was not found.');const d=draft.value;awarded=Number(d.fortune?.credits||0)+Number(d.fortune?.bonusCredits||0);const {data,error}=await window.DND.client.from('character_creation_defaults').select('strength,dexterity,constitution,intelligence,wisdom,charisma').eq('adventure_id',d.adventureId||'viking').eq('class_id',d.classId).eq('adventurer_id',d.adventurerId).maybeSingle();if(error)throw error;if(data){base={str:data.strength,dex:data.dexterity,con:data.constitution,int:data.intelligence,wis:data.wisdom,cha:data.charisma}}else{const json=await fetch(window.DND.siteUrl(`assets/classes/viking/${d.classId}/${d.adventurerId}/${d.adventurerId}.json`)).then(response=>response.json());base={str:Number(json.baseAttributes?.str)||0,dex:Number(json.baseAttributes?.dex)||0,con:Number(json.baseAttributes?.con)||0,int:Number(json.baseAttributes?.int)||0,wis:Number(json.baseAttributes?.wis)||0,cha:Number(json.baseAttributes?.cha)||0}}if(d.attributes?.attributeAllocations)added={...added,...d.attributes.attributeAllocations};render()}
  function showAttributes(){document.querySelectorAll('.creator-step').forEach(panel=>{const on=panel.dataset.step==='5';panel.hidden=!on;panel.classList.toggle('active',on)});document.querySelectorAll('[data-step-button]').forEach(button=>{const number=Number(button.dataset.stepButton);button.classList.toggle('active',number===5);button.classList.toggle('complete',number<5);if(number===5)button.disabled=false});$('#creator-back').hidden=false;active=true;loadDefaults().catch(error=>{$('#attribute-status').textContent=error.message;$('#attribute-status').className='attribute-status'})}
  window.addEventListener('dnd:navigation-ready',()=>{
    $('#attribute-grid').addEventListener('click',event=>{
      const infoButton=event.target.closest('[data-attribute-info]');
      const closeButton=event.target.closest('[data-close-attribute-info]');
      if(infoButton||closeButton){
        const key=(infoButton?.dataset.attributeInfo)||(closeButton?.dataset.closeAttributeInfo);
        const popover=$(`#attribute-info-${key}`);
        const trigger=$(`[data-attribute-info="${key}"]`);
        const opening=popover.hidden;
        document.querySelectorAll('.attribute-info-popover').forEach(item=>item.hidden=true);
        document.querySelectorAll('[data-attribute-info]').forEach(item=>item.setAttribute('aria-expanded','false'));
        popover.hidden=!opening;
        trigger?.setAttribute('aria-expanded',String(opening));
        return;
      }
      const button=event.target.closest('[data-attribute]');
      if(!button)return;
      const key=button.dataset.attribute;
      if(button.dataset.direction==='plus'&&remaining()>0&&added[key]<2)added[key]+=1;
      if(button.dataset.direction==='minus'&&added[key]>0)added[key]-=1;
      render();
    });
    document.addEventListener('click',event=>{
      if(event.target.closest('.attribute-card'))return;
      document.querySelectorAll('.attribute-info-popover').forEach(item=>item.hidden=true);
      document.querySelectorAll('[data-attribute-info]').forEach(item=>item.setAttribute('aria-expanded','false'));
    });
    $('#creator-continue').addEventListener('click',event=>{const step4=document.querySelector('.creator-step[data-step="4"]');const draft=getDraft();if(!step4?.hidden&&draft?.value?.fortune?.complete){event.preventDefault();event.stopImmediatePropagation();showAttributes()}},true);
    $('#creator-back').addEventListener('click',event=>{if(!active)return;event.preventDefault();event.stopImmediatePropagation();active=false;document.querySelectorAll('.creator-step').forEach(panel=>{const on=panel.dataset.step==='4';panel.hidden=!on;panel.classList.toggle('active',on)});document.querySelectorAll('[data-step-button]').forEach(button=>{const number=Number(button.dataset.stepButton);button.classList.toggle('active',number===4);button.classList.toggle('complete',number<4)});$('#creator-continue').disabled=false;$('#creator-continue').textContent='Continue to Attributes'},true);
  });
})();
