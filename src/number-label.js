const digits='零一二三四五六七八九';
function chinese(n){
 if(n<0 || n>9999)return String(n);if(n<10)return digits[n];
 let out='',zero=false;for(const [unit,label] of [[1000,'千'],[100,'百'],[10,'十'],[1,'']]){const d=Math.floor(n/unit)%10;if(d){if(zero)out+='零';out+=d===1&&unit===10&&!out?'十':digits[d]+label;zero=false;}else if(out&&n%unit)zero=true;}return out;
}
export function numberLabel(n,kind='decimal'){
 if(kind==='chinese')return chinese(n)+'、';
 if(kind==='chinese-paren')return '（'+chinese(n)+'）';
 if(kind==='paren')return '（'+n+'）';
 if(kind==='circle'&&n>=1&&n<=20)return String.fromCodePoint(0x2460+n-1);
 if(kind==='alpha'&&n>0){let s='';for(;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(97+(n-1)%26)+s;return s+'.';}
 return n+'.';
}
export function headingLabel(heading){
 const item=heading.parentElement,list=item?.parentElement;
 let prefix='';if(item?.tagName==='LI' && list?.tagName==='OL' && item.firstElementChild===heading){const items=[...list.children].filter(el=>el.tagName==='LI');prefix=numberLabel((Number(list.getAttribute('start'))||1)+items.indexOf(item),list.dataset.numbering)+' ';}
 return prefix+(heading.textContent.trim()||'未命名标题');
}
