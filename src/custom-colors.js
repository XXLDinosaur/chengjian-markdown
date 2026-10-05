const $ = id => document.getElementById(id);
const storageKey = 'moye.custom.colors';
const fields = ['accent', 'background', 'paper', 'text', 'link'];
const defaults = { light: { accent: '#2476ed', background: '#eef2fa', paper: '#ffffff', text: '#25334b', link:'#2476ed' }, dark: { accent: '#86baff', background: '#101725', paper: '#192334', text: '#e5ecf8', link:'#86baff' } };
const valid = color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
function defaultLink(colors){return colors.background?.toLowerCase()==='#213d32'&&colors.paper?.toLowerCase()==='#eef2e4'?'#2b8325':colors.accent;}
const mode = () => document.body.classList.contains('dark') ? 'dark' : 'light';
const schemeKey = 'moye.color.schemes';
const presets = [
  {id:'bamboo',name:'老竹新绿',mode:'dark',colors:{accent:'#cceca2',background:'#213d32',paper:'#eef2e4',text:'#26392c',link:'#2b8325'},effects:{type:'gradient',end:'#90bf69',opacity:40,angle:336,glass:true,glassOpacity:85,glassBlur:28}},
  {id:'celadon',name:'天青烟雨',mode:'light',colors:{accent:'#427d87',background:'#aeced0',paper:'#f6faf8',text:'#263e43'},effects:{type:'gradient',end:'#d8e7df',angle:135,glass:true,glassOpacity:82,glassBlur:28}},
  {id:'dunhuang',name:'丝路敦煌',mode:'light',colors:{accent:'#9c4936',background:'#b99b79',paper:'#fcf0dc',text:'#49392e'},effects:{type:'gradient',end:'#537b80',angle:125,glass:true,glassOpacity:88,glassBlur:28}},
  { id:'light', name:'清透浅色', mode:'light' }, { id:'dark', name:'静谧深色', mode:'dark' },
  { id:'warm', name:'暖纸', mode:'light', colors:{accent:'#a45732',background:'#eee6d8',paper:'#fff9ee',text:'#48382e'} },
  { id:'forest', name:'青苔', mode:'light', colors:{accent:'#3b8069',background:'#e2eee7',paper:'#f5fbf5',text:'#283e35'} },
  { id:'night', name:'暮紫', mode:'dark', colors:{accent:'#b89aff',background:'#201b30',paper:'#2c263d',text:'#eee7fa'} }
];
let saved = [], selected = 'bamboo', defaultId=null;
try {
  const data = JSON.parse(localStorage.getItem(schemeKey) || 'null');
  if (data) { saved = (Array.isArray(data.schemes) ? data.schemes : []).filter(x => x && typeof x.id === 'string' && x.id.startsWith('custom-') && typeof x.name === 'string' && ['light','dark'].includes(x.mode) && x.colors && fields.filter(k=>k!=='link').every(k => valid(x.colors[k]))); defaultId=data.defaultId || null;selected = defaultId || data.selected; if(!data.bambooDefaultRevision && !selected?.startsWith('custom-')) { selected='bamboo';defaultId='bamboo'; } }
  else {
    const old = JSON.parse(localStorage.getItem(storageKey) || '{}');
    for (const m of ['light','dark']) if (old[m] && fields.filter(k=>k!=='link').every(k => valid(old[m][k]))) { saved.push({id:'custom-'+m,name:m==='light'?'我的浅色主题':'我的深色主题',mode:m,colors:old[m]}); if (mode()===m) selected='custom-'+m; }
  }
} catch {}
// Earlier custom copies of bamboo predate the independent link color field.
// Only fill missing values; preserve explicitly chosen colors and all effects.
for(const scheme of saved){const colors=scheme.colors;const oldBamboo=colors.background?.toLowerCase()==='#213d32'&&colors.paper?.toLowerCase()==='#eef2e4'&&colors.link?.toLowerCase()==='#19492f';if(!valid(colors.link)||oldBamboo)colors.link=defaultLink(colors);}
const current = () => [...presets,...saved].find(x => x.id === selected) || presets[0];
function save() { localStorage.setItem(schemeKey, JSON.stringify({selected,defaultId,schemes:saved,bambooDefaultRevision:1})); }
const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16));
const rgba = (hex, alpha) => `rgba(${rgb(hex).join(',')},${alpha})`;
const blend = (a, b, ratio) => '#' + rgb(a).map((v, i) => Math.round(v * (1 - ratio) + rgb(b)[i] * ratio).toString(16).padStart(2, '0')).join('');
function ink(hex) { const linear = rgb(hex).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 > .179 ? '#182337' : '#f4f7ff'; }
const properties = ['--bg','--panel','--text','--muted','--line','--accent','--accent-soft','--glass','--glass-edge','--paper','--code','--button-hover','--custom-document-text','--custom-background','--custom-accent-ink','--document-link'];
function apply(colors) {
  for (const key of properties) document.body.style.removeProperty(key);
  document.body.classList.toggle('custom-colors', Boolean(colors));
  if (!colors) return;
  const foreground = ink(colors.background), glass = blend(colors.background, foreground === '#182337' ? '#ffffff' : '#192334', .22);
  const values = {
    '--document-link':valid(colors.link)?colors.link:defaultLink(colors), '--bg': colors.background, '--panel': glass, '--text': foreground, '--muted': blend(colors.background, foreground, .68),
    '--line': rgba(foreground, .16), '--accent': colors.accent, '--accent-soft': rgba(colors.accent, .12),
    '--glass': rgba(glass, .66), '--glass-edge': rgba(foreground === '#182337' ? '#ffffff' : '#bdd3fb', .45),
    '--paper': rgba(colors.paper, .96), '--code': rgba(colors.text, .07), '--button-hover': rgba(foreground, .08),
    '--custom-document-text': colors.text, '--custom-background': colors.background, '--custom-accent-ink': ink(colors.accent)
  };
  for (const [key, value] of Object.entries(values)) document.body.style.setProperty(key, value);
}

