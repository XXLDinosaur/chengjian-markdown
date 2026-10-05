const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'moye-drop-'));
  const files = [path.join(temp, '中文图片 一.svg'), path.join(temp, '中文图片 二.svg')];
  for (const file of files) await fs.copyFile(path.join(root, 'assets/mountains.svg'), file);
  const target = path.join(temp, '拖拽笔记.md');
  let app;
  try {
    const env = { ...process.env, MOYE_TEST_PROFILE: path.join(temp, 'profile') }; delete env.ELECTRON_RUN_AS_NODE;
    const packaged = process.argv.includes('--packaged');
    app = await electron.launch({ executablePath: packaged ? path.join(root, '发行版/win-unpacked/成简.exe') : require('electron'), args: packaged ? [] : [root], env });
    const page = await app.firstWindow(); page.setDefaultTimeout(10000);
    await page.waitForFunction(() => document.querySelector('#editor')?.value.includes('欢迎来到墨页'));
    const cdp = await page.context().newCDPSession(page);
    async function drop(selector, filenames) {
      const box = await page.locator(selector).boundingBox();
      const data = { items: [], files: filenames, dragOperationsMask: 1 };
      const point = { x: box.x + box.width / 2, y: box.y + Math.min(100, box.height / 2), data };
      await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', ...point });
      await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', ...point });
      await cdp.send('Input.dispatchDragEvent', { type: 'drop', ...point });
    }
    await page.locator('#editor').fill('# 拖拽测试\n\n原有文字');
    await page.locator('#editor').press('Control+End');
    await drop('#editor', files);
    await page.waitForFunction(() => document.querySelectorAll('#preview img').length === 2 && [...document.querySelectorAll('#preview img')].every(i => i.naturalWidth === 1200), null, { timeout: 5000 });
    assert.ok((await page.locator('#editor').inputValue()).includes('原有文字'));
    await page.locator('#editor').focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelectorAll('#preview img').length === 0);
    await page.keyboard.press('Control+y');
    await page.waitForFunction(() => document.querySelectorAll('#preview img').length === 2);
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, target);
    await page.locator('#fileMenuBtn').click(); await page.locator('#saveBtn').click();
    await page.waitForFunction(() => document.querySelector('#saveState').textContent === '已保存');
    assert.equal((await fs.readdir(path.join(temp, '拖拽笔记.assets'))).length, 2);
    await page.locator('[data-view="read"]').click();
    await drop('#previewScroll', [files[0]]);
    await page.waitForFunction(() => document.querySelectorAll('#preview img').length === 3 && [...document.querySelectorAll('#preview img')].every(i => i.naturalWidth === 1200));
    const before = await page.locator('#editor').inputValue();
    const unsupported = path.join(temp, '不支持.txt'); await fs.writeFile(unsupported, 'not an image');
    await drop('#previewScroll', [unsupported]);
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('图片'));
    assert.equal(await page.locator('#editor').inputValue(), before);
    assert.equal(await page.locator('#panes').evaluate(e => e.classList.contains('file-drag-over')), false);
    await page.locator('#fileMenuBtn').click(); await page.locator('#saveBtn').click(); await page.waitForFunction(() => document.querySelector('#saveState').textContent === '已保存');
    await page.locator('#fileMenuBtn').click(); await page.locator('#openBtn').click();
    await page.waitForFunction(() => document.querySelectorAll('#preview img').length === 3 && [...document.querySelectorAll('#preview img')].every(i => i.naturalWidth === 1200));
    console.log('PASS: native Chromium file drop into editor and read preview, multiple Chinese-path files, undo/redo, new-document save, saved-document import, unsupported file, reopen.');
  } finally {
    if (app) { await app.evaluate(({ app }) => { setTimeout(() => app.exit(0), 50); }).catch(() => {}); await app.close().catch(() => {}); }
    await fs.rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
