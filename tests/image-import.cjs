const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'moye-import-'));
  const target = path.join(temp, '新笔记.md');
  let app;
  try {
    const env = { ...process.env, MOYE_TEST_PROFILE: path.join(temp, 'profile') }; delete env.ELECTRON_RUN_AS_NODE;
    const packaged = process.argv.includes('--packaged');
    app = await electron.launch({ executablePath: packaged ? path.join(root, '发行版/win-unpacked/成简.exe') : require('electron'), args: packaged ? [] : [root], env });
    const page = await app.firstWindow(); page.setDefaultTimeout(10000);
    await page.waitForFunction(() => document.querySelector('#editor')?.value.includes('欢迎来到墨页'));
    await app.evaluate(({ dialog }, imagePath) => {
      global.importCalls = [];
      dialog.showSaveDialog = async () => { global.importCalls.push('save-markdown'); return { canceled: true }; };
      dialog.showOpenDialog = async (_win, options) => { global.importCalls.push(`open-${options.filters[0].extensions[0]}`); return { canceled: false, filePaths: [imagePath] }; };
    }, path.join(root, 'assets/mountains.svg'));
    await page.locator('#imageBtn').click();
    await page.waitForTimeout(350);
    const calls = await app.evaluate(() => global.importCalls);
    console.log('Image button dialog sequence:', calls);
    assert.deepEqual(calls, ['open-png'], 'A new document must open the image picker immediately, without a Markdown save dialog.');
    await page.waitForFunction(() => document.querySelector('#preview img')?.naturalWidth === 1200);
    assert.equal(await page.locator('#fileName').textContent(), '未命名.md');
    await page.locator('#preview img').click(); await page.locator('#imageWidth').fill('360'); await page.locator('#imageWidth').press('Enter');
    await page.waitForFunction(() => document.querySelector('#preview img')?.getAttribute('width') === '360');
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, target);
    await page.locator('#saveBtn').click();
    await page.waitForFunction(() => document.querySelector('#saveState').textContent === '已保存');
    const saved = await fs.readFile(target, 'utf8');
    assert.ok(saved.includes('新笔记.assets/')); assert.ok(saved.includes('width="360"')); assert.ok(!saved.includes('file:///'));
    assert.equal((await fs.readdir(path.join(temp, '新笔记.assets'))).length, 1);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, target);
    await page.locator('#openBtn').click();
    await page.waitForFunction(() => document.querySelector('#preview img')?.naturalWidth === 1200 && document.querySelector('#preview img')?.getAttribute('width') === '360');
    await app.evaluate(({ clipboard, nativeImage }) => {
      const png = nativeImage.createFromBitmap(Buffer.from([80, 120, 90, 255]), { width: 1, height: 1 }).toPNG();
      clipboard.read = async () => [{ types: ['image/png'], getType: async () => new Blob([png], { type: 'image/png' }) }];
    });
    await page.locator('#editor').evaluate(editor => {
      const data = new DataTransfer(); data.items.add(new File([new Uint8Array([1])], 'clipboard.png', { type: 'image/png' }));
      editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => [...document.querySelectorAll('#preview img')].some(image => image.naturalWidth === 1));
    assert.ok((await page.locator('#editor').inputValue()).includes('粘贴图片'));
    await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true }); });
    const before = await page.locator('#editor').inputValue(); await page.locator('#imageBtn').click();
    await page.waitForTimeout(150); assert.equal(await page.locator('#editor').inputValue(), before);
    console.log('PASS: new-document image picker, staged preview, resized image save/reopen, clipboard import, cancel.');
  } finally {
    if (app) { await app.evaluate(({ app }) => { setTimeout(() => app.exit(0), 50); }).catch(() => {}); await app.close().catch(() => {}); }
    await fs.rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
