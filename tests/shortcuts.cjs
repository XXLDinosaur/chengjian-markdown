const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'moye-keys-')); let app;
  try {
    const env = { ...process.env, MOYE_TEST_PROFILE: temp }; delete env.ELECTRON_RUN_AS_NODE;
    const packaged = process.argv.includes('--packaged');
    app = await electron.launch({ executablePath: packaged ? path.join(root, require('../package.json').build.directories.output, 'win-unpacked/成简.exe') : require('electron'), args: packaged ? [] : [root], env });
    const page = await app.firstWindow(); page.setDefaultTimeout(10000);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
    const press = async key => { await page.keyboard.press(key); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); };
    await page.waitForSelector('.tiptap'); await page.locator('#autoSave').uncheck(); await press('Control+n'); await page.waitForFunction(()=>document.querySelector('.tiptap').textContent==='');
    const doc = page.locator('.tiptap'); await doc.click(); await page.keyboard.insertText('快捷键测试'); await press('Control+a');
    for (const [key, tag] of [['Control+b','strong'],['Control+i','em'],['Control+Shift+x','s']]) { await press(key); assert.equal(await doc.locator(tag).count(), 1); await press(key); assert.equal(await doc.locator(tag).count(), 0); }
    await press('Control+Home');
    for (const level of [1,2,3]) { await press(`Control+Alt+${level}`); assert.equal(await doc.locator('h' + level).count(), 1, await doc.innerHTML()); }
    await press('Control+Alt+0'); assert.equal(await doc.locator('h1,h2,h3').count(), 0); assert.equal(await page.locator('#zoomValue').textContent(), '100%');
    for (const [key, tag] of [['Control+Shift+8','ul'],['Control+Shift+7','ol'],['Control+Shift+9','ul[data-type="taskList"]'],['Control+Shift+b','blockquote'],['Control+Alt+c','pre']]) { await press(key); assert.equal(await doc.locator(tag).count(), 1); await press(key); assert.equal(await doc.locator(tag).count(), 0); }
    await press('Control+a'); await press('Control+b'); await press('Control+z'); assert.equal(await doc.locator('strong').count(), 0); await press('Control+y'); assert.equal(await doc.locator('strong').count(), 1);
    await press('Control+z'); await press('Control+Shift+z'); assert.equal(await doc.locator('strong').count(), 1);
    await press('Control+k'); assert.equal(await page.locator('#linkDialog').evaluate(e => e.open), true);
    await page.locator('#linkUrl').fill('https://example.com'); await press('Control+Alt+t'); assert.equal(await page.locator('#tableDialog').evaluate(e => e.open), false); await press('Escape');
    await doc.focus(); await press('Control+Alt+t'); assert.equal(await page.locator('#tableDialog').evaluate(e => e.open), true); await press('Escape');
    await app.evaluate(({ dialog }, args) => { global.imageCalls = 0; global.saveCalls = 0; dialog.showOpenDialog = async () => { global.imageCalls++; return { canceled: false, filePaths: [args.image] }; }; dialog.showSaveDialog = async () => { global.saveCalls++; return { canceled: false, filePath: args.file }; }; }, { image: path.join(root,'assets/mountains.svg'), file: path.join(temp,'快捷键.md') });
    await doc.focus(); await press('Control+End'); await press('Control+Shift+i'); await page.waitForFunction(() => document.querySelector('.tiptap .rich-image img')?.naturalWidth === 1200); assert.equal(await app.evaluate(() => global.imageCalls), 1);
    await doc.focus(); await press('Control+Shift+s'); await page.waitForFunction(() => document.querySelector('#saveState').textContent === '已保存'); assert.equal(await app.evaluate(() => global.saveCalls), 1); assert.equal(await doc.locator('s').count(), 0);
    await doc.focus(); await press('Control+Equal'); assert.equal(await page.locator('#zoomValue').textContent(), '110%'); await press('Control+Minus'); assert.equal(await page.locator('#zoomValue').textContent(), '100%');
    for (const selector of ['[data-command="bold"]','[data-command="strike"]','#imageBtn','#tableBtn','#blockType']) { await page.locator(selector).hover(); await page.waitForFunction(() => !document.querySelector('#shortcutTip').hidden); assert.ok((await page.locator('#shortcutTip').innerText()).includes('Ctrl+')); }
    await page.locator('#tableBtn').hover(); await page.waitForFunction(() => document.querySelector('#shortcutTip').textContent.includes('Ctrl+Alt+T'));
    await page.screenshot({ path: path.join(root,'test-results/shortcut-tooltip.png') });
    console.log('PASS: formatting/list/heading shortcuts, single undo/redo, dialogs, modal isolation, image insertion, Save As without strike conflict, zoom, visible hover tooltips.');
  } finally { if (app) { await app.evaluate(({ app }) => { setTimeout(() => app.exit(0), 50); }).catch(() => {}); await app.close().catch(() => {}); } await fs.rm(temp, { recursive:true, force:true, maxRetries:5, retryDelay:250 }); }
})().catch(e => { console.error(e); process.exitCode=1; });





