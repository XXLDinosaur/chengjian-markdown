// A single stroke and canvas size for application action icons.
const icon=path=>`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const actions=[
 ['[data-command="undo"]','<path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 6 6v3"/>','撤销'],
 ['[data-command="redo"]','<path d="m15 5 5 5-5 5m5-5H10a6 6 0 0 0-6 6v3"/>','重做'],
 ['[data-command="bullet"]','<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="3" cy="6" r=".8"/><circle cx="3" cy="12" r=".8"/><circle cx="3" cy="18" r=".8"/>','项目符号'],
 ['[data-command="task"]','<rect x="3" y="4" width="17" height="17" rx="2"/><path d="m7 12 4 4 8-10"/>','待办'],
 ['#brushBtn','<path d="M4 3h16v6H4zM12 9v4h4v8h-4v-8H7V9"/>','格式刷'],
 ['#imageBtn','<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-7 5 8"/>','图片'],
 ['#tableBtn','<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>','表格'],
 ['#floatBtn','<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 10h11v10H10z"/>','浮窗']
];
for(const [selector,path,label] of actions)for(const button of document.querySelectorAll(selector))button.innerHTML=icon(path)+'<span>'+label+'</span>';

for(const action of ['undo','redo']){const button=document.querySelector('[data-command="'+action+'"]');button.querySelector('span')?.remove();button.setAttribute('aria-label',action==='undo'?'撤销':'重做');}
for(const [id,path] of [['windowMinimize','<path d="M5 12h14"/>'],['windowMaximize','<rect x="5" y="5" width="14" height="14" rx="1"/>'],['windowClose','<path d="m5 5 14 14M19 5 5 19"/>']])document.getElementById(id).innerHTML=icon(path);
const motto=document.getElementById('appMotto');motto.textContent=localStorage.getItem('chengjian.motto')||'大道简成';
motto.ondblclick=()=>{if(document.getElementById('mottoInput'))return;const input=document.createElement('input');input.id='mottoInput';input.maxLength=80;input.value=motto.textContent;input.setAttribute('aria-label','自定义一句话');motto.hidden=true;motto.after(input);input.focus();input.select();let done=false;const finish=save=>{if(done)return;done=true;if(save){motto.textContent=input.value.trim()||'大道简成';localStorage.setItem('chengjian.motto',motto.textContent);}input.remove();motto.hidden=false;};input.onblur=()=>finish(true);input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();finish(true);}if(e.key==='Escape'){e.preventDefault();finish(false);}};};
