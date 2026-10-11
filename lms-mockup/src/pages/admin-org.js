/* ==========================================================================
   pages/admin-org.js — Người dùng, Chi tiết người dùng, Đơn vị & nhóm, Giao học, Hệ thống
   ========================================================================== */
(function (LMS) {
  const { html, raw, icon, UI, Charts, fmt, ui, api } = LMS;
  const ROLE_OPTS = [{ value: 'learner', label: 'Học viên' }, { value: 'instructor', label: 'Giảng viên / quản lý nội dung' }, { value: 'admin', label: 'Quản trị viên' }, { value: 'viewer', label: 'Lãnh đạo / người xem báo cáo' }];

  /* ======================= NGƯỜI DÙNG ======================= */
  LMS.page('users', {
    title: 'Người dùng', initState: () => ({ q: '', role: '', unit: '', status: '' }),
    load: async () => ({ list: await api.admin.users(), meta: await api.admin.meta() }),
    view: ({ list, meta }, ctx) => {
      const s = ctx.state; const q = s.q.toLowerCase(); const me = LMS.apiCore.me();
      const rows = list.filter((u) => (!q || (u.name + u.email + u.staffCode).toLowerCase().includes(q)) && (!s.role || u.role === s.role) && (!s.unit || u.unitId === s.unit) && (!s.status || u.status === s.status));
      return html`<div class="page page--wide">${UI.PageHeader({ eyebrow: 'Tổ chức', title: 'Người dùng', desc: me.adminScope ? html`Bạn là quản trị viên đơn vị — chỉ thấy và quản lý người dùng thuộc <strong>${(meta.allUnits.find((u) => u.id === me.adminScope) || {}).name}</strong>.` : 'Quản lý tài khoản, vai trò, đơn vị và trạng thái. Tài khoản bị khóa không đăng nhập được.', actions: html`${UI.Button({ label: 'Nhập danh sách', icon: 'upload', href: '#/admin/import?type=users' })}${UI.Button({ label: 'Thêm người dùng', icon: 'plus', variant: 'primary', action: 'new' })}` })}
      <section class="card"><div class="card__header"><div class="row">${UI.Search({ value: s.q, action: 'fq', placeholder: 'Tên, email, mã cán bộ…', label: 'Tìm người dùng' })}${UI.FilterSelect({ label: 'Vai trò', value: s.role, action: 'frole', options: ROLE_OPTS })}${meta.units.length > 1 ? UI.FilterSelect({ label: 'Đơn vị', value: s.unit, action: 'funit', options: meta.units.map((u) => ({ value: u.id, label: u.name })) }) : ''}${UI.FilterSelect({ label: 'Trạng thái', value: s.status, action: 'fstatus', options: [{ value: 'active', label: 'Hoạt động' }, { value: 'suspended', label: 'Tạm dừng' }, { value: 'locked', label: 'Đã khóa' }] })}</div><span class="text-sm text-muted">${rows.length} người dùng</span></div>
      ${UI.DataTable({ id: 'users', state: s.tables.users, rows, pageSize: 10, rowAction: (r) => `#/admin/users/${r.id}`, caption: 'Danh sách người dùng', columns: [
        { key: 'name', label: 'Người dùng', render: (r) => html`<div class="row" style="--gap:10px;flex-wrap:nowrap">${UI.Avatar(r.name, 'sm')}<div><div class="table__primary">${r.name}</div><div class="table__sub">${r.email} · ${r.staffCode}</div></div></div>` },
        { key: 'role', label: 'Vai trò', render: (r) => UI.RoleBadge(r.role, !!r.adminScope) },
        { key: 'unitName', label: 'Đơn vị / nhóm', render: (r) => html`<div class="text-sm">${r.unitName}</div><div class="table__sub">${r.groupName}</div>` },
        { key: 'status', label: 'Trạng thái', render: (r) => UI.AccountStatus(r.status) },
        { key: 'lastLoginAt', label: 'Đăng nhập cuối', render: (r) => (r.lastLoginAt ? fmt.relative(r.lastLoginAt) : html`<span class="text-muted">Chưa đăng nhập</span>`) },
        { key: 'id', label: '', sort: false, cls: 'col-actions', render: (r) => html`${UI.Button({ label: 'Sửa', icon: 'edit', size: 'sm', variant: 'ghost', action: 'edit', attrs: `data-id="${r.id}"` })}${r.id !== me.id ? (r.status === 'active' ? UI.Button({ label: 'Khóa', icon: 'lock', size: 'sm', variant: 'danger-ghost', action: 'lock', attrs: `data-id="${r.id}"` }) : UI.Button({ label: 'Mở khóa', icon: 'unlock', size: 'sm', variant: 'ghost', action: 'unlock', attrs: `data-id="${r.id}"` })) : ''}` },
      ] })}</section></div>`;
    },
    actions: Object.assign({
      new: (el, ctx) => userForm(ctx, null),
      edit: (el, ctx) => userForm(ctx, ctx.data.list.find((u) => u.id === el.dataset.id)),
      lock: (el, ctx) => setStatus(ctx, el.dataset.id, 'locked'),
      unlock: (el, ctx) => setStatus(ctx, el.dataset.id, 'active'),
    }, ...['q', 'role', 'unit', 'status'].map((k) => ({ ['f' + k]: (el, ctx) => { ctx.state[k] = el.value; ctx.rerender(); } }))),
  });
  async function setStatus(ctx, id, status) {
    const u = (ctx.data.list || [ctx.data.user]).find((x) => x.id === id);
    if (!(await ui.confirm({ title: status === 'locked' ? `Khóa tài khoản ${u.name}?` : `Mở khóa ${u.name}?`, message: status === 'locked' ? 'Người dùng bị đăng xuất và không thể đăng nhập. Lịch sử học tập được giữ nguyên.' : 'Người dùng có thể đăng nhập lại ngay.', confirmLabel: status === 'locked' ? 'Khóa tài khoản' : 'Mở khóa', tone: status === 'locked' ? 'danger' : 'primary', icon: status === 'locked' ? 'lock' : 'unlock' }))) return;
    try { await api.admin.setUserStatus(id, status); ui.notify.success(status === 'locked' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản'); ctx.reload(); } catch (e) { LMS.handleError(e); }
  }
  function userForm(ctx, u) {
    const meta = ctx.data.meta; const me = LMS.apiCore.me();
    const st = u ? { ...u } : { name: '', email: '', title: '', unitId: me.adminScope || meta.units[0].id, groupId: '', role: 'learner', adminScope: null };
    const body = () => html`<form class="stack" id="uf" novalidate>${UI.Field({ label: 'Họ và tên', name: 'name', value: st.name, required: true })}${UI.Field({ label: 'Email đăng nhập', name: 'email', type: 'email', value: st.email, required: true })}${UI.Field({ label: 'Chức danh', name: 'title', value: st.title })}
      <div class="form-grid">${UI.Field({ label: 'Đơn vị', name: 'unitId', type: 'select', required: true, value: st.unitId, options: meta.units.map((x) => ({ value: x.id, label: x.name })) })}${UI.Field({ label: 'Phòng / nhóm', name: 'groupId', type: 'select', required: true, value: st.groupId, options: [{ value: '', label: '— Chọn —' }, ...meta.groups.filter((g) => g.unitId === st.unitId).map((g) => ({ value: g.id, label: g.name }))] })}</div>
      ${UI.Field({ label: 'Vai trò', name: 'role', type: 'select', required: true, value: st.role, options: ROLE_OPTS })}
      ${st.role === 'admin' ? UI.Field({ label: 'Phạm vi quản trị', name: 'adminScope', type: 'select', value: st.adminScope || '', options: [...(me.adminScope ? [] : [{ value: '', label: 'Toàn hệ thống' }]), ...meta.allUnits.filter((x) => !me.adminScope || x.id === me.adminScope).map((x) => ({ value: x.id, label: `Chỉ đơn vị: ${x.name}` }))], help: 'Quản trị viên đơn vị chỉ xem và sửa dữ liệu trong đơn vị được giao.' }) : ''}
      <div class="alert">${icon('shield')}<div class="text-sm">Quyền được kiểm tra ở lớp dữ liệu/API. Quản trị viên đơn vị không thể tạo người dùng ngoài đơn vị hoặc cấp quyền toàn hệ thống.</div></div></form>`;
    const d = ui.drawer({ title: u ? `Sửa ${u.name}` : 'Thêm người dùng', body: body(), footer: html`${u ? html`<button class="btn btn--ghost" data-reset style="margin-right:auto">${icon('key', 'icon--sm')}Đặt lại mật khẩu</button>` : ''}<button class="btn btn--ghost" data-x>Hủy</button><button class="btn btn--primary" data-ok>Lưu</button>` });
    const sync = () => Object.assign(st, ui.readForm(d.el.querySelector('#uf')));
    d.el.addEventListener('change', (e) => { if (e.target.name === 'unitId' || e.target.name === 'role') { sync(); if (e.target.name === 'unitId') st.groupId = ''; d.el.querySelector('.drawer__body').innerHTML = String(body()); } });
    d.el.querySelector('[data-x]').onclick = d.close;
    const rs = d.el.querySelector('[data-reset]'); if (rs) rs.onclick = async () => { try { const r = await api.admin.resetPassword(u.id); ui.notify.success('Đã gửi liên kết đặt lại mật khẩu', r.sentTo); } catch (e) { LMS.handleError(e); } };
    d.el.querySelector('[data-ok]').onclick = async (e) => { sync(); const f = d.el.querySelector('#uf'); ui.clearErrors(f); await ui.busy(e.currentTarget, async () => { try { await api.admin.saveUser({ ...st, adminScope: st.adminScope || null }); d.close(); ui.notify.success(u ? 'Đã cập nhật người dùng' : 'Đã thêm người dùng'); ctx.reload(); } catch (err) { LMS.handleError(err, f); } }); };
  }

  /* ======================= CHI TIẾT NGƯỜI DÙNG ======================= */
  LMS.page('userDetail', {
    title: (ctx) => (ctx.data ? ctx.data.user.name : 'Người dùng'), initState: () => ({ tab: 'courses' }),
    load: async (ctx) => ({ ...(await api.admin.user(ctx.params.id)), meta: await api.admin.meta() }),
    view: (d, ctx) => {
      const u = d.user; const me = LMS.apiCore.me();
      return html`<div class="page">${UI.Breadcrumb([{ label: 'Người dùng', href: '#/admin/users' }, { label: u.name }])}
      <section class="card card--pad row" style="--gap:20px">${UI.Avatar(u.name, 'xl')}<div class="grow stack" style="--gap:6px"><h1 style="font-size:var(--text-xl)">${u.name}</h1><div class="row">${UI.RoleBadge(u.role, !!u.adminScope)}${UI.AccountStatus(u.status)}<span class="text-sm text-muted">${u.email} · ${u.staffCode} · ${u.unitName} / ${u.groupName}</span></div><span class="text-xs text-muted">Tham gia ${fmt.date(u.joinedAt)} · Đăng nhập cuối ${u.lastLoginAt ? fmt.relative(u.lastLoginAt) : 'chưa'}</span></div>
        <div class="row">${UI.Button({ label: 'Sửa', icon: 'edit', action: 'edit' })}${u.id !== me.id ? (u.status === 'active' ? UI.Button({ label: 'Khóa tài khoản', icon: 'lock', variant: 'danger-ghost', action: 'lock' }) : UI.Button({ label: 'Mở khóa', icon: 'unlock', action: 'unlock' })) : ''}</div></section>
      <div class="card mt-6">${UI.Tabs([{ id: 'courses', label: 'Khóa học được giao', count: d.courses.length }, { id: 'attempts', label: 'Lịch sử thi', count: d.attempts.length }, { id: 'competency', label: 'Năng lực' }, { id: 'perms', label: 'Vai trò & quyền' }, { id: 'audit', label: 'Hoạt động' }], ctx.state.tab)}
      ${ctx.state.tab === 'courses' ? UI.DataTable({ id: 'uc', rows: d.courses, empty: UI.Empty({ icon: 'book', title: 'Chưa được giao khóa học', action: UI.Button({ label: 'Giao khóa học', variant: 'primary', href: '#/admin/assignments' }) }), columns: [
        { key: 'title', label: 'Khóa học', render: (r) => html`<div class="table__primary">${r.title}</div><div class="table__sub">${r.code} · ${r.required ? 'Bắt buộc' : 'Tự chọn'}</div>` },
        { key: 'pct', label: 'Tiến độ', render: (r) => html`<div style="min-width:110px">${UI.Progress(r.pct, { sm: true })}<span class="text-xs num">${r.pct}%</span></div>` },
        { key: 'status', label: 'Trạng thái', render: (r) => UI.CourseStatus(r.status, r.overdue) },
        { key: 'dueAt', label: 'Hạn', render: (r) => UI.Due(r.dueAt, r.status === 'completed') },
        { key: 'lastAccessAt', label: 'Truy cập', render: (r) => fmt.relative(r.lastAccessAt) },
        { key: 'quiz', label: 'Điểm cao nhất', sortValue: (r) => (r.quiz ? r.quiz.best : null), render: (r) => (r.quiz && r.quiz.best != null ? html`${r.quiz.best}% <span class="table__sub">${r.quiz.attempts}/${r.quiz.maxAttempts} lượt</span>` : '—') },
        { key: 'assignmentId', label: '', sort: false, cls: 'col-actions', render: (r) => (r.assignmentId ? UI.Button({ label: 'Gia hạn', icon: 'calendar', size: 'sm', variant: 'ghost', action: 'extend', attrs: `data-course="${r.id}"` }) : '') },
      ] }) : ''}
      ${ctx.state.tab === 'attempts' ? UI.DataTable({ id: 'ua', rows: d.attempts, rowAction: (r) => `#/quiz/x/result/${r.id}`, empty: UI.Empty({ icon: 'clipboard', title: 'Chưa có lần thi' }), columns: [{ key: 'title', label: 'Bài kiểm tra' }, { key: 'at', label: 'Ngày', render: (r) => fmt.datetime(r.at) }, { key: 'score', label: 'Điểm', render: (r) => html`<strong class="num">${r.score}%</strong>` }, { key: 'passed', label: 'Kết quả', render: (r) => UI.Badge(r.passed ? 'Đạt' : 'Chưa đạt', r.passed ? 'success' : 'danger') }] }) : ''}
      ${ctx.state.tab === 'competency' ? html`<div class="card__body" style="max-width:520px">${Charts.Radar({ data: d.competency, seriesLabel: 'Học viên (lần thi tốt nhất)' })}</div>` : ''}
      ${ctx.state.tab === 'perms' ? html`<div class="card__body stack" style="--gap:16px"><p class="text-sm">Vai trò <strong>${LMS.apiCore.ROLE_LABEL[u.role]}</strong>${u.adminScope ? html` — phạm vi <strong>${(d.meta.allUnits.find((x) => x.id === u.adminScope) || {}).name}</strong>` : ''}. Ma trận quyền (chỉ đọc):</p>${permMatrix(u.role)}</div>` : ''}
      ${ctx.state.tab === 'audit' ? (d.audit.length ? html`<ul class="list">${d.audit.map((a) => html`<li class="list__item text-sm"><span class="list__icon">${icon('history', 'icon--sm')}</span><span class="grow">${a.detail} — <span class="text-muted">${a.target}</span></span><span class="text-xs text-muted">${fmt.datetime(a.at)}</span></li>`)}</ul>` : UI.Empty({ icon: 'history', title: 'Chưa có hoạt động' })) : ''}
      </div></div>`;
    },
    actions: {
      tab: (el, ctx) => { ctx.state.tab = el.dataset.id; ctx.rerender(); },
      edit: (el, ctx) => userForm({ ...ctx, data: { meta: ctx.data.meta } , reload: ctx.reload }, ctx.data.user),
      lock: (el, ctx) => setStatus(ctx, ctx.data.user.id, 'locked'),
      unlock: (el, ctx) => setStatus(ctx, ctx.data.user.id, 'active'),
      extend: async (el, ctx) => {
        const c = ctx.data.courses.find((x) => x.id === el.dataset.course); const def = new Date(Math.max(Date.now(), new Date(c.dueAt).getTime()) + 7 * 86400000).toISOString().slice(0, 10);
        const ok = await ui.modal({ title: `Gia hạn "${c.title}" cho ${ctx.data.user.name}`, icon: 'calendar', body: html`<form class="stack" novalidate><p>Tạo lượt giao riêng cho cá nhân với hạn mới (không ảnh hưởng người khác).</p>${UI.Field({ label: 'Hạn mới', name: 'due', type: 'date', value: def, required: true })}</form>`, actions: [{ label: 'Hủy', variant: 'ghost', value: null }, { label: 'Gia hạn', variant: 'primary', handler: async (ov) => { const due = ov.querySelector('[name=due]').value; await api.admin.saveAssignment({ courseId: c.id, targetType: 'user', targetId: ctx.data.user.id, startAt: new Date().toISOString(), dueAt: due + 'T17:00:00' }); return true; } }] });
        if (ok) { ui.notify.success('Đã gia hạn', 'Học viên nhận được thông báo.'); ctx.reload(); }
      },
    },
  });
  function permMatrix(role) {
    const F = [['Học, làm bài, xem tiến độ cá nhân', 'learn'], ['Tạo/sửa khóa học, bài học, tài liệu', 'content.write'], ['Ngân hàng câu hỏi & bài kiểm tra', 'question.write'], ['Trả lời phản hồi học viên', 'feedback.reply'], ['Xem báo cáo', 'reports.read'], ['Quản lý người dùng', 'users.manage'], ['Quản lý đơn vị & nhóm', 'org.manage'], ['Giao học & hạn', 'assign.manage'], ['Cấu hình hệ thống, sao lưu', 'system.manage']];
    const R = ['learner', 'instructor', 'admin', 'viewer'];
    return html`<div class="table-wrap"><table class="table"><thead><tr><th>Chức năng</th>${R.map((r) => html`<th style="${r === role ? 'color:var(--color-primary)' : ''}">${LMS.apiCore.ROLE_LABEL[r]}</th>`)}</tr></thead><tbody>${F.map(([l, p]) => html`<tr><td>${l}</td>${R.map((r) => html`<td>${LMS.apiCore.PERMS[r].includes(p) ? html`<span class="text-success">${icon('check', '', 'Có')}</span>` : html`<span class="text-muted">${icon('minus', '', 'Không')}</span>`}</td>`)}</tr>`)}</tbody></table></div>`;
  }
  LMS.permMatrix = permMatrix;

  /* ======================= ĐƠN VỊ & NHÓM ======================= */
  LMS.page('org', {
    title: 'Đơn vị & nhóm', initState: () => ({ sel: null }),
    load: () => api.admin.org(),
    view: (units, ctx) => {
      const me = LMS.apiCore.me(); const u = units.find((x) => x.id === ctx.state.sel) || units[0];
      return html`<div class="page page--wide">${UI.PageHeader({ eyebrow: 'Tổ chức', title: 'Đơn vị, phòng & nhóm', desc: 'Mô hình nhiều đơn vị: mỗi đơn vị có quản trị viên riêng, dữ liệu tách biệt; khóa học được chia sẻ giữa các đơn vị.', actions: html`${UI.Button({ label: 'Nhập từ tệp', icon: 'upload', href: '#/admin/import?type=org' })}${!me.adminScope ? UI.Button({ label: 'Thêm đơn vị', icon: 'plus', variant: 'primary', action: 'add-unit' }) : ''}` })}
      <div class="split"><section class="card" aria-label="Danh sách đơn vị"><ul class="list">${units.map((x) => html`<li><button class="list__item" data-action="pick" data-id="${x.id}" ${u && u.id === x.id ? raw('aria-current="true" style="background:var(--color-primary-subtle)"') : ''}><span class="list__icon">${icon('building', 'icon--sm')}</span><span class="grow"><span class="fw-600 text-sm">${x.name}</span><br><span class="text-xs text-muted">${x.code} · ${x.members} người · ${x.groups.length} nhóm</span></span>${x.status !== 'active' ? UI.Badge('Tạm dừng', 'warning') : ''}</button></li>`)}</ul></section>
      ${u ? html`<section class="stack" style="--gap:20px"><div class="card card--pad row-between"><div><span class="eyebrow">${u.code}</span><h2 style="font-size:var(--text-xl)">${u.name}</h2><div class="text-sm text-muted mt-2">Quản trị viên: ${u.admins.length ? u.admins.map((a) => `${a.name} (${a.scope})`).join(', ') : 'chưa gán'}</div></div><div class="row">${UI.Button({ label: 'Sửa', icon: 'edit', action: 'edit-unit' })}${!me.adminScope ? (u.status === 'active' ? UI.Button({ label: 'Tạm dừng', icon: 'pause-circle', variant: 'ghost', action: 'unit-status', attrs: 'data-s="paused"' }) : UI.Button({ label: 'Kích hoạt', icon: 'check', action: 'unit-status', attrs: 'data-s="active"' })) : ''}</div></div>
        <div class="row-between"><h3>Phòng / nhóm (${u.groups.length})</h3>${UI.Button({ label: 'Thêm phòng/nhóm', icon: 'plus', size: 'sm', action: 'add-group' })}</div>
        <div class="grid grid-2">${u.groups.map((g) => html`<div class="card"><div class="card__header"><div><strong>${g.name}</strong><div class="text-xs text-muted">${g.kind === 'department' ? 'Phòng' : 'Nhóm'} · ${g.members.length} thành viên</div></div><div class="row" style="--gap:4px">${UI.Button({ icon: 'edit', size: 'sm', variant: 'ghost', action: 'edit-group', attrs: `data-id="${g.id}"`, title: 'Đổi tên' })}${UI.Button({ icon: 'trash', size: 'sm', variant: 'danger-ghost', action: 'del-group', attrs: `data-id="${g.id}"`, title: 'Xóa nhóm' })}</div></div>${g.members.length ? html`<ul class="list">${g.members.slice(0, 5).map((m) => html`<li><a class="list__item text-sm" href="#/admin/users/${m.id}">${UI.Avatar(m.name, 'sm')}<span class="grow">${m.name}</span>${UI.RoleBadge(m.role)}</a></li>`)}${g.members.length > 5 ? html`<li class="list__item text-xs text-muted">+${g.members.length - 5} người khác</li>` : ''}</ul>` : html`<div class="card__body text-sm text-muted">Chưa có thành viên.</div>`}</div>`)}</div>
        ${UI.Card({ title: 'Khóa học được chia sẻ cho đơn vị này', body: u.sharedCourses.length ? html`<ul class="stack" style="--gap:6px;list-style:none;padding:0">${u.sharedCourses.map((c) => html`<li class="row text-sm">${icon('globe', 'icon--sm')}${c.title}</li>`)}</ul>` : html`<p class="text-sm text-muted">Chưa có. Chia sẻ tại màn Khóa học → Thao tác → Chia sẻ cho đơn vị.</p>` })}</section>` : ''}</div></div>`;
    },
    actions: {
      pick: (el, ctx) => { ctx.state.sel = el.dataset.id; ctx.rerender(); },
      'add-unit': (el, ctx) => simpleForm(ctx, 'Thêm đơn vị', [['code', 'Mã đơn vị'], ['name', 'Tên đơn vị']], {}, (d) => api.admin.saveUnit(d)),
      'edit-unit': (el, ctx) => { const u = ctx.data.find((x) => x.id === (ctx.state.sel || ctx.data[0].id)); simpleForm(ctx, 'Sửa đơn vị', [['code', 'Mã đơn vị'], ['name', 'Tên đơn vị']], u, (d) => api.admin.saveUnit({ ...d, id: u.id })); },
      'unit-status': async (el, ctx) => { const u = ctx.data.find((x) => x.id === (ctx.state.sel || ctx.data[0].id)); if (!(await ui.confirm({ title: `${el.dataset.s === 'paused' ? 'Tạm dừng' : 'Kích hoạt'} đơn vị ${u.name}?`, message: 'Thay đổi áp dụng ngay cho mọi người dùng thuộc đơn vị.', confirmLabel: 'Xác nhận', tone: 'warning' }))) return; try { await api.admin.setUnitStatus(u.id, el.dataset.s); ui.notify.success('Đã cập nhật'); ctx.reload(); } catch (e) { LMS.handleError(e); } },
      'add-group': (el, ctx) => { const u = ctx.data.find((x) => x.id === (ctx.state.sel || ctx.data[0].id)); simpleForm(ctx, `Thêm phòng/nhóm vào ${u.name}`, [['name', 'Tên phòng/nhóm']], {}, (d) => api.admin.saveGroup({ ...d, unitId: u.id })); },
      'edit-group': (el, ctx) => { const g = ctx.data.flatMap((u) => u.groups).find((x) => x.id === el.dataset.id); simpleForm(ctx, 'Đổi tên phòng/nhóm', [['name', 'Tên phòng/nhóm']], g, (d) => api.admin.saveGroup({ ...g, ...d })); },
      'del-group': async (el, ctx) => { if (!(await ui.confirm({ title: 'Xóa phòng/nhóm?', message: 'Chỉ xóa được nhóm không còn thành viên.', confirmLabel: 'Xóa', tone: 'danger' }))) return; try { await api.admin.deleteGroup(el.dataset.id); ui.notify.success('Đã xóa'); ctx.reload(); } catch (e) { LMS.handleError(e); } },
    },
  });
  function simpleForm(ctx, title, fields, data, save) {
    const d = ui.drawer({ title, body: html`<form class="stack" id="sf" novalidate>${fields.map(([k, l]) => UI.Field({ label: l, name: k, value: data[k] || '', required: true }))}</form>`, footer: html`<button class="btn btn--ghost" data-x>Hủy</button><button class="btn btn--primary" data-ok>Lưu</button>` });
    d.el.querySelector('[data-x]').onclick = d.close;
    d.el.querySelector('[data-ok]').onclick = async (e) => { const f = d.el.querySelector('#sf'); ui.clearErrors(f); await ui.busy(e.currentTarget, async () => { try { await save(ui.readForm(f)); d.close(); ui.notify.success('Đã lưu'); ctx.reload(); } catch (err) { LMS.handleError(err, f); } }); };
  }

  /* ======================= GIAO HỌC ======================= */
  LMS.page('assignments', {
    title: 'Giao học & hạn hoàn thành', initState: (info) => ({ course: info.query.course || '', open: null }),
    load: async () => ({ list: await api.admin.assignments(), meta: await api.admin.meta(), courses: await api.admin.courses() }),
    mount(ctx) { if (ctx.query.course && !ctx.state.opened) { ctx.state.opened = true; assignForm(ctx, { courseId: ctx.query.course }); } },
    view: ({ list, courses }, ctx) => {
      const rows = list.filter((a) => !ctx.state.course || a.courseId === ctx.state.course);
      return html`<div class="page page--wide">${UI.PageHeader({ eyebrow: 'Tổ chức', title: 'Giao học & hạn hoàn thành', desc: 'Giao khóa học cho cá nhân, nhóm, phòng hoặc đơn vị. Đổi hạn có hiệu lực ngay; danh sách, tiến độ và báo cáo tự cập nhật.', actions: UI.Button({ label: 'Giao khóa học', icon: 'plus', variant: 'primary', action: 'new' }) })}
      <section class="card"><div class="card__header"><div class="row">${UI.FilterSelect({ label: 'Khóa học', value: ctx.state.course, action: 'fcourse', options: courses.map((c) => ({ value: c.id, label: c.title })) })}</div><span class="text-sm text-muted">${rows.length} lượt giao</span></div>
      ${UI.DataTable({ id: 'as', state: ctx.state.tables.as, rows, caption: 'Lượt giao khóa học', empty: UI.Empty({ icon: 'calendar', title: 'Chưa có lượt giao', action: UI.Button({ label: 'Giao khóa học', variant: 'primary', action: 'new' }) }), columns: [
        { key: 'courseTitle', label: 'Khóa học', render: (r) => html`<div class="table__primary">${r.courseTitle}</div><div class="table__sub">${r.courseCode}</div>` },
        { key: 'targetName', label: 'Đối tượng', render: (r) => html`${UI.Badge({ unit: 'Đơn vị', group: 'Nhóm', user: 'Cá nhân' }[r.targetType], 'outline')} <span class="text-sm">${r.targetName}</span>` },
        { key: 'dueAt', label: 'Thời gian', render: (r) => html`<span class="text-xs">${fmt.date(r.startAt)} → </span>${UI.Due(r.dueAt, r.completed === r.people)}` },
        { key: 'people', label: 'Người', render: (r) => html`<span class="num">${r.people}</span>` },
        { key: 'pct', label: 'Tiến độ', render: (r) => html`<div style="min-width:120px">${UI.Progress(r.pct, { sm: true })}<span class="text-xs num">${r.pct}% · ${r.completed}/${r.people} xong</span></div>` },
        { key: 'overdue', label: 'Quá hạn', render: (r) => (r.overdue ? UI.Badge(`${r.overdue} người`, 'danger') : html`<span class="text-muted">0</span>`) },
        { key: 'id', label: '', sort: false, cls: 'col-actions', render: (r) => html`${UI.Button({ label: 'Nhắc học', icon: 'bell', size: 'sm', variant: 'ghost', action: 'remind', attrs: `data-id="${r.id}"`, disabled: r.completed === r.people })}${UI.Button({ label: 'Sửa hạn', icon: 'edit', size: 'sm', variant: 'ghost', action: 'edit', attrs: `data-id="${r.id}"` })}${UI.Button({ icon: 'trash', size: 'sm', variant: 'danger-ghost', action: 'revoke', attrs: `data-id="${r.id}"`, title: 'Thu hồi' })}` },
      ] })}</section></div>`;
    },
    actions: {
      fcourse: (el, ctx) => { ctx.state.course = el.value; ctx.rerender(); },
      new: (el, ctx) => assignForm(ctx, { courseId: ctx.state.course }),
      edit: (el, ctx) => assignForm(ctx, ctx.data.list.find((a) => a.id === el.dataset.id)),
      remind: async (el, ctx) => { await ui.busy(el, async () => { try { const n = await api.admin.remind(el.dataset.id); ui.notify.success(`Đã gửi nhắc ${n} học viên`, 'Học viên nhận thông báo trong ứng dụng.'); } catch (e) { LMS.handleError(e); } }); },
      revoke: async (el, ctx) => { if (!(await ui.confirm({ title: 'Thu hồi lượt giao?', message: 'Học viên không còn bị yêu cầu học khóa này. Tiến độ đã học vẫn được giữ.', confirmLabel: 'Thu hồi', tone: 'danger' }))) return; try { await api.admin.revokeAssignment(el.dataset.id); ui.notify.success('Đã thu hồi'); ctx.reload(); } catch (e) { LMS.handleError(e); } },
    },
  });
  function assignForm(ctx, a) {
    const { meta, courses } = ctx.data; const st = { targetType: 'unit', targetId: '', startAt: new Date().toISOString().slice(0, 10), dueAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), ...a, ...(a.startAt ? { startAt: a.startAt.slice(0, 10), dueAt: a.dueAt.slice(0, 10) } : {}) };
    const opts = () => (st.targetType === 'unit' ? meta.units.map((u) => ({ value: u.id, label: u.name })) : st.targetType === 'group' ? meta.groups.map((g) => ({ value: g.id, label: g.name })) : meta.users.map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` })));
    const body = () => html`<form class="stack" id="af" novalidate>${UI.Field({ label: 'Khóa học', name: 'courseId', type: 'select', required: true, value: st.courseId, options: [{ value: '', label: '— Chọn khóa học —' }, ...courses.filter((c) => c.status === 'published').map((c) => ({ value: c.id, label: `${c.code} · ${c.title}` }))] })}
      <fieldset class="field" style="border:0;padding:0"><legend class="field__label">Giao cho</legend><div class="segmented" role="radiogroup">${[['unit', 'Đơn vị'], ['group', 'Phòng/nhóm'], ['user', 'Cá nhân']].map(([v, l]) => html`<button type="button" role="radio" aria-checked="${st.targetType === v}" data-tt="${v}">${l}</button>`)}</div></fieldset>
      ${UI.Field({ label: 'Đối tượng', name: 'targetId', type: 'select', required: true, value: st.targetId, options: [{ value: '', label: '— Chọn —' }, ...opts()] })}
      <div class="form-grid">${UI.Field({ label: 'Ngày bắt đầu', name: 'startAt', type: 'date', value: st.startAt })}${UI.Field({ label: 'Hạn hoàn thành', name: 'dueAt', type: 'date', required: true, value: st.dueAt })}</div>
      <label class="switch"><input type="checkbox" name="remind" ${st.remind !== false ? raw('checked') : ''}>Nhắc học trước hạn ${meta.settings.remindDaysBefore} ngày</label></form>`;
    const d = ui.drawer({ title: a.id ? 'Sửa lượt giao' : 'Giao khóa học', body: body(), footer: html`<button class="btn btn--ghost" data-x>Hủy</button><button class="btn btn--primary" data-ok>${a.id ? 'Lưu' : 'Giao khóa học'}</button>` });
    const sync = () => Object.assign(st, ui.readForm(d.el.querySelector('#af')));
    d.el.addEventListener('click', (e) => { const b = e.target.closest('[data-tt]'); if (b) { sync(); st.targetType = b.dataset.tt; st.targetId = ''; d.el.querySelector('.drawer__body').innerHTML = String(body()); } });
    d.el.querySelector('[data-x]').onclick = d.close;
    d.el.querySelector('[data-ok]').onclick = async (e) => { sync(); const f = d.el.querySelector('#af'); ui.clearErrors(f); await ui.busy(e.currentTarget, async () => { try { await api.admin.saveAssignment({ ...st, id: a.id, startAt: st.startAt ? new Date(st.startAt).toISOString() : null, dueAt: st.dueAt ? st.dueAt + 'T17:00:00' : '' }); d.close(); ui.notify.success(a.id ? 'Đã cập nhật hạn' : 'Đã giao khóa học', 'Học viên nhận thông báo; báo cáo tự cập nhật.'); ctx.reload(); } catch (err) { LMS.handleError(err, f); } }); };
  }

  /* ======================= HỆ THỐNG & NHẬT KÝ ======================= */
  LMS.page('system', {
    title: 'Hệ thống & nhật ký', initState: (info) => ({ tab: info.query.tab || 'audit', q: '' }),
    load: () => api.admin.system(),
    view: (d, ctx) => {
      const s = ctx.state; const u = d.settings.upload;
      return html`<div class="page page--wide">${UI.PageHeader({ eyebrow: 'Quản trị', title: 'Hệ thống & nhật ký', desc: 'Theo dõi hoạt động, cấu hình giới hạn tệp, quản lý tệp lỗi và sao lưu / xuất dữ liệu phục vụ bàn giao.' })}
      <div class="card">${UI.Tabs([{ id: 'audit', label: 'Nhật ký hoạt động', icon: 'history' }, { id: 'files', label: 'Tệp & lưu trữ', icon: 'database', count: d.files.filter((f) => f.state !== 'ok').length || null }, { id: 'config', label: 'Cấu hình', icon: 'settings' }, { id: 'backup', label: 'Sao lưu & xuất dữ liệu', icon: 'archive' }], s.tab)}
      ${s.tab === 'audit' ? html`<div class="card__body">${UI.Search({ value: s.q, action: 'fq', placeholder: 'Lọc theo người, thao tác, đối tượng…', label: 'Lọc nhật ký' })}</div>${UI.DataTable({ id: 'au', state: s.tables.au, pageSize: 12, rows: d.audit.filter((a) => !s.q || (a.userName + a.action + a.target + a.detail).toLowerCase().includes(s.q.toLowerCase())), caption: 'Nhật ký hoạt động', columns: [{ key: 'at', label: 'Thời gian', render: (r) => html`<span class="text-sm num">${fmt.datetime(r.at)}</span>` }, { key: 'userName', label: 'Người thực hiện' }, { key: 'action', label: 'Thao tác', render: (r) => UI.Badge(r.action, 'outline') }, { key: 'target', label: 'Đối tượng' }, { key: 'detail', label: 'Chi tiết', render: (r) => html`<span class="text-sm text-secondary">${r.detail}</span>` }] })}` : ''}
      ${s.tab === 'files' ? html`<div class="card__body"><div class="alert">${icon('shield')}<div class="text-sm">Tệp lưu trên kho lưu trữ có phân quyền; học viên nhận đường dẫn ký số (signed URL) có thời hạn. Upload kiểm tra phần mở rộng + MIME + dung lượng ở cả client và server.</div></div></div>${UI.DataTable({ id: 'fl', rows: d.files, caption: 'Tệp', columns: [{ key: 'name', label: 'Tệp', render: (r) => html`<span class="mono text-sm">${r.name}</span>` }, { key: 'size', label: 'Dung lượng', render: (r) => fmt.bytes(r.size) }, { key: 'usedIn', label: 'Dùng trong', sort: false, render: (r) => html`<span class="text-sm">${r.usedIn.join(', ') || '—'}</span>` }, { key: 'state', label: 'Trạng thái', render: (r) => (r.state === 'ok' ? UI.Badge('Bình thường', 'success badge--dot') : UI.Badge('Thiếu / lỗi', 'danger badge--dot')) }, { key: 'id', label: '', sort: false, cls: 'col-actions', render: (r) => (r.state !== 'ok' ? UI.Button({ label: 'Thay thế tệp', icon: 'upload', size: 'sm', variant: 'primary', action: 'replace', attrs: `data-id="${r.id}"` }) : '') }] })}` : ''}
      ${s.tab === 'config' ? html`<form class="card__body stack" style="--gap:20px;max-width:760px" data-submit="save-config" novalidate ${!d.global ? raw('inert') : ''}>${!d.global ? html`<div class="alert alert--warning">${icon('lock')}<div>Chỉ quản trị toàn hệ thống được đổi cấu hình.</div></div>` : ''}
        <h3>Giới hạn tải lên</h3><div class="form-grid">${[['maxPdfMB', 'PDF tối đa'], ['maxVideoMB', 'Video tối đa'], ['maxImageMB', 'Hình ảnh tối đa'], ['maxAttachMB', 'Tệp đính kèm tối đa']].map(([k, l]) => html`<div class="field"><label class="field__label" for="cf-${k}">${l}</label><div class="input-group"><input class="input num" type="number" id="cf-${k}" name="${k}" value="${u[k]}" min="1"><span class="input-group__addon">MB</span></div></div>`)}</div>
        <div class="field"><span class="field__label">Định dạng cho phép</span><div class="row" style="--gap:6px">${u.allowed.map((x) => UI.Badge('.' + x, 'outline'))}</div></div>
        <h3>Phiên & nhắc học</h3><div class="form-grid"><div class="field"><label class="field__label" for="cf-r">Nhắc trước hạn</label><div class="input-group"><input class="input num" type="number" id="cf-r" name="remindDaysBefore" value="${d.settings.remindDaysBefore}" min="0"><span class="input-group__addon">ngày</span></div></div><div class="field"><label class="field__label" for="cf-s">Hết phiên sau</label><div class="input-group"><input class="input num" type="number" id="cf-s" name="sessionMinutes" value="${d.settings.sessionMinutes}" min="5"><span class="input-group__addon">phút</span></div></div></div>
        <div class="row" style="justify-content:flex-end">${UI.Button({ label: 'Lưu cấu hình', variant: 'primary', type: 'submit' })}</div></form>` : ''}
      ${s.tab === 'backup' ? html`<div class="card__body grid grid-2"><section class="card card--pad stack" style="--gap:12px"><h3>Sao lưu</h3><p class="text-sm text-secondary">Sao lưu tự động hằng ngày lúc 02:00, giữ ${d.settings.backupRetentionDays} ngày. Lần gần nhất: <strong>${fmt.datetime(d.settings.lastBackupAt)}</strong>.</p>${UI.Button({ label: 'Sao lưu ngay', icon: 'archive', variant: 'primary', action: 'backup' })}<p class="text-xs text-muted">Phục hồi: xem "Hướng dẫn sao lưu & phục hồi" trong tài liệu bàn giao.</p></section>
        <section class="card card--pad stack" style="--gap:12px"><h3>Xuất dữ liệu (không khóa nhà cung cấp)</h3><p class="text-sm text-secondary">Xuất toàn bộ dữ liệu dạng JSON chuẩn để chuyển sang nền tảng/CSDL tương đương.</p><div class="grid grid-3" style="--gap:8px">${Object.entries(d.stats).map(([k, v]) => html`<div class="card" style="padding:8px 10px"><div class="num fw-700">${v}</div><div class="text-xs text-muted">${k}</div></div>`)}</div>${UI.Button({ label: 'Xuất JSON', icon: 'download', action: 'export' })}</section></div>` : ''}
      </div></div>`;
    },
    actions: {
      tab: (el, ctx) => { ctx.state.tab = el.dataset.id; ctx.rerender(); },
      fq: (el, ctx) => { ctx.state.q = el.value; ctx.rerender(); },
      replace: async (el, ctx) => { await ui.busy(el, async () => { try { await api.admin.replaceFile(el.dataset.id); ui.notify.success('Đã thay thế tệp', 'Báo cáo lỗi liên quan được đánh dấu đã xử lý.'); ctx.reload(); } catch (e) { LMS.handleError(e); } }); },
      'save-config': async (form, ctx) => { ui.clearErrors(form); const v = ui.readForm(form); await ui.busy(form.querySelector('[type=submit]'), async () => { try { await api.admin.saveSettings({ upload: { maxPdfMB: v.maxPdfMB, maxVideoMB: v.maxVideoMB, maxImageMB: v.maxImageMB, maxAttachMB: v.maxAttachMB }, remindDaysBefore: v.remindDaysBefore, sessionMinutes: v.sessionMinutes }); ui.notify.success('Đã lưu cấu hình', 'Có hiệu lực ngay, không cần triển khai lại.'); ctx.reload(); } catch (e) { LMS.handleError(e, form); } }); },
      backup: async (el, ctx) => { await ui.busy(el, async () => { try { await api.admin.backup(); ui.notify.success('Sao lưu thành công'); ctx.reload(); } catch (e) { LMS.handleError(e); } }); },
      export: async (el) => { await ui.busy(el, async () => { try { const data = await api.admin.exportAll(); ui.download(`cbacademy-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json'); ui.notify.success('Đã xuất dữ liệu'); } catch (e) { LMS.handleError(e); } }); },
    },
  });
})(window.LMS);
