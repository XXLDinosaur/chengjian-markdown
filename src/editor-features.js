import { Extension, Node } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import katex from 'katex';

export const Numbering = Extension.create({
  name:'numbering',
  addGlobalAttributes() { return [{ types:['orderedList'], attributes:{ numbering:{ default:'decimal', parseHTML:el=>el.getAttribute('data-numbering') || 'decimal', renderHTML:attrs=>({'data-numbering':attrs.numbering}) } } }]; }
});
export const TextHighlight = Highlight.configure({ multicolor:true });
export const formulaHTML = latex => katex.renderToString(latex, { output:'mathml', throwOnError:true, trust:false, maxExpand:1000, maxSize:30 });
export const Formula = Node.create({
  name:'formula', group:'inline', inline:true, atom:true, selectable:true,
  addAttributes() { return { latex:{default:'',parseHTML:el=>el.getAttribute('data-latex')} }; },
  parseHTML() { return [{tag:'span[data-formula]'}]; },
  renderHTML({HTMLAttributes}) { const span=document.createElement('span');span.dataset.formula='true';span.dataset.latex=HTMLAttributes.latex || '';span.className='formula';try { span.innerHTML=formulaHTML(span.dataset.latex); } catch { span.textContent=span.dataset.latex; }return span; },
  addNodeView() { return ({node,getPos,editor}) => {const dom=document.createElement('span');dom.className='formula';dom.contentEditable='false';dom.title='旧版公式';try{dom.innerHTML=formulaHTML(node.attrs.latex);}catch{dom.textContent=node.attrs.latex;}return {dom};}; }
});
