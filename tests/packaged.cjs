const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'moye-packaged-'));
  let app;
  try {
    const env = { ...process.env, MOYE_TEST_PROFILE: path.join(temp, 'profile') }; delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ executablePath: path.join(root, '发行版', 'win-unpacked', '墨页 Markdown.exe'), args: [path.join(root, '示例文档.md')], env });
    const page = await app.firstWindow(); page.setDefaultTimeout(15000);
    await page.waitForFunction(() => document.querySelector('#preview img')?.naturalWidth === 1200);
    assert.equal(await page.locator('#fileName').textContent(), '示例文档.md');
    await page.locator('[data-view="read"]').click();
    await page.locator('[data-zoom="preview:1"]').click();
    assert.equal(await page.locator('#previewZoom').textContent(), '110%');
    assert.equal(await page.locator('#preview input[type="checkbox"]').count(), 3);
    await page.locator('#preview img').dblclick();
    assert.equal(await page.locator('#lightbox').evaluate(e => e.open), true);
    console.log('PASS: packaged Windows executable opens Chinese-path Markdown, loads local image, renders checkboxes, zooms and opens image viewer.');
  } finally {
    if (app) { await app.evaluate(({ app }) => { setTimeout(() => app.exit(0), 50); }).catch(() => {}); await app.close().catch(() => {}); }
    await fs.rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
