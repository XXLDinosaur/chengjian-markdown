import DOMPurify from 'dompurify';
import { prepareMarkdown, resizeImage, escapeAttr, clamp } from './core.mjs';
const $ = id => document.getElementById(id);
const editor = $('editor'), preview = $('preview'), api = window.desktop;
const welcome = `# 你好，欢迎来到墨页

让文字回到文字，让阅读更舒适。

这是你的本地 Markdown 工作台。打开一份文档，或者直接从这里开始写。

> **看得清，写得自在。**\n> 正文可以缩放，图片也可以。所有内容保存在你的电脑上。

## 01 · 调到舒服的大小

- 在编辑区或预览区按住 **Ctrl + 滚轮**，分别缩放。
- 也可以点击右上角的 **− / ＋**，点击百分比恢复到 100%。
- 切换到 **阅读** 模式，专心看内容。

## 02 · 图片，由你掌控

把图片拖进编辑区或预览区，点击 **＋ 图片**，或直接粘贴截图。新文档也可以立即插图。

1. **单击图片**：输入宽度，或拖动右下角调整大小。
2. **双击图片**：打开大图，滚轮缩放、拖动查看细节。
3. **保存文档**：图片尺寸会一起保留。

插入的图片会复制到文档旁的同名 \`.assets\` 文件夹，移动文档时带上它即可。

## 03 · 从一段想法开始

- [x] 找到顺手的书写工具
- [ ] 整理今天的灵感
- [ ] 把想法变成作品

| 操作 | 快捷键 |
| --- | --- |
| 打开 / 保存 | Ctrl + O / Ctrl + S |
| 另存为 | Ctrl + Shift + S |
| 加粗 / 斜体 | Ctrl + B / Ctrl + I |
| 撤销 / 重做 | Ctrl + Z / Ctrl + Y |

---

*不需要订阅。随时打开，随手记录。*
`;
let savedText = '', filePath = null, busy = false, renderSequence = 0, renderTimer, toastTimer;
let imageRecords = [], selected = null, history = [], historyIndex = -1, pendingSelection = null;
let preferences = {};
try { preferences = JSON.parse(localStorage.getItem('moye.preferences') || '{}'); } catch {}
const zoom = { editor: clamp(Number(preferences.editor) || 100, 50, 300), preview: clamp(Number(preferences.preview) || 100, 50, 300) };
const persist = () => localStorage.setItem('moye.preferences', JSON.stringify({ ...zoom, dark: document.body.classList.contains('dark') }));
document.body.classList.toggle('dark', Boolean(preferences.dark));
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4200); }
async function checked(promise) { const result = await promise; if (result?.error) throw new Error(result.error); return result; }
function status() {
  const dirty = editor.value !== savedText;
  $('saveState').textContent = dirty ? '未保存' : filePath ? '已保存' : '新文档';
  $('wordCount').textContent = `${editor.value.replace(/\s/g, '').length.toLocaleString()} 字`;
  const before = editor.value.slice(0, editor.selectionStart).split('\n');
  $('cursorPosition').textContent = `行 ${before.length}，列 ${before.at(-1).length + 1}`;
  api.dirty(dirty);
}
function record() {
  if (history[historyIndex]?.text === editor.value) return;
  history.splice(historyIndex + 1);
  history.push({ text: editor.value, cursor: editor.selectionStart });
  if (history.length > 100) history.shift();
  historyIndex = history.length - 1;
}
function changed(immediate = false) { record(); status(); deselect(); ++renderSequence; clearTimeout(renderTimer); if (immediate) render(); else renderTimer = setTimeout(render, 160); }
function replaceText(text, cursor = editor.selectionStart) { editor.value = text; editor.setSelectionRange(cursor, cursor); changed(true); }
function insert(text, selectionStart, selectionEnd) {
  if (busy) return;
  const start = selectionStart ?? editor.selectionStart, end = selectionEnd ?? editor.selectionEnd;
  replaceText(editor.value.slice(0, start) + text + editor.value.slice(end), start + text.length);
  editor.focus();
}
async function render() {
  const sequence = ++renderSequence;
  try {
    const result = prepareMarkdown(editor.value);
    const sanitized = DOMPurify.sanitize(result.html, { FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'dialog', 'iframe', 'object', 'embed', 'svg', 'math', 'video', 'audio'], FORBID_ATTR: ['style', 'srcset', 'id', 'name'], ADD_ATTR: ['data-image-id'] });
    const sources = await checked(api.resolveImages(result.images.map(img => img.src)));
    if (sequence !== renderSequence) return;
    imageRecords = result.images;
    preview.innerHTML = sanitized;
    for (const input of preview.querySelectorAll('input')) { if (input.type === 'checkbox') input.disabled = true; else input.remove(); }
    selected = null; $('imageToolbar').hidden = true;
    for (const img of preview.querySelectorAll('img')) {
      const index = Number(img.dataset.imageId);
      if (!Number.isInteger(index) || !imageRecords[index]) { img.remove(); continue; }
      if (sources[index]) img.src = sources[index]; else img.removeAttribute('src');
      img.title = `${imageRecords[index].alt || '图片'} · 单击调整尺寸，双击放大查看`;
      img.addEventListener('error', () => img.title = '图片无法加载：请检查路径或网络');
      const wrapper = document.createElement('span'); wrapper.className = 'image-wrap';
      img.replaceWith(wrapper); wrapper.append(img);
      const handle = document.createElement('button'); handle.className = 'resize-handle'; handle.title = '拖动调整图片宽度'; handle.setAttribute('aria-label', '拖动调整图片宽度'); wrapper.append(handle);
      img.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); selectImage(img, index); });
      img.addEventListener('dblclick', e => { e.preventDefault(); e.stopPropagation(); showImage(img); });
      handle.addEventListener('pointerdown', e => startResize(e, img, index));
      if (pendingSelection === index) selectImage(img, index);
    }
    pendingSelection = null;
    const headings = [...preview.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    $('headingCount').textContent = headings.length;
    $('outline').replaceChildren();
    if (!headings.length) { const empty = document.createElement('p'); empty.className = 'outline-empty'; empty.textContent = '使用 # 标题组织文档\n大纲会出现在这里。'; $('outline').append(empty); }
    headings.forEach((heading, index) => {
      heading.id = `section-${index}`;
      const button = document.createElement('button'); button.textContent = heading.textContent; button.title = heading.textContent;
      button.style.paddingLeft = `${7 + Math.max(0, Number(heading.tagName[1]) - 1) * 10}px`;
      button.onclick = () => { if ($('panes').dataset.view === 'edit') setView('split'); heading.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      $('outline').append(button);
    });
    $('status').textContent = filePath || '本地工作台 · 可直接插图，Ctrl+S 保存文档和图片'; $('status').title = filePath || '';
  } catch (error) { if (sequence === renderSequence) toast(`预览失败：${error.message}`); }
}
function deselect() { selected?.element.classList.remove('selected'); selected = null; $('imageToolbar').hidden = true; }
function selectImage(element, index) {
  deselect(); selected = { element, index, record: imageRecords[index] }; element.classList.add('selected');
  $('imageToolbar').hidden = false;
  $('imageWidth').value = imageRecords[index].width || Math.round(element.getBoundingClientRect().width / (zoom.preview / 100)) || element.naturalWidth || 400;
}
function applyWidth(width) {
  if (!selected || busy) return;
  try { const image = selected.record; pendingSelection = selected.index; replaceText(resizeImage(editor.value, image, width)); toast(width == null ? '已恢复图片原始大小，保存后生效' : `图片宽度已设为 ${Math.round(clamp(width, 24, 8192))} px · Ctrl+S 保存`); }
  catch (error) { toast(error.message); }
}
function startResize(event, img, index) {
  if (busy) return;
  event.preventDefault(); event.stopPropagation(); selectImage(img, index);
  const startX = event.clientX, width = img.getBoundingClientRect().width / (zoom.preview / 100);
  const handle = event.currentTarget; handle.setPointerCapture(event.pointerId);
  let target = width;
  const move = e => { target = clamp(width + (e.clientX - startX) / (zoom.preview / 100), 24, 8192); img.style.width = `${target}px`; $('imageWidth').value = Math.round(target); };
  const done = e => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', done); handle.removeEventListener('pointercancel', cancel); if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId); applyWidth(target); };
  const cancel = () => { img.style.width = ''; handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', done); handle.removeEventListener('pointercancel', cancel); };
  handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', done); handle.addEventListener('pointercancel', cancel);
}
function setZoom(area, value) { zoom[area] = clamp(value, 50, 300); $(area + 'Zoom').textContent = `${zoom[area]}%`; if (area === 'editor') document.documentElement.style.setProperty('--editor-size', `${14 * zoom.editor / 100}px`); else preview.style.zoom = zoom.preview / 100; persist(); }
function setView(view) { deselect(); $('panes').dataset.view = view; document.querySelectorAll('[data-view]').forEach(button => { if (button.tagName === 'BUTTON') button.classList.toggle('active', button.dataset.view === view); }); }
async function save(saveAs = false) {
  const text = editor.value;
  const result = await checked(api.save({ text, saveAs }));
  if (!result) return false;
  filePath = result.path; savedText = result.text;
  if (editor.value === text && result.text !== text) { editor.value = result.text; record(); }
  $('fileName').textContent = result.name; status(); await render(); toast('文档已保存'); return true;
}
async function canLeave() { if (editor.value === savedText) return true; const answer = await checked(api.confirmLeave()); return answer === 'discard' || (answer === 'save' && await save()); }
async function locked(action) {
  if (busy) return; busy = true; editor.readOnly = true;
  for (const button of document.querySelectorAll('.file-actions button')) button.disabled = true;
  try { await action(); } catch (error) { toast(error.message); }
  finally { busy = false; editor.readOnly = false; for (const button of document.querySelectorAll('.file-actions button')) button.disabled = false; }
}
function loadDocument(data) {
  filePath = data.path; savedText = data.text; editor.value = data.text;
  $('fileName').textContent = data.name; $('encodingLabel').textContent = data.encoding === 'utf16le' ? 'UTF-16 LE' : 'UTF-8';
  history = []; historyIndex = -1; record(); editor.scrollTop = 0; $('previewScroll').scrollTop = 0; changed(true);
}
$('newBtn').onclick = () => locked(async () => { if (await canLeave()) loadDocument(await checked(api.newDocument())); });
$('openBtn').onclick = () => locked(async () => { if (await canLeave()) { const data = await checked(api.open()); if (data) loadDocument(data); } });
$('saveBtn').onclick = () => locked(() => save());
$('saveAsBtn').onclick = () => locked(() => save(true));
async function addImage(paste = false) {
  if (busy) return;
  const start = editor.selectionStart, end = editor.selectionEnd;
  let result;
  await locked(async () => { result = await checked(paste ? api.pasteImage() : api.image()); });
  if (result) { insert(`\n![${result.name.replace(/[\[\]]/g, '')}](<${result.src}>)\n`, start, end); toast(filePath ? '图片已插入 · Ctrl+S 保存文档' : '图片已插入 · Ctrl+S 将文档和图片一起保存'); }
}
$('imageBtn').onclick = () => addImage();
const supportedImageName = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
const isFileDrag = event => [...(event.dataTransfer?.types || [])].includes('Files');
let dragDepth = 0;
function clearFileDrag() { dragDepth = 0; $('panes').classList.remove('file-drag-over'); }
document.addEventListener('dragenter', event => {
  if (!isFileDrag(event)) return;
  event.preventDefault(); dragDepth++;
  if (!busy && !$('lightbox').open) $('panes').classList.add('file-drag-over');
});
document.addEventListener('dragover', event => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = busy || $('lightbox').open ? 'none' : 'copy';
});
document.addEventListener('dragleave', event => {
  if (!isFileDrag(event)) return;
  if (--dragDepth <= 0) clearFileDrag();
});
document.addEventListener('dragend', clearFileDrag);
window.addEventListener('blur', clearFileDrag);
document.addEventListener('drop', event => {
  if (!isFileDrag(event)) return;
  event.preventDefault(); event.stopPropagation(); clearFileDrag();
  const files = [...event.dataTransfer.files];
  if (busy) { toast('正在处理文件，请稍后再拖入图片'); return; }
  if ($('lightbox').open) { toast('请先关闭大图查看，再拖入图片'); return; }
  importDroppedImages(files);
}, true);
async function importDroppedImages(files) {
  const accepted = files.filter(file => supportedImageName.test(file.name));
  if (!accepted.length) { toast('请拖入 PNG、JPG、SVG、WebP 等图片文件'); return; }
  if (accepted.length > 20) { toast('一次最多拖入 20 张图片，请分批导入'); return; }
  const position = editor.selectionStart;
  const imported = [], failures = [];
  await locked(async () => {
    for (const file of accepted) {
      try {
        if (file.size > 40 * 1024 * 1024) throw new Error('图片超过 40 MB');
        const bytes = new Uint8Array(await file.arrayBuffer());
        imported.push(await checked(api.droppedImage({ name: file.name, bytes })));
      } catch (error) { failures.push(`${file.name}：${error.message}`); }
    }
  });
  if (imported.length) {
    insert('\n' + imported.map(image => `<img src="${escapeAttr(image.src)}" alt="${escapeAttr(image.name)}">`).join('\n\n') + '\n', position, position);
  }
  const skipped = files.length - accepted.length;
  if (failures.length) toast(`已插入 ${imported.length} 张；${failures[0]}`);
  else toast(`已插入 ${imported.length} 张图片${skipped ? `，已跳过 ${skipped} 个非图片文件` : ''} · Ctrl+S 保存`);
}
editor.addEventListener('paste', event => { if ([...event.clipboardData.items].some(item => item.type.startsWith('image/'))) { event.preventDefault(); addImage(true); } });
editor.addEventListener('input', () => changed());
editor.addEventListener('click', status); editor.addEventListener('keyup', status);
editor.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); insert('  '); } });
function format(kind) {
  const text = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  const formats = { heading: `## ${text || '标题'}`, bold: `**${text || '加粗文字'}**`, italic: `*${text || '斜体文字'}*`, code: text.includes('\n') ? `\n\`\`\`\n${text}\n\`\`\`\n` : `\`${text || '代码'}\``, link: `[${text || '链接文字'}](https://example.com)`, task: `- [ ] ${text || '待办事项'}` };
  insert(formats[kind]);
}
document.querySelectorAll('[data-format]').forEach(button => button.onclick = () => format(button.dataset.format));
document.querySelectorAll('button[data-view]').forEach(button => button.onclick = () => setView(button.dataset.view));
document.querySelectorAll('[data-zoom]').forEach(button => button.onclick = () => { const [area, delta] = button.dataset.zoom.split(':'); setZoom(area, zoom[area] + Number(delta) * 10); });
$('editorZoom').onclick = () => setZoom('editor', 100); $('previewZoom').onclick = () => setZoom('preview', 100);
for (const [element, area] of [[editor, 'editor'], [$('previewScroll'), 'preview']]) element.addEventListener('wheel', event => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); setZoom(area, zoom[area] + (event.deltaY < 0 ? 10 : -10)); } }, { passive: false });
$('themeBtn').onclick = () => { document.body.classList.toggle('dark'); persist(); };
$('imageWidth').addEventListener('keydown', event => { if (event.key === 'Enter' && Number($('imageWidth').value) > 0) applyWidth(Number($('imageWidth').value)); });
$('imageWidth').addEventListener('change', () => { if (Number($('imageWidth').value) > 0) applyWidth(Number($('imageWidth').value)); });
$('imageSmaller').onclick = () => applyWidth(Number($('imageWidth').value) * .9);
$('imageLarger').onclick = () => applyWidth(Number($('imageWidth').value) * 1.1);
$('imageNatural').onclick = () => applyWidth(null);
$('viewImage').onclick = () => { if (selected) showImage(selected.element); };
$('deselectImage').onclick = deselect;
preview.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (link) { event.preventDefault(); const href = link.getAttribute('href'); if (/^https?:\/\//i.test(href)) api.externalLink(href); else if (href?.startsWith('#')) { const name = decodeURIComponent(href.slice(1)); const heading = [...preview.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(h => h.id === name || h.textContent.toLowerCase().replace(/\s+/g, '-') === name); heading?.scrollIntoView({ behavior: 'smooth' }); } else toast('暂时仅支持打开网页链接和文档内标题链接'); }
  if (!event.target.closest('.image-wrap')) deselect();
});
let viewer = { scale: 1, x: 0, y: 0 };
const stage = $('imageStage'), largeImage = $('largeImage');
function paintViewer() { largeImage.style.transform = `translate(${viewer.x}px, ${viewer.y}px) scale(${viewer.scale})`; $('viewerPercent').textContent = `${Math.round(viewer.scale * 100)}%`; }
function centerImage(scale) { viewer = { scale, x: (stage.clientWidth - largeImage.naturalWidth * scale) / 2, y: (stage.clientHeight - largeImage.naturalHeight * scale) / 2 }; paintViewer(); }
function fitImage() { if (!largeImage.naturalWidth) return; centerImage(Math.min((stage.clientWidth - 70) / largeImage.naturalWidth, (stage.clientHeight - 50) / largeImage.naturalHeight, 1)); }
function viewerZoom(factor, x = stage.clientWidth / 2, y = stage.clientHeight / 2) { const next = clamp(viewer.scale * factor, .01, 20); const ratio = next / viewer.scale; viewer.x = x - (x - viewer.x) * ratio; viewer.y = y - (y - viewer.y) * ratio; viewer.scale = next; paintViewer(); }
function showImage(img) { if (!img.complete || !img.naturalWidth) { toast('图片尚未加载或路径无效'); return; } $('imageName').textContent = imageRecords[Number(img.dataset.imageId)]?.alt || '图片预览'; largeImage.onload = fitImage; largeImage.src = img.src; $('lightbox').showModal(); if (largeImage.complete) fitImage(); }
$('viewerClose').onclick = () => $('lightbox').close(); $('viewerFit').onclick = fitImage;
$('viewerOriginal').onclick = $('viewerPercent').onclick = () => centerImage(1);
$('viewerPlus').onclick = () => viewerZoom(1.2); $('viewerMinus').onclick = () => viewerZoom(1 / 1.2);
stage.addEventListener('wheel', event => { event.preventDefault(); const bounds = stage.getBoundingClientRect(); viewerZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - bounds.left, event.clientY - bounds.top); }, { passive: false });
stage.addEventListener('pointerdown', event => { if (event.button !== 0) return; stage.setPointerCapture(event.pointerId); const start = { x: event.clientX, y: event.clientY, vx: viewer.x, vy: viewer.y }; const move = e => { viewer.x = start.vx + e.clientX - start.x; viewer.y = start.vy + e.clientY - start.y; paintViewer(); }; const done = () => { stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerup', done); stage.removeEventListener('pointercancel', done); }; stage.addEventListener('pointermove', move); stage.addEventListener('pointerup', done); stage.addEventListener('pointercancel', done); });
function setSplit(clientX) { const bounds = $('panes').getBoundingClientRect(); document.querySelector('.editor-pane').style.width = `${clamp((clientX - bounds.left) / bounds.width * 100, 25, 75)}%`; }
$('splitter').addEventListener('pointerdown', event => { const handle = event.currentTarget; handle.setPointerCapture(event.pointerId); const move = e => setSplit(e.clientX); const done = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', done); handle.removeEventListener('pointercancel', done); }; handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', done); handle.addEventListener('pointercancel', done); });
$('splitter').addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const bounds = $('splitter').getBoundingClientRect(); setSplit(bounds.left + (event.key === 'ArrowLeft' ? -20 : 20)); } });
document.addEventListener('keydown', event => {
  if ($('lightbox').open) return;
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (['s', 'o', 'n', 'b', 'i'].includes(key)) { event.preventDefault(); if (busy) return; if (key === 's') (event.shiftKey ? $('saveAsBtn') : $('saveBtn')).click(); if (key === 'o') $('openBtn').click(); if (key === 'n') $('newBtn').click(); if (key === 'b') format('bold'); if (key === 'i') format('italic'); }
  if ((key === 'z' || key === 'y') && document.activeElement !== $('imageWidth')) { event.preventDefault(); if (busy) return; const direction = key === 'y' || event.shiftKey ? 1 : -1; const next = clamp(historyIndex + direction, 0, history.length - 1); if (next !== historyIndex) { historyIndex = next; editor.value = history[next].text; editor.setSelectionRange(history[next].cursor, history[next].cursor); status(); deselect(); render(); } }
  if (['+', '=', '-', '0'].includes(key)) { event.preventDefault(); const area = document.activeElement === editor ? 'editor' : 'preview'; setZoom(area, key === '0' ? 100 : zoom[area] + (key === '-' ? -10 : 10)); }
});
api.onClose(async () => { if (busy) { api.closeResult(false); return; } await locked(async () => { let allow = false; try { allow = await canLeave(); } finally { api.closeResult(allow); } }); });
for (const area of ['editor', 'preview']) setZoom(area, zoom[area]);
(async () => { try { const initial = await checked(api.initial()); if (initial) loadDocument(initial); else { editor.value = welcome; savedText = welcome; record(); status(); render(); } } catch (error) { toast(error.message); loadDocument({ path: null, name: '未命名.md', text: '' }); } })();
