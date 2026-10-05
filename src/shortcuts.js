// One registry drives both keyboard actions and visible shortcut hints.
export function installShortcuts({ blocked, setBlock }) {
  const command = name => `[data-command="${name}"]`;
  const bindings = [
    ['#findBtn','查找','Ctrl+F','KeyF'], ['#replaceBtn','替换','Ctrl+H','KeyH'], ['#printBtn','打印','Ctrl+P','KeyP'],
    ['#brushBtn','格式刷','Ctrl+Shift+C','KeyC',true],

    ['#outlineBtn', '显示 / 收起目录', 'Ctrl+Shift+O', 'KeyO', true],
    ['#newBtn', '新建文档', 'Ctrl+N', 'KeyN'], ['#openBtn', '打开文档', 'Ctrl+O', 'KeyO'],
    ['#saveBtn', '保存文档', 'Ctrl+S', 'KeyS'], ['#saveAsBtn', '另存为', 'Ctrl+Shift+S', 'KeyS', true],
    [command('undo'), '撤销', 'Ctrl+Z', 'KeyZ'], [command('redo'), '重做', 'Ctrl+Y', 'KeyY'],
    [command('redo'), '重做', 'Ctrl+Shift+Z', 'KeyZ', true],
    [command('bold'), '加粗', 'Ctrl+B', 'KeyB'], [command('italic'), '斜体', 'Ctrl+I', 'KeyI'],
    [command('strike'), '删除线', 'Ctrl+Shift+X', 'KeyX', true],
    [command('bullet'), '项目符号', 'Ctrl+Shift+8', 'Digit8', true],
    [command('ordered'), '编号列表', 'Ctrl+Shift+7', 'Digit7', true],
    [command('task'), '待办清单', 'Ctrl+Shift+9', 'Digit9', true],
    [command('quote'), '引用', 'Ctrl+Shift+B', 'KeyB', true],
    [command('code'), '代码块', 'Ctrl+Alt+C', 'KeyC', false, true],
    ['#linkBtn', '插入链接', 'Ctrl+K', 'KeyK'],
    ['#imageBtn', '插入图片', 'Ctrl+Shift+I', 'KeyI', true],
    ['#tableBtn', '插入表格', 'Ctrl+Alt+T', 'KeyT', false, true],
    ['#zoomPlus', '放大正文', 'Ctrl++', 'Equal'], ['#zoomPlus', '放大正文', 'Ctrl++', 'Equal', true],
    ['#zoomPlus', '放大正文', 'Ctrl++', 'NumpadAdd'],
    ['#zoomMinus', '缩小正文', 'Ctrl+-', 'Minus'], ['#zoomMinus', '缩小正文', 'Ctrl+-', 'NumpadSubtract'],
    ['#zoomValue', '恢复 100% 缩放', 'Ctrl+0', 'Digit0'],
    ...[0,1,2,3].map(level => ['#blockType', ['正文','一级标题','二级标题','三级标题'][level], `Ctrl+Alt+${level}`, `Digit${level}`, false, true, () => setBlock(level)])
  ];
  const grouped = new Map();
  for (const [selector, label, shortcut] of bindings) {
    const hints = grouped.get(selector) || [];
    const hint = selector === '#blockType' ? `${label}  ${shortcut}` : shortcut;
    if (!hints.includes(hint)) hints.push(hint);
    grouped.set(selector, hints);
  }
  for (const [selector, hints] of grouped) {
    const el = document.querySelector(selector); if (!el) continue;
    const label = bindings.find(item => item[0] === selector)[1];
    el.dataset.tooltip = selector === '#blockType' ? hints.join('\n') : `${label}  ${hints.join(' / ')}`;
    el.setAttribute('aria-label', selector === '#blockType' ? '文字样式' : label);
    el.setAttribute('aria-keyshortcuts', [...new Set(bindings.filter(item => item[0] === selector).map(item => item[2].replace('Ctrl', 'Control')))].join(' '));
    el.removeAttribute('title');
  }
  const tip = document.createElement('div'); tip.id = 'shortcutTip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.append(tip);
  let active, timer;
  function hide() { clearTimeout(timer); tip.hidden = true; active?.removeAttribute('aria-describedby'); active = null; }
  function show(el) {
    hide(); active = el;
    timer = setTimeout(() => {
      if (!active?.isConnected) return;
      tip.textContent = el.dataset.tooltip; tip.hidden = false; el.setAttribute('aria-describedby', tip.id);
      const box = el.getBoundingClientRect(), bounds = tip.getBoundingClientRect();
      tip.style.left = `${Math.max(8, Math.min(box.left + box.width / 2 - bounds.width / 2, innerWidth - bounds.width - 8))}px`;
      tip.style.top = `${box.bottom + bounds.height + 12 > innerHeight ? Math.max(8, box.top - bounds.height - 8) : box.bottom + 8}px`;
    }, 230);
  }
  document.addEventListener('pointerover', event => { const el = event.target.closest?.('[data-tooltip]'); if (el && el !== active) show(el); });
  document.addEventListener('pointerout', event => { if (active && !active.contains(event.relatedTarget)) hide(); });
  document.addEventListener('focusin', event => { if (event.target.matches?.('[data-tooltip]')) show(event.target); });
  document.addEventListener('focusout', hide); document.addEventListener('pointerdown', hide);
  document.addEventListener('scroll', hide, true); window.addEventListener('resize', hide); window.addEventListener('blur', hide);
  document.addEventListener('keydown', event => {
    hide();
    if (!(event.ctrlKey || event.metaKey) || event.isComposing || event.getModifierState('AltGraph') || document.querySelector('dialog[open]')) return;
    const input = event.target;
    // Keep normal text-field shortcuts in width inputs and other controls.
    if ((input instanceof HTMLInputElement && !['checkbox','radio','button','range','color'].includes(input.type)) || input instanceof HTMLTextAreaElement) return;
    const binding = bindings.find(item => item[3] === event.code && Boolean(item[4]) === event.shiftKey && Boolean(item[5]) === event.altKey);
    if (!binding) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat || blocked()) return;
    if (binding[6]) binding[6](); else document.querySelector(binding[0])?.click();
  }, true);
}
