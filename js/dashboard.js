window.addEventListener('dnd:navigation-ready', async event => {
  const { session, platformRole, isAdmin, canManage } = event.detail;
  document.querySelectorAll('[data-admin-only]').forEach(el => el.hidden = !isAdmin);
  document.getElementById('management-panel').hidden = !canManage;
  const { count } = await window.DND.client.from('characters').select('*',{count:'exact',head:true}).eq('user_id',session.user.id);
  const total=count??0; document.getElementById('character-count').textContent=total;
  if(total>0){document.getElementById('character-summary-title').textContent=`${total} Character${total===1?'':'s'}`;document.getElementById('character-summary-text').textContent='Open Characters to manage your heroes.'}
  if(!canManage)return;
  const modal=document.getElementById('invite-modal'),form=document.getElementById('invite-form');
  const close=()=>{modal.hidden=true;form.reset()};
  document.getElementById('invite-adventurer-button').addEventListener('click',()=>{modal.hidden=false;document.getElementById('invite-email').focus()});
  document.getElementById('invite-close').addEventListener('click',close);document.getElementById('invite-cancel').addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close()});
  form.addEventListener('submit',e=>{e.preventDefault();const to=document.getElementById('invite-email').value.trim();const subject="You've Been Invited to Three Realms Adventures";const body=`Welcome to Three Realms Adventures!\n\nThree Realms Adventures is a tabletop RPG platform where players create universal characters and explore adventures across multiple realms.\n\nCurrent Realms:\n• Viking Adventure\n• Cajun Adventure (Coming Soon)\n• Fantasy Adventure (Coming Soon)\n\nGetting Started\n\n1. Visit the website:\nhttps://swampweb.github.io/DnD/\n\n2. Select Create Account.\n\n3. Enter your information and create your account.\n\n4. Check your email for a confirmation message from Supabase.\n\n5. Click the confirmation link in the email to activate your account.\n\n6. Return to Three Realms Adventures and sign in.\n\nOnce logged in, you can create characters, manage your profile, and prepare for future adventures.\n\nWe look forward to seeing your legend unfold.\n\nThree Realms Adventures\nEndless Adventures`;window.location.href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;close()});
});
