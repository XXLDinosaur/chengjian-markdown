import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
function mediaBlock(node){return node.type.name==='table'||(node.isTextblock&&!node.textContent.trim()&&Array.from(node.content.content).some(n=>n.type.name==='image'));}
// Media-only list items belong to the preceding item. Replace only changed lists,
// preserving transaction mapping, history and the rest of the document.
export const ListMedia=Extension.create({name:'listMedia',addProseMirrorPlugins(){return [new Plugin({appendTransaction(transactions,old,state){if(!transactions.some(t=>t.docChanged))return;const edits=[];state.doc.descendants((node,pos)=>{if(!['orderedList','bulletList'].includes(node.type.name))return;const items=[];let changed=false;node.forEach(item=>{const parts=Array.from(item.content.content);if(items.length&&parts.every(n=>mediaBlock(n)||(n.isTextblock&&!n.content.size))&&parts.some(mediaBlock)){const prev=items.pop();items.push(prev.copy(prev.content.append(item.content)));changed=true;}else items.push(item);});if(changed){edits.push({pos,node,next:node.type.create(node.attrs,items)});return false;}});if(!edits.length)return;const tr=state.tr;for(const e of edits.reverse())tr.replaceWith(e.pos,e.pos+e.node.nodeSize,e.next);return tr;}})];}});
export function applyList(editor, type, numbering='decimal', toggle=false) {
 const selection=editor.state.selection,top=[];
 editor.state.doc.forEach((node,pos)=>{if(pos<selection.to&&pos+node.nodeSize>selection.from)top.push({node,pos});});
 if(top.some(x=>mediaBlock(x.node))&&top.every(x=>x.node.isTextblock||mediaBlock(x.node))){
  const result=[],items=[];for(const {node} of top){if(mediaBlock(node)){if(items.length){const last=items.pop();items.push(last.copy(last.content.append(editor.schema.nodes.doc.create(null,[node]).content)));}else result.push(node);}else items.push(editor.schema.nodes.listItem.create(null,[node]));}
  if(items.length)result.push(editor.schema.nodes[type].create(type==='orderedList'?{numbering}:null,items));
  editor.view.dispatch(editor.state.tr.replaceWith(top[0].pos,top.at(-1).pos+top.at(-1).node.nodeSize,result));editor.view.focus();return;
 }
 const headings=[];editor.state.doc.nodesBetween(editor.state.selection.from,editor.state.selection.to,(node,pos)=>{if(node.type.name==='heading')headings.push({pos:pos+1,attrs:{...node.attrs}});});
 const chain=editor.chain().focus();
 let selectedList=editor.isActive(type);const blocks=[];
 editor.state.doc.nodesBetween(editor.state.selection.from,editor.state.selection.to,(node,pos)=>{if(node.type.name===type)selectedList=true;if(node.isTextblock && node.content.size)blocks.push({from:pos+1,to:pos+1+node.content.size});});
 if(editor.state.selection.$from.depth===0 && blocks.length)chain.setTextSelection({from:blocks[0].from,to:blocks[blocks.length-1].to});
 const removing=toggle && selectedList;
 if(removing)chain.liftListItem('listItem');
 else if(!selectedList)chain[type==='orderedList'?'toggleOrderedList':'toggleBulletList']();
 if(type==='orderedList' && !removing)chain.updateAttributes(type,{numbering});
 chain.command(({tr})=>{for(const item of headings){const mapped=tr.mapping.map(item.pos),resolved=tr.doc.resolve(Math.min(mapped,tr.doc.content.size));for(let d=resolved.depth;d>0;d--){if(resolved.node(d).isTextblock){tr.setNodeMarkup(resolved.before(d),editor.schema.nodes.heading,item.attrs);break;}}}return true;});
 chain.run();
}
export function captureFormat(editor){
 const {from,to}=editor.state.selection;let $from=editor.state.selection.$from;
 if(!$from.parent.isTextblock){let first=null;editor.state.doc.nodesBetween(from,to,(node,pos)=>{if(first===null&&node.isTextblock)first=pos+1;});if(first!==null)$from=editor.state.doc.resolve(first);}
 let marks=$from.marks();
 if(from!==to){let found=false;editor.state.doc.nodesBetween(from,to,node=>{if(node.isText&&!found){marks=node.marks;found=true;}});}
 let block='paragraph',attrs={},list=null,listAttrs={};
 for(let depth=$from.depth;depth>0;depth--){const node=$from.node(depth);if(node.isTextblock){block=node.type.name;attrs={...node.attrs};}if(['orderedList','bulletList','taskList'].includes(node.type.name)){list=node.type.name;listAttrs={...node.attrs};break;}}
 return {from,to,marks:marks.map(m=>({type:m.type.name,attrs:m.attrs})),block,attrs,list,listAttrs};
}
export function paintFormat(editor,format){
 let chain=editor.chain().focus();
 const selection=editor.state.selection;
 // A click paints the whole destination paragraph, including character marks.
 if(selection.empty && selection.$from.parent.isTextblock)chain.setTextSelection({from:selection.$from.start(),to:selection.$from.end()});
 // Lift only the destination list, preserving the selected text and nested content.
 const existing=['orderedList','bulletList','taskList'].find(type=>editor.isActive(type));
 if(existing && existing!==format.list)chain.liftListItem(existing==='taskList'?'taskItem':'listItem');
 if(format.list && existing!==format.list)chain[format.list==='orderedList'?'toggleOrderedList':format.list==='bulletList'?'toggleBulletList':'toggleTaskList']();
 if(format.list)chain.updateAttributes(format.list,format.listAttrs);
 // Set the textblock directly on the current transaction. Tiptap setParagraph()
 // falls back to clearNodes() when the target is already a paragraph; that can
 // unwrap a freshly created list or throw on the heading-capable list schema.
 chain.command(({tr})=>{const type=editor.schema.nodes[format.block];if(!type?.isTextblock)return false;tr.setBlockType(tr.selection.from,tr.selection.to,type,format.attrs);return true;});
 // Links belong to the destination content, rather than the copied appearance.
 for(const name of Object.keys(editor.schema.marks))if(name!=='link')chain.unsetMark(name);
 for(const mark of format.marks)if(mark.type!=='link')chain.setMark(mark.type,mark.attrs);
 return chain.run();
}
