const {_electron:electron}=require('playwright'),fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict');
(async()=>{const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'chengjian-brush-'));let app;
try{const env={...process.env,MOYE_TEST_PROFILE:temp};delete env.ELECTRON_RUN_AS_NODE;const packaged=process.argv.includes('--packaged');app=await electron.launch({executablePath:packaged?path.join(root,require('../package.json').build.directories.output,'win-unpacked/成简.exe'):require('electron'),args:packaged?[]:[root],env});const page=await app.firstWindow();const errors=[];page.on("pageerror",e=>errors.push(e.message));page.setDefaultTimeout(10000);await app.evaluate(({BrowserWindow,dialog})=>{BrowserWindow.getAllWindows()[0].showInactive();dialog.showMessageBox=async()=>({response:1});});await page.waitForSelector('.tiptap');await page.locator('#autoSave').uncheck();const doc=page.locator('.tiptap');const failures=[];
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
for(const kind of ['decimal','chinese','chinese-paren','paren','circle','alpha','bullet'])for(const selected of [false,true]){
 const tag=kind==='bullet'?'ul':'ol',file=path.join(temp,'brush.md');await fs.writeFile(file,`<${tag} data-numbering="${kind}"><li><p><strong>源格式</strong></p></li></${tag}>\n\n目标正文\n\n第二目标\n`);
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);await page.locator('#openBtn').click();await page.waitForFunction(()=>document.querySelector('.tiptap').textContent.includes('第二目标'));await settle();
 await doc.locator('p').filter({hasText:'源格式'}).click({position:{x:8,y:10}});if(selected){await page.keyboard.press('Home');await page.keyboard.press('Shift+End');}await page.locator('#brushBtn').click();await doc.locator('p').filter({hasText:'目标正文'}).click({position:{x:8,y:10}});await settle();
 const target=doc.locator('p').filter({hasText:'目标正文'});const result=await target.evaluate(el=>({list:el.parentElement.parentElement.tagName,kind:el.closest('ol')?.dataset.numbering,bold:!!el.querySelector('strong')}));
 if(result.list!==tag.toUpperCase() || (kind!=='bullet'&&result.kind!==kind) || !result.bold)failures.push({kind,selected,result,html:await doc.innerHTML()});
 assert.equal(await page.locator('#brushBtn').getAttribute('aria-pressed'),'false');
 await page.keyboard.press('Control+z');await settle();assert.equal(await target.evaluate(el=>el.parentElement.tagName),'DIV','Undo should restore the plain paragraph');
}

for(const sourceKind of ['plain','bullet','ordered','heading'])for(const targetKind of ['plain','bullet','ordered','heading']){
 const wrap=(kind,content)=>kind==='plain'?'<p>'+content+'</p>':kind==='heading'?'<h2>'+content+'</h2>':kind==='bullet'?'<ul><li><p>'+content+'</p></li></ul>':'<ol data-numbering="alpha"><li><p>'+content+'</p></li></ol>';
 const file=path.join(temp,'matrix.md');await fs.writeFile(file,wrap(sourceKind,'<strong>源格式</strong>')+'\n\n间隔段落\n\n'+wrap(targetKind,'<a href="https://example.com">目标正文</a>'));
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);await page.locator('#openBtn').click();await settle();await doc.locator('p,h2').filter({hasText:'源格式'}).click({position:{x:8,y:10}});await page.locator('#brushBtn').click();await doc.locator('p,h2').filter({hasText:'目标正文'}).click({position:{x:8,y:10}});await settle();
 const result=await doc.locator('p,h2').filter({hasText:'目标正文'}).evaluate(el=>({tag:el.tagName,list:el.closest('ul,ol')?.tagName || null,bold:!!el.querySelector('strong'),link:el.querySelector('a')?.getAttribute('href')}));
 assert.deepEqual(result,{tag:sourceKind==='heading'?'H2':'P',list:sourceKind==='bullet'?'UL':sourceKind==='ordered'?'OL':null,bold:true,link:'https://example.com'},sourceKind+' -> '+targetKind);
}
assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);console.log('PASS: six numbering styles and bullet painter to plain text, cursor/selection capture, character marks, single-use exit, one-step undo, all paragraph/list/heading conversions and destination links.');
}finally{if(app){await app.evaluate(({app})=>setTimeout(()=>app.exit(0),30)).catch(()=>{});await app.close().catch(()=>{});}await fs.rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:250});}})().catch(e=>{console.error(e);process.exitCode=1;});
