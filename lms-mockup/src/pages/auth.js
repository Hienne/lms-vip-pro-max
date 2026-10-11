/* ==========================================================================
   pages/auth.js — Đăng nhập, Trang chủ theo vai trò, Hồ sơ, Thông báo, 403/404
   ========================================================================== */
(function (LMS) {
  const { html, raw, icon, mai, UI, fmt, ui, api } = LMS;
  const HOME = { learner: '#/learn', instructor: '#/instructor', admin: '#/admin', viewer: '#/reports' };

  /* ---------------- Đăng nhập ---------------- */
  LMS.page('login', {
    title: 'Đăng nhập', layout: 'bare',
    load: () => api.auth.demoAccounts(),
    view: (accts, ctx) => html`<div class="auth">
      <section class="auth__brand" aria-label="Giới thiệu">
        <div style="position:absolute;right:-60px;bottom:-60px;opacity:.06">${mai(420, '#fff', '#fff')}</div>
        <div class="row">${mai(40)}<div><div class="fw-700" style="color:#fff;font-size:var(--text-lg)">Core Banking Academy</div><div class="text-sm" style="color:#A9CFCC">Ban QL&PT Core Banking</div></div></div>
        <div class="stack" style="--gap:20px;max-width:460px">
          <h1 style="color:#fff;font-size:var(--text-3xl)">Học đúng việc, đúng lúc — ngay trên một nền tảng.</h1>
          <p style="color:#CFE6E4">Đào tạo hội nhập, nghiệp vụ Core Banking, vận hành và kiểm tra năng lực cho cán bộ mới, cán bộ luân chuyển và cán bộ hiện hữu.</p>
          <ul class="stack" style="--gap:10px;list-style:none;padding:0;color:#E6F2F1">${[['book', 'Tài liệu PDF, video, quy trình và bài kiểm tra trên cùng nền tảng'], ['history', 'Tiếp tục học đúng trang, đúng mốc video trên mọi thiết bị'], ['target', 'Theo dõi năng lực theo từng nhóm kiến thức']].map(([ic, t]) => html`<li class="row" style="--gap:12px">${icon(ic)}<span>${t}</span></li>`)}</ul>
        </div>
        <p class="text-xs" style="color:#8FBDB9">Bản mockup v2 · dữ liệu giả lập · <a href="#/design-system" style="color:#FFD15C">Xem Design System</a></p>
      </section>
      <section class="auth__form"><div class="auth__card stack" style="--gap:24px">
        <div class="stack" style="--gap:6px"><span class="eyebrow">Đăng nhập</span><h2 style="font-size:var(--text-2xl)">Chào mừng trở lại</h2><p class="text-sm text-secondary">Dùng tài khoản nội bộ được cấp. Tài khoản bị khóa sẽ không đăng nhập được.</p></div>
        ${ctx.query.next ? html`<div class="alert">${icon('info')}<div>Vui lòng đăng nhập để tiếp tục tới trang bạn yêu cầu.</div></div>` : ''}
        <form class="stack" data-submit="login" novalidate>
          ${UI.Field({ label: 'Email', name: 'email', type: 'email', required: true, value: ctx.state.email || '', placeholder: 'ten@demo.cb', attrs: 'autocomplete="username" autofocus', prefix: 'user' })}
          <div class="field"><label class="field__label" for="pw">Mật khẩu<span class="req" aria-hidden="true">*</span></label><div class="input-group"><input class="input" id="pw" name="password" type="password" required aria-required="true" autocomplete="current-password" aria-describedby="pw-help"><button type="button" class="btn btn--ghost btn--sm btn--icon input-group__btn" data-action="toggle-pw" aria-label="Hiện mật khẩu" aria-pressed="false">${icon('eye')}</button></div><div class="field__help" id="pw-help">Mockup: tài khoản demo chấp nhận mật khẩu bất kỳ từ 6 ký tự.</div></div>
          <button class="btn btn--primary btn--lg btn--block" type="submit">Đăng nhập</button>
        </form>
        <div class="stack" style="--gap:10px"><div class="row-between"><span class="eyebrow">Tài khoản kiểm thử theo vai trò</span><span class="text-xs text-muted">Mỗi vai trò một tài khoản riêng</span></div>
          <div class="grid grid-2" style="--gap:8px">${accts.map((a) => html`<button class="card card--interactive" style="padding:10px 12px;text-align:left;display:flex;gap:10px;align-items:center" data-action="demo-login" data-id="${a.id}">${UI.Avatar(a.name, 'sm')}<span class="grow" style="min-width:0"><span class="text-sm fw-600 truncate" style="display:block">${a.roleLabel}</span><span class="text-xs text-muted truncate" style="display:block">${a.email}</span></span></button>`)}</div>
          <button class="link-btn" data-action="try-locked">${icon('lock', 'icon--sm')}Thử đăng nhập tài khoản đã bị khóa</button>
        </div></div></section></div>`,
    actions: {
      'toggle-pw': (el) => { const inp = document.getElementById('pw'); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; el.setAttribute('aria-pressed', String(show)); el.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'); el.innerHTML = String(icon(show ? 'eye-off' : 'eye')); },
      login: async (form, ctx) => {
        const d = ui.readForm(form); ctx.state.email = d.email;
        ui.clearErrors(form);
        await ui.busy(form.querySelector('[type=submit]'), async () => {
          try { const r = await api.auth.login(d.email, d.password); done(ctx, r); }
          catch (err) { if (err.status === 422) ui.showErrors(form, err.details, err.message); else if (err.status === 401 || err.status === 423) ui.showErrors(form, { password: err.message }, 'Không đăng nhập được'); else LMS.handleError(err); }
        });
      },
      'demo-login': async (el, ctx) => { el.style.opacity = .6; try { const r = await api.auth.loginDemo(el.dataset.id); done(ctx, r); } catch (e) { el.style.opacity = 1; LMS.handleError(e); } },
      'try-locked': (el) => { const f = document.querySelector('form[data-submit="login"]'); f.email.value = 'long.pd@demo.cb'; f.password.value = '123456'; f.requestSubmit(); },
    },
  });
  function done(ctx, r) { LMS.shell.invalidate(); ui.notify.success('Đăng nhập thành công'); location.hash = ctx.query.next ? '#' + ctx.query.next : HOME[r.role]; }

  LMS.page('home', { title: 'Trang chủ', view: () => { setTimeout(() => location.replace(HOME[LMS.apiCore.me().role]), 0); return html``; } });

  /* ---------------- Hồ sơ ---------------- */
  LMS.page('profile', {
    title: 'Hồ sơ cá nhân',
    load: () => api.auth.profile(),
    view: (p) => html`<div class="page page--narrow">${UI.PageHeader({ eyebrow: 'Tài khoản', title: 'Hồ sơ cá nhân', desc: 'Thông tin tổ chức và vai trò do quản trị viên quản lý — bạn chỉ sửa được thông tin cá nhân.' })}
      <div class="stack" style="--gap:20px">
      <section class="card card--pad row" style="--gap:20px;align-items:center">${UI.Avatar(p.name, 'xl')}<div class="grow stack" style="--gap:6px"><h2>${p.name}</h2><div class="row">${UI.RoleBadge(p.role, !!p.adminScope)}${UI.AccountStatus(p.status)}<span class="badge badge--outline">${icon('key')}Mã cán bộ ${p.staffCode}</span></div><span class="text-sm text-muted">${p.email} · Tham gia ${fmt.date(p.joinedAt)} · Đăng nhập gần nhất ${fmt.relative(p.lastLoginAt)}</span></div></section>
      <div class="grid grid-2">
        ${UI.Card({ title: 'Thông tin cá nhân', body: html`<form class="stack" data-submit="save-profile" novalidate>${UI.Field({ label: 'Họ và tên', name: 'name', value: p.name, required: true })}${UI.Field({ label: 'Chức danh', name: 'title', value: p.title })}<div class="row" style="justify-content:flex-end">${UI.Button({ label: 'Lưu thay đổi', variant: 'primary', type: 'submit' })}</div></form>` })}
        ${UI.Card({ title: 'Tổ chức & phân quyền', body: html`<dl class="stack" style="--gap:12px">${[['Đơn vị', p.unitName], ['Phòng / nhóm', p.groupName], ['Vai trò', p.roleLabel + (p.adminScope ? ' đơn vị' : '')], ['Phạm vi dữ liệu', p.scopeName]].map(([k, v]) => html`<div class="row-between"><dt class="text-sm text-muted">${k}</dt><dd class="text-sm fw-600">${v}</dd></div>`)}</dl><hr class="mt-4 mb-4"><div class="text-xs text-muted mb-2">Quyền chức năng</div><div class="row" style="--gap:6px">${p.perms.map((x) => UI.Badge(x, 'primary'))}</div>` })}
      </div>
      ${UI.Card({ title: 'Đổi mật khẩu', body: html`<form class="form-grid" data-submit="change-pw" novalidate>${UI.Field({ label: 'Mật khẩu hiện tại', name: 'cur', type: 'password', required: true, attrs: 'autocomplete="current-password"' })}<div></div>${UI.Field({ label: 'Mật khẩu mới', name: 'next', type: 'password', required: true, help: 'Tối thiểu 8 ký tự, có chữ hoa và chữ số.', attrs: 'autocomplete="new-password"' })}${UI.Field({ label: 'Nhập lại mật khẩu mới', name: 'confirm', type: 'password', required: true, attrs: 'autocomplete="new-password"' })}<div class="full row" style="justify-content:flex-end">${UI.Button({ label: 'Đổi mật khẩu', variant: 'secondary', type: 'submit' })}</div></form>` })}
      </div></div>`,
    actions: {
      'save-profile': async (form, ctx) => { ui.clearErrors(form); await ui.busy(form.querySelector('[type=submit]'), async () => { try { await api.auth.updateProfile(ui.readForm(form)); ui.notify.success('Đã lưu hồ sơ'); LMS.shell.invalidate(); LMS.router.resolve(); } catch (e) { LMS.handleError(e, form); } }); },
      'change-pw': async (form) => { ui.clearErrors(form); await ui.busy(form.querySelector('[type=submit]'), async () => { try { const d = ui.readForm(form); await api.auth.changePassword(d.cur, d.next, d.confirm); form.reset(); ui.notify.success('Đã đổi mật khẩu'); } catch (e) { LMS.handleError(e, form); } }); },
    },
  });

  /* ---------------- Thông báo ---------------- */
  const NIC = { due: ['clock', 'warning'], reply: ['message', 'info'], assigned: ['book', 'primary'], result: ['clipboard', 'primary'], certificate: ['award', 'reward'], question: ['help', 'info'], report: ['flag', 'danger'] };
  LMS.page('notifications', {
    title: 'Thông báo', initState: () => ({ tab: 'all' }),
    load: () => api.learner.notifications(),
    view: (list, ctx) => {
      const shown = ctx.state.tab === 'unread' ? list.filter((n) => !n.read) : list;
      return html`<div class="page page--narrow">${UI.PageHeader({ eyebrow: 'Hộp thư', title: 'Thông báo', desc: 'Nhắc hạn, kết quả thi, phản hồi của giảng viên và các thay đổi liên quan đến bạn.', actions: UI.Button({ label: 'Đánh dấu đã đọc tất cả', icon: 'check', action: 'read-all', disabled: !list.some((n) => !n.read) }) })}
      <div class="card">${UI.Tabs([{ id: 'all', label: 'Tất cả', count: list.length }, { id: 'unread', label: 'Chưa đọc', count: list.filter((n) => !n.read).length }], ctx.state.tab)}
      ${shown.length ? html`<ul class="list">${shown.map((n) => { const [ic, tone] = NIC[n.kind] || ['bell', 'primary']; return html`<li><a class="list__item" href="${n.link}" data-action="open-notif" data-id="${n.id}" data-href="${n.link}" style="${n.read ? '' : 'background:var(--color-primary-subtle)'}"><span class="kpi__icon ${tone === 'primary' ? '' : 'kpi__icon--' + (tone === 'reward' ? 'reward' : tone)}" style="width:36px;height:36px">${icon(ic, 'icon--sm')}</span><span class="grow"><span class="text-sm ${n.read ? '' : 'fw-600'}">${n.text}</span><br><span class="text-xs text-muted">${fmt.relative(n.at)}</span></span>${n.read ? '' : html`<span class="badge badge--primary">Mới</span>`}</a></li>`; })}</ul>` : UI.Empty({ icon: 'bell', title: 'Không có thông báo chưa đọc', desc: 'Bạn đã xem hết thông báo. Thông báo mới sẽ xuất hiện tại đây.' })}</div></div>`;
    },
    actions: {
      tab: (el, ctx) => { ctx.state.tab = el.dataset.id; ctx.rerender(); },
      'read-all': async (el, ctx) => { await ui.busy(el, () => api.learner.markRead(null)); ui.notify.success('Đã đánh dấu đã đọc'); ctx.reload(); },
      'open-notif': async (el) => { try { await api.learner.markRead(el.dataset.id); } catch (e) { /* vẫn điều hướng */ } location.hash = el.dataset.href; },
    },
  });

  /* ---------------- 403 / 404 ---------------- */
  LMS.page('forbidden', { title: 'Không đủ quyền', view: (_, ctx) => html`<div class="page page--narrow">${UI.Empty({ icon: 'lock', tone: 'danger', title: 'Bạn không có quyền truy cập trang này', desc: (ctx.reason || 'Chức năng này không thuộc vai trò của bạn.') + ' Nếu cần quyền, hãy liên hệ quản trị viên đơn vị.', action: html`<div class="row" style="justify-content:center">${UI.Button({ label: 'Về trang chủ của tôi', icon: 'home', variant: 'primary', href: '#/' })}${UI.Button({ label: 'Quay lại', icon: 'arrow-left', action: 'back' })}</div>` })}<p class="text-xs text-muted" style="text-align:center">Mã lỗi 403 · Ngoài chặn ở giao diện, mọi API cũng kiểm tra quyền và phạm vi đơn vị — gọi trực tiếp vẫn bị từ chối.</p></div>`, actions: { back: () => history.back() } });
  LMS.page('notFound', { title: 'Không tìm thấy', view: (_, ctx) => html`<div class="page page--narrow">${UI.Empty({ icon: 'search', title: 'Không tìm thấy trang', desc: `Đường dẫn "${ctx.path || ''}" không tồn tại hoặc đã bị thay đổi.`, action: UI.Button({ label: 'Về trang chủ', icon: 'home', variant: 'primary', href: '#/' }) })}<p class="text-xs text-muted" style="text-align:center">Mã lỗi 404</p></div>` });
})(window.LMS);
