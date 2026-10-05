const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
async function readDocument(file) {
  const bytes = await fs.readFile(file);
  if (bytes.length > 20 * 1024 * 1024) throw new Error('文件超过 20 MB，暂不支持打开。');
  let encoding = 'utf8';
  let bom = false;
  let text;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) { encoding = 'utf16le'; bom = true; text = bytes.subarray(2).toString('utf16le'); }
  else {
    bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('该文件不是 UTF-8 或 UTF-16 LE 编码，请先转换为 UTF-8。'); }
  }
  return { path: file, text: text.replace(/\r\n/g, '\n'), hash: hash(bytes), encoding, bom, eol: text.includes('\r\n') ? '\r\n' : '\n' };
}
async function atomicSave(file, text, format = {}) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n/g, format.eol || '\n');
  const encoding = format.encoding || 'utf8';
  const payload = Buffer.from((format.bom ? '\ufeff' : '') + normalized, encoding);
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${crypto.randomUUID()}.tmp`);
  try { await fs.writeFile(temporary, payload, { flag: 'wx' }); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  return hash(payload);
}
module.exports = { readDocument, atomicSave, hash };
