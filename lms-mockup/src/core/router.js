/* ==========================================================================
   core/router.js — Hash router + guard theo vai trò + vòng đời page
   React Router: routes[] → <Route path element loader/>, guard → <RequireRole/>
   Angular: routes[] → Routes với canActivate: [roleGuard], resolve: { data }
   ========================================================================== */
(function (LMS) {
  const { html, UI } = LMS;
  const pages = {};
  /** Đăng ký page: LMS.page('key', { title, layout, load(ctx), view(data, ctx), actions, mount(ctx), unmount(ctx), skeleton }) */
  LMS.page = (key, def) => (pages[key] = def);

  const ALL = ['learner', 'instructor', 'admin', 'viewer'];
  const L = ['learner'], A = ['admin'], CW = ['admin', 'instructor'], R = ['admin', 'viewer', 'instructor'];
  /** Bảng route — nguồn duy nhất cho điều hướng & phân quyền giao diện */
  const routes = [
    { path: '/login', page: 'login', public: true },
    { path: '/', page: 'home', roles: ALL },
    { path: '/learn', page: 'dashboard', roles: L },
    { path: '/catalog', page: 'catalog', roles: L },
    { path: '/course/:id', page: 'course', roles: L },
    { path: '/lesson/:courseId/:lessonId', page: 'lesson', roles: L, layout: 'focus' },
    { path: '/quiz/:id', page: 'quizIntro', roles: L },
    { path: '/quiz/:id/take', page: 'quizTake', roles: L, layout: 'focus' },
    { path: '/quiz/:id/result/:attemptId', page: 'quizResult', roles: ALL },
    { path: '/quiz/:id/attempts', page: 'quizAttempts', roles: L },
    { path: '/progress', page: 'progress', roles: L },
    { path: '/leaderboard', page: 'leaderboard', roles: L },
    { path: '/certificates', page: 'certificates', roles: L },
    { path: '/certificate/:id', page: 'certificate', roles: L },
    { path: '/saved', page: 'saved', roles: L },
    { path: '/flashcards', page: 'flashcards', roles: L },
    { path: '/assistant', page: 'assistant', roles: L },
    { path: '/notifications', page: 'notifications', roles: ALL },
    { path: '/profile', page: 'profile', roles: ALL },
    { path: '/instructor', page: 'instructor', roles: ['instructor', 'admin'] },
    { path: '/instructor/inbox', page: 'inbox', roles: ['instructor', 'admin'] },
    { path: '/admin', page: 'adminHome', roles: A },
    { path: '/admin/catalog', page: 'adminCatalog', roles: CW },
    { path: '/admin/courses', page: 'adminCourses', roles: CW },
    { path: '/admin/courses/new', page: 'courseWizard', roles: CW },
    { path: '/admin/courses/:id/edit', page: 'courseWizard', roles: CW },
    { path: '/admin/questions', page: 'questions', roles: CW },
    { path: '/admin/quizzes', page: 'quizzes', roles: CW },
    { path: '/admin/quizzes/:id', page: 'quizConfig', roles: CW },
    { path: '/admin/import', page: 'import', roles: CW },
    { path: '/admin/users', page: 'users', roles: A },
    { path: '/admin/users/:id', page: 'userDetail', roles: A },
    { path: '/admin/org', page: 'org', roles: A },
    { path: '/admin/assignments', page: 'assignments', roles: A },
    { path: '/admin/system', page: 'system', roles: A },
    { path: '/reports', page: 'reports', roles: R },
    { path: '/reports/:dim', page: 'reportDetail', roles: R },
    { path: '/design-system', page: 'designSystem', public: true, roles: ALL },
    { path: '/403', page: 'forbidden', roles: ALL },
  ];

  function match(path) {
    for (const r of routes) {
      const ks = []; const re = new RegExp('^' + r.path.replace(/:(\w+)/g, (_, k) => { ks.push(k); return '([^/]+)'; }) + '/?$');
      const m = path.match(re); if (m) return { route: r, params: Object.fromEntries(ks.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }

  let current = null; // { key, def, ctx, cleanup }
  let guardFn = null;
  const outlet = () => document.getElementById('outlet');

  async function resolve() {
    const [path, qstr] = (location.hash.slice(1) || '/').split('?');
    const query = Object.fromEntries(new URLSearchParams(qstr || ''));
    const m = match(path);
    const me = LMS.apiCore.me();
    if (!m) return render('notFound', { params: {}, query, path }, me);
    if (!m.route.public && !me) { location.replace('#/login?next=' + encodeURIComponent(location.hash.slice(1))); return; }
    if (me && m.route.roles && !m.route.roles.includes(me.role)) return render('forbidden', { params: m.params, query, path, reason: `Trang "${path}" dành cho vai trò: ${m.route.roles.map((r) => LMS.apiCore.ROLE_LABEL[r]).join(', ')}.` }, me, m.route);
    return render(m.route.page, { params: m.params, query, path }, me, m.route);
  }

  async function render(key, info, me, route = {}) {
    const def = pages[key] || pages.notFound;
    if (current) { try { current.cleanup && current.cleanup(); current.def.unmount && current.def.unmount(current.ctx); } catch (e) { console.warn(e); } }
    guardFn = null;
    const layout = route.layout || def.layout || 'app';
    LMS.shell.render(layout, me, info.path);
    const el = outlet();
    const prevKey = current && current.key === key && current.path === info.path ? current.ctx.state : null;
    const ctx = {
      ...info, me, el, state: prevKey || (def.initState ? def.initState(info) : {}), data: null, key,
      rerender: () => paint(ctx), reload: () => load(ctx, false), go: (h) => (location.hash = h),
      setGuard: (fn) => (guardFn = fn),
    };
    ctx.state.tables = ctx.state.tables || {};
    current = { key, def, ctx, path: info.path };
    document.title = `${typeof def.title === 'function' ? def.title(ctx) : def.title || 'Core Banking Academy'} · Core Banking Academy`;
    await load(ctx, true);
  }

  async function load(ctx, first) {
    const def = pages[ctx.key] || pages.notFound;
    if (def.load) {
      if (first) ctx.el.innerHTML = String(def.skeleton ? def.skeleton(ctx) : UI.Skeleton());
      try { ctx.data = await def.load(ctx); }
      catch (err) { if (current && current.ctx !== ctx) return; return showError(ctx, err); }
    }
    if (current && current.ctx !== ctx) return; // đã điều hướng sang trang khác
    paint(ctx, first);
  }
  function paint(ctx, first) {
    const def = pages[ctx.key];
    const scroll = window.scrollY;
    const focusSel = !first && document.activeElement && document.activeElement.dataset && (document.activeElement.dataset.input ? `[data-input="${document.activeElement.dataset.input}"]` : null);
    const caret = focusSel && document.activeElement.selectionStart;
    try { ctx.el.innerHTML = String(def.view(ctx.data, ctx)); }
    catch (err) { console.error(err); return showError(ctx, err); }
    if (typeof def.title === 'function') document.title = `${def.title(ctx)} · Core Banking Academy`;
    if (current) { current.cleanup && current.cleanup(); current.cleanup = def.mount ? def.mount(ctx) : null; }
    if (first) { window.scrollTo(0, 0); const h = ctx.el.querySelector('h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
    else { window.scrollTo(0, scroll); if (focusSel) { const f = ctx.el.querySelector(focusSel); if (f) { f.focus(); try { f.setSelectionRange(caret, caret); } catch (e) { /* noop */ } } } }
  }
  function showError(ctx, err) {
    if (err && err.status === 401) { LMS.sessionExpired(); }
    console.warn('[api]', err);
    ctx.el.innerHTML = String(UI.ErrorState(err || {}));
  }

  /* ---------- Sự kiện ủy quyền (delegation) ---------- */
  const tableState = (ctx, id) => (ctx.state.tables[id] = ctx.state.tables[id] || { sort: null, dir: 'asc', page: 1, selected: [] });
  const BUILTIN = {
    'tbl-sort': (el, ctx) => { const t = tableState(ctx, el.dataset.table); if (t.sort === el.dataset.key) t.dir = t.dir === 'asc' ? 'desc' : 'asc'; else { t.sort = el.dataset.key; t.dir = 'asc'; } t.page = 1; ctx.rerender(); },
    'tbl-page': (el, ctx) => { tableState(ctx, el.dataset.table).page = +el.dataset.page; ctx.rerender(); },
    'tbl-sel': (el, ctx) => { const t = tableState(ctx, el.dataset.table); const id = el.dataset.id; t.selected = t.selected.includes(id) ? t.selected.filter((x) => x !== id) : [...t.selected, id]; ctx.rerender(); },
    'tbl-sel-all': (el, ctx) => { const t = tableState(ctx, el.dataset.table); const ids = el.dataset.ids.split(',').filter(Boolean); const all = ids.every((i) => t.selected.includes(i)); t.selected = all ? t.selected.filter((x) => !ids.includes(x)) : [...new Set([...t.selected, ...ids])]; ctx.rerender(); },
    'tbl-sel-clear': (el, ctx) => { tableState(ctx, el.dataset.table).selected = []; ctx.rerender(); },
    retry: (el, ctx) => load(ctx, true),
  };
  function dispatch(name, el, ev) {
    if (!current) return;
    const { def, ctx } = current;
    const fn = (def.actions && def.actions[name]) || BUILTIN[name] || LMS.shell.actions[name];
    if (fn) { Promise.resolve(fn(el, ctx, ev)).catch((err) => LMS.handleError(err)); return true; }
    console.warn('Không có handler cho action', name);
  }
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (el && !el.disabled) { if (el.tagName === 'A' && !el.getAttribute('href')) ev.preventDefault(); if (el.type !== 'checkbox' && el.type !== 'radio') ev.preventDefault(); dispatch(el.dataset.action, el, ev); return; }
    const row = ev.target.closest('[data-row-href]');
    if (row && !ev.target.closest('a,button,input,select,label')) location.hash = row.dataset.rowHref;
  });
  const debounce = new Map();
  document.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-input]'); if (!el) return;
    clearTimeout(debounce.get(el.dataset.input));
    debounce.set(el.dataset.input, setTimeout(() => dispatch(el.dataset.input, el, ev), 220));
  });
  document.addEventListener('change', (ev) => { const el = ev.target.closest('[data-change]'); if (el) dispatch(el.dataset.change, el, ev); });
  document.addEventListener('submit', (ev) => { const f = ev.target.closest('form[data-submit]'); if (f) { ev.preventDefault(); dispatch(f.dataset.submit, f, ev); } });
  // Bàn phím cho tablist: mũi tên trái/phải
  document.addEventListener('keydown', (ev) => {
    const tab = ev.target.closest('[role="tab"]'); if (!tab || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    const list = [...tab.parentElement.querySelectorAll('[role="tab"]')]; const i = list.indexOf(tab);
    const next = list[(i + (ev.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length]; next.focus(); next.click();
  });

  /* ---------- Chặn rời trang khi còn thay đổi chưa lưu ---------- */
  let skipNext = false, lastHash = location.hash;
  window.addEventListener('hashchange', async () => {
    if (skipNext) { skipNext = false; lastHash = location.hash; return; }
    if (guardFn) {
      const msg = guardFn();
      if (msg) {
        const target = location.hash; skipNext = true; history.replaceState(null, '', lastHash);
        const ok = await LMS.ui.confirm({ title: 'Rời trang khi chưa lưu?', message: msg, confirmLabel: 'Rời trang', cancelLabel: 'Ở lại', tone: 'warning' });
        if (!ok) { skipNext = false; return; }
        guardFn = null; skipNext = false; location.hash = target; return;
      }
    }
    lastHash = location.hash; resolve();
  });
  window.addEventListener('beforeunload', (e) => { if (guardFn && guardFn()) { e.preventDefault(); e.returnValue = ''; } });

  LMS.router = { resolve, routes, match, refresh: () => current && load(current.ctx, false), current: () => current };
})(window.LMS);