function activate(id) {
  selected = id; const scheme = current(); selected = scheme.id;document.body.dataset.theme=scheme.id;
  document.body.classList.toggle('dark', scheme.mode === 'dark'); apply(scheme.colors);
  applyEffects(scheme); document.dispatchEvent(new Event('moye-theme-change')); save();
  $('colorsBtn').textContent = '主题';
}
function renderSchemes() {
  const list = $('schemeList'); list.replaceChildren();
  for (const scheme of [...presets,...saved]) {
    const row = document.createElement('div'); row.className='scheme-row';
    const button = document.createElement('button'); button.type='button'; button.dataset.scheme=scheme.id; button.className='scheme-option'; button.setAttribute('aria-pressed', String(current().id===scheme.id));
    const swatches=document.createElement('span'); swatches.className='scheme-swatches';
    for (const color of Object.values(scheme.colors || defaults[scheme.mode])) { const dot=document.createElement('i'); dot.style.background=color; swatches.append(dot); }
    if(scheme.effects?.thumbnail){const thumbnail=document.createElement('img');thumbnail.className='scheme-thumbnail';thumbnail.src=scheme.effects.thumbnail;thumbnail.alt='背景缩略图';swatches.replaceChildren(thumbnail);}
    const label=document.createElement('span'); label.textContent=scheme.name;
    button.append(swatches,label); button.onclick=()=>{activate(scheme.id);renderSchemes();}; row.append(button);
    if (saved.includes(scheme)) { const edit=document.createElement('button'); edit.type='button';edit.textContent='编辑';edit.dataset.edit=scheme.id;edit.onclick=()=>openEditor(scheme);row.append(edit);const remove=document.createElement('button');remove.type='button';remove.className='delete-scheme';remove.textContent='删除';remove.setAttribute('aria-label','删除 '+scheme.name);remove.onclick=()=>{saved=saved.filter(x=>x.id!==scheme.id);if(defaultId===scheme.id)defaultId='bamboo';if(selected===scheme.id)activate(defaultId || 'bamboo');else save();renderSchemes();};row.append(remove); }
    list.append(row);
  }
}
$('schemesDialog').querySelector('button.primary').addEventListener('click',()=>{defaultId=selected;save();});
$('colorsBtn').onclick=()=>{renderSchemes();$('schemesDialog').showModal();};
let editing;
function fill() { for (const key of fields) { $('color-'+key).value=editing.colors[key]; $('hex-'+key).value=editing.colors[key].toUpperCase(); $('hex-'+key).removeAttribute('aria-invalid'); } syncColorValues();$('colorError').textContent='颜色修改后自动保存'; }
function openEditor(scheme) { if(!valid(scheme.colors.link))scheme.colors.link=defaultLink(scheme.colors);editing=scheme;activate(scheme.id);$('schemesDialog').close();$('schemeName').value=scheme.name;fill();fillEffects();$('colorsDialog').showModal(); }
$('newScheme').onclick=()=>{const base=current();let number=1;while(saved.some(x=>x.name==='我的主题 '+number)) number++;const scheme={id:'custom-'+crypto.randomUUID(),name:'我的主题 '+number,mode:base.mode,colors:{...(base.colors || defaults[base.mode])},effects:{...base.effects}};saved.push(scheme);openEditor(scheme);};
$('schemeName').addEventListener('input',()=>{editing.name=$('schemeName').value.trim() || '未命名主题';activate(editing.id);});
for (const key of fields) {
  $('color-'+key).addEventListener('input',()=>{editing.colors[key]=$('color-'+key).value; $('hex-'+key).value=editing.colors[key].toUpperCase();$('hex-'+key).removeAttribute('aria-invalid');activate(editing.id);syncColorValues();$('colorError').textContent='已自动保存';});
  $('hex-'+key).addEventListener('input',()=>{let value=$('hex-'+key).value.trim();if(!value.startsWith('#'))value='#'+value;if(!valid(value)){$('hex-'+key).setAttribute('aria-invalid','true');$('colorError').textContent='请输入 6 位十六进制颜色；保留上次有效颜色。';return;}editing.colors[key]=value.toLowerCase();$('color-'+key).value=value;$('hex-'+key).removeAttribute('aria-invalid');activate(editing.id);syncColorValues();$('colorError').textContent='已自动保存';});
}
$('resetColors').onclick=()=>{editing.colors={...defaults[editing.mode]};editing.effects={...effectDefaults};fill();fillEffects();activate(editing.id);};
$('applyColors').onclick=()=>{$('colorsDialog').close();};
$('colorsDialog').addEventListener('close',()=>{renderSchemes();$('schemesDialog').showModal();});
const backdrop=document.createElement('div');backdrop.id='themeBackdrop';document.body.prepend(backdrop);
const effectDefaults={type:'solid',end:'#b9d5ff',angle:135,scale:100,opacity:100,blur:0,glass:true,glassOpacity:66,glassBlur:24};
const effect=()=>({...effectDefaults,...editing.effects});
function applyEffects(scheme){
  const fx={...effectDefaults,...scheme.effects};
  backdrop.style.cssText='';document.body.classList.toggle('theme-background',Boolean(scheme.colors));
  document.body.style.removeProperty('--theme-blur');document.body.style.removeProperty('--theme-glass-opacity');
  if(!scheme.colors)return;
  backdrop.style.backgroundColor=scheme.colors.background;
  if(fx.type==='gradient')backdrop.style.backgroundImage='linear-gradient('+Number(fx.angle)+'deg,'+scheme.colors.background+','+(valid(fx.end)?fx.end:'#b9d5ff')+')';
  if(fx.type==='image' && typeof fx.url==='string' && fx.url.startsWith('file:'))backdrop.style.backgroundImage='url('+JSON.stringify(fx.url)+')';
  backdrop.style.backgroundSize='cover';backdrop.style.backgroundPosition='center';backdrop.style.transform='scale('+Math.max(1,Math.min(2.5,Number(fx.scale)/100))+')';
  backdrop.style.opacity=Math.max(0,Math.min(1,Number(fx.opacity)/100));backdrop.style.filter='blur('+Math.max(0,Math.min(40,Number(fx.blur)))+'px)';
  document.body.style.setProperty('--theme-blur',(fx.glass?Number(fx.glassBlur):0)+'px');
  const foreground=ink(scheme.colors.background),glass=blend(scheme.colors.background,foreground==='#182337'?'#ffffff':'#192334',.22);
  document.body.style.setProperty('--glass',rgba(glass,fx.glass?Number(fx.glassOpacity)/100:1));
  document.body.style.setProperty('--paper',rgba(scheme.colors.paper,fx.glass?Math.max(.35,Number(fx.glassOpacity)/100):1));
}
const controls={backgroundType:'type',gradientEnd:'end',gradientAngle:'angle',themeScale:'scale',themeOpacity:'opacity',themeBlur:'blur',themeGlass:'glass',glassOpacity:'glassOpacity',glassBlur:'glassBlur'};
function fillEffects(){const fx=effect();for(const [id,key] of Object.entries(controls)){if($(id).type==='checkbox')$(id).checked=fx[key];else $(id).value=fx[key];if($(id).type==='range')$(id).nextElementSibling.textContent=fx[key]+(['gradientAngle'].includes(id)?'°':['themeBlur','glassBlur'].includes(id)?' px':'%');}$('gradientControls').hidden=fx.type!=='gradient';$('imageControls').hidden=fx.type!=='image';$('themeThumbnail').hidden=!fx.thumbnail;if(fx.thumbnail)$('themeThumbnail').src=fx.thumbnail;syncColorValues();}
for(const [id,key] of Object.entries(controls))$(id).addEventListener('input',()=>{editing.effects={...effect(),[key]:$(id).type==='checkbox'?$(id).checked:$(id).type==='range'?Number($(id).value):$(id).value};activate(editing.id);fillEffects();$('colorError').textContent='已自动保存';});
$('uploadThemeImage').onclick=async()=>{try{const result=await window.desktop.themeImage();if(result?.error)throw new Error(result.error);if(result){editing.effects={...effect(),...result,type:'image'};activate(editing.id);fillEffects();}}catch(e){$('colorError').textContent=e.message;}};

