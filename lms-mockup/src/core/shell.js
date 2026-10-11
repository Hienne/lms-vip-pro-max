/* ==========================================================================
   core/shell.js — AppShell: Sidebar (theo vai trò) + Header + banner mạng
   React: <AppShell><Outlet/></AppShell>  ·  Angular: <app-shell><router-outlet/>
   ========================================================================== */
(function (LMS) {
  const { html, icon, mai, UI, fmt } = LMS;

  /** Menu theo vai trò — mỗi mục phải có trang hoạt động thật (không nút giả) */
  const NAV = {
    learner: [
      { section: 'Học tập', items: [['#/learn', 'home', 'Trang chủ học tập'], ['#/catalog', 'library', 'Danh mục khóa học'], ['#/progress', 'chart', 'Tiến độ của tôi'], ['#/leaderboard', 'trophy', 'Bảng xếp hạng']] },
      { section: 'Công cụ học', items: [['#/assistant', 'sparkles', 'Trợ lý AI'], ['#/flashcards', 'layers', 'Flashcard ôn tập'], ['#/saved', 'bookmark', 'Đã lưu & ghi chú'], ['#/certificates', 'award', 'Chứng nhận']] },
    ],
    instructor: [
      { section: 'Giảng dạy', items: [['#/instructor', 'home', 'Tổng quan giảng viên'], ['#/instructor/inbox', 'inbox', 'Hộp phản hồi', 'inbox']] },
      { section: 'Nội dung', items: [['#/admin/catalog', 'tree', 'Lĩnh vực & chương trình'], ['#/admin/courses', 'book', 'Khóa học'], ['#/admin/questions', 'help', 'Ngân hàng câu hỏi'], ['#/admin/quizzes', 'clipboard', 'Bài kiểm tra'], ['#/admin/import', 'upload', 'Nhập dữ liệu']] },
      { section: 'Theo dõi', items: [['#/reports', 'chart', 'Báo cáo']] },
    ],
    admin: [
      { section: 'Quản trị', items: [['#/admin', 'home', 'Tổng quan']] },
      { section: 'Nội dung', items: [['#/admin/catalog', 'tree', 'Lĩnh vực & chương trình'], ['#/admin/courses', 'book', 'Khóa học'], ['#/admin/questions', 'help', 'Ngân hàng câu hỏi'], ['#/admin/quizzes', 'clipboard', 'Bài kiểm tra'], ['#/admin/import', 'upload', 'Nhập dữ liệu']] },
      { section: 'Tổ chức', items: [['#/admin/users', 'users', 'Người dùng'], ['#/admin/org', 'building', 'Đơn vị & nhóm'], ['#/admin/assignments', 'calendar', 'Giao học & hạn']] },
      { section: 'Theo dõi', items: [['#/reports', 'chart', 'Báo cáo'], ['#/instructor/inbox', 'inbox', 'Hộp phản hồi', 'inbox'], ['#/admin/system', 'settings', 'Hệ thống & nhật ký']] },
    ],
    viewer: [
      { section: 'Báo cáo', items: [['#/reports', 'chart', 'Tổng quan đào tạo'], ['#/reports/learners', 'users', 'Theo học viên'], ['#/reports/courses', 'book', 'Theo khóa học'], ['#/reports/units', 'building', 'Theo đơn vị'], ['#/reports/competency', 'target', 'Năng lực']] },
    ],
  };

  let shellKey = '';
  let badges = { notif: 0, inbox: 0 };

  function activeHref(path) {
    const me = LMS.apiCore.me(); if (!me) return '';
    const all = NAV[me.role].flatMap((s) => s.items.map((i) => i[0].slice(1)));
    return '#' + (all.filter((h) => path === h || path.startsWith(h + '/')).sort((a, b) => b.length - a.length)[0] || '');
  }

  function sidebar(me, path) {
    const act = activeHref(path);
    const st = me.role === 'learner' ? LMS.apiCore.streak(me.id) : 0;
    return html`<aside class="sidebar" id="sidebar" aria-label="Điều hướng chính">
      <a class="sidebar__brand" href="#/">${mai(30)}<span><span class="sidebar__brand-name">Core Banking Academy</span><br><span class="sidebar__brand-sub">Đào tạo nội bộ Ban QL&PT Core Banking</span></span></a>
      <div class="sidebar__role">${icon('shield', 'icon--sm')}<span>Vai trò: <strong style="color:#fff">${LMS.apiCore.ROLE_LABEL[me.role]}${me.adminScope ? ' đơn vị' : ''}</strong></span></div>
      <nav>${NAV[me.role].map((s) => html`<div class="sidebar__section" id="nav-${s.section}">${s.section}</div><ul class="nav" aria-labelledby="nav-${s.section}">${s.items.map(([href, ic, label, badge]) => html`<li><a href="${href}" ${act === href ? LMS.raw('aria-current="page"') : ''}>${icon(ic)}<span>${label}</span>${badge && badges[badge] ? html`<span class="nav__badge" aria-label="${badges[badge]} mục mới">${badges[badge]}</span>` : ''}</a></li>`)}</ul>`)}</nav>
      <div class="sidebar__footer stack" style="--gap:10px">
        ${me.role === 'learner' && st ? html`<div class="streak-card">${icon('flame', 'icon--sm')}<div><strong>Chuỗi học ${st} ngày</strong>Học thêm hôm nay để giữ chuỗi!</div></div>` : ''}
        <a class="nav" href="#/design-system" style="color:#A9CFCC;font-size:12px;display:flex;gap:8px;align-items:center;min-height:32px;text-decoration:none">${icon('palette', 'icon--sm')}Design System v2</a>
      </div></aside><div class="sidebar-scrim" data-action="nav-close"></div>`;
  }

  function header(me) {
    const ph = me.role === 'learner' ? 'Tìm khóa học, bài học…' : 'Tìm khóa học, người dùng, câu hỏi…';
    return html`<header class="header">
      <button class="icon-btn header__menu" data-action="nav-toggle" aria-label="Mở menu điều hướng" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button>
      <form class="header__search" role="search" data-submit="global-search">${icon('search')}<label class="sr-only" for="gsearch">Tìm kiếm</label><input id="gsearch" name="q" type="search" placeholder="${ph}" autocomplete="off"></form>
      <div class="header__actions">
        <button class="btn btn--ghost btn--sm" data-action="demo-menu" aria-haspopup="menu" aria-expanded="false">${icon('settings', 'icon--sm')}<span class="hide-sm">Demo</span></button>
        <button class="icon-btn" data-action="theme" aria-label="Đổi giao diện sáng/tối">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>
        <a class="icon-btn" href="#/notifications" aria-label="Thông báo${badges.notif ? `, ${badges.notif} chưa đọc` : ''}">${icon('bell')}${badges.notif ? html`<span class="icon-btn__dot"></span>` : ''}</a>
        <button class="header__user" data-action="user-menu" aria-haspopup="menu" aria-expanded="false">${UI.Avatar(me.name)}<span class="header__user-meta"><span class="header__user-name">${me.name}</span><br><span class="header__user-role">${me.title}</span></span>${icon('chevron-down', 'icon--sm')}</button>
      </div></header>`;
  }

  function netBanner() {
    if (!LMS.store.net.offline) return '';
    return html`<div class="net-banner" role="alert">${icon('wifi-off')}<span class="grow">Mất kết nối mạng (mô phỏng). Dữ liệu đang nhập được giữ nguyên — thao tác sẽ thực hiện được khi có mạng trở lại.</span><button class="btn btn--sm" data-action="net-online">Kết nối lại</button></div>`;
  }

  function render(layout, me, path = '') {
    const app = document.getElementById('app');
    const key = `${layout}|${me ? me.id + me.role + me.name : ''}|${LMS.store.net.offline}|${document.documentElement.dataset.theme}`;
    if (key === shellKey && document.getElementById('outlet')) { updateActive(path); return; }
    shellKey = key;
    if (layout === 'bare' || !me) { app.className = 'app app--bare'; app.innerHTML = String(html`${netBanner()}<main id="outlet" tabindex="-1"></main>`); return; }
    if (layout === 'focus') { app.className = 'app app--bare'; app.innerHTML = String(html`${netBanner()}<main id="outlet" class="focus-shell" tabindex="-1"></main>`); return; }
    app.className = 'app';
    app.innerHTML = String(html`${sidebar(me, path)}<div class="main">${header(me)}${netBanner()}<main id="outlet" tabindex="-1"></main></div>`);
    refreshBadges();
  }
  function updateActive(path) {
    const act = activeHref(path);
    document.querySelectorAll('.nav a').forEach((a) => (a.getAttribute('href') === act ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    document.getElementById('app').classList.remove('is-nav-open');
  }
  function refreshBadges() {
    const me = LMS.apiCore.me(); if (!me) return;
    const db = LMS.store.db;
    badges = { notif: db.notifications.filter((n) => n.userId === me.id && !n.read).length, inbox: LMS.apiCore.can(me, 'feedback.reply') ? db.feedback.filter((f) => (f.kind === 'question' || f.kind === 'report') && f.status === 'new').length : 0 };
    const bell = document.querySelector('.header a[href="#/notifications"]');
    if (bell) { const dot = bell.querySelector('.icon-btn__dot'); if (badges.notif && !dot) bell.insertAdjacentHTML('beforeend', '<span class="icon-btn__dot"></span>'); if (!badges.notif && dot) dot.remove(); bell.setAttribute('aria-label', `Thông báo${badges.notif ? `, ${badges.notif} chưa đọc` : ''}`); }
    document.querySelectorAll('.nav a[href="#/instructor/inbox"]').forEach((a) => { let b = a.querySelector('.nav__badge'); if (badges.inbox) { if (!b) { b = document.createElement('span'); b.className = 'nav__badge'; a.appendChild(b); } b.textContent = badges.inbox; b.setAttribute('aria-label', `${badges.inbox} mục mới`); } else if (b) b.remove(); });
  }
  LMS.store.subscribe(() => setTimeout(refreshBadges, 0));

  function setTheme(t) { document.documentElement.dataset.theme = t; LMS.store.prefs.set({ theme: t }); }

  /* ---------- Hành động toàn cục của shell ---------- */
  const actions = {
    'nav-toggle': (el) => { const app = document.getElementById('app'); const open = !app.classList.contains('is-nav-open'); app.classList.toggle('is-nav-open', open); el.setAttribute('aria-expanded', String(open)); if (open) setTimeout(() => { const f = document.querySelector('.sidebar a'); f && f.focus(); }, 50); },
    'nav-close': () => document.getElementById('app').classList.remove('is-nav-open'),
    theme: () => { const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); setTheme(cur === 'dark' ? 'light' : 'dark'); shellKey = ''; LMS.router.resolve(); },
    'net-online': () => { LMS.store.net.offline = false; shellKey = ''; LMS.ui.notify.success('Đã kết nối lại'); LMS.router.resolve(); },
    'global-search': (form) => { const q = form.q.value.trim(); const me = LMS.apiCore.me(); if (!q) return; location.hash = me.role === 'learner' ? `#/catalog?q=${encodeURIComponent(q)}` : me.role === 'viewer' ? `#/reports/learners?q=${encodeURIComponent(q)}` : `#/admin/courses?q=${encodeURIComponent(q)}`; },
    'user-menu': (el) => { const me = LMS.apiCore.me(); LMS.ui.menu(el, [{ label: `${me.name} · ${me.email}` }, { label: 'Hồ sơ cá nhân', icon: 'user', href: '#/profile' }, { label: 'Thông báo', icon: 'bell', href: '#/notifications' }, '-', { label: 'Đăng xuất', icon: 'logout', danger: true, onClick: logout }]); },
    'demo-menu': async (el) => {
      const me = LMS.apiCore.me(); const accts = await LMS.api.auth.demoAccounts();
      LMS.ui.menu(el, [
        { label: 'Đăng nhập nhanh theo vai trò' },
        ...accts.map((a) => ({ label: `${a.roleLabel} — ${a.name}`, icon: 'user', checked: a.id === me.id, onClick: async () => { await LMS.api.auth.loginDemo(a.id); shellKey = ''; location.hash = '#/'; LMS.router.resolve(); LMS.ui.notify.info(`Đã chuyển sang ${a.roleLabel}`, a.email); } })),
        '-', { label: 'Mô phỏng sự cố' },
        { label: LMS.store.net.offline ? 'Bật lại kết nối mạng' : 'Mô phỏng mất kết nối', icon: 'wifi-off', onClick: () => { LMS.store.net.offline = !LMS.store.net.offline; shellKey = ''; LMS.router.resolve(); } },
        { label: 'Mô phỏng hết phiên đăng nhập', icon: 'clock', onClick: () => { LMS.store.net.sessionExpired = true; LMS.ui.notify.info('Phiên sẽ hết hạn ở thao tác tiếp theo'); } },
        { label: 'Thử truy cập URL quản trị (kiểm thử vượt quyền)', icon: 'lock', onClick: () => (location.hash = '#/admin/users') },
        '-', { label: 'Mở Design System', icon: 'palette', href: '#/design-system' },
        { label: 'Đặt lại dữ liệu demo', icon: 'refresh', danger: true, onClick: async () => { if (await LMS.ui.confirm({ title: 'Đặt lại dữ liệu demo?', message: 'Mọi thay đổi (tiến độ, bài thi, khóa học tạo mới…) sẽ bị xóa và nạp lại dữ liệu mẫu ban đầu.', confirmLabel: 'Đặt lại', tone: 'danger' })) { LMS.store.reset(); shellKey = ''; LMS.router.resolve(); LMS.ui.notify.success('Đã nạp lại dữ liệu mẫu'); } } },
      ], { align: 'right' });
    },
  };
  async function logout() {
    if (!(await LMS.ui.confirm({ title: 'Đăng xuất?', message: 'Tiến độ học đã được lưu tự động. Bạn có thể tiếp tục trên thiết bị khác.', confirmLabel: 'Đăng xuất', icon: 'logout' }))) return;
    try { await LMS.api.auth.logout(); } catch (e) { LMS.store.session.clear(); }
    shellKey = ''; location.hash = '#/login'; LMS.ui.notify.success('Đã đăng xuất');
  }

  LMS.shell = { render, actions, setTheme, refreshBadges, invalidate: () => (shellKey = ''), NAV };
})(window.LMS);
