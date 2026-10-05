import { applyList, captureFormat, paintFormat } from './block-format.js';
export function installWorkbench({getEditor,isBusy,toast,locked,rename}) {
 const $=id=>document.getElementById(id);
 const act=fn=>{if(!isBusy() && getEditor())fn(getEditor());};

 const closeMenus=()=>{for(const name of ['highlight','number']){$(name+'Menu').hidden=true;$(name+'MenuBtn').setAttribute('aria-expanded','false');}};
 const openMenu=name=>{const button=$(name+'MenuBtn'),menu=$(name+'Menu'),wasOpen=!menu.hidden;closeMenus();if(wasOpen)return;menu.hidden=false;button.setAttribute('aria-expanded','true');const box=button.parentElement.getBoundingClientRect();menu.style.left=Math.min(box.left,innerWidth-menu.offsetWidth-10)+'px';menu.style.top=box.bottom+6+'px';};
 for(const name of ['highlight','number']){$(name+'MenuBtn').onmousedown=e=>e.preventDefault();$(name+'MenuBtn').onclick=()=>openMenu(name);}
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.tool-popover,.split-tool'))closeMenus();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});window.addEventListener('resize',closeMenus);
 const colors={'黄色':'#fff176','橙色':'#ffb74d','红色':'#ef9a9a','粉色':'#f48fb1','紫色':'#ce93d8','蓝色':'#90caf9','青色':'#80deea','绿色':'#a5d6a7','灰色':'#cfd8dc'};
 for(const [name,color] of Object.entries(colors)){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',name);b.style.background=color;b.dataset.color=color;b.onmousedown=e=>e.preventDefault();b.onclick=()=>act(e=>{e.chain().focus().setHighlight({color}).run();closeMenus();});$('highlightPalette').append(b);}
 $('highlightBtn').onmousedown=e=>e.preventDefault();$('highlightBtn').onclick=()=>act(e=>e.chain().focus().setHighlight({color:'#fff176'}).run());
 $('clearHighlight').onmousedown=e=>e.preventDefault();$('clearHighlight').onclick=()=>act(e=>{e.chain().focus().unsetHighlight().run();closeMenus();});
 for(const [value,label] of Object.entries({decimal:'1. 2. 3.',chinese:'一、二、三、','chinese-paren':'（一）（二）（三）',paren:'（1）（2）（3）',circle:'① ② ③',alpha:'a. b. c.'})){const b=document.createElement('button');b.type='button';b.dataset.numbering=value;b.textContent=label;b.onmousedown=e=>e.preventDefault();b.onclick=()=>act(e=>{applyList(e,'orderedList',value);closeMenus();});$('numberMenu').append(b);}
 let brush=null,continuous=false,pointerStart=null;
 const syncSelection=e=>{const s=window.getSelection();if(!s?.anchorNode || !e.view.dom.contains(s.anchorNode) || !e.view.dom.contains(s.focusNode))return;try{const a=e.view.posAtDOM(s.anchorNode,s.anchorOffset),b=e.view.posAtDOM(s.focusNode,s.focusOffset);e.commands.setTextSelection({from:Math.min(a,b),to:Math.max(a,b)});}catch{}};
 const showBrush=()=>{$('brushBtn').classList.toggle('active',!!brush);$('brushBtn').classList.toggle('continuous',continuous);$('brushBtn').setAttribute('aria-pressed',String(!!brush));document.body.classList.toggle('format-brushing',!!brush);};
 const clearBrush=()=>{brush=null;continuous=false;showBrush();};
 $('brushBtn').onmousedown=e=>e.preventDefault();
 $('brushBtn').onclick=event=>act(e=>{if(event.detail===2)return;if(brush){clearBrush();return;}syncSelection(e);brush=captureFormat(e);continuous=false;showBrush();toast('单次格式刷：点击目标段落；双击格式刷可连续使用');});
 $('brushBtn').ondblclick=()=>act(e=>{if(!brush){syncSelection(e);brush=captureFormat(e);}continuous=true;showBrush();toast('连续格式刷：点击目标段落；再次点击格式刷或 Esc 退出');});
 $('editor').addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};});
 $('editor').addEventListener('pointerup',event=>{if(!event.target.closest('.tiptap') || !brush || isBusy())return;const e=getEditor(),start=pointerStart;const clicked=!start || Math.hypot(event.clientX-start.x,event.clientY-start.y)<5;const position=e.view.posAtCoords({left:event.clientX,top:event.clientY})?.pos;setTimeout(()=>{if(!brush || isBusy())return;if(clicked && position!=null)e.commands.setTextSelection(position);else syncSelection(e);const captured=brush;try{if(paintFormat(e,captured)){if(!continuous)clearBrush();}else toast("该位置无法应用格式，请选择正文段落");}catch(error){toast("格式应用失败："+error.message);}},0);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')clearBrush();});
 let nameInput;
 function editName(){if(isBusy() || nameInput)return;const label=$('fileName'),previous=label.textContent;nameInput=document.createElement('input');nameInput.id='inlineFileName';nameInput.value=previous;nameInput.setAttribute('aria-label','文件名');label.hidden=true;label.after(nameInput);nameInput.focus();nameInput.setSelectionRange(0,previous.replace(/\.md$/i,'').length);let committing=false;
 const finish=()=>{nameInput?.remove();nameInput=null;label.hidden=false;};
 const commit=()=>{if(committing || !nameInput)return;committing=true;const value=nameInput.value.trim();if(value===previous){finish();return;}locked(async()=>{try{if(await rename(value))finish();else committing=false;}catch(e){toast(e.message);committing=false;nameInput?.focus();}});};
 nameInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();commit();}else if(e.key==='Escape'){e.preventDefault();finish();}};nameInput.onblur=commit;
 }
 $('fileName').ondblclick=editName;$('fileName').onkeydown=e=>{if(e.key==='Enter')editName();};
 $('floatBtn').onclick=async()=>{try{const enabled=await window.desktop.floatWindow(!document.body.classList.contains('floating'));if(enabled?.error)throw new Error(enabled.error);document.body.classList.toggle('floating',enabled);$('floatBtn').textContent=enabled?'↗ 恢复窗口':'▣ 浮窗';$('floatBtn').setAttribute('aria-pressed',String(enabled));}catch(e){toast(e.message);}};
 $('restoreWindowBtn').onclick=()=>$('floatBtn').click();
 $('printBtn').onclick=async()=>{const result=await window.desktop.printDocument();if(result.error)toast(result.error);else if(!result.success && result.reason && !/cancel/i.test(result.reason))toast(result.reason);};
 let hits=[],index=-1,searchFrame;
 function showSearch(replace){if($('documentOutline').hidden)$('outlineBtn').click();$('outlineList').hidden=true;$('outlineEmpty').hidden=true;$('searchPanel').hidden=false;$('replacePanel').hidden=!replace;$('tocTab').classList.remove('active');$('searchTab').classList.toggle('active',!replace);$('replaceTab').classList.toggle('active',replace);$('findText').focus();scan();}
 $('findBtn').onclick=()=>showSearch(false);$('replaceBtn').onclick=()=>showSearch(true);$('searchTab').onclick=()=>showSearch(false);$('replaceTab').onclick=()=>showSearch(true);
 $('tocTab').onclick=()=>{$('searchPanel').hidden=true;$('outlineList').hidden=false;$('outlineEmpty').hidden=!!$('outlineList').children.length;$('tocTab').classList.add('active');$('searchTab').classList.remove('active');$('replaceTab').classList.remove('active');CSS.highlights?.delete('search-results');};
 function paintSearch(){if(!CSS.highlights)return;const e=getEditor(),ranges=[];for(const h of hits.slice(0,2000)){try{const a=e.view.domAtPos(h.from),b=e.view.domAtPos(h.to);const range=new Range();range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);ranges.push(range);}catch{}}CSS.highlights.set('search-results',new Highlight(...ranges));}
 function scan(){const e=getEditor();if(!e || $('searchPanel').hidden)return;const old=hits[index]?.from;hits=[];const query=$('findText').value;if(query){const needle=$('matchCase').checked?query:query.toLowerCase();e.state.doc.descendants((node,pos)=>{if(!node.isTextblock)return;const raw=node.textBetween(0,node.content.size,'','\ufffc'),text=$('matchCase').checked?raw:raw.toLowerCase();let start=0,found;while((found=text.indexOf(needle,start))!==-1){const word=c=>Boolean(c && /[\p{L}\p{N}_]/u.test(c));if(!$('wholeWord').checked || (!word(raw[found-1])&&!word(raw[found+query.length])))hits.push({from:pos+1+found,to:pos+1+found+query.length,label:raw.slice(Math.max(0,found-12),found+query.length+24)});start=found+Math.max(1,needle.length);}});}index=hits.findIndex(h=>h.from===old);if(index<0 && hits.length)index=0;
  $('findStatus').textContent=hits.length?`${index+1} / ${hits.length} 处`:(query?'未找到匹配文字':'输入文字开始查找');$('searchResults').replaceChildren();hits.slice(0,200).forEach((hit,i)=>{const b=document.createElement('button');b.type='button';b.className='search-result';b.textContent=hit.label;b.onclick=()=>jump(i);$('searchResults').append(b);});paintSearch();
 }
 function jump(i){if(!hits.length)return;index=(i+hits.length)%hits.length;act(e=>{e.commands.setTextSelection(hits[index]);e.commands.scrollIntoView();$('findStatus').textContent=`${index+1} / ${hits.length} 处`;});}
 for(const id of ['findText','matchCase','wholeWord'])$(id).addEventListener(id==='findText'?'input':'change',scan);
 $('findNext').onclick=()=>jump(index+1);$('findPrev').onclick=()=>jump(index-1);
 $('findText').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();jump(index+(e.shiftKey?-1:1));}};
 $('replaceOne').onclick=()=>act(e=>{if(!hits.length)return;const h=hits[index<0?0:index];const text=$('replaceText').value;const tr=e.state.tr;if(text)tr.insertText(text,h.from,h.to);else tr.delete(h.from,h.to);e.view.dispatch(tr);scan();jump(index);});
 $('replaceAll').onclick=()=>act(e=>{if(!hits.length)return;const count=hits.length,replacement=$('replaceText').value;let tr=e.state.tr;for(const hit of [...hits].reverse()){if(replacement)tr.insertText(replacement,hit.from,hit.to);else tr.delete(hit.from,hit.to);}e.view.dispatch(tr);scan();toast(`已替换 ${count} 处，可撤销`);});
 document.addEventListener('document-updated',()=>{clearTimeout(searchFrame);searchFrame=setTimeout(scan,100);});
}
