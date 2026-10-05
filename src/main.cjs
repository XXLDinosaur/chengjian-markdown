const { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { readDocument, atomicSave, hash } = require('./files.cjs');
const { relocateImages, prepareMarkdown } = require('../dist/document.cjs');
let imageStagingDirectory;
const stagedImages = new Map();
const {renderVector}=require('./vector-image.cjs');
const { collectResources, encodePath } = require('./resources.cjs');
if (process.env.MOYE_TEST_PROFILE) app.setPath('userData', process.env.MOYE_TEST_PROFILE);
let win, documentState = null, dirty = false, closing = false, closePending = false;
const filters = [{ name: 'Markdown 文档', extensions: ['md', 'markdown', 'mdown', 'txt'] }];
const state = () => ({ path: documentState?.path || null, name: documentState ? path.basename(documentState.path) : '未命名.md', text: documentState?.text || '', encoding: documentState?.encoding || 'utf8' });
async function openFile(file) {
  const next = await readDocument(file);
  documentState = next;
  return state();
}
function register(name, handler) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('无效请求');
    try { return await handler(...args); } catch (error) { return { error: error.message }; }
  });
}
app.whenReady().then(() => {
  app.setAppUserModelId('local.moye.markdown');
  win = new BrowserWindow({ frame:false, width: 1440, height: 920, minWidth: 980, minHeight: 650, backgroundColor: '#f5f5f2', title: '成简', icon: path.join(__dirname, '../assets/app-icon.ico'), show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  win.on('close', event => { if (dirty && !closing) { event.preventDefault(); if (!closePending) { closePending = true; win.webContents.send('request-close'); } } });
  win.once('ready-to-show', () => { if (!process.env.MOYE_TEST_PROFILE) win.show(); });
  register('window-control', action => {
    if(action==='minimize')win.minimize();
    else if(action==='maximize'){if(win.isMaximized())win.unmaximize();else win.maximize();}
    else if(action==='close')win.close();
    return {maximized:win.isMaximized()};
  });
  register('edit-command', command => {if(!['copy','paste','cut'].includes(command))throw Error('无效编辑操作');win.webContents[command]();return true;});
  register('initial', async () => {
    const file = process.argv.find(arg => /\.(md|markdown|mdown|txt)$/i.test(arg) && path.isAbsolute(arg));
    return file ? openFile(file) : null;
  });
  register('open', async () => {
    const result = await dialog.showOpenDialog(win, { title: '打开 Markdown 文档', filters, properties: ['openFile'] });
    return result.canceled ? null : openFile(result.filePaths[0]);
  });
  register('new', () => { documentState = null; return state(); });
  register('dirty', value => { dirty = Boolean(value); win.setTitle(`${dirty ? '● ' : ''}${documentState ? path.basename(documentState.path) : '未命名'} — 成简`); });
  register('confirm-leave', async () => {
    const { response } = await dialog.showMessageBox(win, { type: 'question', title: '保存修改', message: '当前文档有未保存的修改', buttons: ['保存', '不保存', '取消'], defaultId: 0, cancelId: 2, noLink: true });
    return ['save', 'discard', 'cancel'][response];
  });
  register('save', async ({ text, saveAs, automatic = false, suggestedName }) => {
    if (typeof text !== 'string' || Buffer.byteLength(text) > 40 * 1024 * 1024) throw new Error('文档内容过大。');
    let target = documentState?.path;
    if (automatic && !target) throw new Error('文档尚未选择保存位置');
    if (!target || saveAs) {
      const result = await dialog.showSaveDialog(win, { title: '保存 Markdown 文档', defaultPath: target || path.basename(suggestedName || '未命名.md'), filters });
      if (result.canceled) return null;
      target = result.filePath;
    }
    if (documentState && target === documentState.path) {
      const disk = await fs.readFile(target).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
      if (!disk || hash(disk) !== documentState.hash) {
        if (automatic) throw new Error('自动保存已暂停：文件被其他程序修改，请手动保存或另存为。');
        const { response } = await dialog.showMessageBox(win, { type: 'warning', message: '磁盘上的文件已被其他程序修改或删除。', detail: '覆盖会用当前编辑内容替换磁盘版本。可取消后使用“另存为”保留两份。', buttons: ['取消', '覆盖'], defaultId: 0, cancelId: 0, noLink: true });
        if (response !== 1) return null;
      }
    }
    text = await collectResources({ text, sourceDocument: documentState?.path, targetDocument: target,
      stagedImages, prepareMarkdown, relocateImages, writeImage });
    const format = documentState || { encoding: 'utf8', bom: false, eol: '\n' };
    const digest = await atomicSave(target, text, format);
    documentState = { ...format, path: target, text, hash: digest };
    return state();
  });
  register('draft-read', async () => { try { const data=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'draft.json'),'utf8'));const draftRoot=path.join(app.getPath('userData'),'draft-assets')+path.sep;for(const image of prepareMarkdown(data.text).images){if(image.src.startsWith('file:')){const file=require('node:url').fileURLToPath(image.src);if(file.startsWith(draftRoot))stagedImages.set(image.src,{path:file,name:path.basename(file)});}}return data; } catch { return null; } });
  register('draft-write', async data => {
    const file=path.join(app.getPath('userData'),'draft.json');
    if(data===null) { await fs.unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;}); return; }
    if(typeof data.text!=='string' || Buffer.byteLength(data.text)>40*1024*1024)throw new Error('草稿过大');
    await atomicSave(file,JSON.stringify({text:data.text,name:path.basename(data.name || '未命名.md')}),{encoding:'utf8',bom:false,eol:'\n'});
  });
  register('rename-document', async name => {
    if(typeof name!=='string' || !name.trim() || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))throw new Error('文件名包含无效字符');
    if(!/\.md$/i.test(name))name+='.md';
    if(!documentState)return {name};
    const target=path.join(path.dirname(documentState.path),name);if(target===documentState.path)return state();
    if(hash(await fs.readFile(documentState.path))!==documentState.hash)throw new Error('文件已被外部修改，请重新打开后改名');
    await fs.copyFile(documentState.path,target,require('node:fs').constants.COPYFILE_EXCL);
    await fs.unlink(documentState.path);documentState.path=target;return state();
  });
  let normalBounds, wasMaximized, floating = false;
  register('float-window', enabled => {
    if(enabled && !floating){wasMaximized=win.isMaximized();normalBounds=win.getNormalBounds();if(wasMaximized)win.unmaximize();win.setMinimumSize(380,360);win.setAlwaysOnTop(true);win.setSize(520,650);}
    else if(!enabled && floating){win.setAlwaysOnTop(false);win.setMinimumSize(980,650);if(normalBounds)win.setBounds(normalBounds);if(wasMaximized)win.maximize();}
    floating = Boolean(enabled); return floating;
  });
  register('print-document', () => new Promise(resolve=>win.webContents.print({silent:false,printBackground:true},(success,reason)=>resolve({success,reason}))));
  register('theme-image', async () => {
    const result=await dialog.showOpenDialog(win,{title:'选择主题背景图片',filters:[{name:'图片',extensions:['png','jpg','jpeg','webp']}],properties:['openFile']});if(result.canceled)return null;
    const bytes=await fs.readFile(result.filePaths[0]);if(bytes.length>20*1024*1024)throw new Error('主题图片不能超过 20 MB');
    const image=require('electron').nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw new Error('无法读取该图片');
    const size=image.getSize();const resized=size.width>2560?image.resize({width:2560}):image;
    const folder=path.join(app.getPath('userData'),'theme-images');await fs.mkdir(folder,{recursive:true});
    const file=path.join(folder,require('node:crypto').randomUUID()+'.jpg');await fs.writeFile(file,resized.toJPEG(88));return {url:pathToFileURL(file).href,thumbnail:resized.resize({width:200}).toDataURL()};
  });
  async function stageWordHTML(html,folder){
    for(const match of [...html.matchAll(/<img\b[^>]*>/gi)]){
      const attr=match[0].match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);if(!attr)continue;
      const raw=(attr[1]??attr[2]??attr[3]).replace(/&amp;/g,'&');if(/^(https?:|data:)/i.test(raw))continue;
      let file;try{file=raw.startsWith('file:')?require('node:url').fileURLToPath(raw):path.resolve(folder,decodeURIComponent(raw));}catch{continue;}
      if(!/\.(png|jpe?g|gif|bmp|svg|webp)$/i.test(file))continue;
      const staged=await writeImage(await fs.readFile(file),path.basename(file),null);
      html=html.replace(match[0],match[0].replace(attr[0],'src="'+staged.src+'"'));
    }
    return html;
  }
  register('paste-word',async ({html,plain})=>{
    if(typeof html!=='string'||html.length>20*1024*1024)throw new Error('粘贴内容过大');
    // Prefer the matching Office VML vector source when it precedes a fallback bitmap.
    for(const pair of [...html.matchAll(/<v:imagedata\b[^>]*\bsrc=["']([^"']+)["'][^>]*>[\s\S]{0,1800}?<img\b[^>]*>/gi)]){
      const raw=pair[1].replace(/&amp;/g,'&');let file;try{file=raw.startsWith('file:')?require('node:url').fileURLToPath(raw):path.resolve(app.getPath('temp'),decodeURIComponent(raw));}catch{continue;}
      if(!/\.(emf|wmf|emz|wmz)$/i.test(file))continue;
      const vector=await renderVector(file);if(!vector)continue;
      const original=pair[0].match(/<img\b[^>]*>$/i)[0],staged=await writeImage(vector.bytes,'公式高清.png',null);
      const replacement=original.replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,'src="'+staged.src+'"');html=html.replace(pair[0],pair[0].slice(0,-original.length)+replacement);
    }
    const plainHTML=html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<xml\b[^>]*>[\s\S]*?<\/xml>/gi,'').replace(/<(?:m:)?(?:oMath|oMathPara|math)\b[^>]*>[\s\S]*?<\/(?:m:)?(?:oMath|oMathPara|math)>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,'').replace(/&nbsp;|\s/g,'');
    if(!plainHTML && [...html.matchAll(/<img\b/gi)].length<=1){const vector=await renderVector();if(vector){const staged=await writeImage(vector.bytes,'公式高清.png',null);if(/<img\b/i.test(html))html=html.replace(/(<img\b[^>]*\bsrc=)["'][^"']*["']/i,'$1"'+staged.src+'"');else html='<p><img src="'+staged.src+'" width="'+vector.width+'"></p>';}}
    if(!/<img\b/i.test(html) && /<(?:m:)?(?:oMath|math)\b/i.test(html+' '+plain))throw new Error('剪贴板没有 Word 原始公式图片。请在 Word 中复制公式为图片后重试，以保持原样。');
    return {html:await stageWordHTML(html,app.getPath('temp'))};
  });
  register('image', async () => {
    const result = await dialog.showOpenDialog(win, { title: '插入图片', filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'] }], properties: ['openFile'] });
    if (result.canceled) return null;
    return importImage(result.filePaths[0]);
  });
  register('dropped-image', async image => {
    if (!image || typeof image.name !== 'string' || image.name.length > 255 || !(image.bytes instanceof Uint8Array) || !image.bytes.length) throw new Error('无法读取拖入的图片，请重试。');
    return writeImage(Buffer.from(image.bytes), path.basename(image.name));
  });
  register('paste-image', async () => {
    const vector=await renderVector();if(vector)return {...await writeImage(vector.bytes,'高清粘贴图片.png'),width:vector.width};
    const formats = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/avif': 'avif', 'image/svg+xml': 'svg' };
    for (const item of await clipboard.read()) {
      const type = Object.keys(formats).find(type => item.types.includes(type));
      if (!type) continue;
      const blob = await item.getType(type);
      return writeImage(Buffer.from(await blob.arrayBuffer()), `粘贴图片-${Date.now()}.${formats[type]}`);
    }
    throw new Error('剪贴板中没有可用图片，请重新复制图片或使用“＋ 图片”选择文件。');
  });
  async function writeImage(bytes, name, targetDocument = documentState?.path) {
    if (bytes.length > 40 * 1024 * 1024) throw new Error('图片超过 40 MB，请缩小文件后重试。');
    const ext = path.extname(name).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif'].includes(ext)) throw new Error('暂不支持这种图片格式，请使用 PNG、JPG、SVG 等常见格式。');
    const folderName = targetDocument ? `${path.basename(targetDocument, path.extname(targetDocument))}.assets` : null;
    if (!targetDocument && !imageStagingDirectory) imageStagingDirectory = path.join(app.getPath('userData'), 'draft-assets');
    const folder = targetDocument ? path.join(path.dirname(targetDocument), folderName) : imageStagingDirectory;
    await fs.mkdir(folder, { recursive: true });
    const uniqueName = `${path.basename(name, ext).replace(/[<>:"/\\|?*]/g, '_')}-${require('node:crypto').randomUUID().slice(0, 8)}${ext}`;
    await fs.writeFile(path.join(folder, uniqueName), bytes, { flag: 'wx' });
    if (!targetDocument) {
      const src = pathToFileURL(path.join(folder, uniqueName)).href;
      stagedImages.set(src, { path: path.join(folder, uniqueName), name });
      return { src, name: path.basename(name, ext) };
    }
    return { src: `${encodePath(folderName)}/${encodePath(uniqueName)}`, name: path.basename(name, ext) };
  }
  async function importImage(file) { return writeImage(await fs.readFile(file), path.basename(file)); }
  register('resolve-images', sources => {
    if (!Array.isArray(sources) || sources.length > 10000) throw new Error('图片数量过多。');
    return sources.map(src => {
      if (typeof src !== 'string') return '';
      if (/^https?:\/\//i.test(src) || /^data:image\/(png|jpeg|gif|webp|avif|bmp);base64,/i.test(src)) return src;
      if (/^file:\/\//i.test(src)) return src;
      if (/^[a-z][a-z0-9+.-]*:/i.test(src) && !/^[a-z]:[\\/]/i.test(src)) return '';
      let decoded = src; try { decoded = decodeURIComponent(src); } catch {}
      if (!path.isAbsolute(decoded) && !documentState) return '';
      return pathToFileURL(path.resolve(documentState ? path.dirname(documentState.path) : '', decoded)).href;
    });
  });
  register('external-link', async url => { if (typeof url === 'string' && /^https?:\/\//i.test(url)) await shell.openExternal(url); });
  register('close-result', allow => { closePending = false; if (allow) { closing = true; win.close(); } });
  win.loadFile(path.join(__dirname, '../dist/index.html'));
});
app.on('window-all-closed', async () => {
  // Draft assets survive restarts so recovered unsaved documents retain their images.
  app.quit();
});
