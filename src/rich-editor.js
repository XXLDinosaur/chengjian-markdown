import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { prepareMarkdown, escapeAttr, clamp } from './core.mjs';
import { Numbering, TextHighlight, Formula } from './editor-features.js';
import { HeadingListItem, WordStyles, WordText, normalizeWordHTML } from './word-format.js';
import { applyList } from './block-format.js';
import { installWorkbench } from './workbench.js';
import { installShortcuts } from './shortcuts.js';

const $ = id => document.getElementById(id), api = window.desktop;
let autoTimer, autoPromise=null, autoPaused=false, draftSnapshot='';
let editor, filePath = null, savedDocument = '', originalText = '', busy = false, toastTimer;
let prefs = {}; try { prefs = JSON.parse(localStorage.getItem('moye.rich.preferences') || localStorage.getItem('moye.preferences') || '{}'); } catch {}
let zoom = clamp(Number(prefs.zoom) || 100, 50, 250);
document.body.classList.toggle('dark', Boolean(prefs.dark));
function persist() { localStorage.setItem('moye.rich.preferences', JSON.stringify({ zoom, dark: document.body.classList.contains('dark') })); }
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4500); }
async function checked(promise) { const result = await promise; if (result?.error) throw new Error(result.error); return result; }
const welcome = '# 写作，就从这里开始\n\n直接点击这张纸，就可以像写普通文档一样输入、修改文字。\n\n## 把注意力留给内容\n\n选中文字，点击上方的 **加粗**、*斜体* 或标题样式。你看到的，就是正在编辑的内容。\n\n> 不需要记住任何 Markdown 语法。\n\n## 图片与表格，也很简单\n\n- 把图片直接拖进来，单击调整大小，双击放大查看。\n- 点击上方的“表格”，选择行列数，然后直接填写。\n- 按 Ctrl + 滚轮，把页面调到舒服的大小。\n\n按 **Ctrl + S**，把这份文档保存在你的电脑上。\n';
const markdown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
markdown.use(gfm);
markdown.addRule('formula',{filter:node=>node.nodeName==='SPAN' && node.hasAttribute('data-formula'),replacement:(_c,node)=>node.outerHTML});
markdown.addRule('wordFormatting',{filter:node=>node.hasAttribute?.('data-word-style') || (node.nodeName==='OL' && node.querySelector('h1,h2,h3,h4,h5,h6')) || (node.nodeName==='UL' && node.querySelector('h1,h2,h3,h4,h5,h6')),replacement:(_c,node)=>['SPAN','IMG'].includes(node.nodeName)?node.outerHTML:'\n\n'+node.outerHTML+'\n\n'});
markdown.addRule('highlight',{filter:'mark',replacement:(_c,node)=>node.outerHTML});
markdown.addRule('numbered',{filter:node=>node.nodeName==='OL' && node.getAttribute('data-numbering') && node.getAttribute('data-numbering')!=='decimal',replacement:(_c,node)=>'\n\n'+node.outerHTML+'\n\n'});

