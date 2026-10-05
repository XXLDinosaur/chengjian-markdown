import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareMarkdown, resizeImage } from '../src/core.mjs';
import files from '../src/files.cjs';
test('image positions distinguish code, duplicates, nested lists and references', () => {
  const source = '```md\n![same](a.png)\n```\n\n![same](a.png)\n\n> - ![same](a.png)\n\n![reference][r]\n\n[r]: <a b.png> "title"\n';
  const { images } = prepareMarkdown(source);
  assert.equal(images.length, 3);
  assert.equal(images[2].src, 'a b.png');
  const changed = resizeImage(source, images[1], 350);
  assert.ok(changed.includes('> - <img src="a.png" alt="same" width="350">'));
  assert.ok(changed.startsWith('```md\n![same](a.png)\n```\n\n![same](a.png)'));
  assert.equal(prepareMarkdown(changed).images[1].width, 350);
});
test('HTML image sizes round trip and attributes stay escaped', () => {
  const source = '<img src="图 &amp; 文.png" alt="a &quot;b&quot;" width="200">';
  const image = prepareMarkdown(source).images[0];
  assert.equal(image.src, '图 & 文.png');
  const next = resizeImage(source, image, 700);
  assert.ok(next.includes('width="700"'));
  assert.equal(prepareMarkdown(next).images[0].alt, 'a "b"');
  assert.throws(() => resizeImage('changed', image, 300));
  assert.ok(!resizeImage(source, image, null).includes('width='));
});
test('atomic save preserves CRLF and UTF-16 BOM, including reopen', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'moye-files-'));
  try {
    const file = path.join(temp, '中文.md');
    await fs.writeFile(file, Buffer.from('\ufeff# 标题\r\n正文\r\n', 'utf16le'));
    const original = await files.readDocument(file);
    assert.equal(original.encoding, 'utf16le'); assert.equal(original.eol, '\r\n');
    const digest = await files.atomicSave(file, '# 修改\n正文\n', original);
    const reopened = await files.readDocument(file);
    assert.equal(reopened.text, '# 修改\n正文\n'); assert.equal(digest, reopened.hash);
    assert.deepEqual(await fs.readdir(temp), ['中文.md']);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
import { collectResources } from '../src/resources.cjs';
import { relocateImages } from '../src/core.mjs';
import { pathToFileURL } from 'node:url';

test('saving collects external images once and leaves remote/code examples untouched', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'chengjian-resources-'));
  try {
    const file = path.join(temp,'external #100%.svg');
    await fs.writeFile(file,'<svg/>');
    const src=pathToFileURL(file).href;
    const text=`<img src="${src}" width="300">\n\n<img src="${src}" width="450">\n\n![remote](https://example.com/a.png)\n\n\`![code](missing.png)\``;
    let copies=0;
    const result=await collectResources({text,sourceDocument:path.join(temp,'old.md'),targetDocument:path.join(temp,'new','copy.md'),stagedImages:new Map(),prepareMarkdown,relocateImages,writeImage:async(bytes)=>{copies++;assert.equal(bytes.toString(),'<svg/>');return {src:'copy.assets/image.svg'};}});
    assert.equal(copies,1);
    assert.match(result,/width="300"/);assert.match(result,/width="450"/);
    assert.equal(prepareMarkdown(result).images.filter(i=>i.src==='copy.assets/image.svg').length,2);
    assert.match(result,/https:\/\/example.com\/a.png/);assert.match(result,/`!\[code\]\(missing.png\)`/);
    await assert.rejects(collectResources({text:'![missing](missing.png)',sourceDocument:path.join(temp,'old.md'),targetDocument:path.join(temp,'new','copy.md'),stagedImages:new Map(),prepareMarkdown,relocateImages,writeImage:async()=>{throw Error('should not write');}}),/文档未保存/);
  } finally { await fs.rm(temp,{recursive:true,force:true}); }
});
