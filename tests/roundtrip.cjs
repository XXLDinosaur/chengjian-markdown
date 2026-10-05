const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
(async () => {
 const root = path.resolve(__dirname, '..');
 const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'chengjian-roundtrip-'));
 let app;
 try {
  const original = path.join(temp, 'original'); const copy = path.join(temp, 'copy');
  await fs.mkdir(original); await fs.mkdir(copy);
  await fs.copyFile(path.join(root, 'assets/mountains.svg'), path.join(original, '图 100%.svg'));
  const file = path.join(original, '原稿.md');
  await fs.writeFile(file, '# 保真测试\n\n<p></p>\n\n<p></p>\n\n正文\n\n<img src="图%20100%25.svg" width="300" alt="山">\n\n<table><tbody><tr><th colspan="2" colwidth="150,200"><p>合并标题</p></th></tr><tr><td rowspan="2" colwidth="150"><p>跨行</p></td><td colwidth="200"><p>第一段</p><p>第二段</p></td></tr><tr><td colwidth="200"><p><strong>加粗</strong></p></td></tr></tbody></table>\n\n结尾\n');
  const env = {...process.env, MOYE_TEST_PROFILE:path.join(temp,'profile')}; delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({executablePath:require('electron'),args:[root,file],env});
  const page = await app.firstWindow(); page.setDefaultTimeout(12000);
  await page.waitForSelector('.tiptap h1'); await page.locator('#fileMenuBtn').click(); await page.locator('#autoSave').uncheck(); await page.locator('#fileMenuBtn').click();
  const shape = () => page.locator('.tiptap').evaluate(el => ({
   empty:[...el.children].filter(p => p.tagName==='P'&&!p.textContent&&!p.querySelector('img')).length,
   cells:[...el.querySelectorAll('th,td')].map(c=>({tag:c.tagName,colspan:c.getAttribute('colspan'),rowspan:c.getAttribute('rowspan'),width:c.getAttribute('colwidth'),text:c.textContent})),
   width:el.querySelector('.rich-image img').style.width
  }));
  const before = await shape(); assert.equal(before.empty,2);
  await page.locator('.tiptap').press('Control+End'); await page.keyboard.insertText('修改');
  await page.locator('#fileMenuBtn').click(); await page.locator('#saveBtn').click(); await page.waitForFunction(()=>document.querySelector('#saveState').textContent==='已保存');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
  await page.locator('#fileMenuBtn').click(); await page.locator('#openBtn').click(); await page.waitForFunction(()=>document.querySelector('.tiptap').textContent.includes('结尾修改'));
  assert.deepEqual(await shape(),before,'Editing then reopening must preserve empty paragraphs, merged cells and image width');
  const target=path.join(copy,'便携.md');
  await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},target);
  await page.locator('#fileMenuBtn').click(); await page.locator('#saveAsBtn').click(); await page.waitForFunction(()=>document.querySelector('#fileName').textContent==='便携.md');
  const saved=await fs.readFile(target,'utf8');
  assert.ok(!saved.includes('../')&&!saved.includes('file:'),saved);
  assert.match(saved,/便携.assets\//);
  await fs.rename(original,path.join(temp,'original-unavailable'));
  const moved=path.join(temp,'moved');await fs.rename(copy,moved);
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},path.join(moved,'便携.md'));
  await page.locator('#fileMenuBtn').click(); await page.locator('#openBtn').click();
  await page.waitForFunction(()=>document.querySelector('.tiptap .rich-image img')?.naturalWidth===1200);
  assert.deepEqual(await shape(),before);
  console.log('PASS: empty paragraphs, merged tables, column widths, image size, save-as copies resources, moving folder keeps images readable');
 } finally {
  if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
  await fs.rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:250});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
