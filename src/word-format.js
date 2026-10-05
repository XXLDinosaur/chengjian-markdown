import { Extension, Mark } from '@tiptap/core';
import { ListItem } from '@tiptap/extension-list';
import DOMPurify from 'dompurify';
const allowed=['font-family','font-size','font-weight','font-style','color','background-color','text-decoration','text-align','text-indent','line-height','margin-top','margin-bottom','margin-left','margin-right','padding','padding-left','padding-right','padding-top','padding-bottom','border','border-top','border-bottom','border-left','border-right','border-collapse','width','height','vertical-align','letter-spacing'];
export function safeStyle(value){const el=document.createElement('span');el.style.cssText=value || '';return allowed.map(key=>{const v=el.style.getPropertyValue(key);return v&&!/url\s*\(|expression|javascript|var\(/i.test(v)?`${key}:${v}`:'';}).filter(Boolean).join(';');}
export const HeadingListItem=ListItem.extend({content:'(paragraph | heading) block*'});
export const WordStyles=Extension.create({name:'wordStyles',addGlobalAttributes(){return [{types:['paragraph','heading','table','tableRow','tableCell','tableHeader','listItem','image'],attributes:{wordStyle:{default:null,parseHTML:e=>safeStyle(e.getAttribute('data-word-style')),renderHTML:a=>a.wordStyle?{'data-word-style':safeStyle(a.wordStyle),style:safeStyle(a.wordStyle)}:{}}}}];}});
export const WordText=Mark.create({name:'wordText',addAttributes(){return {style:{default:'',parseHTML:e=>safeStyle(e.getAttribute('data-word-style'))}};},parseHTML(){return [{tag:'span[data-word-style]'}];},renderHTML({HTMLAttributes}){const style=safeStyle(HTMLAttributes.style);return ['span',{'data-word-style':style,style},0];}});

export function normalizeWordHTML(source){
 source=source.replace(/<!--\[if[^>]*>/gi,'').replace(/<!\[endif\]-->/gi,'').replace(/<m:oMath(?:Para)?\b[^>]*>[\s\S]*?<\/m:oMath(?:Para)?>/gi,'').replace(/<xml\b[^>]*>[\s\S]*?<\/xml>/gi,'');
 const dom=new DOMParser().parseFromString(source,'text/html');
 for(const style of dom.querySelectorAll('style')){try{const sheet=new CSSStyleSheet();sheet.replaceSync(style.textContent);for(const rule of sheet.cssRules){if(!rule.selectorText)continue;try{for(const el of dom.body.querySelectorAll(rule.selectorText))el.setAttribute('style',rule.style.cssText+';'+(el.getAttribute('style')||''));}catch{}}}catch{}}
 const inherit=['font-family','font-size','font-weight','font-style','color','letter-spacing'];
 function walk(el,inherited={}){const own={...inherited};for(const key of inherit){const value=el.style?.getPropertyValue(key);if(value)own[key]=value;else if(own[key])el.style?.setProperty(key,own[key]);}for(const child of el.children)walk(child,own);}
 walk(dom.body);
 for(const el of [...dom.body.querySelectorAll('p,h1,h2,h3,h4,h5,h6')]){
   const style=el.getAttribute('style')||'',match=style.match(/mso-list:\s*(\w+)\s+level(\d+)\s+(\w+)/i);
   const outline=style.match(/mso-outline-level:\s*([1-6])/i);
   let block=el;if(outline && el.tagName==='P'){block=dom.createElement('h'+outline[1]);for(const a of el.attributes)block.setAttribute(a.name,a.value);block.append(...el.childNodes);el.replaceWith(block);}
   if(!match)continue;
   const marker=block.querySelector('span[style*="mso-list:Ignore"],span[style*="mso-list: Ignore"]');const label=marker?.textContent.trim()||'';marker?.remove();
   const bullet=/^[·•●○▪■\uf0b7\uf0a7]/.test(label);const tag=bullet?'ul':'ol';const key=match[1]+match[3];let list=block.previousElementSibling;
   if(!list || list.tagName.toLowerCase()!==tag || list.dataset.wordList!==key){list=dom.createElement(tag);list.dataset.wordList=key;block.before(list);const start=parseInt(label);if(!bullet&&start>1)list.setAttribute('start',start);}
   if(!bullet){let kind='decimal';if(/[①-⑳]/.test(label))kind='circle';else if(/[一二三四五六七八九十]/.test(label))kind=/[（(]/.test(label)?'chinese-paren':'chinese';else if(/[（(]/.test(label))kind='paren';else if(/^[a-z][.)]/i.test(label))kind='alpha';list.dataset.numbering=kind;}
   const li=dom.createElement('li');list.append(li);li.append(block);block.style.removeProperty('text-indent');block.style.removeProperty('margin-left');
 }
 for(const el of dom.body.querySelectorAll('*')){
   const css=safeStyle(el.getAttribute('style'));if(css)el.setAttribute('data-word-style',css);
   if(el.tagName==='IMG'){el.dataset.inline='true';if(el.style.width&&!el.getAttribute('width')){const value=parseFloat(el.style.width);if(Number.isFinite(value))el.setAttribute('width',String(Math.round(value*(el.style.width.endsWith('pt')?4/3:1))));}}
   el.removeAttribute('style');el.removeAttribute('class');
 }
 return DOMPurify.sanitize(dom.body.innerHTML,{ALLOWED_URI_REGEXP:/^(?:(?:https?|file|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,FORBID_TAGS:['style','script','form','input','object','iframe','svg','math'],FORBID_ATTR:['id','name','srcset']});
}

