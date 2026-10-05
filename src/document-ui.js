import { Mark } from '@tiptap/core';
import { installGlassSelects } from './glass-selects.js';
import './ui-icons.js';
export const NoJump=Mark.create({name:'noJump',inclusive:false,addAttributes(){return {href:{default:null,parseHTML:el=>el.getAttribute('data-disabled-href'),renderHTML:attrs=>attrs.href?{'data-disabled-href':attrs.href}:{}}};},parseHTML(){return [{tag:'span[data-no-jump]'}];},renderHTML({HTMLAttributes}){return ['span',{...HTMLAttributes,'data-no-jump':'true'},0];}});
export function installDocumentUI({getEditor,api,checked,locked,toast}){
 const $=id=>document.getElementById(id);
 for(const [id,action] of [['windowMinimize','minimize'],['windowMaximize','maximize'],['windowClose','close']])$(id).onclick=()=>checked(api.windowControl(action)).catch(e=>toast(e.message));
 // Keep the single-document commands in one menu. Moving the actual buttons
 // preserves the same shortcuts, disabled state and unsaved-change handling.
 const fileMenu=$('fileMenu'),fileButton=$('fileMenuBtn');
 const labels={newBtn:['新建文档','Ctrl+N'],openBtn:['打开文档','Ctrl+O'],saveBtn:['保存','Ctrl+S'],saveAsBtn:['另存为','Ctrl+Shift+S'],printBtn:['打印','Ctrl+P'],helpBtn:['帮助','F1']};
 for(const [id,[label,key]] of Object.entries(labels)){const b=$(id);b.setAttribute('role','menuitem');b.classList.remove('primary');b.innerHTML=label+'<kbd>'+key+'</kbd>';fileMenu.append(b);}
 const auto=$('autoSave').closest('label');fileMenu.append(auto);
 const closeFile=()=>{fileMenu.hidden=true;fileButton.setAttribute('aria-expanded','false');};
 fileButton.onclick=()=>{const show=fileMenu.hidden;closeFile();if(show){fileMenu.hidden=false;const r=fileButton.getBoundingClientRect();fileMenu.style.left=Math.max(8,Math.min(r.left,innerWidth-fileMenu.offsetWidth-8))+'px';fileMenu.style.top=r.bottom+5+'px';fileButton.setAttribute('aria-expanded','true');}};
 fileMenu.addEventListener('click',e=>{if(e.target.closest('button'))closeFile();});
 document.addEventListener('pointerdown',e=>{if(!fileMenu.contains(e.target)&&!fileButton.contains(e.target))closeFile();});
 // Native clipboard operations remain in the main process; menu clicks restore
 // the ProseMirror selection so toolbar focus cannot change their target.
 const menu=document.createElement('div');menu.className='glass-context-menu';menu.id='documentContextMenu';menu.hidden=true;menu.setAttribute('role','menu');document.body.append(menu);
 let selection=null;
 const restore=()=>{const e=getEditor();if(e&&selection)e.chain().focus().setTextSelection(selection).run();return e;};
 const entry=(label,fn,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.setAttribute('role','menuitem');b.onmousedown=e=>e.preventDefault();b.onclick=()=>{menu.hidden=true;Promise.resolve(fn()).catch(e=>toast(e.message));};menu.append(b);};
 function targetLink(event){const element=event.target.closest('a,span[data-no-jump]');if(!element)return null;const editor=getEditor();const from=editor.view.posAtDOM(element,0),to=from+element.textContent.length;return {from,to,href:element.getAttribute('href')||element.getAttribute('data-disabled-href'),disabled:element.hasAttribute('data-no-jump')};}
 $('editor').addEventListener('contextmenu',event=>{
  if(!event.target.closest('.tiptap')||!getEditor()?.isEditable)return;
  event.preventDefault();const editor=getEditor(),target=targetLink(event);selection={from:editor.state.selection.from,to:editor.state.selection.to};
  if(selection.from===selection.to){const hit=editor.view.posAtCoords({left:event.clientX,top:event.clientY});if(hit)selection={from:hit.pos,to:hit.pos};}
  menu.replaceChildren();for(const [label,command] of [['复制','copy'],['剪切','cut'],['粘贴','paste']])entry(label,()=>{restore();return checked(api.editCommand(command));},command!=='paste'&&selection.from===selection.to);
  entry('链接…',()=>{restore();$('linkBtn').click();});
  if(target&&/^https?:\/\//i.test(target.href||''))entry(target.disabled?'恢复跳转链接':'取消跳转链接',()=>{const chain=editor.chain().focus().setTextSelection({from:target.from,to:target.to});if(target.disabled)chain.unsetMark('noJump').setLink({href:target.href}).run();else chain.unsetLink().setMark('noJump',{href:target.href}).run();});
  menu.hidden=false;menu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-menu.offsetHeight-8))+'px';
 });
 $('editor').addEventListener('dblclick',event=>{const target=targetLink(event);if(target&&!target.disabled&&/^https?:\/\//i.test(target.href||'')){event.preventDefault();checked(api.externalLink(target.href)).catch(e=>toast(e.message));}},true);
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))menu.hidden=true;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeFile();menu.hidden=true;}});
 const help=document.createElement('dialog');help.id='helpDialog';help.className='small-dialog';help.innerHTML='<form method="dialog"><h2>成简 · 使用说明</h2><p>专注当前文档，直接点击页面开始编辑。</p><h3>打开与保存</h3><p>右上角“文件”可新建、打开、保存、另存为、打印和查看帮助。Ctrl+S 保存，Ctrl+Shift+S 另存为。新文档先保存在本机草稿，首次保存时选择位置。双击文件名可直接改名。</p><h3>编辑与导航</h3><p>选中文字后设置样式；点击导航可查看目录、查找和替换。格式刷单击使用一次，双击连续使用，Esc 退出。文档中右键可复制、剪切、粘贴或插入网址链接。</p><h3>图片与表格</h3><p>拖入、粘贴或选择图片；单击调整尺寸，双击查看大图。表格可增删行列。另存为会复制本地图片，请将文档和同名 .assets 文件夹一起移动。</p><h3>主题与浮窗</h3><p>主题支持预设、自定义配色及图片背景；修改后自动保存。Ctrl+滚轮缩放正文。浮窗左上角的六点区域可拖动窗口，点击“恢复窗口”返回。</p><div class="dialog-actions"><button class="primary">知道了</button></div></form>';document.body.append(help);
 $('helpBtn').onclick=()=>help.showModal();document.addEventListener('keydown',e=>{if(e.key==='F1'){e.preventDefault();if(!help.open)help.showModal();}});
 installGlassSelects();
}
