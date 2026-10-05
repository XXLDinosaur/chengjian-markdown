export function installGlassSelects() {
  const known = new WeakSet(), pairs = [];
  let current = null;
  function close(restoreFocus = false) {
    if (!current) return;
    const { menu, button } = current;
    current = null;
    if (menu.matches(':popover-open')) menu.hidePopover();
    menu.remove();
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus({ preventScroll: true });
  }
  function sync() {
    for (const { select, button } of pairs) {
      const label = (select.selectedOptions[0]?.textContent || '') + ' ▾';
      if (button.textContent !== label) button.textContent = label;
      button.disabled = select.disabled;
    }
  }
  function open(select, button) {
    if (current?.button === button) { close(true); return; }
    close(); sync();
    const menu = document.createElement('div');
    menu.className = 'glass-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', button.getAttribute('aria-label'));
    // The top layer uses viewport coordinates, even inside a blurred dialog.
    // Ordinary fixed descendants use that dialog as their containing block.
    menu.setAttribute('popover', 'manual');
    for (const option of select.options) {
      const item = document.createElement('button');
      item.type = 'button'; item.textContent = option.textContent;
      item.disabled = option.disabled;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.selected));
      item.onclick = () => {
        select.value = option.value;
        close(true);
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
      };
      menu.append(item);
    }
    (select.closest('dialog') || document.body).append(menu);
    const rect = button.getBoundingClientRect();
    menu.style.minWidth = rect.width + 'px';
    menu.showPopover();
    menu.style.left = Math.max(8, Math.min(rect.left, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = (rect.bottom + menu.offsetHeight + 8 > innerHeight
      ? Math.max(8, rect.top - menu.offsetHeight - 5) : rect.bottom + 5) + 'px';
    current = { menu, button };
    button.setAttribute('aria-expanded', 'true');
    menu.querySelector('[aria-selected=true]')?.focus({ preventScroll: true });
  }
  function scan() {
    for (const select of document.querySelectorAll('select')) {
      if (known.has(select)) continue;
      known.add(select);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'glass-select-button';
      button.setAttribute('aria-label', select.getAttribute('aria-label') || select.closest('label')?.childNodes[0]?.textContent?.trim() || '选择选项');
      if (select.dataset.tooltip) button.dataset.tooltip = select.dataset.tooltip;
      button.setAttribute('aria-haspopup', 'listbox');
      button.setAttribute('aria-expanded', 'false');
      select.classList.add('glass-select-original');
      select.setAttribute('aria-hidden', 'true'); select.tabIndex = -1;
      select.after(button); pairs.push({ select, button });
      button.onclick = () => open(select, button);
      select.addEventListener('change', sync);
    }
    sync();
  }
  document.addEventListener('pointerdown', event => {
    if (current && !current.menu.contains(event.target) && event.target !== current.button) close();
  });
  document.addEventListener('keydown', event => {
    if (!current) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const items = [...current.menu.querySelectorAll('button:not(:disabled)')];
      if (!items.length) return;
      const at = items.indexOf(document.activeElement);
      items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus({ preventScroll: true });
    }
  }, true);
  document.addEventListener('scroll', event => {
    if (current && !current.menu.contains(event.target)) close();
  }, true);
  window.addEventListener('resize', () => close());
  document.addEventListener('close', () => close(), true);
  document.addEventListener('document-updated', sync);
  document.addEventListener('click', () => queueMicrotask(sync));
  document.addEventListener('toggle', sync, true);
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
}
