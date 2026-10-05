const fs = require('node:fs/promises');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const encodePath = value => value.split(path.sep).join('/').replace(/[%#? ]/g, encodeURIComponent);
function localImagePath(src, documentPath) {
  if (/^file:/i.test(src)) return fileURLToPath(src);
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) && !/^[a-z]:[\\/]/i.test(src)) return null;
  if (src.startsWith('#') || src.startsWith('//')) return null;
  let decoded = src;
  try { decoded = decodeURIComponent(src); } catch {}
  if (!path.isAbsolute(decoded) && !documentPath) return null;
  return path.resolve(documentPath ? path.dirname(documentPath) : '', decoded);
}

// Called only on save: missing local resources fail visibly instead of silently
// producing a supposedly portable document with broken images.
async function collectResources({ text, sourceDocument, targetDocument, stagedImages, prepareMarkdown, relocateImages, writeImage }) {
  const relocated = new Map(), copied = new Map();
  const targetFolder = path.dirname(targetDocument);
  const savingAs = sourceDocument && path.resolve(sourceDocument) !== path.resolve(targetDocument);
  for (const image of prepareMarkdown(text).images) {
    if (relocated.has(image.src)) continue;
    const staged = stagedImages.get(image.src);
    const file = staged?.path || localImagePath(image.src, sourceDocument);
    if (!file) continue; // Remote and embedded images remain unchanged.
    const relative = path.relative(targetFolder, file);
    const withinFolder = relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
    if (!staged && !savingAs && withinFolder) {
      await fs.access(file);
      relocated.set(image.src, encodePath(relative));
      continue;
    }
    if (!copied.has(file)) {
      try {
        const result = await writeImage(await fs.readFile(file), staged?.name || path.basename(file), targetDocument);
        copied.set(file, result.src);
      } catch (error) {
        throw new Error(`无法收集图片“${path.basename(file)}”，文档未保存：${error.message}`);
      }
    }
    relocated.set(image.src, copied.get(file));
  }
  return relocateImages(text, src => relocated.get(src) || src);
}
module.exports = { collectResources, localImagePath, encodePath };
