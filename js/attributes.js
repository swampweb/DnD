(() => {
  const $=selector=>document.querySelector(selector);
  const DEFAULT_ATTRS=[
    ['str','Strength','STR','Physical power used for melee attacks, heavy lifting, grappling, pushing, and carrying capacity.'],
    ['dex','Dexterity','DEX','Agility and coordination used for ranged accuracy, stealth, initiative, balance, and quick reactions.'],
    ['con','Constitution','CON','Toughness and endurance used for health, stamina, survival, and resistance to physical hardship.'],
    ['int','Intelligence','INT','Knowledge and reasoning used for research, memory, crafting, investigation, and understanding magic.'],
    ['wis','Wisdom','WIS','Awareness and intuition used for perception, survival, tracking, judgment, and spiritual insight.'],
    ['cha','Charisma','CHA','Presence and influence used for leadership, persuasion, negotiation, performance, and social interaction.']
  ];
  let ATTRS=DEFAULT_ATTRS.map(item=>[...item]);
  let base={str:0,dex:0,con:0,int:0,wis:0,cha:0};
  let added={str:0,dex:0,con:0,int:0,wis:0,cha:0};
  let awarded=0;
  let active=false;
  let reviewActive=false;
  let creatingCharacter=false;
  let reviewAdventurerJson=null;
  let currentSession=null;

  function getDraft(){for(const key of Object.keys(sessionStorage)){if(key.startsWith('three-realms-character-draft')){try{const value=JSON.parse(sessionStorage.getItem(key));if(value?.adventurerId)return{key,value}}catch{}}}return null}
  function saveDraft(){const draft=getDraft();if(!draft)return;draft.value.attributes={baseAttributes:base,attributeAllocations:added,finalAttributes:Object.fromEntries(ATTRS.map(([key])=>[key,base[key]+added[key]])),attributeCreditsAwarded:awarded,attributeCreditsRemaining:remaining()};draft.value.step=5;sessionStorage.setItem(draft.key,JSON.stringify(draft.value))}
  function remaining(){return awarded-Object.values(added).reduce((sum,value)=>sum+value,0)}
  function render(){const left=remaining();$('#attribute-credits-remaining').textContent=left;$('#attribute-credits-total').textContent=`${awarded} awarded`;$('#attribute-grid').innerHTML=ATTRS.map(([key,name,abbr,description])=>`<article class="attribute-card" data-attribute-card="${key}"><div class="attribute-title"><span class="attribute-name-row"><strong>${name}</strong><button class="attribute-info-button" type="button" data-attribute-info="${key}" aria-expanded="false" aria-label="Show information about ${name}"><span aria-hidden="true">i</span></button></span><small>${abbr}</small></div><div class="attribute-values"><button class="attribute-button" type="button" data-attribute="${key}" data-direction="minus" ${added[key]===0?'disabled':''}>−</button><span class="attribute-score"><strong>${base[key]+added[key]}</strong><small>Base ${base[key]} +${added[key]}</small></span><button class="attribute-button" type="button" data-attribute="${key}" data-direction="plus" ${left===0||added[key]>=2?'disabled':''}>+</button></div><div class="attribute-added" aria-label="${added[key]} of 2 bonus points used"><span class="${added[key]>=1?'used':''}"></span><span class="${added[key]>=2?'used':''}"></span></div><div class="attribute-info-popover" id="attribute-info-${key}" hidden><div class="attribute-info-heading"><strong>${name} (${abbr})</strong><button type="button" data-close-attribute-info="${key}" aria-label="Close ${name} information">×</button></div><p>${description}</p></div></article>`).join('');$('#attribute-status').className=left===0?'attribute-status complete':'attribute-status';$('#attribute-status').textContent=left===0?'All Attribute Credits assigned. Continue is ready.':`Assign ${left} remaining Credit${left===1?'':'s'}. Maximum +2 per Attribute.`;const button=$('#creator-continue');button.disabled=left!==0;button.textContent=left===0?'Continue to Review (Next Build)':'Assign All Credits';saveDraft()}
  async function loadAttributeDescriptions(){
    const {data,error}=await window.DND.client.from('attribute_definitions').select('attribute_key,name,abbreviation,description').order('display_order',{ascending:true});
    if(!error&&data?.length){const map=new Map(data.map(row=>[row.attribute_key,row]));ATTRS=DEFAULT_ATTRS.map(([key,name,abbr,description])=>{const row=map.get(key);return row?[key,row.name||name,row.abbreviation||abbr,row.description||description]:[key,name,abbr,description]})}
  }
  function positionPopover(popover,trigger){
    popover.style.position='fixed';popover.style.left='0px';popover.style.top='0px';popover.hidden=false;
    const triggerRect=trigger.getBoundingClientRect();const rect=popover.getBoundingClientRect();const gap=9;let left=triggerRect.left;let top=triggerRect.bottom+gap;
    if(left+rect.width>window.innerWidth-12)left=window.innerWidth-rect.width-12;if(left<12)left=12;
    if(top+rect.height>window.innerHeight-12)top=triggerRect.top-rect.height-gap;if(top<12)top=12;
    popover.style.left=`${left}px`;popover.style.top=`${top}px`;
  }

  async function loadDefaults(){const draft=getDraft();if(!draft)throw new Error('Character draft was not found.');const d=draft.value;awarded=Number(d.fortune?.credits||0)+Number(d.fortune?.bonusCredits||0);const {data,error}=await window.DND.client.from('character_creation_defaults').select('strength,dexterity,constitution,intelligence,wisdom,charisma').eq('adventure_id',d.adventureId||'viking').eq('class_id',d.classId).eq('adventurer_id',d.adventurerId).maybeSingle();if(error)throw error;if(data){base={str:data.strength,dex:data.dexterity,con:data.constitution,int:data.intelligence,wis:data.wisdom,cha:data.charisma}}else{const json=await fetch(window.DND.siteUrl(`assets/classes/viking/${d.classId}/${d.adventurerId}/${d.adventurerId}.json`)).then(response=>response.json());base={str:Number(json.baseAttributes?.str)||0,dex:Number(json.baseAttributes?.dex)||0,con:Number(json.baseAttributes?.con)||0,int:Number(json.baseAttributes?.int)||0,wis:Number(json.baseAttributes?.wis)||0,cha:Number(json.baseAttributes?.cha)||0}}if(d.attributes?.attributeAllocations)added={...added,...d.attributes.attributeAllocations};render()}
  function pretty(value){return String(value||'').split('-').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ')}
  async function showReview(){
    const draft=getDraft();if(!draft)return;
    saveDraft();draft.value=JSON.parse(sessionStorage.getItem(draft.key));draft.value.step=6;sessionStorage.setItem(draft.key,JSON.stringify(draft.value));
    const d=draft.value;const attrs=d.attributes?.finalAttributes||Object.fromEntries(ATTRS.map(([key])=>[key,base[key]+added[key]]));
    document.querySelectorAll('.creator-step').forEach(panel=>{const on=panel.dataset.step==='6';panel.hidden=!on;panel.classList.toggle('active',on)});
    document.querySelectorAll('[data-step-button]').forEach(button=>{const number=Number(button.dataset.stepButton);button.classList.toggle('active',number===6);button.classList.toggle('complete',number<6);if(number===6)button.disabled=false});
    active=false;reviewActive=true;$('#creator-back').hidden=false;$('#creator-continue').disabled=true;$('#creator-continue').textContent='Create Character';
    const nameInput=$('#review-character-name');nameInput.value=d.characterName||'';nameInput.addEventListener('input',()=>{d.characterName=nameInput.value.trim();sessionStorage.setItem(draft.key,JSON.stringify(d));$('#creator-continue').disabled=!d.characterName||creatingCharacter},{once:false});
    $('#creator-continue').disabled=!nameInput.value.trim();
    $('#review-class-name').textContent=`${pretty(d.classId)} • Viking Adventure`;$('#review-summary-class').textContent=pretty(d.classId);$('#review-summary-adventurer').textContent=pretty(d.adventurerId);$('#review-adventurer-name').textContent=pretty(d.adventurerId);$('#review-summary-credits').textContent=Number(d.fortune?.credits||0)+Number(d.fortune?.bonusCredits||0);$('#review-fortune-label').textContent=d.fortune?.experience||`${$('#review-summary-credits').textContent} Attribute Credits`;
    $('#review-attribute-grid').innerHTML=ATTRS.map(([key,name,abbr])=>{
      const baseValue=Number(d.attributes?.baseAttributes?.[key]??base[key]??0);
      const bonusValue=Number(d.attributes?.attributeAllocations?.[key]??added[key]??0);
      const finalValue=Number(attrs[key]??(baseValue+bonusValue));
      return `<div class="review-attribute-item"><span>${abbr}</span><strong>${finalValue}</strong><small>${name}</small><p><b>${baseValue}</b><i>+${bonusValue}</i><em>= ${finalValue}</em></p></div>`;
    }).join('');
    try{const folder=`assets/classes/viking/${d.classId}/${d.adventurerId}`;const json=await fetch(window.DND.siteUrl(`${folder}/${d.adventurerId}.json`),{cache:'no-cache'}).then(response=>response.json());reviewAdventurerJson=json;$('#review-adventurer-name').textContent=json.name||pretty(d.adventurerId);$('#review-summary-adventurer').textContent=json.name||pretty(d.adventurerId);const model=json.assets?.model||json.assets?.previewCard||json.assets?.portrait;const image=$('#review-model-image');if(model){image.src=encodeURI(window.DND.siteUrl(`${folder}/${model}`));image.hidden=false}else image.hidden=true}catch{reviewAdventurerJson=null;$('#review-model-image').hidden=true}
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function createCharacter(){
    if(creatingCharacter||!reviewActive)return;
    const draft=getDraft();if(!draft)return;
    const d=draft.value;const name=$('#review-character-name').value.trim();
    if(!currentSession?.user?.id){creatingCharacter=false;window.DND.toast('Unable to determine signed in user. Refresh and sign in again.','error');return;}
    if(!name){window.DND.toast('Enter a character name before creating the character.','error');return}
    const attrs=d.attributes?.finalAttributes;if(!attrs||Number(d.attributes?.attributeCreditsRemaining)!==0){window.DND.toast('Assign every Attribute Credit before creating the character.','error');return}
    creatingCharacter=true;const button=$('#creator-continue');button.disabled=true;button.textContent='Creating Character...';
    const folder=`assets/classes/viking/${d.classId}/${d.adventurerId}`;const portrait=reviewAdventurerJson?.assets?.portrait||reviewAdventurerJson?.assets?.previewCard||reviewAdventurerJson?.assets?.model||'';
    const payload={
      user_id:currentSession?.user?.id,
      name,
      title:'',
      level:1,
      race:reviewAdventurerJson?.name||pretty(d.adventurerId),
      class:reviewAdventurerJson?.class||pretty(d.classId),
      background:reviewAdventurerJson?.theme||'',
      alignment:'',
      age:0,
      status:'Active',
      strength:Number(attrs.str)||0,
      dexterity:Number(attrs.dex)||0,
      constitution:Number(attrs.con)||0,
      intelligence:Number(attrs.int)||0,
      wisdom:Number(attrs.wis)||0,
      charisma:Number(attrs.cha)||0,
      current_hp:0,
      max_hp:0,
      current_mana:0,
      max_mana:0,
      experience:0,
      experience_to_next:0,
      gold:0,
      silver:0,
      portrait_url:portrait?encodeURI(window.DND.siteUrl(`${folder}/${portrait}`)):'',
      biography:''
    };
    const {data,error}=await window.DND.client.from('characters').insert(payload).select('id,name').single();
    if(error){creatingCharacter=false;button.disabled=false;button.textContent='Create Character';window.DND.toast(error.message||'The character could not be created.','error');return}
    Object.keys(sessionStorage).filter(key=>key.startsWith('three-realms-character-draft')).forEach(key=>sessionStorage.removeItem(key));
    await window.DNDModal.alert({type:'success',kicker:'Three Realms Adventures',title:'Character Created',message:`${data.name} has been added to your Character Library.`,confirmText:'View Character Library'});
    location.href='index.html';
  }

  function showAttributes(){document.querySelectorAll('.creator-step').forEach(panel=>{const on=panel.dataset.step==='5';panel.hidden=!on;panel.classList.toggle('active',on)});document.querySelectorAll('[data-step-button]').forEach(button=>{const number=Number(button.dataset.stepButton);button.classList.toggle('active',number===5);button.classList.toggle('complete',number<5);if(number===5)button.disabled=false});$('#creator-back').hidden=false;$('#creator-continue').disabled=true;$('#creator-continue').textContent='Loading Attributes...';active=true;reviewActive=false;const currentDraft=getDraft();if(currentDraft){currentDraft.value.step=5;sessionStorage.setItem(currentDraft.key,JSON.stringify(currentDraft.value))}loadAttributeDescriptions().then(loadDefaults).catch(error=>{$('#attribute-status').textContent=error.message;$('#attribute-status').className='attribute-status'})}
  window.addEventListener('dnd:navigation-ready',(event)=>{currentSession=event.detail?.session||null;
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
        if(opening)positionPopover(popover,trigger);else popover.hidden=true;
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
    $('#creator-continue').addEventListener('click',event=>{
      const step6=document.querySelector('.creator-step[data-step="6"]');
      if(!step6?.hidden){event.preventDefault();event.stopImmediatePropagation();createCharacter();return}
      const step5=document.querySelector('.creator-step[data-step="5"]');
      if(!step5?.hidden&&remaining()===0){event.preventDefault();event.stopImmediatePropagation();showReview();return}
      const step4=document.querySelector('.creator-step[data-step="4"]');const draft=getDraft();if(!step4?.hidden&&draft?.value?.fortune?.complete){event.preventDefault();event.stopImmediatePropagation();showAttributes()}
    },true);
    $('#creator-back').addEventListener('click',event=>{
      if(reviewActive){
        event.preventDefault();event.stopImmediatePropagation();showAttributes();return;
      }
      if(!active)return;
      event.preventDefault();event.stopImmediatePropagation();active=false;
      document.querySelectorAll('.creator-step').forEach(panel=>{const on=panel.dataset.step==='4';panel.hidden=!on;panel.classList.toggle('active',on)});
      document.querySelectorAll('[data-step-button]').forEach(button=>{const number=Number(button.dataset.stepButton);button.classList.toggle('active',number===4);button.classList.toggle('complete',number<4)});
      const currentDraft=getDraft();if(currentDraft){currentDraft.value.step=4;sessionStorage.setItem(currentDraft.key,JSON.stringify(currentDraft.value))}
      $('#creator-continue').disabled=false;$('#creator-continue').textContent='Continue to Attributes';
    },true);
    const draft=getDraft();
    const resumeRequested=new URLSearchParams(location.search).get('resume')==='1';
    const fortuneComplete=draft?.value?.fortune?.complete===true;
    const savedStep=Number(draft?.value?.step)||1;
    if(resumeRequested&&savedStep>=6){setTimeout(showReview,0)}
    else if(resumeRequested&&(savedStep>=5||fortuneComplete)){setTimeout(showAttributes,0)}
  });
})();
