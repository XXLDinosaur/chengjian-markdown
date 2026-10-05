const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'moye-glass-'));
  let app;
  try {
    const env = { ...process.env, MOYE_TEST_PROFILE: temp }; delete env.ELECTRON_RUN_AS_NODE;
    const packaged = process.argv.includes('--packaged');
    app = await electron.launch({ executablePath: packaged ? path.join(root, require('../package.json').build.directories.output, 'win-unpacked/墨页 Markdown.exe') : require('electron'), args: [...(packaged ? [] : [root]), path.join(root, '示例文档.md')], env });
    const page = await app.firstWindow(); page.setDefaultTimeout(12000);
    await page.waitForSelector('.tiptap table');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
    await page.screenshot({ path: path.join(root, 'test-results/glass-light.png') });
    await page.locator('#tableBtn').click();
    await page.screenshot({ path: path.join(root, 'test-results/glass-dialog.png') });
    await page.keyboard.press('Escape');
    await page.locator('#colorsBtn').click(); await page.locator('[data-scheme="dark"]').click(); await page.keyboard.press('Escape');
    await page.screenshot({ path: path.join(root, 'test-results/glass-dark.png') });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 720));
    await page.screenshot({ path: path.join(root, 'test-results/glass-compact.png') });
    console.log('Saved light, dark, dialog, compact window previews.');
  } finally { if (app) { await app.evaluate(({ app }) => { setTimeout(() => app.exit(0), 50); }).catch(() => {}); await app.close().catch(() => {}); } await fs.rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); }
})().catch(e => { console.error(e); process.exitCode = 1; });

