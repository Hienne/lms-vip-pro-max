/* ==========================================================================
   pages/admin-content.js — Tổng quan QTV, Cây nội dung, Danh sách khóa học, Wizard khóa học
   ========================================================================== */
(function (LMS) {
  const { html, raw, icon, UI, Charts, fmt, ui, api, attr } = LMS;
  const STATUS_OPTS = [{ value: 'draft', label: 'Nháp' }, { value: 'published', label: 'Đã xuất bản' }, { value: 'paused', label: 'Tạm dừng' }, { value: 'locked', label: 'Đã khóa' }];

  /* ======================= TỔNG QUAN QTV ======================= */
  LMS.page('adminHome', {
    title: 'Tổng quan quản trị',
    load: () => api.admin.overview(),
    view: (d) => html`<div class="page">${UI.PageHeader({ eyebrow: 'Quản trị', title: 'Tổng quan đào tạo', desc: html`Phạm vi dữ liệu: <strong>${d.scope}</strong>. Mọi số liệu tính trực tiếp từ dữ liệu, tự cập nhật khi có thay đổi.`, actions: html`${UI.Button({ label: 'Tạo khóa học', icon: 'plus', variant: 'primary', href: '#/admin/courses/new' })}${UI.Button({ label: 'Nhập dữ liệu', icon: 'upload', href: '#/admin/import' })}${UI.Button({ label: 'Giao học', icon: 'calendar', href: '#/admin/assignments' })}` })}
      <div class="grid grid-4">${UI.Kpi({ icon: 'users', value: d.kpi.active, suffix: `/${d.kpi.learners}`, label: 'Học viên đang hoạt động', href: '#/admin/users' })}${UI.Kpi({ icon: 'chart', value: d.kpi.completion, suffix: '%', label: 'Tỷ lệ hoàn thành TB', href: '#/reports' })}${UI.Kpi({ icon: 'alert', tone: d.kpi.overdue ? 'danger' : '', value: d.kpi.overdue, label: 'Lượt học quá hạn', href: '#/reports/status' })}${UI.Kpi({ icon: 'clipboard', tone: 'info', value: d.kpi.avgScore, suffix: '%', label: `Điểm thi TB · đạt ${d.kpi.passRate}%`, href: '#/reports/results' })}</div>
      <div class="dash-grid mt-6">
        ${UI.Card({ title: 'Tỷ lệ hoàn thành theo phòng/nhóm', actions: html`<a class="link-btn" href="#/reports/groups">Chi tiết</a>`, body: Charts.HBars(d.byGroup) })}
        <div class="stack" style="--gap:24px">${UI.Card({ title: 'Cần chú ý', pad: false, body: d.attention.length ? html`<ul class="list">${d.attention.map((a) => html`<li><a class="list__item" href="${a.href}"><span class="list__icon" style="color:var(--color-${a.kind === 'overdue' ? 'danger' : 'warning'})">${icon(a.kind === 'overdue' ? 'clock' : a.kind === 'file' ? 'file' : 'flag', 'icon--sm')}</span><span class="text-sm grow">${a.text}</span>${icon('chevron-right', 'icon--sm')}</a></li>`)}</ul>` : html`<div class="card__body">${UI.Empty({ icon: 'check-circle', title: 'Không có vấn đề cần xử lý' })}</div>` })}
          ${UI.Card({ title: 'Nội dung', body: html`<div class="row-between text-sm"><span>Khóa đã xuất bản</span><strong class="num">${d.kpi.courses}</strong></div><div class="row-between text-sm mt-2"><span>Khóa đang nháp</span><strong class="num">${d.kpi.drafts}</strong></div><a class="link-btn mt-4" href="#/admin/courses">Quản lý khóa học</a>` })}</div></div>
      ${UI.Card({ title: 'Hoạt động gần đây', cls: 'mt-6', pad: false, actions: html`<a class="link-btn" href="#/admin/system">Nhật ký đầy đủ</a>`, body: html`<ul class="list">${d.recent.map((a) => html`<li class="list__item"><span class="list__icon">${icon('history', 'icon--sm')}</span><span class="grow text-sm"><strong>${a.userName}</strong> · ${a.detail} — <span class="text-muted">${a.target}</span></span><span class="text-xs text-muted">${fmt.relative(a.at)}</span></li>`)}</ul>` })}</div>`,
  });

  /* ======================= CÂY NỘI DUNG ======================= */
  LMS.page('adminCatalog', {
    title: 'Lĩnh vực & chương trình', initState: () => ({ sel: null, open: {} }),
    load: () => api.admin.tree(),
    view: (tree, ctx) => {
      const s = ctx.state; const all = []; tree.forEach((d) => { all.push(d); d.children.forEach((p) => { all.push(p); p.children.forEach((c) => all.push(c)); }); });
      const sel = all.find((n) => n.id === s.sel) || tree[0];
      const node = (n, lvl) => html`<li><button class="tree__node" role="treeitem" aria-level="${lvl}" aria-selected="${sel && sel.id === n.id}" ${n.children ? raw(`aria-expanded="${s.open[n.id] !== false}"`) : ''} data-action="pick" data-id="${n.id}"><span class="tree__toggle" ${n.children ? raw(`data-action="toggle" data-id="${n.id}"`) : ''}>${n.children && n.children.length ? icon(s.open[n.id] === false ? 'chevron-right' : 'chevron-down', 'icon--sm') : ''}</span>${icon(n.type === 'domain' ? 'layers' : n.type === 'program' ? 'tree' : 'book', 'icon--sm')}<span class="grow truncate">${n.name}</span>${n.status !== 'published' ? UI.PublishStatus(n.status) : ''}</button>${n.children && n.children.length && s.open[n.id] !== false ? html`<ul class="tree" role="group">${n.children.map((c) => node(c, lvl + 1))}</ul>` : ''}</li>`;
      const label = { domain: 'Lĩnh vực', program: 'Chương trình', course: 'Khóa học' };
      return html`<div class="page page--wide">${UI.PageHeader({ eyebrow: 'Nội dung', title: 'Lĩnh vực → Chương trình → Khóa học', desc: 'Cấu trúc đào tạo được quản lý hoàn toàn bằng dữ liệu — thêm, sửa, sao chép, xuất bản hay tạm dừng mà không cần sửa mã nguồn.', actions: html`${UI.Button({ label: 'Thêm lĩnh vực', icon: 'plus', variant: 'primary', action: 'add-domain' })}` })}
      <div class="split">
        <section class="card card--pad" aria-label="Cây nội dung">${UI.Search({ placeholder: 'Tìm trong cây…', action: 'tree-q', label: 'Tìm trong cây nội dung', width: '100%' })}<ul class="tree mt-4" role="tree" aria-label="Cây nội dung">${tree.filter((d) => !s.q || JSON.stringify(d).toLowerCase().includes(s.q)).map((d) => node(d, 1))}</ul></section>
        ${sel ? html`<section class="card" aria-label="Chi tiết">
          <div class="card__header"><div class="stack" style="--gap:4px"><span class="eyebrow">${label[sel.type]} · ${sel.code}</span><h2 style="font-size:var(--text-xl)">${sel.name}</h2></div>${UI.PublishStatus(sel.status)}</div>
          <div class="card__body stack" style="--gap:20px">
            ${sel.desc ? html`<p class="text-secondary">${sel.desc}</p>` : ''}
            ${sel.children ? html`<div><div class="eyebrow mb-2">${sel.type === 'domain' ? 'Chương trình' : 'Khóa học'} (${sel.children.length})</div>${sel.children.length ? html`<ul class="list card">${sel.children.map((c) => html`<li><button class="list__item" data-action="pick" data-id="${c.id}">${icon(c.type === 'program' ? 'tree' : 'book', 'icon--sm')}<span class="grow text-sm">${c.name}</span>${UI.PublishStatus(c.status)}</button></li>`)}</ul>` : html`<p class="text-sm text-muted">Chưa có mục con.</p>`}</div>` : ''}
            <div class="stack" style="--gap:10px"><div class="eyebrow">Thao tác</div><div class="row" style="--gap:8px">
              ${sel.type === 'domain' ? UI.Button({ label: 'Thêm chương trình', icon: 'plus', variant: 'primary', action: 'add-program', attrs: `data-id="${sel.id}"` }) : ''}
              ${sel.type === 'program' ? UI.Button({ label: 'Thêm khóa học', icon: 'plus', variant: 'primary', href: `#/admin/courses/new?program=${sel.id}` }) : ''}
              ${sel.type === 'course' ? UI.Button({ label: 'Sửa khóa học', icon: 'edit', variant: 'primary', href: `#/admin/courses/${sel.id}/edit` }) : UI.Button({ label: 'Sửa', icon: 'edit', action: 'edit', attrs: `data-id="${sel.id}" data-type="${sel.type}"` })}
              ${sel.type !== 'domain' ? UI.Button({ label: 'Sao chép', icon: 'copy', action: 'dup', attrs: `data-id="${sel.id}" data-type="${sel.type}"` }) : ''}
              ${sel.status !== 'published' ? UI.Button({ label: 'Xuất bản', icon: 'check', action: 'status', attrs: `data-id="${sel.id}" data-type="${sel.type}" data-s="published"` }) : UI.Button({ label: 'Tạm dừng', icon: 'pause-circle', action: 'status', attrs: `data-id="${sel.id}" data-type="${sel.type}" data-s="paused"` })}
              ${sel.status !== 'locked' ? UI.Button({ label: 'Khóa', icon: 'lock', variant: 'ghost', action: 'status', attrs: `data-id="${sel.id}" data-type="${sel.type}" data-s="locked"` }) : ''}
              ${UI.Button({ label: 'Xóa', icon: 'trash', variant: 'danger-ghost', action: 'del', attrs: `data-id="${sel.id}" data-type="${sel.type}"` })}</div>
              <p class="text-xs text-muted">Tạm dừng: học viên không thấy nội dung mới nhưng giữ tiến độ. Khóa: ngừng hoàn toàn, chỉ quản trị viên xem được.</p></div>
          </div></section>` : ''}</div></div>`;
    },
    actions: {
      pick: (el, ctx, ev) => { if (ev.target.closest('[data-action="toggle"]')) return; ctx.state.sel = el.dataset.id; ctx.rerender(); },
      toggle: (el, ctx) => { ctx.state.open[el.dataset.id] = ctx.state.open[el.dataset.id] === false; ctx.rerender(); },
      'tree-q': (el, ctx) => { ctx.state.q = el.value.trim().toLowerCase(); ctx.rerender(); },
      'add-domain': (el, ctx) => nodeForm(ctx, 'domain', {}),
      'add-program': (el, ctx) => nodeForm(ctx, 'program', { domainId: el.dataset.id }),
      edit: (el, ctx) => { const all = ctx.data.flatMap((d) => [d, ...d.children]); nodeForm(ctx, el.dataset.type, all.find((n) => n.id === el.dataset.id)); },
      dup: async (el, ctx) => { try { const r = await api.admin.duplicate(el.dataset.type, el.dataset.id); ui.notify.success('Đã sao chép', `Bản sao ở trạng thái Nháp: ${r.name || r.title}`); ctx.state.sel = r.id; ctx.reload(); } catch (e) { LMS.handleError(e); } },
      status: async (el, ctx) => { const s = el.dataset.s; const lbl = { published: 'Xuất bản', paused: 'Tạm dừng', locked: 'Khóa' }[s]; if (!(await ui.confirm({ title: `${lbl} mục này?`, message: s === 'published' ? 'Học viên trong phạm vi được giao sẽ nhìn thấy nội dung ngay lập tức, không cần triển khai lại website.' : s === 'paused' ? 'Học viên tạm thời không học tiếp được, tiến độ được giữ nguyên.' : 'Nội dung bị khóa hoàn toàn với học viên.', confirmLabel: lbl, tone: s === 'published' ? 'primary' : 'warning' }))) return; try { await api.admin.setStatus(el.dataset.type, el.dataset.id, s); ui.notify.success(`Đã ${lbl.toLowerCase()}`); ctx.reload(); } catch (e) { LMS.handleError(e); } },
      del: async (el, ctx) => { if (!(await ui.confirm({ title: 'Xóa mục này?', message: 'Thao tác không thể hoàn tác. Hệ thống sẽ chặn xóa nếu còn mục con hoặc đã có học viên học.', confirmLabel: 'Xóa', tone: 'danger' }))) return; try { await api.admin.deleteNode(el.dataset.type, el.dataset.id); ui.notify.success('Đã xóa'); ctx.state.sel = null; ctx.reload(); } catch (e) { LMS.handleError(e); } },
    },
  });
  function nodeForm(ctx, type, data) {
    const isD = type === 'domain';
    const d = ui.drawer({ title: `${data.id ? 'Sửa' : 'Thêm'} ${isD ? 'lĩnh vực' : 'chương trình'}`, body: html`<form class="stack" id="node-form" novalidate>${UI.Field({ label: 'Mã', name: 'code', value: data.code || '', required: true, help: isD ? 'Ví dụ: NV, VH' : 'Ví dụ: VH-02' })}${UI.Field({ label: 'Tên', name: 'name', value: data.name || '', required: true })}${!isD ? UI.Field({ label: 'Mô tả', name: 'desc', type: 'textarea', value: data.desc || '' }) : ''}</form>`, footer: html`<button class="btn btn--ghost" data-x>Hủy</button><button class="btn btn--primary" data-save>Lưu</button>` });
    d.el.querySelector('[data-x]').onclick = d.close;
    d.el.querySelector('[data-save]').onclick = async (e) => { const f = d.el.querySelector('#node-form'); ui.clearErrors(f); await ui.busy(e.currentTarget, async () => { try { const r = await api.admin.saveNode(type, { ...data, ...ui.readForm(f) }); d.close(); ui.notify.success('Đã lưu'); ctx.state.sel = r.id; ctx.reload(); } catch (err) { LMS.handleError(err, f); } }); };
  }

  /* ======================= DANH SÁCH KHÓA HỌC ======================= */
  LMS.page('adminCourses', {
    title: 'Khóa học', initState: (info) => ({ q: info.query.q || '', status: '', domain: '' }),
    load: async () => ({ list: await api.admin.courses(), meta: await api.admin.meta() }),
    view: ({ list, meta }, ctx) => {
      const s = ctx.state; const q = s.q.toLowerCase();
      const rows = list.filter((c) => (!q || (c.title + c.code + c.program).toLowerCase().includes(q)) && (!s.status || c.status === s.status) && (!s.domain || c.domainId === s.domain));
      return html`<div class="page page--wide">${UI.PageHeader({ eyebrow: 'Nội dung', title: 'Khóa học', desc: 'Tạo, sửa, sao chép, xuất bản và giao khóa học — mọi thay đổi có hiệu lực ngay, không cần build hay triển khai lại.', actions: UI.Button({ label: 'Tạo khóa học', icon: 'plus', variant: 'primary', href: '#/admin/courses/new' }) })}
      <section class="card"><div class="card__header"><div class="row">${UI.Search({ value: s.q, action: 'q', placeholder: 'Tên, mã, chương trình…', label: 'Tìm khóa học' })}${UI.FilterSelect({ label: 'Lĩnh vực', value: s.domain, action: 'fdomain', options: meta.domains.map((d) => ({ value: d.id, label: d.name })) })}${UI.FilterSelect({ label: 'Trạng thái', value: s.status, action: 'fstatus', options: STATUS_OPTS })}</div><span class="text-sm text-muted">${rows.length} khóa học</span></div>
      ${UI.DataTable({ id: 'courses', state: s.tables.courses, rows, caption: 'Danh sách khóa học', empty: UI.Empty({ icon: 'book', title: 'Không có khóa học phù hợp', action: UI.Button({ label: 'Tạo khóa học', variant: 'primary', href: '#/admin/courses/new' }) }), columns: [
        { key: 'title', label: 'Khóa học', render: (r) => html`<div class="table__primary">${r.title}</div><div class="table__sub">${r.code} · ${r.program}</div>` },
        { key: 'module', label: 'Phân hệ / mức độ', render: (r) => html`<span class="text-sm">${r.module}</span><div class="table__sub">${r.level}</div>` },
        { key: 'required', label: 'Loại', render: (r) => UI.Required(r.required) },
        { key: 'lessons', label: 'Bài', render: (r) => html`<span class="num">${r.lessons}</span>` },
        { key: 'learners', label: 'Được giao', render: (r) => html`<span class="num">${r.learners}</span>` },
        { key: 'status', label: 'Trạng thái', render: (r) => UI.PublishStatus(r.status) },
        { key: 'updatedAt', label: 'Cập nhật', render: (r) => fmt.date(r.updatedAt) },
        { key: 'id', label: 'Thao tác', sort: false, cls: 'col-actions', render: (r) => r.editable ? html`<a class="btn btn--ghost btn--sm" href="#/admin/courses/${r.id}/edit">${icon('edit', 'icon--sm')}Sửa</a><button class="btn btn--ghost btn--sm btn--icon" data-action="row-menu" data-id="${r.id}" aria-label="Thêm thao tác cho ${r.title}" aria-haspopup="menu">${icon('more')}</button>` : html`<span class="badge badge--outline" title="Khóa học thuộc đơn vị khác — chỉ xem">${icon('lock')}Chỉ xem</span>` },
      ] })}</section></div>`;
    },
    actions: {
      q: (el, ctx) => { ctx.state.q = el.value; ctx.rerender(); }, fstatus: (el, ctx) => { ctx.state.status = el.value; ctx.rerender(); }, fdomain: (el, ctx) => { ctx.state.domain = el.value; ctx.rerender(); },
      'row-menu': (el, ctx) => {
        const c = ctx.data.list.find((x) => x.id === el.dataset.id);
        const set = (s, lbl) => async () => { if (!(await ui.confirm({ title: `${lbl} "${c.title}"?`, message: s === 'published' ? 'Khóa học hiển thị ngay với học viên được giao.' : 'Học viên giữ nguyên tiến độ.', confirmLabel: lbl, tone: s === 'published' ? 'primary' : 'warning' }))) return; try { await api.admin.setStatus('course', c.id, s); ui.notify.success(`Đã ${lbl.toLowerCase()}`); ctx.reload(); } catch (e) { LMS.handleError(e); } };
        ui.menu(el, [
          { label: 'Sao chép khóa học', icon: 'copy', onClick: async () => { try { const r = await api.admin.duplicate('course', c.id); ui.notify.success('Đã sao chép', r.title); ctx.reload(); } catch (e) { LMS.handleError(e); } } },
          c.status !== 'published' ? { label: 'Xuất bản', icon: 'check', onClick: set('published', 'Xuất bản') } : { label: 'Tạm dừng', icon: 'pause-circle', onClick: set('paused', 'Tạm dừng') },
          { label: 'Khóa', icon: 'lock', onClick: set('locked', 'Khóa') },
          { label: 'Giao học', icon: 'calendar', href: `#/admin/assignments?course=${c.id}` },
          { label: 'Chia sẻ cho đơn vị', icon: 'globe', onClick: () => shareDialog(ctx, c) },
          { label: 'Xem báo cáo', icon: 'chart', href: `#/reports/courses?course=${c.id}` },
          '-', { label: 'Xóa', icon: 'trash', danger: true, onClick: async () => { if (!(await ui.confirm({ title: 'Xóa khóa học?', message: 'Không thể hoàn tác. Khóa đã có học viên chỉ có thể Tạm dừng/Khóa.', confirmLabel: 'Xóa', tone: 'danger' }))) return; try { await api.admin.deleteNode('course', c.id); ui.notify.success('Đã xóa'); ctx.reload(); } catch (e) { LMS.handleError(e); } } },
        ]);
      },
    },
  });
  async function shareDialog(ctx, c) {
    const meta = ctx.data.meta; const course = (await api.admin.courseFull(c.id)).course;
    const v = await ui.modal({ title: `Chia sẻ "${c.title}"`, icon: 'globe', body: html`<p class="mb-4">Chọn đơn vị được phép sử dụng khóa học. Đơn vị nhận chia sẻ có thể giao khóa cho học viên của mình nhưng không sửa được nội dung.</p><div class="stack" style="--gap:8px" id="share-units">${meta.allUnits.map((u) => html`<label class="check"><input type="checkbox" value="${u.id}" ${u.id === course.ownerUnitId ? raw('checked disabled') : (course.sharedUnitIds || []).includes(u.id) ? raw('checked') : ''}>${u.name}${u.id === course.ownerUnitId ? ' (đơn vị sở hữu)' : ''}</label>`)}</div>`, actions: [{ label: 'Hủy', variant: 'ghost', value: null }, { label: 'Lưu chia sẻ', variant: 'primary', handler: async (ov) => { const ids = [...ov.querySelectorAll('#share-units input:checked:not(:disabled)')].map((x) => x.value); await api.admin.shareCourse(c.id, ids); return true; } }] });
    if (v) { ui.notify.success('Đã cập nhật chia sẻ'); ctx.reload(); }
  }

  /* ======================= WIZARD KHÓA HỌC ======================= */
  const STEPS = [['Thông tin cơ bản', 'Tên, chương trình, mục tiêu'], ['Nội dung khóa học', 'Chương, bài, khối nội dung'], ['Bài thi & điều kiện', 'Kiểm tra cuối khóa, điểm thưởng'], ['Đối tượng & xuất bản', 'Giao học, chia sẻ, kiểm tra']];
  const BTYPES = { video: ['video', 'Video'], pdf: ['pdf', 'Tài liệu PDF'], text: ['file', 'Văn bản / Markdown'], process: ['process', 'Quy trình từng bước'], image: ['image', 'Hình ảnh'], attachment: ['paperclip', 'Tệp đính kèm'] };
  const ACCEPT = { pdf: ['pdf', ['application/pdf'], 'maxPdfMB'], video: ['mp4,webm', ['video/mp4', 'video/webm'], 'maxVideoMB'], image: ['png,jpg,jpeg,webp', ['image/png', 'image/jpeg', 'image/webp'], 'maxImageMB'], attachment: ['pdf,docx,xlsx,pptx', null, 'maxAttachMB'] };
  const blank = (programId) => ({ course: { title: '', code: '', programId: programId || '', module: 'Tổng quan', level: 'Cơ bản', required: true, desc: '', outcomes: [''], rewardPoints: 50, quizId: '', sharedUnitIds: [] }, chapters: [{ title: 'Chương 1', lessons: [] }], newAssignments: [] });

  LMS.page('courseWizard', {
    title: (ctx) => (ctx.params.id ? 'Sửa khóa học' : 'Tạo khóa học mới'),
    initState: () => ({ step: 0, dirty: false }),
    load: async (ctx) => {
      const meta = await api.admin.meta();
      if (!ctx.state.draft) {
        if (ctx.params.id) { const f = await api.admin.courseFull(ctx.params.id); ctx.state.draft = { course: { ...f.course, quizId: f.course.completion.quizId || '', outcomes: f.course.outcomes.length ? f.course.outcomes : [''] }, chapters: f.chapters, newAssignments: [], existingAssignments: f.assignments }; }
        else ctx.state.draft = blank(ctx.query.program);
      }
      return meta;
    },
    view: (meta, ctx) => {
      const st = ctx.state; const dr = st.draft; const c = dr.course;
      ctx.setGuard(() => (st.dirty ? 'Bạn có thay đổi chưa lưu trong khóa học này.' : null));
      return html`<div class="page page--wide">${UI.Breadcrumb([{ label: 'Khóa học', href: '#/admin/courses' }, { label: ctx.params.id ? 'Sửa khóa học' : 'Tạo khóa học mới' }])}
        <div class="row-between mb-4"><div><h1>${ctx.params.id ? 'Sửa khóa học' : 'Tạo khóa học mới'}</h1><p class="text-sm text-muted">${c.title || 'Chưa đặt tên'} ${c.status ? html`· ${UI.PublishStatus(c.status)}` : ''}</p></div><span class="text-xs text-muted" aria-live="polite">${st.dirty ? html`${icon('edit', 'icon--sm')} Có thay đổi chưa lưu` : st.savedAt ? html`${icon('check', 'icon--sm')} Đã lưu nháp lúc ${st.savedAt}` : ''}</span></div>
        <ol class="stepper mb-6" aria-label="Các bước tạo khóa học">${STEPS.map(([t, sub], i) => html`<li style="flex:1 1 0"><button class="stepper__step w-full ${i < st.step ? 'is-done' : ''}" ${i === st.step ? raw('aria-current="step"') : ''} data-action="goto-step" data-i="${i}"><span class="stepper__num">${i < st.step ? icon('check', 'icon--sm') : i + 1}</span><span><span class="stepper__title">Bước ${i + 1} · ${t}</span><br><span class="stepper__sub">${sub}</span></span></button></li>`)}</ol>
        <form id="wiz" novalidate data-submit="noop">${[step1, step2, step3, step4][st.step](dr, meta, ctx)}</form>
        <div class="wizard-foot card"><div class="row" style="--gap:8px">${st.step > 0 ? UI.Button({ label: 'Quay lại', icon: 'chevron-left', variant: 'ghost', action: 'prev' }) : UI.Button({ label: 'Hủy', variant: 'ghost', href: '#/admin/courses' })}</div>
          <div class="row" style="--gap:8px">${UI.Button({ label: 'Lưu nháp', icon: 'archive', action: 'save' })}${st.step < 3 ? UI.Button({ label: 'Tiếp tục', icon: 'chevron-right', iconRight: true, variant: 'primary', action: 'next' }) : UI.Button({ label: 'Xuất bản khóa học', icon: 'check', variant: 'primary', action: 'publish' })}</div></div>
      </div>`;
    },
    mount(ctx) {
      const form = ctx.el.querySelector('#wiz');
      form.addEventListener('input', (e) => { if (e.target.closest('[data-bind]')) { bind(ctx, e.target); if (!ctx.state.dirty) { ctx.state.dirty = true; const s = ctx.el.querySelector('[aria-live]'); s && (s.innerHTML = String(html`${icon('edit', 'icon--sm')} Có thay đổi chưa lưu`)); } const pv = ctx.el.querySelector('[data-preview]'); if (pv && ctx.state.step === 0) pv.innerHTML = String(preview(ctx.state.draft, ctx.data)); } });
      form.addEventListener('change', (e) => { if (e.target.closest('[data-bind]')) { bind(ctx, e.target); ctx.state.dirty = true; } });
      // Kéo thả sắp xếp bài học (HTML5 DnD) — có nút ↑↓ cho bàn phím
      let drag = null;
      form.addEventListener('dragstart', (e) => { const it = e.target.closest('[data-drag]'); if (!it) return; drag = it.dataset.drag; it.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; });
      form.addEventListener('dragover', (e) => { const it = e.target.closest('[data-drag]'); if (!it || !drag) return; e.preventDefault(); form.querySelectorAll('.is-over').forEach((x) => x.classList.remove('is-over')); it.classList.add('is-over'); });
      form.addEventListener('drop', (e) => { const it = e.target.closest('[data-drag]'); if (!it || !drag) return; e.preventDefault(); const [c1, l1] = drag.split(':').map(Number); const [c2, l2] = it.dataset.drag.split(':').map(Number); const chs = ctx.state.draft.chapters; const [m] = chs[c1].lessons.splice(l1, 1); chs[c2].lessons.splice(l2, 0, m); drag = null; ctx.state.dirty = true; ctx.rerender(); });
      form.addEventListener('dragend', () => { drag = null; form.querySelectorAll('.is-dragging,.is-over').forEach((x) => x.classList.remove('is-dragging', 'is-over')); });
    },
    actions: {
      noop: () => {},
      'goto-step': (el, ctx) => { const i = +el.dataset.i; if (i > ctx.state.step && !validateStep(ctx)) return; ctx.state.step = i; ctx.rerender(); },
      next: (el, ctx) => { if (!validateStep(ctx)) return; ctx.state.step++; ctx.rerender(); },
      prev: (el, ctx) => { ctx.state.step--; ctx.rerender(); },
      save: (el, ctx) => persist(el, ctx, false),
      publish: async (el, ctx) => { if (!(await ui.confirm({ title: 'Xuất bản khóa học?', message: 'Khóa học hiển thị ngay với học viên được giao và họ nhận thông báo. Không cần build hay triển khai lại website.', confirmLabel: 'Xuất bản', icon: 'check' }))) return; persist(el, ctx, true); },
      'add-outcome': (el, ctx) => { ctx.state.draft.course.outcomes.push(''); ctx.state.dirty = true; ctx.rerender(); },
      'del-outcome': (el, ctx) => { ctx.state.draft.course.outcomes.splice(+el.dataset.i, 1); ctx.state.dirty = true; ctx.rerender(); },
      'add-chapter': (el, ctx) => { ctx.state.draft.chapters.push({ title: `Chương ${ctx.state.draft.chapters.length + 1}`, lessons: [] }); ctx.state.dirty = true; ctx.rerender(); },
      'del-chapter': async (el, ctx) => { const ch = ctx.state.draft.chapters[+el.dataset.c]; if (ch.lessons.length && !(await ui.confirm({ title: 'Xóa chương?', message: `Chương có ${ch.lessons.length} bài học sẽ bị xóa cùng. Tiến độ học viên của các bài này sẽ mất sau khi lưu.`, confirmLabel: 'Xóa chương', tone: 'danger' }))) return; ctx.state.draft.chapters.splice(+el.dataset.c, 1); ctx.state.dirty = true; ctx.rerender(); },
      'add-lesson': (el, ctx) => { const ch = ctx.state.draft.chapters[+el.dataset.c]; ch.lessons.push({ title: `Bài ${ch.lessons.length + 1}`, minutes: 10, blocks: [] }); ctx.state.dirty = true; lessonDrawer(ctx, +el.dataset.c, ch.lessons.length - 1); },
      'edit-lesson': (el, ctx) => lessonDrawer(ctx, +el.dataset.c, +el.dataset.l),
      'move-lesson': (el, ctx) => { const c = +el.dataset.c, l = +el.dataset.l, dir = +el.dataset.dir; const arr = ctx.state.draft.chapters[c].lessons; const j = l + dir; if (j < 0 || j >= arr.length) return; [arr[l], arr[j]] = [arr[j], arr[l]]; ctx.state.dirty = true; ctx.rerender(); setTimeout(() => { const b = ctx.el.querySelector(`[data-action="move-lesson"][data-c="${c}"][data-l="${j}"][data-dir="${dir}"]`); b && b.focus(); }, 0); },
      'del-lesson': async (el, ctx) => { if (!(await ui.confirm({ title: 'Xóa bài học?', message: 'Bài học và các khối nội dung sẽ bị xóa khi lưu.', confirmLabel: 'Xóa', tone: 'danger' }))) return; ctx.state.draft.chapters[+el.dataset.c].lessons.splice(+el.dataset.l, 1); ctx.state.dirty = true; ctx.rerender(); },
      'add-assign': (el, ctx) => { ctx.state.draft.newAssignments.push({ targetType: 'unit', targetId: '', startAt: new Date().toISOString().slice(0, 10), dueAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), remind: true }); ctx.state.dirty = true; ctx.rerender(); },
      'del-assign': (el, ctx) => { ctx.state.draft.newAssignments.splice(+el.dataset.i, 1); ctx.rerender(); },
      refresh: (el, ctx) => { const i = +el.id.replace('at', ''); if (ctx.state.draft.newAssignments[i]) ctx.state.draft.newAssignments[i].targetId = ''; ctx.rerender(); },
      'pick-cover': (el, ctx) => { ctx.state.draft.course.cover = el.dataset.v; ctx.state.dirty = true; ctx.rerender(); },
    },
  });

  function bind(ctx, el) {
    const path = el.dataset.bind.split('.'); let o = ctx.state.draft;
    for (let i = 0; i < path.length - 1; i++) o = o[isNaN(path[i]) ? path[i] : +path[i]];
    const k = path[path.length - 1];
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.multi != null) { const arr = new Set(o[k] || []); el.checked ? arr.add(el.value) : arr.delete(el.value); v = [...arr]; }
    if (el.dataset.bool != null) v = el.value === 'true';
    o[isNaN(k) ? k : +k] = v;
  }
  const b = (path) => raw(`data-bind="${path}"`);

  function preview(dr, meta) {
    const c = dr.course; const prog = meta.programs.find((p) => p.id === c.programId); const dom = prog && meta.domains.find((d) => d.id === prog.domainId);
    const lessons = dr.chapters.reduce((s, ch) => s + ch.lessons.length, 0); const minutes = dr.chapters.reduce((s, ch) => s + ch.lessons.reduce((a, l) => a + (+l.minutes || 0), 0), 0);
    return UI.CourseCard({ id: c.id || 'preview', title: c.title || 'Tên khóa học', required: c.required, cover: c.cover || 'layers', domain: dom ? dom.name : 'Lĩnh vực', module: c.module, minutes, lessons, level: c.level, pct: 0, status: 'not_started', statusLabel: 'Chưa bắt đầu' });
  }

  function step1(dr, meta) {
    const c = dr.course;
    return html`<div class="dash-grid"><section class="card card--pad stack" style="--gap:20px" aria-label="Thông tin cơ bản">
      <div class="form-grid">
        <div class="field full"><label class="field__label" for="w-title">Tên khóa học<span class="req" aria-hidden="true">*</span></label><input class="input" id="w-title" name="title" ${b('course.title')} value="${c.title}" required aria-required="true" maxlength="120" placeholder="Ví dụ: Quy trình đối soát cuối ngày"></div>
        <div class="field"><label class="field__label" for="w-code">Mã khóa học<span class="req" aria-hidden="true">*</span></label><input class="input mono" id="w-code" name="code" ${b('course.code')} value="${c.code}" required aria-required="true" placeholder="VH-302" aria-describedby="w-code-h"><div class="field__help" id="w-code-h">Duy nhất trong hệ thống.</div></div>
        <div class="field"><label class="field__label" for="w-prog">Chương trình<span class="req" aria-hidden="true">*</span></label><select class="select" id="w-prog" name="programId" ${b('course.programId')} required><option value="">— Chọn chương trình —</option>${meta.domains.map((d) => html`<optgroup label="${d.name}">${meta.programs.filter((p) => p.domainId === d.id).map((p) => html`<option value="${p.id}" ${p.id === c.programId ? raw('selected') : ''}>${p.name}</option>`)}</optgroup>`)}</select></div>
        <div class="field"><label class="field__label" for="w-mod">Phân hệ nghiệp vụ</label><select class="select" id="w-mod" ${b('course.module')}>${meta.modules.map((m) => html`<option ${m === c.module ? raw('selected') : ''}>${m}</option>`)}</select></div>
        <div class="field"><label class="field__label" for="w-lvl">Mức độ</label><select class="select" id="w-lvl" ${b('course.level')}>${['Cơ bản', 'Trung cấp', 'Nâng cao'].map((m) => html`<option ${m === c.level ? raw('selected') : ''}>${m}</option>`)}</select></div>
        <fieldset class="field full" style="border:0;padding:0"><legend class="field__label">Loại khóa học</legend><div class="grid grid-2" style="--gap:10px"><label class="option-card"><input type="radio" name="req" value="true" ${b('course.required')} data-bool ${c.required ? raw('checked') : ''}><span><strong>Bắt buộc</strong><br><span class="text-xs text-muted">Học viên được giao phải hoàn thành trước hạn</span></span></label><label class="option-card"><input type="radio" name="req" value="false" ${b('course.required')} data-bool ${!c.required ? raw('checked') : ''}><span><strong>Tự chọn</strong><br><span class="text-xs text-muted">Học viên tự đăng ký từ danh mục</span></span></label></div></fieldset>
        <div class="field full"><label class="field__label" for="w-desc">Mô tả ngắn</label><textarea class="textarea" id="w-desc" rows="3" ${b('course.desc')} maxlength="400">${c.desc}</textarea></div>
      </div>
      <div class="stack" style="--gap:8px"><div class="field__label">Mục tiêu đầu ra</div>${c.outcomes.map((o, i) => html`<div class="row" style="--gap:8px;flex-wrap:nowrap"><label class="sr-only" for="w-o${i}">Mục tiêu ${i + 1}</label><input class="input" id="w-o${i}" ${b('course.outcomes.' + i)} value="${o}" placeholder="Học viên có thể…">${UI.Button({ icon: 'x', variant: 'ghost', action: 'del-outcome', attrs: `data-i="${i}"`, title: 'Xóa mục tiêu' })}</div>`)}<button type="button" class="link-btn" data-action="add-outcome">${icon('plus', 'icon--sm')}Thêm mục tiêu</button></div>
      <div class="stack" style="--gap:8px"><div class="field__label">Biểu tượng ảnh bìa</div><div class="row" style="--gap:8px" role="radiogroup" aria-label="Biểu tượng ảnh bìa">${['layers', 'process', 'clock', 'building', 'database', 'shield'].map((v) => html`<button type="button" class="chip" role="radio" aria-checked="${(c.cover || 'layers') === v}" data-action="pick-cover" data-v="${v}" aria-label="Biểu tượng ${v}">${icon(v)}</button>`)}</div></div>
    </section><aside class="stack" style="--gap:12px;align-self:start;position:sticky;top:80px"><span class="eyebrow">Xem trước thẻ khóa học</span><div data-preview>${preview(dr, meta)}</div><p class="text-xs text-muted">Thẻ cập nhật theo dữ liệu bạn đang nhập — đây là những gì học viên nhìn thấy.</p></aside></div>`;
  }

  function step2(dr) {
    const total = dr.chapters.reduce((s, ch) => s + ch.lessons.length, 0);
    const minutes = dr.chapters.reduce((s, ch) => s + ch.lessons.reduce((a, l) => a + (+l.minutes || 0), 0), 0);
    return html`<div class="row mb-4" style="--gap:24px"><span class="text-sm"><strong class="num">${dr.chapters.length}</strong> chương</span><span class="text-sm"><strong class="num">${total}</strong> bài học</span><span class="text-sm"><strong class="num">${fmt.minutes(minutes)}</strong> tổng thời lượng</span><span class="grow"></span><span class="text-xs text-muted">${icon('grip', 'icon--sm')} Kéo thả hoặc dùng nút ↑ ↓ để sắp xếp</span></div>
      <div class="stack" style="--gap:16px">${dr.chapters.map((ch, ci) => html`<section class="card" aria-label="Chương ${ci + 1}"><div class="card__header"><div class="row grow" style="--gap:10px;flex-wrap:nowrap"><span class="chapter__num">${ci + 1}</span><label class="sr-only" for="ch-${ci}">Tên chương ${ci + 1}</label><input class="input" id="ch-${ci}" ${b(`chapters.${ci}.title`)} value="${ch.title}" style="font-weight:600"></div>${UI.Button({ icon: 'trash', variant: 'danger-ghost', size: 'sm', action: 'del-chapter', attrs: `data-c="${ci}"`, title: 'Xóa chương' })}</div>
        <div class="card__body">${ch.lessons.length ? ch.lessons.map((l, li) => { const missing = !l.quizId && (!l.blocks || !l.blocks.length); const fileErr = (l.blocks || []).some((bk) => bk.file && bk.file.state !== 'ok'); return html`<div class="sort-item" draggable="true" data-drag="${ci}:${li}"><span class="drag-handle" aria-hidden="true">${icon('grip', 'icon--sm')}</span><div class="grow" style="min-width:0"><div class="text-sm fw-600 truncate">${l.title}</div><div class="row text-xs text-muted" style="--gap:8px">${l.quizId ? html`<span class="row" style="--gap:4px">${icon('clipboard', 'icon--sm')}Bài kiểm tra</span>` : (l.blocks || []).map((bk) => html`<span class="row" style="--gap:4px">${icon(BTYPES[bk.type][0], 'icon--sm')}${BTYPES[bk.type][1]}</span>`)}<span>· ${l.minutes} phút</span></div></div>${missing ? UI.Badge('Thiếu nội dung', 'warning', 'alert') : fileErr ? UI.Badge('Tệp lỗi', 'danger', 'alert') : UI.Badge('Đủ nội dung', 'success', 'check')}
          <button type="button" class="btn btn--ghost btn--sm btn--icon" data-action="move-lesson" data-c="${ci}" data-l="${li}" data-dir="-1" aria-label="Chuyển lên" ${li === 0 ? raw('disabled') : ''}>${icon('chevron-up', 'icon--sm')}</button><button type="button" class="btn btn--ghost btn--sm btn--icon" data-action="move-lesson" data-c="${ci}" data-l="${li}" data-dir="1" aria-label="Chuyển xuống" ${li === ch.lessons.length - 1 ? raw('disabled') : ''}>${icon('chevron-down', 'icon--sm')}</button>
          ${UI.Button({ label: 'Sửa', icon: 'edit', size: 'sm', action: 'edit-lesson', attrs: `data-c="${ci}" data-l="${li}"` })}${UI.Button({ icon: 'trash', variant: 'danger-ghost', size: 'sm', action: 'del-lesson', attrs: `data-c="${ci}" data-l="${li}"`, title: 'Xóa bài' })}</div>`; }) : html`<p class="text-sm text-muted">Chương chưa có bài học.</p>`}
          <button type="button" class="link-btn mt-2" data-action="add-lesson" data-c="${ci}">${icon('plus', 'icon--sm')}Thêm bài học</button></div></section>`)}
        <button type="button" class="btn btn--secondary" data-action="add-chapter" style="align-self:flex-start">${icon('plus', 'icon--sm')}Thêm chương</button></div>`;
  }

  function step3(dr, meta) {
    const c = dr.course; const qs = meta.quizzes.filter((q) => !c.id || q.courseId === c.id || !meta.quizzes.some((x) => x.courseId === c.id));
    return html`<div class="grid grid-2"><section class="card card--pad stack" style="--gap:16px"><h2 class="text-lg">Bài kiểm tra cuối khóa</h2>
      <div class="field"><label class="field__label" for="w-quiz">Bài kiểm tra dùng để xét hoàn thành</label><select class="select" id="w-quiz" ${b('course.quizId')}><option value="">Không yêu cầu bài kiểm tra</option>${meta.quizzes.map((q) => html`<option value="${q.id}" ${q.id === c.quizId ? raw('selected') : ''}>${q.title}</option>`)}</select><div class="field__help">Cấu hình thời gian, số câu, điểm đạt, số lần thi, trộn đề tại màn Bài kiểm tra.</div></div>
      ${c.quizId ? html`<a class="link-btn" href="#/admin/quizzes/${c.quizId}">${icon('settings', 'icon--sm')}Mở cấu hình bài kiểm tra</a>` : html`<a class="link-btn" href="#/admin/quizzes/new">${icon('plus', 'icon--sm')}Tạo bài kiểm tra mới</a>`}
      <div class="alert">${icon('info')}<div class="text-sm">Để học viên thấy bài kiểm tra trong mục lục, thêm một bài học loại "Bài kiểm tra" ở Bước 2 (sửa bài → chọn bài kiểm tra).</div></div></section>
      <section class="card card--pad stack" style="--gap:16px"><h2 class="text-lg">Điều kiện hoàn thành</h2>
        <label class="check"><input type="checkbox" checked disabled>Hoàn thành 100% bài học nội dung (video ≥ 80%, PDF đọc đến trang cuối)</label>
        <label class="check"><input type="checkbox" ${c.quizId ? raw('checked') : ''} disabled>Đạt bài kiểm tra cuối khóa${c.quizId ? '' : ' (chưa chọn)'}</label>
        <div class="field"><label class="field__label" for="w-pt">Điểm thưởng khi hoàn thành</label><div class="input-group"><input class="input num" id="w-pt" type="number" min="0" max="500" ${b('course.rewardPoints')} value="${c.rewardPoints}"><span class="input-group__addon">điểm</span></div><div class="field__help">Cộng vào điểm tích lũy & bảng xếp hạng.</div></div></section></div>`;
  }

  function step4(dr, meta, ctx) {
    const c = dr.course; const issues = [];
    if (!c.title || !c.code || !c.programId) issues.push(['Thông tin cơ bản chưa đủ (tên, mã, chương trình)', 0]);
    const ls = dr.chapters.flatMap((ch) => ch.lessons);
    if (!ls.length) issues.push(['Chưa có bài học nào', 1]);
    ls.forEach((l) => { if (!l.quizId && (!l.blocks || !l.blocks.length)) issues.push([`Bài "${l.title}" chưa có nội dung`, 1]); if ((l.blocks || []).some((bk) => bk.file && bk.file.state !== 'ok')) issues.push([`Bài "${l.title}" có tệp lỗi`, 1]); });
    const targets = (t) => (t === 'unit' ? meta.units.map((u) => ({ value: u.id, label: u.name })) : t === 'group' ? meta.groups.map((g) => ({ value: g.id, label: `${g.name} (${(meta.allUnits.find((u) => u.id === g.unitId) || {}).code})` })) : meta.users.map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` })));
    return html`<div class="dash-grid"><div class="stack" style="--gap:24px">
      <section class="card card--pad stack" style="--gap:16px"><div class="row-between"><h2 class="text-lg">Giao khóa học</h2>${UI.Button({ label: 'Thêm đối tượng', icon: 'plus', size: 'sm', action: 'add-assign' })}</div>
        ${(dr.existingAssignments || []).length ? html`<div class="text-sm text-muted">Đã giao trước đó: ${dr.existingAssignments.length} lượt — quản lý tại <a href="#/admin/assignments">Giao học & hạn</a>.</div>` : ''}
        ${dr.newAssignments.length ? dr.newAssignments.map((a, i) => html`<div class="assign-row" data-error-for="assign${i}"><div class="field"><label class="field__label" for="at${i}">Loại</label><select class="select" id="at${i}" ${b(`newAssignments.${i}.targetType`)} data-change="refresh"><option value="unit" ${a.targetType === 'unit' ? raw('selected') : ''}>Đơn vị</option><option value="group" ${a.targetType === 'group' ? raw('selected') : ''}>Phòng/nhóm</option><option value="user" ${a.targetType === 'user' ? raw('selected') : ''}>Cá nhân</option></select></div>
          <div class="field grow"><label class="field__label" for="ag${i}">Đối tượng</label><select class="select" id="ag${i}" ${b(`newAssignments.${i}.targetId`)}><option value="">— Chọn —</option>${targets(a.targetType).map((o) => html`<option value="${o.value}" ${o.value === a.targetId ? raw('selected') : ''}>${o.label}</option>`)}</select></div>
          <div class="field"><label class="field__label" for="as${i}">Bắt đầu</label><input class="input" type="date" id="as${i}" ${b(`newAssignments.${i}.startAt`)} value="${a.startAt}"></div>
          <div class="field"><label class="field__label" for="ad${i}">Hạn hoàn thành</label><input class="input" type="date" id="ad${i}" ${b(`newAssignments.${i}.dueAt`)} value="${a.dueAt}"></div>
          ${UI.Button({ icon: 'trash', variant: 'danger-ghost', action: 'del-assign', attrs: `data-i="${i}"`, title: 'Xóa dòng' })}</div>`) : html`<p class="text-sm text-muted">Chưa thêm đối tượng. Có thể giao sau khi xuất bản.</p>`}
        <label class="switch"><input type="checkbox" checked>Tự động nhắc học viên trước hạn ${meta.settings.remindDaysBefore} ngày</label></section>
      <section class="card card--pad stack" style="--gap:12px"><h2 class="text-lg">Chia sẻ cho đơn vị khác</h2><p class="text-sm text-muted">Đơn vị được chia sẻ có thể giao khóa cho học viên của mình nhưng không sửa nội dung.</p>${meta.allUnits.map((u) => html`<label class="check"><input type="checkbox" value="${u.id}" data-multi ${b('course.sharedUnitIds')} ${(c.sharedUnitIds || []).includes(u.id) ? raw('checked') : ''} ${u.id === (c.ownerUnitId || LMS.apiCore.me().unitId) ? raw('disabled checked') : ''}>${u.name}${u.id === (c.ownerUnitId || LMS.apiCore.me().unitId) ? ' (đơn vị sở hữu)' : ''}</label>`)}</section></div>
      <aside class="card card--pad stack" style="--gap:12px;align-self:start"><h2 class="text-lg">Kiểm tra trước khi xuất bản</h2>
        ${[['Có thông tin cơ bản', c.title && c.code && c.programId, 0], ['Có ít nhất 1 bài học', ls.length > 0, 1], ['Mọi bài học có nội dung', !issues.some((x) => x[0].includes('chưa có nội dung')), 1], ['Không có tệp lỗi', !issues.some((x) => x[0].includes('tệp lỗi')), 1], ['Đã cấu hình bài kiểm tra (khuyến nghị)', !!c.quizId, 2]].map(([t, ok, st]) => html`<div class="row text-sm" style="--gap:10px">${ok ? html`<span class="text-success">${icon('check-circle')}</span>` : html`<span class="${st === 2 ? 'text-muted' : 'text-warning'}">${icon(st === 2 ? 'info' : 'alert')}</span>`}<span class="grow">${t}</span>${!ok ? html`<button type="button" class="link-btn" data-action="goto-step" data-i="${st}">Bổ sung</button>` : ''}</div>`)}
        ${issues.length ? html`<div class="alert alert--warning">${icon('alert')}<div class="text-sm">${issues[0][0]}${issues.length > 1 ? ` (và ${issues.length - 1} vấn đề khác)` : ''}</div></div>` : html`<div class="alert alert--success">${icon('check-circle')}<div class="text-sm">Sẵn sàng xuất bản.</div></div>`}</aside></div>`;
  }

  function validateStep(ctx) {
    const st = ctx.state; const c = st.draft.course; const form = ctx.el.querySelector('#wiz');
    if (st.step === 0) { const e = {}; if (!c.title.trim()) e.title = 'Nhập tên khóa học.'; if (!c.code.trim()) e.code = 'Nhập mã khóa học.'; if (!c.programId) e.programId = 'Chọn chương trình.'; if (Object.keys(e).length) { ui.showErrors(form, e, 'Hoàn thiện thông tin trước khi tiếp tục:'); return false; } }
    if (st.step === 3) { const e = {}; st.draft.newAssignments.forEach((a, i) => { if (!a.targetId) e['assign' + i] = `Dòng giao học ${i + 1}: chọn đối tượng.`; else if (a.dueAt < a.startAt) e['assign' + i] = `Dòng giao học ${i + 1}: hạn phải sau ngày bắt đầu.`; }); if (Object.keys(e).length) { ui.showErrors(form, e); return false; } }
    return true;
  }
  async function persist(el, ctx, publish) {
    if (!validateStep(ctx)) return;
    const dr = ctx.state.draft;
    const payload = { course: dr.course, chapters: dr.chapters, newAssignments: dr.newAssignments.map((a) => ({ ...a, startAt: new Date(a.startAt).toISOString(), dueAt: new Date(a.dueAt + 'T17:00:00').toISOString() })) };
    await ui.busy(el, async () => {
      try {
        const r = await api.admin.saveCourse(payload, { publish });
        ctx.state.dirty = false; ctx.state.savedAt = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        if (publish) { ctx.setGuard(null); ui.notify.success('Đã xuất bản khóa học', 'Học viên được giao đã nhận thông báo.'); location.hash = '#/admin/courses'; return; }
        ui.notify.success('Đã lưu nháp');
        const f = await api.admin.courseFull(r.id); ctx.state.draft = { course: { ...f.course, quizId: f.course.completion.quizId || '', outcomes: f.course.outcomes.length ? f.course.outcomes : [''] }, chapters: f.chapters, newAssignments: [], existingAssignments: f.assignments };
        if (!ctx.params.id) { ctx.setGuard(null); history.replaceState(null, '', `#/admin/courses/${r.id}/edit`); ctx.params.id = r.id; }
        ctx.rerender();
      } catch (e) { LMS.handleError(e, ctx.el.querySelector('#wiz')); }
    });
  }

  /* -------- Drawer sửa bài học: khối nội dung + upload có kiểm tra -------- */
  function lessonDrawer(ctx, ci, li) {
    const meta = ctx.data; const l = LMS.clone(ctx.state.draft.chapters[ci].lessons[li]); l.blocks = l.blocks || [];
    const lim = meta.settings.upload;
    const blockEd = (bk, i) => {
      const acc = ACCEPT[bk.type];
      const existing = bk.type === 'attachment' && bk.files && bk.files.length ? html`<ul class="stack" style="--gap:6px;list-style:none;padding:0">${bk.files.map((f) => html`<li class="upload-item">${icon('paperclip', 'icon--sm')}<span class="grow text-sm">${f.name}</span><span class="text-xs text-muted">${fmt.bytes(f.size)}</span></li>`)}</ul>` : '';
      const fileBox = acc ? html`<div class="stack" style="--gap:8px">${existing}${bk.file || bk.newFile ? html`<div class="upload-item ${bk.file && bk.file.state !== 'ok' ? 'is-error' : ''}">${icon(BTYPES[bk.type][0])}<div class="grow" style="min-width:0"><div class="text-sm fw-600 truncate">${(bk.newFile || bk.file).name}</div><div class="text-xs text-muted">${fmt.bytes((bk.newFile || bk.file).size)}${bk.file && bk.file.state !== 'ok' ? ' · Tệp bị lỗi/thiếu — hãy tải lại' : bk.newFile ? ' · Sẽ lưu khi lưu khóa học' : ''}</div></div><label class="btn btn--sm">Thay tệp<input type="file" hidden accept="${acc[0].split(',').map((x) => '.' + x).join(',')}" data-upload="${i}"></label></div>` : html`<label class="dropzone" data-drop="${i}">${icon('upload', 'icon--xl')}<div class="fw-600">Kéo thả hoặc <span class="link-btn">chọn tệp</span></div><div class="text-xs">Định dạng: ${acc[0].toUpperCase()} · tối đa ${lim[acc[2]]} MB</div><input type="file" hidden accept="${acc[0].split(',').map((x) => '.' + x).join(',')}" data-upload="${i}"></label>`}<div data-upload-msg="${i}"></div></div>` : '';
      const fields = bk.type === 'text' ? html`<div class="field"><label class="field__label" for="bt${i}">Nội dung (Markdown: ## tiêu đề, **đậm**, - danh sách)</label><textarea class="textarea mono" id="bt${i}" rows="6" data-bk="${i}" data-k="markdown">${(bk.data || {}).markdown || ''}</textarea></div>`
        : bk.type === 'process' ? html`<div class="field"><label class="field__label" for="bp${i}">Các bước (mỗi dòng: Tiêu đề | Mô tả)</label><textarea class="textarea" id="bp${i}" rows="5" data-bk="${i}" data-k="steps">${((bk.data || {}).steps || []).map((s) => `${s.title} | ${s.text}`).join('\n')}</textarea></div>`
          : bk.type === 'image' ? html`<div class="field"><label class="field__label" for="bc${i}">Chú thích hình</label><input class="input" id="bc${i}" data-bk="${i}" data-k="caption" value="${(bk.data || {}).caption || ''}"></div>` : '';
      return html`<div class="card" style="padding:12px" data-block="${i}"><div class="row-between mb-2"><span class="row text-sm fw-600" style="--gap:6px">${icon(BTYPES[bk.type][0], 'icon--sm')}${BTYPES[bk.type][1]}</span><span class="row" style="--gap:2px"><button type="button" class="btn btn--ghost btn--sm btn--icon" data-bmove="${i}" data-dir="-1" aria-label="Chuyển khối lên" ${i === 0 ? raw('disabled') : ''}>${icon('chevron-up', 'icon--sm')}</button><button type="button" class="btn btn--ghost btn--sm btn--icon" data-bmove="${i}" data-dir="1" aria-label="Chuyển khối xuống" ${i === l.blocks.length - 1 ? raw('disabled') : ''}>${icon('chevron-down', 'icon--sm')}</button><button type="button" class="btn btn--danger-ghost btn--sm btn--icon" data-bdel="${i}" aria-label="Xóa khối">${icon('trash', 'icon--sm')}</button></span></div>
        <div class="stack" style="--gap:10px"><div class="field"><label class="field__label" for="btl${i}">Tiêu đề khối</label><input class="input" id="btl${i}" data-bk="${i}" data-k="title" value="${bk.title || ''}"></div>${fileBox}${fields}</div></div>`;
    };
    const body = () => html`<form class="stack" style="--gap:16px" id="lesson-form" novalidate>
      <div class="form-grid">${UI.Field({ label: 'Tên bài học', name: 'title', value: l.title, required: true, attrs: 'data-lk="title"' })}${UI.Field({ label: 'Thời lượng (phút)', name: 'minutes', type: 'number', value: l.minutes, attrs: 'min="1" max="600" data-lk="minutes"' })}</div>
      <div class="field"><label class="field__label" for="lq">Loại bài</label><select class="select" id="lq" data-lk="quizId"><option value="">Bài nội dung (video, tài liệu, quy trình…)</option>${meta.quizzes.map((q) => html`<option value="${q.id}" ${q.id === l.quizId ? raw('selected') : ''}>Bài kiểm tra: ${q.title}</option>`)}</select></div>
      ${l.quizId ? html`<div class="alert">${icon('info')}<div class="text-sm">Bài kiểm tra hoàn thành khi học viên đạt điểm. Không cần khối nội dung.</div></div>` : html`<div class="stack" style="--gap:10px"><div class="row-between"><span class="field__label">Khối nội dung (${l.blocks.length})</span></div>${l.blocks.map(blockEd)}
        <div class="row" style="--gap:6px"><span class="text-xs text-muted">Thêm khối:</span>${Object.entries(BTYPES).map(([k, [ic, lb]]) => html`<button type="button" class="chip" data-badd="${k}">${icon(ic, 'icon--sm')}${lb}</button>`)}</div></div>`}</form>`;
    const d = ui.drawer({ title: 'Sửa bài học', body: body(), footer: html`<button class="btn btn--ghost" data-x>Hủy</button><button class="btn btn--primary" data-ok>Áp dụng</button>` });
    const redraw = () => { d.el.querySelector('.drawer__body').innerHTML = String(body()); };
    const sync = () => {
      d.el.querySelectorAll('[data-lk]').forEach((x) => (l[x.dataset.lk] = x.dataset.lk === 'minutes' ? +x.value : x.value));
      d.el.querySelectorAll('[data-bk]').forEach((x) => { const bk = l.blocks[+x.dataset.bk]; bk.data = bk.data || {}; const k = x.dataset.k; if (k === 'title') bk.title = x.value; else if (k === 'steps') bk.data.steps = x.value.split('\n').filter((s) => s.trim()).map((s) => { const [t, ...r] = s.split('|'); return { title: t.trim(), text: r.join('|').trim() }; }); else bk.data[k] = x.value; });
    };
    const handleFile = (i, file) => {
      const bk = l.blocks[i]; const acc = ACCEPT[bk.type]; const msg = d.el.querySelector(`[data-upload-msg="${i}"]`);
      const ext = file.name.split('.').pop().toLowerCase(); const maxMB = lim[acc[2]];
      const err = !acc[0].split(',').includes(ext) || (acc[1] && file.type && !acc[1].includes(file.type)) ? `Sai định dạng: chỉ chấp nhận ${acc[0].toUpperCase()}.` : file.size > maxMB * 1048576 ? `Tệp ${fmt.bytes(file.size)} vượt giới hạn ${maxMB} MB.` : null;
      if (err) { msg.innerHTML = String(html`<div class="upload-item is-error" role="alert">${icon('x-circle')}<div class="grow text-sm"><strong>${file.name}</strong><br>${err}</div></div>`); return; }
      msg.innerHTML = String(html`<div class="upload-item"><div class="spinner"></div><div class="grow"><div class="text-sm">Đang tải lên ${file.name}…</div>${UI.Progress(0, { sm: true, label: 'Tiến trình tải lên' })}</div></div>`);
      let p = 0; const bar = msg.querySelector('.progress__bar');
      const iv = setInterval(() => { p += 20; bar.style.width = p + '%'; if (p >= 100) { clearInterval(iv); sync(); bk.newFile = { name: file.name, size: file.size, mime: file.type || 'application/octet-stream' }; bk.file = null; bk.data = bk.data || {}; if (bk.type === 'pdf') bk.data = { pages: Math.max(4, Math.min(30, Math.round(file.size / 200000))), outline: ['Giới thiệu', 'Nội dung chính', 'Phụ lục'] }; if (bk.type === 'video') bk.data = { duration: 600, chapters: [{ t: 0, title: 'Mở đầu' }], transcript: [] }; if (bk.type === 'attachment') bk.data = { items: [] }; redraw(); ui.notify.success('Tải lên thành công', `${file.name} · đã kiểm tra định dạng & dung lượng`); } }, 160);
    };
    d.el.addEventListener('click', (e) => {
      const add = e.target.closest('[data-badd]'); const del = e.target.closest('[data-bdel]'); const mv = e.target.closest('[data-bmove]');
      if (add) { sync(); l.blocks.push({ type: add.dataset.badd, title: BTYPES[add.dataset.badd][1], data: add.dataset.badd === 'process' ? { steps: [], links: [] } : add.dataset.badd === 'text' ? { markdown: '' } : {} }); redraw(); }
      if (del) { sync(); l.blocks.splice(+del.dataset.bdel, 1); redraw(); }
      if (mv) { sync(); const i = +mv.dataset.bmove, j = i + +mv.dataset.dir; [l.blocks[i], l.blocks[j]] = [l.blocks[j], l.blocks[i]]; redraw(); }
    });
    d.el.addEventListener('change', (e) => { if (e.target.matches('[data-upload]') && e.target.files[0]) handleFile(+e.target.dataset.upload, e.target.files[0]); if (e.target.matches('[data-lk="quizId"]')) { sync(); redraw(); } });
    d.el.addEventListener('dragover', (e) => { const z = e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('is-over'); } });
    d.el.addEventListener('dragleave', (e) => { const z = e.target.closest('[data-drop]'); z && z.classList.remove('is-over'); });
    d.el.addEventListener('drop', (e) => { const z = e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.remove('is-over'); e.dataTransfer.files[0] && handleFile(+z.dataset.drop, e.dataTransfer.files[0]); } });
    d.el.querySelector('[data-x]').onclick = d.close;
    d.el.querySelector('[data-ok]').onclick = () => {
      sync(); const f = d.el.querySelector('#lesson-form'); ui.clearErrors(f);
      if (!String(l.title).trim()) return ui.showErrors(f, { title: 'Nhập tên bài học.' });
      const noFile = l.blocks.findIndex((bk) => ACCEPT[bk.type] && bk.type !== 'attachment' && !bk.file && !bk.newFile);
      if (!l.quizId && noFile >= 0) return ui.showErrors(f, { title: `Khối "${l.blocks[noFile].title}" chưa có tệp — tải tệp lên hoặc xóa khối.` });
      ctx.state.draft.chapters[ci].lessons[li] = l; ctx.state.dirty = true; d.close(); ctx.rerender(); ui.notify.success('Đã cập nhật bài học', 'Nhấn "Lưu nháp" để lưu vào hệ thống.');
    };
  }
  LMS.lessonDrawerTypes = BTYPES;
})(window.LMS);