markdown.addRule('sizedImage', { filter: 'img', replacement: (_content, node) => `<img src="${escapeAttr(node.getAttribute('src'))}" alt="${escapeAttr(node.getAttribute('alt'))}"${node.getAttribute('data-word-style') ? ` data-word-style="${escapeAttr(node.getAttribute('data-word-style'))}"` : String()}${node.getAttribute('title') ? ` title="${escapeAttr(node.getAttribute('title'))}"` : ''}${node.getAttribute('width') ? ` width="${escapeAttr(node.getAttribute('width'))}"` : ''}>` });
markdown.addRule('editableTable', { filter: 'table', replacement: (_content, node) => `\n\n${node.outerHTML}\n\n` });
markdown.addRule('taskItem', { filter: node => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem', replacement: (content, node) => `\n- [${node.getAttribute('data-checked') === 'true' ? 'x' : ' '}] ${content.trim()}\n` });
function htmlFromMarkdown(text) {
  const clean = DOMPurify.sanitize(prepareMarkdown(text).html, { ALLOWED_URI_REGEXP: /^(?:(?:https?|file|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i, ADD_ATTR: ['colwidth'], FORBID_TAGS: ['style', 'script', 'form', 'button', 'textarea', 'select', 'dialog', 'iframe', 'object', 'embed', 'svg', 'math', 'video', 'audio'], FORBID_ATTR: ['style', 'id', 'name', 'srcset'] });
  const dom = document.createElement('div'); dom.innerHTML = clean;
  for (const input of dom.querySelectorAll('input[type="checkbox"]')) {
    const item = input.closest('li'); if (item) { item.dataset.type = 'taskItem'; item.dataset.checked = String(input.checked); if (item.parentElement?.tagName === 'UL') item.parentElement.dataset.type = 'taskList'; } input.remove();
  }
  return dom.innerHTML;
}
const snapshot = () => JSON.stringify(editor.getJSON());
const dirty = () => editor && snapshot() !== savedDocument;
const serialize = () => dirty() ? markdown.turndown(editor.getHTML()) + '\n' : originalText;
const autoEnabled = () => $('autoSave').checked;
$('autoSave').checked = localStorage.getItem('moye.autosave') !== 'false';
$('autoSave').onchange=()=>{localStorage.setItem('moye.autosave',String(autoEnabled()));autoPaused=false;scheduleAutoSave();};
function scheduleAutoSave(){
  clearTimeout(autoTimer);if(!editor || !dirty() || !autoEnabled() || autoPaused || (!filePath && snapshot()===draftSnapshot))return;
  autoTimer=setTimeout(()=>{
    if(busy || autoPromise){scheduleAutoSave();return;}
    autoPromise=(async()=>{try{if(filePath)await save(false,true);else{const captured=snapshot();await checked(api.draftWrite({name:$('fileName').textContent,text:serialize()}));draftSnapshot=captured;refresh();}}catch(e){autoPaused=true;toast(e.message);}finally{autoPromise=null;scheduleAutoSave();}})();
  },900);
}

function selectedImage() { const node = editor?.state.selection.node; return node?.type.name === 'image' ? node : null; }
function refresh() {
  if (!editor) return;
  $('saveState').textContent = dirty() ? (!filePath && draftSnapshot===snapshot()?'草稿已保存':'未保存') : filePath ? '已保存' : '新文档';
  $('wordCount').textContent = `${editor.getText().replace(/\s/g, '').length.toLocaleString()} 字`;
  $('status').textContent = filePath || '直接输入文字 · 可拖入图片'; $('status').title = filePath || '';
  api.dirty(dirty()); scheduleAutoSave(); document.dispatchEvent(new Event('document-updated'));
  $('tableTools').hidden = !editor.isActive('table');
  
  $('blockType').value = String(editor.isActive('heading') ? editor.getAttributes('heading').level : 0);
  for (const button of document.querySelectorAll('[data-command]')) { const names = { bullet: 'bulletList', ordered: 'orderedList', task: 'taskList', quote: 'blockquote', code: 'codeBlock' }; button.classList.toggle('active', editor.isActive(names[button.dataset.command] || button.dataset.command)); }
  const node = selectedImage(); $('imageToolbar').hidden = !node;
  if (node && document.activeElement !== $('imageWidth')) $('imageWidth').value = node.attrs.width || Math.round(document.querySelector('.ProseMirror-selectednode img')?.getBoundingClientRect().width / (zoom / 100)) || 400;
}
const RichImage = Image.extend({
  addAttributes() { return { ...this.parent?.(), width: { default: null, parseHTML: element => Number(element.getAttribute('width')) || null, renderHTML: attrs => attrs.width ? { width: attrs.width } : {} } }; },
  addNodeView() { return ({ node, getPos, editor: instance }) => {
    let current = node, request = 0;
    const dom = document.createElement('span'); dom.className = 'rich-image inline-image'; dom.contentEditable = 'false';
    const img = document.createElement('img'); img.draggable = false;
    const handle = document.createElement('button'); handle.className = 'resize-handle'; handle.title = '拖动调整图片大小'; handle.setAttribute('aria-label', handle.title); dom.append(img, handle);
    async function paint() { img.alt = current.attrs.alt || ''; dom.style.cssText=current.attrs.wordStyle || '';img.style.width = current.attrs.width ? `${current.attrs.width}px` : ''; const seq = ++request; try { const sources = await checked(api.resolveImages([current.attrs.src])); if (seq === request) { if (sources[0]) img.src = sources[0]; else img.removeAttribute('src'); } } catch (e) { toast(e.message); } }
    img.addEventListener('click', () => { if (!busy) instance.commands.setNodeSelection(getPos()); });
    img.addEventListener('dblclick', event => { event.preventDefault(); showImage(img); });
    handle.addEventListener('pointerdown', event => {
      if (busy) return; event.preventDefault(); event.stopPropagation(); instance.commands.setNodeSelection(getPos());
      const x = event.clientX, width = img.getBoundingClientRect().width / (zoom / 100); let next = width;
      handle.setPointerCapture(event.pointerId);
      const move = e => { next = clamp(Math.round(width + (e.clientX - x) / (zoom / 100)), 24, 8192); img.style.width = `${next}px`; $('imageWidth').value = next; };
      const cleanup = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', cancel); };
      const up = () => { cleanup(); instance.chain().setNodeSelection(getPos()).updateAttributes('image', { width: next }).run(); };
      const cancel = () => { cleanup(); paint(); };
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', cancel);
    });
    paint();
    return { dom, update(next) { if (next.type !== current.type) return false; current = next; paint(); return true; }, selectNode() { dom.classList.add('ProseMirror-selectednode'); }, deselectNode() { dom.classList.remove('ProseMirror-selectednode'); }, stopEvent: event => event.target === handle, ignoreMutation: () => true, destroy() { request++; } };
  }; }
});
function createEditor(content) {
  editor?.destroy();
  editor = new Editor({ element: $('editor'), extensions: [Numbering, TextHighlight, Formula, HeadingListItem, WordStyles, WordText, StarterKit.configure({ listItem:false, link: { openOnClick: false } }), RichImage.configure({ allowBase64: true, inline:true }), TableKit.configure({ table: { resizable: true } }), TaskList, TaskItem.configure({ nested: true, HTMLAttributes: { 'data-type': 'taskItem' } })], content: htmlFromMarkdown(content), editorProps: { attributes: { 'aria-label': '文档编辑区', spellcheck: 'false' }, handlePaste: (_view, event) => {
      const html=event.clipboardData?.getData('text/html') || '', plain=event.clipboardData?.getData('text/plain') || '';
      if (/mso-|<m:oMath|msEquation|<math\b/i.test(html)) {event.preventDefault();const from=editor.state.selection.from,to=editor.state.selection.to;locked(async()=>{const result=await checked(api.pasteWord({html,plain}));const normalized=normalizeWordHTML(result.html);editor.chain().insertContentAt({from,to},normalized).run();});return true;}
      if ([...(event.clipboardData?.items || [])].some(item => item.type.startsWith('image/'))) { event.preventDefault(); importImages('paste'); return true; } return false; } }, onUpdate: refresh, onSelectionUpdate: refresh });
}
function load(data) { clearTimeout(autoTimer);autoPaused=false;draftSnapshot=''; filePath = data.path; originalText = data.text; createEditor(data.text); savedDocument = snapshot(); $('fileName').textContent = data.name; $('encodingLabel').textContent = data.encoding === 'utf16le' ? 'UTF-16 LE' : 'UTF-8'; $('documentScroll').scrollTop = 0; refresh(); }
async function locked(action) { if(autoPromise)await autoPromise; if (busy) return; busy = true; editor?.setEditable(false, false); document.querySelectorAll('.file-actions button').forEach(b => b.disabled = true); try { return await action(); } catch (e) { toast(e.message); } finally { busy = false; editor?.setEditable(true, false); document.querySelectorAll('.file-actions button').forEach(b => b.disabled = false); } }
async function save(saveAs = false, automatic = false) {
  const capturedSnapshot=snapshot();
  const text = serialize();
  const result = await checked(api.save({ text, saveAs, automatic, suggestedName:$('fileName').textContent })); if (!result) return false;
  filePath = result.path;
  if (result.text !== text) {
    const oldImages = prepareMarkdown(text).images, nextImages = prepareMarkdown(result.text).images;
    const relocated = new Map(oldImages.map((img, i) => [img.src, nextImages[i]?.src || img.src]));
    const tr = editor.state.tr;
    editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image' && relocated.has(node.attrs.src)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: relocated.get(node.attrs.src) }); });
    editor.view.dispatch(tr.setMeta('addToHistory', false));
  }
  originalText = result.text; savedDocument = automatic ? capturedSnapshot : snapshot(); $('fileName').textContent = result.name; autoPaused=false;await checked(api.draftWrite(null));refresh(); if(!automatic)toast('文档已保存'); return true;
}
async function canLeave() { if (!dirty()) return true; const answer = await checked(api.confirmLeave()); return answer === 'discard' || (answer === 'save' && await save()); }
$('newBtn').onclick = () => locked(async () => { if (await canLeave()) {await checked(api.draftWrite(null));load(await checked(api.newDocument()));} });
$('openBtn').onclick = () => locked(async () => { if (await canLeave()) { const data = await checked(api.open()); if (data) {await checked(api.draftWrite(null));load(data);} } });
$('saveBtn').onclick = () => locked(() => save()); $('saveAsBtn').onclick = () => locked(() => save(true));
const commands = { undo: 'undo', redo: 'redo', bold: 'toggleBold', italic: 'toggleItalic', strike: 'toggleStrike', bullet: 'toggleBulletList', ordered: 'toggleOrderedList', task: 'toggleTaskList', quote: 'toggleBlockquote', code: 'toggleCodeBlock' };
document.querySelectorAll('[data-command]').forEach(button=>{button.onmousedown=e=>e.preventDefault();button.onclick=()=>{if(busy)return;if(button.dataset.command==='ordered')applyList(editor,'orderedList','decimal',true);else {const level=editor.isActive('heading')?editor.getAttributes('heading').level:null;editor.chain().focus()[commands[button.dataset.command]]().run();if(level && button.dataset.command==='bullet')editor.commands.setHeading({level});}refresh();};});
$('blockType').onchange = () => { if (busy) return; const level = Number($('blockType').value); if (level) editor.chain().focus().setHeading({ level }).run(); else editor.chain().focus().setParagraph().run(); refresh(); };
$('tableBtn').onclick = () => { if (!busy) $('tableDialog').showModal(); };
$('insertTable').onclick = () => { const rows = clamp(Number($('tableRows').value) || 3, 1, 50), cols = clamp(Number($('tableCols').value) || 3, 1, 20); $('tableDialog').close(); editor.chain().focus().insertTable({ rows, cols, withHeaderRow: $('tableHeader').checked }).run(); refresh(); };
document.querySelectorAll('[data-table]').forEach(button => { button.onmousedown = e => e.preventDefault(); button.onclick = () => { if (!busy) { editor.chain().focus()[button.dataset.table]().run(); refresh(); } }; });
$('linkBtn').onclick = () => { if (busy) return; $('linkUrl').value = editor.getAttributes('link').href || ''; $('linkDialog').showModal(); };
$('applyLink').onclick = () => { const href = $('linkUrl').value.trim(); if (href && !/^https?:\/\//i.test(href)) { toast('请输入以 https:// 或 http:// 开头的网址'); return; } $('linkDialog').close(); const chain = editor.chain().focus().extendMarkRange('link'); if (!href) chain.unsetLink().run(); else if (editor.state.selection.empty) chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run(); else chain.setLink({ href }).run(); };
async function importImages(kind, files = [], dropPosition = null) {
  if (busy) { toast('正在处理文件，请稍后再试'); return; }
  const position = dropPosition ?? editor.state.selection.from; const results = [], errors = [];
  await locked(async () => {
    if (kind === 'files') {
      const accepted = files.filter(file => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(file.name));
      if (!accepted.length) throw new Error('请拖入 PNG、JPG、SVG 等图片文件');
      if (accepted.length > 20) throw new Error('一次最多拖入 20 张图片');
      for (const file of accepted) { try { if (file.size > 40 * 1024 * 1024) throw new Error('图片超过 40 MB'); results.push(await checked(api.droppedImage({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }))); } catch(e) { errors.push(`${file.name}：${e.message}`); } }
    } else { const result = await checked(kind === 'paste' ? api.pasteImage() : api.image()); if (result) results.push(result); }
  });
  if (results.length) { editor.chain().focus().insertContentAt(Math.min(position, editor.state.doc.content.size), results.map(img => ({ type: 'paragraph', content:[{ type: 'image', attrs: { src: img.src, alt: img.name, width:img.width || null } }] })).concat({ type: 'paragraph' })).run(); toast(`已插入 ${results.length} 张图片 · Ctrl+S 保存`); }
  if (errors.length) toast(errors[0]);
}
$('imageBtn').onclick = () => importImages('picker');
let dragDepth = 0; const main = document.querySelector('main');
const fileDrag = event => [...(event.dataTransfer?.types || [])].includes('Files');
const clearDrag = () => { dragDepth = 0; main.classList.remove('file-drag-over'); };
document.addEventListener('dragenter', e => { if (fileDrag(e)) { e.preventDefault(); dragDepth++; if (!busy) main.classList.add('file-drag-over'); } });
document.addEventListener('dragover', e => { if (fileDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = busy ? 'none' : 'copy'; } });
document.addEventListener('dragleave', e => { if (fileDrag(e) && --dragDepth <= 0) clearDrag(); });
document.addEventListener('dragend', clearDrag); window.addEventListener('blur', clearDrag);
document.addEventListener('drop', e => { if (!fileDrag(e)) return; e.preventDefault(); e.stopPropagation(); clearDrag(); if ($('lightbox').open) return; const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos; importImages('files', [...e.dataTransfer.files], pos); }, true);
function resizeSelected(width) { if (busy || !selectedImage()) return; editor.chain().focus().updateAttributes('image', { width: width == null ? null : clamp(Math.round(width), 24, 8192) }).run(); refresh(); }
$('imageWidth').onchange = () => { if (Number($('imageWidth').value) > 0) resizeSelected(Number($('imageWidth').value)); };
$('imageWidth').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('imageWidth').blur(); } };
$('imageSmaller').onclick = () => resizeSelected(Number($('imageWidth').value) * .9); $('imageLarger').onclick = () => resizeSelected(Number($('imageWidth').value) * 1.1); $('imageNatural').onclick = () => resizeSelected(null);
$('deleteImage').onclick = () => { if (!busy) editor.chain().focus().deleteSelection().run(); };
$('viewImage').onclick = () => { const img = document.querySelector('.ProseMirror-selectednode img'); if (img) showImage(img); };
function setZoom(value) { zoom = clamp(value, 50, 250); $('editor').style.zoom = zoom / 100; $('zoomValue').textContent = `${zoom}%`; persist(); }
$('zoomMinus').onclick = () => setZoom(zoom - 10); $('zoomPlus').onclick = () => setZoom(zoom + 10); $('zoomValue').onclick = () => setZoom(100);
$('documentScroll').addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(zoom + (e.deltaY < 0 ? 10 : -10)); } }, { passive: false });
document.addEventListener('moye-theme-change', persist);
let viewer = { scale: 1, x: 0, y: 0 }; const stage = $('imageStage'), largeImage = $('largeImage');
function paintViewer() { largeImage.style.transform = `translate(${viewer.x}px, ${viewer.y}px) scale(${viewer.scale})`; $('viewerPercent').textContent = `${Math.round(viewer.scale * 100)}%`; }
function centerImage(scale) { viewer = { scale, x: (stage.clientWidth - largeImage.naturalWidth * scale) / 2, y: (stage.clientHeight - largeImage.naturalHeight * scale) / 2 }; paintViewer(); }
function fitImage() { if (largeImage.naturalWidth) centerImage(Math.min((stage.clientWidth - 70) / largeImage.naturalWidth, (stage.clientHeight - 50) / largeImage.naturalHeight, 1)); }
function viewerZoom(factor, x = stage.clientWidth / 2, y = stage.clientHeight / 2) { const next = clamp(viewer.scale * factor, .01, 20), ratio = next / viewer.scale; viewer.x = x - (x - viewer.x) * ratio; viewer.y = y - (y - viewer.y) * ratio; viewer.scale = next; paintViewer(); }
function showImage(img) { if (!img.complete || !img.naturalWidth) { toast('图片尚未加载或路径无效'); return; } $('imageName').textContent = img.alt || '图片预览'; largeImage.onload = fitImage; largeImage.src = img.src; $('lightbox').showModal(); if (largeImage.complete) fitImage(); }
$('viewerClose').onclick = () => $('lightbox').close(); $('viewerFit').onclick = fitImage; $('viewerOriginal').onclick = $('viewerPercent').onclick = () => centerImage(1); $('viewerPlus').onclick = () => viewerZoom(1.2); $('viewerMinus').onclick = () => viewerZoom(1 / 1.2);
stage.addEventListener('wheel', e => { e.preventDefault(); const b = stage.getBoundingClientRect(); viewerZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - b.left, e.clientY - b.top); }, { passive: false });
stage.addEventListener('pointerdown', e => { if (e.button !== 0) return; stage.setPointerCapture(e.pointerId); const start = { x: e.clientX, y: e.clientY, vx: viewer.x, vy: viewer.y }; const move = e => { viewer.x = start.vx + e.clientX - start.x; viewer.y = start.vy + e.clientY - start.y; paintViewer(); }; const done = () => { stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerup', done); stage.removeEventListener('pointercancel', done); }; stage.addEventListener('pointermove', move); stage.addEventListener('pointerup', done); stage.addEventListener('pointercancel', done); });
installShortcuts({ blocked: () => busy || !editor, setBlock: level => { $('blockType').value = String(level); $('blockType').onchange(); } });
api.onClose(async () => { if (busy) { api.closeResult(false); return; } await locked(async () => { let allow = false; try { if(autoEnabled() && !filePath && dirty()){await checked(api.draftWrite({text:serialize(),name:$('fileName').textContent}));allow=true;}else allow = await canLeave(); } finally { api.closeResult(allow); } }); });
setZoom(zoom);
import('./custom-colors.js');
(async () => { try { const initial = await checked(api.initial()); const draft=initial?null:await checked(api.draftRead()); load(initial || (draft?{path:null,...draft}:{ path: null, name: '未命名.md', text: welcome }));if(draft){savedDocument='';refresh();toast('已恢复上次未命名草稿');} } catch(e) { load({ path: null, name: '未命名.md', text: '' }); toast(e.message); } })();


import('./outline.js');

installWorkbench({getEditor:()=>editor, isBusy:()=>busy, toast, locked, save, rename:async name=>{if(filePath && dirty() && !(await save()))return false;const result=await checked(api.renameDocument(name));if(result.path)filePath=result.path;$('fileName').textContent=result.name;if(!filePath && autoEnabled())await checked(api.draftWrite({text:serialize(),name:result.name}));refresh();return true;}});
