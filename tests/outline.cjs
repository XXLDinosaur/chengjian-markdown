const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async()=>{
 const root=path.resolve(__dirname,'..'), temp=await fs.mkdtemp(path.join(os.tmpdir(),'moye-outline-'));let app;
 try{
  const env={...process.env,MOYE_TEST_PROFILE:temp};delete env.ELECTRON_RUN_AS_NODE;
  const packaged=process.argv.includes('--packaged');
  app=await electron.launch({executablePath:packaged?path.join(root,require('../package.json').build.directories.output,'win-unpacked/成简.exe'):require('electron'),args:packaged?[]:[root],env});
  const page=await app.firstWindow();page.setDefaultTimeout(10000);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
  await page.waitForSelector('.outline-item');
  const file=path.join(temp,'目录.md');const paragraphs=('这是一段用于验证长文档浏览的正文。\n\n').repeat(30);
  await fs.writeFile(file,'# 全书\n\n## 同名章节\n\n'+paragraphs+'### 子章节\n\n'+paragraphs+'## 同名章节\n\n'+paragraphs+'###### 六级标题\n\n'+paragraphs+'```\n# 这不是标题\n```\n');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
  await page.locator('#openBtn').click();await page.waitForFunction(()=>document.querySelectorAll('.outline-item').length===5);
  assert.deepEqual(await page.locator('.outline-item').allTextContents(),['全书','同名章节','子章节','同名章节','六级标题']);
  const doc=page.locator('.tiptap');const before=await doc.innerHTML();
  await page.locator('.outline-item').nth(3).click();
  assert.ok(await page.locator('#documentScroll').evaluate(e=>e.scrollTop)>1000);
  let distance=await page.locator('.tiptap h2').nth(1).evaluate(e=>e.getBoundingClientRect().top-document.querySelector('#documentScroll').getBoundingClientRect().top);
  assert.ok(Math.abs(distance-24)<3);assert.equal(await doc.innerHTML(),before);assert.equal(await page.locator('#saveState').textContent(),'已保存');
  await page.locator('#zoomPlus').click();await page.locator('.outline-item').nth(2).click();
  distance=await page.locator('.tiptap h3').evaluate(e=>e.getBoundingClientRect().top-document.querySelector('#documentScroll').getBoundingClientRect().top);assert.ok(Math.abs(distance-24)<3);
  await page.waitForFunction(()=>document.querySelectorAll('.outline-item')[2].getAttribute('aria-current')==='location');
  await page.locator('#documentScroll').evaluate(e=>e.scrollTop=0);await page.waitForFunction(()=>document.querySelector('.outline-item').getAttribute('aria-current')==='location');
  await page.locator('.tiptap h1').click();await page.keyboard.press('Home');await page.keyboard.insertText('新');await page.waitForFunction(()=>document.querySelector('.outline-item').textContent==='新全书');
  await page.locator('#blockType').selectOption('0');await page.waitForFunction(()=>document.querySelectorAll('.outline-item').length===4);
  await page.locator('#closeOutline').click();assert.equal(await page.locator('#documentOutline').evaluate(e=>e.hidden),true);
  await page.reload();await page.waitForSelector('.tiptap'); await page.locator('#autoSave').uncheck();assert.equal(await page.locator('#documentOutline').evaluate(e=>e.hidden),true);
  await doc.click();await page.keyboard.press('Control+Shift+o');await page.waitForFunction(()=>!document.querySelector('#documentOutline').hidden);
  await page.screenshot({path:path.join(root,'test-results/document-outline.png')});
  await page.locator('#newBtn').click();await page.waitForFunction(()=>document.querySelectorAll('.outline-item').length===0);assert.equal(await page.locator('#outlineEmpty').isVisible(),true);
  console.log('PASS: heading hierarchy H1-H6, duplicate titles, code excluded, accurate jumps at zoom, scroll highlight, live edits/removal, navigation does not dirty document, collapse persistence, shortcut, empty document.');
 }finally{if(app){await app.evaluate(({app})=>setTimeout(()=>app.exit(0),50)).catch(()=>{});await app.close().catch(()=>{});}await fs.rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:250});}
})().catch(e=>{console.error(e);process.exitCode=1;});