// The same RGB / HEX editor is used for every theme color, including gradient end.
function syncColorValues(){for(const key of [...fields,'gradientEnd']){const picker=$(key==='gradientEnd'?key:'color-'+key),hex=$('hex-'+key),rgbInput=$('rgb-'+key);if(!rgbInput)continue;rgbInput.value=rgb(picker.value).join(', ');rgbInput.removeAttribute('aria-invalid');if(hex&&key==='gradientEnd')hex.value=picker.value.toUpperCase();}}
for(const key of [...fields,'gradientEnd']){
 const picker=$(key==='gradientEnd'?key:'color-'+key);let hex=$('hex-'+key);
 if(!hex){hex=document.createElement('input');hex.id='hex-'+key;hex.className='hex-color';hex.maxLength=7;hex.setAttribute('aria-label','渐变终点十六进制');picker.after(hex);hex.addEventListener('input',()=>{let value=hex.value.trim();if(!value.startsWith('#'))value='#'+value;if(!valid(value)){hex.setAttribute('aria-invalid','true');return;}hex.removeAttribute('aria-invalid');picker.value=value;picker.dispatchEvent(new Event('input',{bubbles:true}));});}
 const values=document.createElement('span');values.className='color-values';hex.before(values);values.append(hex);
 const input=document.createElement('input');input.id='rgb-'+key;input.type='text';input.className='rgb-color';input.setAttribute('aria-label',(key==='gradientEnd'?'渐变终点':$('color-'+key).getAttribute('aria-label'))+' RGB');input.title='RGB：0–255，使用逗号分隔';values.append(input);
 input.addEventListener('input',()=>{const parts=input.value.trim().split(/[,，\s]+/);if(parts.length!==3||parts.some(v=>!/^\d{1,3}$/.test(v)||Number(v)>255)){input.setAttribute('aria-invalid','true');return;}input.removeAttribute('aria-invalid');picker.value='#'+parts.map(v=>Number(v).toString(16).padStart(2,'0')).join('');picker.dispatchEvent(new Event('input',{bubbles:true}));});
}
if(defaultId && ![...presets,...saved].some(x=>x.id===defaultId))defaultId='bamboo';
activate(current().id);
