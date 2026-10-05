import { headingLabel } from './number-label.js';
const $ = id => document.getElementById(id);
const panel = $('documentOutline'), list = $('outlineList'), scroll = $('documentScroll');
let headings = [], buttons = [], frame = 0, rebuild = false;
function toggle(show) {
  panel.hidden = !show;
  $('outlineBtn').setAttribute('aria-expanded', String(show));
  $('outlineBtn').classList.toggle('active', show);
  localStorage.setItem('moye.outline.visible', String(show));
  schedule();
}
$('outlineBtn').onclick = () => toggle(panel.hidden);
$('closeOutline').onclick = () => { toggle(false); $('outlineBtn').focus(); };
function highlight() {
  if (panel.hidden || !headings.length) return;
  const top = scroll.getBoundingClientRect().top + 42;
  let index = 0;
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].getBoundingClientRect().top <= top) index = i; else break;
  }
  for (let i = 0; i < buttons.length; i++) {
    if (i === index) buttons[i].setAttribute('aria-current', 'location');
    else buttons[i].removeAttribute('aria-current');
  }
}
function update() {
  const next = [...$('editor').querySelectorAll('.tiptap h1,.tiptap h2,.tiptap h3,.tiptap h4,.tiptap h5,.tiptap h6')];
  const unchanged = next.length === headings.length && next.every((el, i) => el === headings[i] && headingLabel(el) === buttons[i]?.textContent);
  if (unchanged) return;
  headings = next; buttons = [];
  const fragment = document.createDocumentFragment();
  const base = Math.min(...headings.map(el => Number(el.tagName.slice(1))));
  for (const heading of headings) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'outline-item';
    const level = Number(heading.tagName.slice(1));
    button.style.setProperty('--level', level - base);
    button.textContent = headingLabel(heading);
    button.title = button.textContent; button.setAttribute('aria-label', `${level} 级标题：${button.textContent}`);
    button.onclick = () => {
      if (!heading.isConnected) return;
      // Screen coordinates include document zoom; only scroll the document pane.
      scroll.scrollTo({ top: scroll.scrollTop + heading.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 24, behavior: 'instant' });
      highlight();
    };
    buttons.push(button); fragment.append(button);
  }
  list.replaceChildren(fragment);
  $('outlineCount').textContent = String(headings.length);
  $('outlineEmpty').hidden = headings.length > 0 || !$('searchPanel').hidden;
}
function schedule(changed = false) {
  rebuild ||= changed;
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; if (rebuild) { rebuild = false; update(); } highlight(); });
}
new MutationObserver(() => schedule(true)).observe($('editor'), { childList:true, subtree:true, characterData:true,attributes:true,attributeFilter:['data-numbering','start'] });
new ResizeObserver(() => schedule()).observe(scroll);
scroll.addEventListener('scroll', () => schedule(), { passive:true });
scroll.addEventListener('load', () => schedule(), true);
toggle(localStorage.getItem('moye.outline.visible') !== 'false');
// Initial empty state also needs a count when no headings have been added yet.
$('outlineCount').textContent = '0';
schedule(true);
