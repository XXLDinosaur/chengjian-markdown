const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'moye-colors-')); let app;
  try {
    const env = { ...process.env, MOYE_TEST_PROFILE: temp }; delete env.ELECTRON_RUN_AS_NODE;
    const packaged = process.argv.includes('--packaged');
    app = await electron.launch({ executablePath: packaged ? process.env.MOYE_PACKAGED_EXE || path.join(root, require('../package.json').build.directories.output, 'win-unpacked/成简.exe') : require('electron'), args: packaged ? [] : [root], env });
    const page = await app.firstWindow(); page.setDefaultTimeout(10000);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
    await page.waitForSelector('.tiptap');
    const content = await page.locator('.tiptap').innerHTML();

    await page.locator('#colorsBtn').click();
    await page.locator('[data-scheme="dark"]').click();assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('dark')),true);
    await page.locator('[data-scheme="warm"]').click();
    await page.locator('#newScheme').click();await page.locator('#schemeName').fill('我的暖色');
    for (const [key,value] of Object.entries({accent:'#a45732',background:'#eee6d8',paper:'#fff9ee',text:'#48382e'})) await page.locator('#hex-'+key).fill(value);
    await page.locator('#hex-accent').fill('oops');assert.equal(await page.locator('body').evaluate(e=>e.style.getPropertyValue('--accent')),'#a45732');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#schemesDialog').evaluate(e=>e.open),true);
    await page.locator('[data-scheme="light"]').click();assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('custom-colors')),false);
    await page.getByRole('button',{name:'我的暖色',exact:true}).click();
    await page.screenshot({path:path.join(root,'test-results/color-schemes.png')});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.tiptap').innerHTML(),content);assert.equal(await page.locator('#saveState').textContent(),'新文档');
    await page.locator('#zoomPlus').click();await page.reload();await page.waitForSelector('.tiptap');
    assert.equal(await page.locator('body').evaluate(e=>e.style.getPropertyValue('--accent')),'#a45732');assert.equal(await page.locator('#zoomValue').textContent(),'110%');
    await page.locator('#colorsBtn').click();await page.locator('#newScheme').click();await page.locator('#schemeName').fill('第二套');await page.locator('#hex-accent').fill('#ab8bff');
    await page.reload();await page.waitForSelector('.tiptap');assert.equal(await page.locator('body').evaluate(e=>e.style.getPropertyValue('--accent')),'#ab8bff');
    await page.locator('#colorsBtn').click();await page.getByRole('button',{name:'我的暖色',exact:true}).click();assert.equal(await page.locator('body').evaluate(e=>e.style.getPropertyValue('--accent')),'#a45732');
    await page.evaluate(()=>{localStorage.removeItem('moye.color.schemes');localStorage.setItem('moye.custom.colors',JSON.stringify({light:{accent:'#bb5522',background:'#eeeeee',paper:'#ffffff',text:'#222222'}}));});
    await page.reload();await page.waitForSelector('.tiptap');assert.equal(await page.locator('body').evaluate(e=>e.style.getPropertyValue('--accent')),'#bb5522');
    console.log('PASS: preset selection, multiple named schemes, automatic save without confirmation, reload, invalid color protection, old profile migration, document unchanged.');
  } finally { if (app) { await app.evaluate(({ app }) => { setTimeout(() => app.exit(0), 50); }).catch(() => {}); await app.close().catch(() => {}); } await fs.rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); }
})().catch(e => { console.error(e); process.exitCode = 1; });

