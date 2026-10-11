/* ==========================================================================
   core/ui.js — Toast, Modal/Confirm, Drawer, Menu, Form helpers
   React: <ToastProvider/>, <Dialog/>, <Sheet/>  ·  Angular: CDK Overlay/Dialog
   ========================================================================== */
(function (LMS) {
  const { html, icon, raw } = LMS;

  /* ---------------- Toast ---------------- */
  function toast(kind, title, msg, ms = 4200) {
    let host = document.querySelector('.toasts');
    if (!host) { host = document.createElement('div'); host.className = 'toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    const ic = { success: 'check-circle', error: 'x-circle', warning: 'alert', info: 'info' }[kind] || 'info';
    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.innerHTML = String(html`${icon(ic)}<div class="grow"><div class="toast__title">${title}</div>${msg ? html`<div class="toast__msg">${msg}</div>` : ''}</div><button class="icon-btn" style="width:28px;height:28px" aria-label="Đóng thông báo">${icon('x', 'icon--sm')}</button>`);
    el.querySelector('button').onclick = () => el.remove();
    host.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }
  const notify = { success: (t, m) => toast('success', t, m), error: (t, m) => toast('error', t, m, 6000), warning: (t, m) => toast('warning', t, m), info: (t, m) => toast('info', t, m) };

  /* ---------------- Focus trap ---------------- */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function trap(root, onEsc) {
    const prev = document.activeElement;
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onEsc && onEsc(); }
      if (e.key !== 'Tab') return;
      const f = [...root.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    root.addEventListener('keydown', handler);
    setTimeout(() => { const first = root.querySelector('[autofocus]') || root.querySelector(FOCUSABLE); first && first.focus(); }, 30);
    return () => { root.removeEventListener('keydown', handler); prev && prev.focus && prev.focus(); };
  }

  /* ---------------- Modal ---------------- */
  /** open({ title, body, icon, tone, actions:[{label, variant, value}], size, dismissible }) → Promise<value|null> */
  function modal({ title, body = '', icon: ic, tone = 'primary', actions = [{ label: 'Đóng', variant: 'secondary', value: null }], size = '', dismissible = true, onMount }) {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'overlay';
      const id = LMS.uid('dlg');
      ov.innerHTML = String(html`<div class="modal ${size ? 'modal--' + size : ''}" role="dialog" aria-modal="true" aria-labelledby="${id}">
        <div class="modal__header">${ic ? html`<div class="modal__icon modal__icon--${tone}">${icon(ic)}</div>` : ''}<div class="grow"><h2 id="${id}" style="font-size:var(--text-lg)">${title}</h2></div>
        ${dismissible ? html`<button class="icon-btn" data-close aria-label="Đóng hộp thoại">${icon('x')}</button>` : ''}</div>
        <div class="modal__body">${body}</div>
        <div class="modal__footer">${actions.map((a, i) => html`<button class="btn btn--${a.variant || 'secondary'}" data-i="${i}" ${i === actions.length - 1 ? raw('autofocus') : ''}>${a.label}</button>`)}</div></div>`);
      document.body.appendChild(ov);
      document.body.style.overflow = 'hidden';
      let release;
      const close = (v) => { release && release(); ov.remove(); document.body.style.overflow = ''; resolve(v); };
      release = trap(ov, () => dismissible && close(null));
      ov.addEventListener('click', async (e) => {
        if (e.target === ov && dismissible) return close(null);
        if (e.target.closest('[data-close]')) return close(null);
        const b = e.target.closest('[data-i]');
        if (b) {
          const a = actions[+b.dataset.i];
          if (a.handler) { b.classList.add('is-loading'); try { const r = await a.handler(ov); if (r === false) { b.classList.remove('is-loading'); return; } close(r === undefined ? a.value : r); } catch (err) { b.classList.remove('is-loading'); LMS.handleError(err, ov); } return; }
          close(a.value === undefined ? true : a.value);
        }
      });
      onMount && onMount(ov);
    });
  }
  /** Xác nhận thao tác quan trọng */
  const confirm = ({ title, message, confirmLabel = 'Xác nhận', tone = 'primary', cancelLabel = 'Hủy', icon: ic }) => modal({
    title, body: html`<p>${message}</p>`, icon: ic || (tone === 'danger' ? 'trash' : tone === 'warning' ? 'alert' : 'help'), tone,
    actions: [{ label: cancelLabel, variant: 'ghost', value: false }, { label: confirmLabel, variant: tone === 'danger' ? 'danger' : 'primary', value: true }],
  }).then((v) => v === true);

  /* ---------------- Drawer ---------------- */
  /** drawer({ title, body, footer, onMount, wide }) → { el, close } ; footer buttons dùng data-drawer-action */
  function drawer({ title, body, footer = '', onMount, onClose }) {
    const ov = document.createElement('div');
    ov.className = 'overlay drawer-overlay';
    const id = LMS.uid('drw');
    ov.innerHTML = String(html`<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <div class="drawer__header"><h2 id="${id}" style="font-size:var(--text-lg)">${title}</h2><button class="icon-btn" data-close aria-label="Đóng">${icon('x')}</button></div>
      <div class="drawer__body">${body}</div>${footer ? html`<div class="drawer__footer">${footer}</div>` : ''}</aside>`);
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    let release;
    const api = { el: ov, close: () => { release && release(); ov.remove(); document.body.style.overflow = ''; onClose && onClose(); } };
    release = trap(ov, api.close);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) api.close(); });
    ov.querySelector('[data-close]').onclick = api.close;
    onMount && onMount(ov, api);
    return api;
  }

  /* ---------------- Menu (popover) ---------------- */
  let openMenu = null;
  function menu(anchor, items, { align = 'right' } = {}) {
    closeMenu();
    const m = document.createElement('div');
    m.className = 'menu'; m.setAttribute('role', 'menu');
    m.innerHTML = String(html`${items.map((it) => it === '-' ? html`<div class="menu__sep" role="separator"></div>` : it.label && !it.onClick && !it.href ? html`<div class="menu__label">${it.label}</div>` : it.href ? html`<a class="menu__item" role="menuitem" href="${it.href}">${it.icon ? icon(it.icon, 'icon--sm') : ''}${it.label}</a>` : html`<button class="menu__item ${it.danger ? 'is-danger' : ''}" role="${it.checked != null ? 'menuitemradio' : 'menuitem'}" ${it.checked != null ? raw(`aria-checked="${!!it.checked}"`) : ''}>${it.icon ? icon(it.icon, 'icon--sm') : ''}<span class="grow">${it.label}</span>${it.checked ? icon('check', 'icon--sm') : ''}</button>`)}`);
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight;
    let left = align === 'right' ? r.right - w : r.left; left = Math.max(8, Math.min(left, innerWidth - w - 8));
    let top = r.bottom + 6; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
    m.style.left = left + 'px'; m.style.top = top + 'px'; m.style.position = 'fixed';
    const actionable = items.filter((it) => it !== '-' && (it.onClick || it.href));
    [...m.querySelectorAll('.menu__item')].forEach((el, i) => { const it = actionable[i]; if (it && it.onClick) el.onclick = () => { closeMenu(); it.onClick(); }; else el.addEventListener('click', closeMenu); });
    anchor.setAttribute('aria-expanded', 'true');
    openMenu = { m, anchor };
    setTimeout(() => { const f = m.querySelector('.menu__item'); f && f.focus(); }, 10);
    m.addEventListener('keydown', (e) => {
      const list = [...m.querySelectorAll('.menu__item')]; const i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      if (e.key === 'Escape') { closeMenu(); anchor.focus(); }
    });
  }
  function closeMenu() { if (openMenu) { openMenu.anchor.setAttribute('aria-expanded', 'false'); openMenu.m.remove(); openMenu = null; } }
  document.addEventListener('mousedown', (e) => { if (openMenu && !openMenu.m.contains(e.target) && !openMenu.anchor.contains(e.target)) closeMenu(); });
  window.addEventListener('hashchange', closeMenu);
  window.addEventListener('resize', closeMenu);

  /* ---------------- Form helpers ---------------- */
  function readForm(form) {
    const data = {};
    [...form.elements].forEach((el) => {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') { if (el.dataset.multi != null) { data[el.name] = data[el.name] || []; if (el.checked) data[el.name].push(el.value); } else data[el.name] = el.checked; }
      else if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
      else data[el.name] = el.value;
    });
    return data;
  }
  /** Hiển thị lỗi: inline dưới từng trường (aria-describedby) + error summary có link, focus vào summary */
  function showErrors(form, errors = {}, message) {
    clearErrors(form);
    const keys = Object.keys(errors);
    if (!keys.length) return;
    keys.forEach((k) => {
      const el = form.querySelector(`[name="${k}"]`) || form.querySelector(`[data-error-for="${k}"]`);
      if (!el) return;
      const field = el.closest('.field') || el.parentElement;
      const id = `err-${k}-${LMS.uid('e')}`;
      const p = document.createElement('div'); p.className = 'field__error'; p.id = id; p.dataset.err = '1';
      p.innerHTML = String(html`${icon('alert', 'icon--sm')}${errors[k]}`);
      field.appendChild(p);
      if (el.matches('input,select,textarea')) { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', [el.getAttribute('aria-describedby'), id].filter(Boolean).join(' ')); }
    });
    const sum = document.createElement('div');
    sum.className = 'error-summary'; sum.tabIndex = -1; sum.dataset.err = '1'; sum.setAttribute('role', 'alert');
    sum.innerHTML = String(html`<strong>${message || 'Vui lòng sửa các lỗi sau:'}</strong><ul>${keys.map((k) => html`<li><a href="#" data-goto="${k}">${errors[k]}</a></li>`)}</ul>`);
    form.prepend(sum);
    sum.querySelectorAll('[data-goto]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); const t = form.querySelector(`[name="${a.dataset.goto}"]`) || form.querySelector(`[data-error-for="${a.dataset.goto}"]`); t && t.focus && t.focus(); }));
    sum.focus();
  }
  function clearErrors(form) {
    form.querySelectorAll('[data-err]').forEach((n) => n.remove());
    form.querySelectorAll('[aria-invalid]').forEach((n) => { n.removeAttribute('aria-invalid'); const d = (n.getAttribute('aria-describedby') || '').split(' ').filter((x) => !x.startsWith('err-')).join(' '); d ? n.setAttribute('aria-describedby', d) : n.removeAttribute('aria-describedby'); });
  }
  /** Nút đang xử lý */
  async function busy(btn, fn) { if (!btn) return fn(); btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true'); try { return await fn(); } finally { btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy'); } }

  /** Tải tệp xuống (CSV/JSON) */
  function download(name, content, mime = 'text/csv;charset=utf-8') {
    const blob = new Blob([mime.startsWith('text/csv') ? '﻿' + content : content], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const toCSV = (cols, rows) => [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => (typeof c.value === 'function' ? c.value(r) : r[c.key])))].map((row) => row.map((v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');

  LMS.ui = { toast, notify, modal, confirm, drawer, menu, closeMenu, readForm, showErrors, clearErrors, busy, download, toCSV, trap };
})(window.LMS);
