import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { marked } from 'marked';

const parser = unified().use(remarkParse).use(remarkGfm);
export const escapeAttr = value => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function prepareMarkdown(source) {
  const tree = parser.parse(source);
  const definitions = new Map();
  visit(tree, 'definition', node => definitions.set(node.identifier.toLowerCase(), node));
  const images = [];
  visit(tree, node => {
    if (node.type === 'image' || node.type === 'imageReference') {
      const definition = node.type === 'imageReference' ? definitions.get(node.identifier.toLowerCase()) : node;
      if (!definition) return;
      images.push({ start: node.position.start.offset, end: node.position.end.offset, src: definition.url, alt: node.alt || '', title: definition.title || '' });
    }
    if (node.type === 'html') {
      for (const match of node.value.matchAll(/<img\b[^>]*>/gi)) {
        const attrs = {};
        for (const attr of match[0].matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4];
        const decode = s => (s || '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        if (attrs.src) images.push({ start: node.position.start.offset + match.index, end: node.position.start.offset + match.index + match[0].length, src: decode(attrs.src), alt: decode(attrs.alt), title: decode(attrs.title), wordStyle:decode(attrs['data-word-style']), width: /^\d+$/.test(attrs.width) ? Number(attrs.width) : undefined });
      }
    }
  });
  images.sort((a, b) => a.start - b.start);
  let prepared = source;
  for (let i = images.length - 1; i >= 0; i--) {
    const item = images[i];
    item.raw = source.slice(item.start, item.end);
    const html = `<img data-image-id="${i}" src="${escapeAttr(item.src)}" alt="${escapeAttr(item.alt)}"${item.wordStyle ? ` data-word-style="${escapeAttr(item.wordStyle)}"` : ''}${item.title ? ` title="${escapeAttr(item.title)}"` : ''}${item.width ? ` width="${item.width}"` : ''}>`;
    prepared = prepared.slice(0, item.start) + html + prepared.slice(item.end);
  }
  return { html: marked.parse(prepared, { gfm: true, breaks: false }), images };
}
export function resizeImage(source, image, width) {
  if (source.slice(image.start, image.end) !== image.raw) throw new Error('内容已变化，请重新选择图片。');
  const size = width == null ? '' : ` width="${Math.max(24, Math.min(8192, Math.round(width)))}"`;
  const html = `<img src="${escapeAttr(image.src)}" alt="${escapeAttr(image.alt)}"${image.wordStyle ? ` data-word-style="${escapeAttr(image.wordStyle)}"` : String()}${image.title ? ` title="${escapeAttr(image.title)}"` : ''}${size}>`;
  return source.slice(0, image.start) + html + source.slice(image.end);
}
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function relocateImages(source, relocate) {
  const { images } = prepareMarkdown(source);
  let result = source;
  for (const image of [...images].reverse()) {
    const next = relocate(image.src);
    if (next === image.src) continue;
    const tag = `<img src="${escapeAttr(next)}" alt="${escapeAttr(image.alt)}"${image.wordStyle ? ` data-word-style="${escapeAttr(image.wordStyle)}"` : String()}${image.title ? ` title="${escapeAttr(image.title)}"` : ''}${image.width ? ` width="${image.width}"` : ''}>`;
    result = result.slice(0, image.start) + tag + result.slice(image.end);
  }
  return result;
}
