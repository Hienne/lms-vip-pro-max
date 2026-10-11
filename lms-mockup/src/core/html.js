/* ==========================================================================
   core/html.js — template an toàn (tự escape) + helpers định dạng
   React: thay bằng JSX.  Angular: thay bằng template binding {{ }}.
   ========================================================================== */
(function (LMS) {
  class SafeHTML { constructor(s) { this.s = s; } toString() { return this.s; } }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);

  function toHtml(v) {
    if (v == null) return '';
    if (typeof v === 'boolean') return String(v); // aria-selected="${on}" → "true"/"false"
    if (v instanceof SafeHTML) return v.s;
    if (Array.isArray(v)) return v.map(toHtml).join('');
    return esc(v);
  }

  /** html`<p>${value}</p>` — mọi giá trị được escape, trừ SafeHTML/mảng SafeHTML */
  function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) out += toHtml(values[i]) + strings[i + 1];
    return new SafeHTML(out);
  }
  const raw = (s) => new SafeHTML(String(s));
  const cx = (...a) => a.flat().filter(Boolean).join(' ');
  /** Thuộc tính tuỳ chọn: attr('aria-current', cond && 'page') */
  const attr = (name, val) => (val == null || val === false ? '' : raw(` ${name}="${esc(val === true ? '' : val)}"`));

  const nf = new Intl.NumberFormat('vi-VN');
  const fmt = {
    num: (n) => nf.format(Math.round(n || 0)),
    pct: (n) => `${Math.round(n || 0)}%`,
    score: (n) => (n == null ? '—' : (Math.round(n * 10) / 10).toLocaleString('vi-VN')),
    date: (d) => (d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'),
    datetime: (d) => (d ? new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'),
    time: (sec) => { sec = Math.max(0, Math.round(sec || 0)); const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; },
    minutes: (min) => { min = Math.round(min || 0); if (min < 60) return `${min} phút`; const h = Math.floor(min / 60), m = min % 60; return m ? `${h}g ${m}p` : `${h} giờ`; },
    bytes: (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`),
    relative: (d) => {
      if (!d) return '—';
      const diff = (Date.now() - new Date(d).getTime()) / 1000;
      if (diff < 60) return 'vừa xong';
      if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
      if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} ngày trước`;
      return fmt.date(d);
    },
    daysLeft: (d) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000),
    initials: (name) => (name || '?').split(' ').filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase(),
  };

  const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const qs = () => new URLSearchParams((location.hash.split('?')[1]) || '');

  Object.assign(LMS, { SafeHTML, html, raw, esc, cx, attr, fmt, uid, sleep, clone, qs });
})(window.LMS = window.LMS || {});
