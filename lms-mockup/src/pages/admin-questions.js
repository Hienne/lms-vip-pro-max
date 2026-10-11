/* ==========================================================================
   pages/admin-questions.js — Ngân hàng câu hỏi, Bài kiểm tra, Cấu hình Quiz, Nhập dữ liệu
   ========================================================================== */
(function (LMS) {
  const { html, raw, icon, UI, fmt, ui, api } = LMS;
  const DIFF = ['Dễ', 'Trung bình', 'Khó'];
  const POLICY = [['after_submit', 'Ngay sau khi nộp bài'], ['after_pass', 'Chỉ khi đã đạt'], ['after_close', 'Sau khi đóng đề'], ['never', 'Không cho xem']];

  /* ======================= NGÂN HÀNG CÂU HỎI ======================= */
  LMS.page('questions', {
    title: 'Ngân hàng câu hỏi', initState: () => ({ q: '', type: '', diff: '', comp: '', status: '', lesson: '' }),
    load: async () => ({ list: await api.admin.questions(), meta: await api.admin.meta() }),
    mount(ctx) { if (ctx.query.new && !ctx.state.opened) { ctx.state.opened = true; qForm(ctx, null); } if (ctx.query.edit && !ctx.state.opened) { ctx.state.opened = true; qForm(ctx, ctx.data.list.find((x) => x.id === ctx.query.edit)); } },
    view: ({ list, meta }, ctx) => {
      const s = ctx.state; const q = s.q.toLowerCase();
      const rows = list.filter((x) => (!q || (x.code + x.text).toLowerCase().includes(q)) && (!s.type || x.type === s.type) && (!s.diff || x.difficulty === s.diff) && (!s.comp || x.competency === s.comp) && (!s.status || x.status === s.status) && (!s.lesson || x.lessonId === s.lesson));
      const sel = (s.tables.qb || {}).selected || [];
      return html`<div class="page page--wide">${UI.PageHeader({ eyebrow: 'Nội dung', title: 'Ngân hàng câu hỏi', desc: `${list.length} câu hỏi được lưu dưới dạng dữ liệu, tái sử dụng cho nhiều bài kiểm tra.`, actions: html`${UI.Button({ label: 'Nhập từ Excel/CSV', icon: 'upload', href: '#/admin/import?type=questions' })}${UI.Button({ label: 'Thêm câu hỏi', icon: 'plus', variant: 'primary', action: 'new' })}` })}
      <div class="grid grid-4 mb-4">${UI.Kpi({ icon: 'help', value: list.filter((x) => x.status === 'active').length, label: 'Đang sử dụng' })}${UI.Kpi({ icon: 'check-circle', value: list.filter((x) => x.type === 'single').length, label: 'Một đáp án đúng' })}${UI.Kpi({ icon: 'list', tone: 'info', value: list.filter((x) => x.type === 'multiple').length, label: 'Nhiều đáp án đúng' })}${UI.Kpi({ icon: 'archive', tone: 'warn', value: list.filter((x) => x.status !== 'active').length, label: 'Ngưng sử dụng' })}</div>
      <section class="card"><div class="card__header"><div class="row">${UI.Search({ value: s.q, action: 'fq', placeholder: 'Mã hoặc nội dung…', label: 'Tìm câu hỏi' })}${UI.FilterSelect({ label: 'Loại', value: s.type, action: 'ftype', options: [{ value: 'single', label: 'Một đáp án' }, { value: 'multiple', label: 'Nhiều đáp án' }] })}${UI.FilterSelect({ label: 'Độ khó', value: s.diff, action: 'fdiff', options: DIFF.map((d) => ({ value: d, label: d })) })}${UI.FilterSelect({ label: 'Nhóm kiến thức', value: s.comp, action: 'fcomp', options: meta.competencies.map((d) => ({ value: d, label: d })) })}${UI.FilterSelect({ label: 'Bài học', value: s.lesson, action: 'flesson', options: meta.lessons.filter((l) => list.some((x) => x.lessonId === l.id)).map((l) => ({ value: l.id, label: l.title })) })}${UI.FilterSelect({ label: 'Trạng thái', value: s.status, action: 'fstatus', options: [{ value: 'active', label: 'Đang dùng' }, { value: 'inactive', label: 'Ngưng' }] })}</div><span class="text-sm text-muted">${rows.length} kết quả</span></div>
      ${UI.DataTable({ id: 'qb', state: s.tables.qb, rows, selectable: true, pageSize: 10, caption: 'Ngân hàng câu hỏi', bulk: html`${UI.Button({ label: 'Đang dùng', size: 'sm', action: 'bulk', attrs: 'data-v="active"' })}${UI.Button({ label: 'Ngưng sử dụng', size: 'sm', action: 'bulk', attrs: 'data-v="inactive"' })}${UI.Button({ label: 'Xóa', size: 'sm', variant: 'danger-ghost', icon: 'trash', action: 'bulk', attrs: 'data-v="delete"' })}`, empty: UI.Empty({ icon: 'help', title: 'Không có câu hỏi phù hợp', action: UI.Button({ label: 'Thêm câu hỏi', variant: 'primary', action: 'new' }) }), columns: [
        { key: 'code', label: 'Mã', render: (r) => html`<span class="mono">${r.code}</span>` },
        { key: 'text', label: 'Nội dung', render: (r) => html`<div class="clamp-2" style="max-width:520px">${r.text}</div><div class="table__sub">${r.options.length} phương án · ${r.correct.length} đúng · ${r.lessonTitle}</div>` },
        { key: 'type', label: 'Loại', render: (r) => UI.Badge(r.type === 'single' ? 'Một đáp án' : 'Nhiều đáp án', r.type === 'single' ? '' : 'info') },
        { key: 'difficulty', label: 'Độ khó', sortValue: (r) => DIFF.indexOf(r.difficulty), render: (r) => UI.Badge(r.difficulty, r.difficulty === 'Khó' ? 'danger' : r.difficulty === 'Dễ' ? 'success' : 'warning') },
        { key: 'competency', label: 'Nhóm kiến thức', render: (r) => html`<span class="text-sm">${r.competency}</span>` },
        { key: 'usedIn', label: 'Dùng trong', sortValue: (r) => r.usedIn.length, render: (r) => (r.usedIn.length ? html`<span class="text-sm" title="${r.usedIn.join(', ')}">${r.usedIn.length} bài thi</span>` : html`<span class="text-muted text-sm">—</span>`) },
        { key: 'status', label: 'Trạng thái', render: (r) => UI.Badge(r.status === 'active' ? 'Đang dùng' : 'Ngưng', (r.status === 'active' ? 'success' : 'outline') + ' badge--dot') },
        { key: 'id', label: '', sort: false, cls: 'col-actions', render: (r) => UI.Button({ label: 'Sửa', icon: 'edit', size: 'sm', variant: 'ghost', action: 'edit', attrs: `data-id="${r.id}"` }) },
      ] })}</section></div>`;
    },
    actions: Object.assign({
      new: (el, ctx) => qForm(ctx, null),
      edit: (el, ctx) => qForm(ctx, ctx.data.list.find((x) => x.id === el.dataset.id)),
      bulk: async (el, ctx) => {
        const ids = ctx.state.tables.qb.selected; const v = el.dataset.v;
        if (v === 'delete' && !(await ui.confirm({ title: `Xóa ${ids.length} câu hỏi?`, message: 'Câu hỏi đang được dùng trong bài kiểm tra sẽ không thể xóa (chỉ có thể ngưng sử dụng). Thao tác không thể hoàn tác.', confirmLabel: 'Xóa', tone: 'danger' }))) return;
        try { const n = await api.admin.bulkQuestions(ids, v); ui.notify.success(`Đã cập nhật ${n} câu hỏi`); ctx.state.tables.qb.selected = []; ctx.reload(); } catch (e) { LMS.handleError(e); }
      },
    }, ...['q', 'type', 'diff', 'comp', 'status', 'lesson'].map((k) => ({ ['f' + k]: (el, ctx) => { ctx.state[k] = el.value; ctx.rerender(); } }))),
  });

  function qForm(ctx, q) {
    const meta = ctx.data.meta;
    const st = q ? LMS.clone(q) : { code: '', text: '', type: 'single', options: [0, 1, 2, 3].map(() => ({ id: LMS.uid('o'), text: '' })), correct: [], explanation: '', difficulty: 'Trung bình', domainId: meta.domains[0].id, lessonId: '', competency: meta.competencies[0], status: 'active' };
    const body = () => html`<form class="stack" style="--gap:16px" id="qf" novalidate>
      <div class="form-grid">${UI.Field({ label: 'Mã câu hỏi', name: 'code', value: st.code, help: 'Để trống để hệ thống tự sinh.', attrs: 'data-q="code"' })}
        <div class="field"><label class="field__label" for="qt">Loại câu hỏi<span class="req">*</span></label><select class="select" id="qt" name="type" data-q="type"><option value="single" ${st.type === 'single' ? raw('selected') : ''}>Một đáp án đúng</option><option value="multiple" ${st.type === 'multiple' ? raw('selected') : ''}>Nhiều đáp án đúng</option></select></div></div>
      <div class="field"><label class="field__label" for="qtext">Nội dung câu hỏi<span class="req">*</span></label><textarea class="textarea" id="qtext" name="text" rows="3" data-q="text" required>${st.text}</textarea></div>
      <fieldset class="stack" style="--gap:8px;border:0;padding:0" data-error-for="correct"><legend class="field__label">Phương án & đáp án đúng<span class="req">*</span> <span class="text-xs text-muted" style="font-weight:400">— ${st.type === 'single' ? 'chọn 1 đáp án đúng' : 'chọn ≥ 2 đáp án đúng'}</span></legend>
        <div data-error-for="options" class="stack" style="--gap:8px">${st.options.map((o, i) => html`<div class="row" style="--gap:8px;flex-wrap:nowrap"><label class="check" title="Đánh dấu là đáp án đúng"><input type="${st.type === 'single' ? 'radio' : 'checkbox'}" name="qcorrect" value="${o.id}" data-qc ${st.correct.includes(o.id) ? raw('checked') : ''} aria-label="Phương án ${String.fromCharCode(65 + i)} là đáp án đúng"><span class="badge badge--outline">${String.fromCharCode(65 + i)}</span></label><label class="sr-only" for="qo${i}">Nội dung phương án ${String.fromCharCode(65 + i)}</label><input class="input" id="qo${i}" data-qo="${i}" value="${o.text}" placeholder="Nội dung phương án">${st.options.length > 2 ? html`<button type="button" class="btn btn--ghost btn--sm btn--icon" data-qdel="${i}" aria-label="Xóa phương án ${String.fromCharCode(65 + i)}">${icon('x', 'icon--sm')}</button>` : ''}</div>`)}</div>
        ${st.options.length < 8 ? html`<button type="button" class="link-btn" data-qadd>${icon('plus', 'icon--sm')}Thêm phương án</button>` : ''}</fieldset>
      <div class="field"><label class="field__label" for="qexp">Giải thích đáp án</label><textarea class="textarea" id="qexp" rows="2" data-q="explanation">${st.explanation}</textarea><div class="field__help">Hiển thị khi học viên xem lại bài (theo cấu hình quyền xem đáp án).</div></div>
      <div class="form-grid">
        <div class="field"><label class="field__label" for="qd">Độ khó</label><select class="select" id="qd" data-q="difficulty">${DIFF.map((d) => html`<option ${d === st.difficulty ? raw('selected') : ''}>${d}</option>`)}</select></div>
        <div class="field"><label class="field__label" for="qcp">Nhóm kiến thức<span class="req">*</span></label><select class="select" id="qcp" name="competency" data-q="competency">${meta.competencies.map((d) => html`<option ${d === st.competency ? raw('selected') : ''}>${d}</option>`)}</select></div>
        <div class="field"><label class="field__label" for="qdm">Lĩnh vực<span class="req">*</span></label><select class="select" id="qdm" name="domainId" data-q="domainId">${meta.domains.map((d) => html`<option value="${d.id}" ${d.id === st.domainId ? raw('selected') : ''}>${d.name}</option>`)}</select></div>
        <div class="field"><label class="field__label" for="ql">Bài học liên quan</label><select class="select" id="ql" data-q="lessonId"><option value="">— Không gắn bài —</option>${meta.lessons.map((l) => html`<option value="${l.id}" ${l.id === st.lessonId ? raw('selected') : ''}>${l.title}</option>`)}</select></div>
        <div class="field"><label class="field__label" for="qs">Trạng thái sử dụng</label><select class="select" id="qs" data-q="status"><option value="active" ${st.status === 'active' ? raw('selected') : ''}>Đang dùng</option><option value="inactive" ${st.status !== 'active' ? raw('selected') : ''}>Ngưng sử dụng</option></select></div>
      </div>
      <details class="card" style="padding:12px"><summary class="link-btn" style="cursor:pointer">Xem trước như học viên</summary><div class="stack mt-4" style="--gap:8px"><div class="fw-600">${st.text || 'Nội dung câu hỏi'}</div><div class="text-xs text-muted">${st.type === 'multiple' ? 'Chọn tất cả đáp án đúng' : 'Chọn 1 đáp án'}</div>${st.options.filter((o) => o.text).map((o, i) => html`<div class="option-card" style="pointer-events:none"><input type="${st.type === 'single' ? 'radio' : 'checkbox'}" tabindex="-1"><span class="badge badge--outline">${String.fromCharCode(65 + i)}</span>${o.text}</div>`)}</div></details>
    </form>`;
    const d = ui.drawer({ title: q ? `Sửa câu hỏi ${q.code}` : 'Thêm câu hỏi', body: body(), footer: html`<button class="btn btn--ghost" data-x>Hủy</button><button class="btn btn--primary" data-ok>Lưu câu hỏi</button>` });
    const sync = () => { d.el.querySelectorAll('[data-q]').forEach((x) => (st[x.dataset.q] = x.value)); d.el.querySelectorAll('[data-qo]').forEach((x) => (st.options[+x.dataset.qo].text = x.value)); st.correct = [...d.el.querySelectorAll('[data-qc]:checked')].map((x) => x.value); };
    const redraw = () => { sync(); d.el.querySelector('.drawer__body').innerHTML = String(body()); };
    d.el.addEventListener('change', (e) => { if (e.target.matches('[data-q="type"]')) { sync(); if (st.type === 'single') st.correct = st.correct.slice(0, 1); d.el.querySelector('.drawer__body').innerHTML = String(body()); } });
    d.el.addEventListener('click', (e) => { if (e.target.closest('[data-qadd]')) { sync(); st.options.push({ id: LMS.uid('o'), text: '' }); redraw(); } const del = e.target.closest('[data-qdel]'); if (del) { sync(); const [o] = st.options.splice(+del.dataset.qdel, 1); st.correct = st.correct.filter((x) => x !== o.id); d.el.querySelector('.drawer__body').innerHTML = String(body()); } });
    d.el.querySelector('[data-x]').onclick = d.close;
    d.el.querySelector('[data-ok]').onclick = async (e) => { sync(); const f = d.el.querySelector('#qf'); ui.clearErrors(f); await ui.busy(e.currentTarget, async () => { try { await api.admin.saveQuestion(st); d.close(); ui.notify.success(q ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi'); ctx.reload(); } catch (err) { LMS.handleError(err, f); } }); };
  }

  /* ======================= DANH SÁCH BÀI KIỂM TRA ======================= */
  LMS.page('quizzes', {
    title: 'Bài kiểm tra',
    load: () => api.admin.quizzes(),
    view: (list, ctx) => html`<div class="page page--wide">${UI.PageHeader({ eyebrow: 'Nội dung', title: 'Bài kiểm tra', desc: 'Cấu hình thời gian, số câu, điểm đạt, số lần thi, trộn đề và quyền xem đáp án — thay đổi có hiệu lực ngay.', actions: UI.Button({ label: 'Tạo bài kiểm tra', icon: 'plus', variant: 'primary', href: '#/admin/quizzes/new' }) })}
      <section class="card">${UI.DataTable({ id: 'qz', state: ctx.state.tables.qz, rows: list, rowAction: (r) => `#/admin/quizzes/${r.id}`, caption: 'Bài kiểm tra', columns: [
        { key: 'title', label: 'Bài kiểm tra', render: (r) => html`<div class="table__primary">${r.title}</div><div class="table__sub">${r.course}</div>` },
        { key: 'questionCount', label: 'Câu / Pool', render: (r) => html`<span class="num">${r.questionCount}/${r.questionIds.length}</span> <span class="table__sub">${r.source === 'random' ? 'ngẫu nhiên' : 'cố định'}</span>` },
        { key: 'minutes', label: 'Thời gian', render: (r) => `${r.minutes} phút` },
        { key: 'passPct', label: 'Điểm đạt', render: (r) => html`<span class="num">≥ ${r.passPct}%</span>` },
        { key: 'maxAttempts', label: 'Số lần thi', render: (r) => html`<span class="num">${r.maxAttempts}</span>${r.retakeWaitHours ? html` <span class="table__sub">chờ ${r.retakeWaitHours}h</span>` : ''}` },
        { key: 'closeAt', label: 'Mở – đóng', render: (r) => html`<span class="text-xs">${fmt.date(r.openAt)} → ${fmt.date(r.closeAt)}</span>` },
        { key: 'attempts', label: 'Lượt thi', render: (r) => html`<span class="num">${r.attempts}</span>${r.passRate != null ? html` <span class="table__sub">đạt ${r.passRate}%</span>` : ''}` },
        { key: 'id', label: '', sort: false, cls: 'col-actions', render: (r) => html`<a class="btn btn--ghost btn--sm" href="#/admin/quizzes/${r.id}">${icon('settings', 'icon--sm')}Cấu hình</a>` },
      ] })}</section></div>`,
  });

  /* ======================= CẤU HÌNH BÀI KIỂM TRA ======================= */
  LMS.page('quizConfig', {
    title: (ctx) => (ctx.params.id === 'new' ? 'Tạo bài kiểm tra' : 'Cấu hình bài kiểm tra'),
    initState: () => ({ dirty: false, picker: '' }),
    load: async (ctx) => {
      const [meta, questions, courses] = await Promise.all([api.admin.meta(), api.admin.questions(), api.admin.courses()]);
      if (!ctx.state.q) ctx.state.q = ctx.params.id === 'new' ? { title: '', courseId: '', minutes: 15, questionCount: 10, passPct: 70, maxAttempts: 3, retakeWaitHours: 0, shuffleQuestions: true, shuffleOptions: true, source: 'random', questionIds: [], openAt: new Date().toISOString(), closeAt: new Date(Date.now() + 60 * 86400000).toISOString(), reviewPolicy: 'after_submit' } : await api.admin.quiz(ctx.params.id);
      return { meta, questions, courses };
    },
    view: ({ meta, questions, courses }, ctx) => {
      const q = ctx.state.q; const pool = new Set(q.questionIds); const active = questions.filter((x) => pool.has(x.id) && x.status === 'active');
      ctx.setGuard(() => (ctx.state.dirty ? 'Cấu hình bài kiểm tra chưa được lưu.' : null));
      const dt = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
      const filt = ctx.state.picker.toLowerCase();
      return html`<div class="page page--wide">${UI.Breadcrumb([{ label: 'Bài kiểm tra', href: '#/admin/quizzes' }, { label: q.title || 'Bài mới' }])}${UI.PageHeader({ eyebrow: 'Quiz engine', title: ctx.params.id === 'new' ? 'Tạo bài kiểm tra' : 'Cấu hình bài kiểm tra', desc: 'Thay đổi thời gian thi, số lần thi, điểm đạt… có hiệu lực ngay với lượt thi mới, không cần triển khai lại.', actions: UI.Button({ label: 'Lưu cấu hình', icon: 'check', variant: 'primary', action: 'save' }) })}
      <form id="qcf" class="dash-grid" novalidate data-submit="save">
        <div class="stack" style="--gap:24px">
          <section class="card card--pad stack" style="--gap:16px"><h2 class="text-lg">Thông tin chung</h2><div class="form-grid">
            <div class="field full"><label class="field__label" for="c-t">Tên bài kiểm tra<span class="req">*</span></label><input class="input" id="c-t" name="title" data-c="title" value="${q.title}"></div>
            <div class="field full"><label class="field__label" for="c-c">Khóa học<span class="req">*</span></label><select class="select" id="c-c" name="courseId" data-c="courseId"><option value="">— Chọn khóa học —</option>${courses.map((c) => html`<option value="${c.id}" ${c.id === q.courseId ? raw('selected') : ''}>${c.code} · ${c.title}</option>`)}</select></div>
            ${[['minutes', 'Thời gian làm bài', 'phút'], ['questionCount', 'Số câu mỗi lượt', 'câu'], ['passPct', 'Điểm đạt tối thiểu', '%'], ['maxAttempts', 'Số lần thi tối đa', 'lượt'], ['retakeWaitHours', 'Chờ giữa hai lượt (quyền thi lại)', 'giờ']].map(([k, l, u]) => html`<div class="field"><label class="field__label" for="c-${k}">${l}</label><div class="input-group"><input class="input num" type="number" id="c-${k}" name="${k}" data-c="${k}" value="${q[k]}" min="0"><span class="input-group__addon">${u}</span></div></div>`)}
            <div class="field"><label class="field__label" for="c-rp">Quyền xem đáp án & giải thích</label><select class="select" id="c-rp" data-c="reviewPolicy">${POLICY.map(([v, l]) => html`<option value="${v}" ${v === q.reviewPolicy ? raw('selected') : ''}>${l}</option>`)}</select></div>
            <div class="field"><label class="field__label" for="c-o">Thời gian mở đề</label><input class="input" type="datetime-local" id="c-o" name="openAt" data-c="openAt" data-dt value="${dt(q.openAt)}"></div>
            <div class="field"><label class="field__label" for="c-cl">Thời gian đóng đề</label><input class="input" type="datetime-local" id="c-cl" name="closeAt" data-c="closeAt" data-dt value="${dt(q.closeAt)}"></div>
          </div></section>
          <section class="card"><div class="card__header"><h2>Nguồn câu hỏi <span class="text-sm text-muted" style="font-weight:400">· pool ${active.length} câu đang dùng</span></h2><div class="row" style="--gap:8px">${UI.Search({ value: ctx.state.picker, action: 'picker', placeholder: 'Lọc câu hỏi…', label: 'Lọc câu hỏi trong pool', width: '220px' })}</div></div>
            <div class="table-wrap" style="max-height:420px;overflow:auto" data-error-for="questionIds"><table class="table"><thead><tr><th class="col-check"><span class="sr-only">Chọn</span></th><th>Mã</th><th>Câu hỏi</th><th>Nhóm kiến thức</th><th>Độ khó</th></tr></thead><tbody>${questions.filter((x) => !filt || (x.code + x.text + x.competency).toLowerCase().includes(filt)).map((x) => html`<tr class="${pool.has(x.id) ? 'is-selected' : ''}"><td class="col-check"><input type="checkbox" data-pool="${x.id}" ${pool.has(x.id) ? raw('checked') : ''} ${x.status !== 'active' ? raw('disabled') : ''} aria-label="Đưa câu ${x.code} vào pool"></td><td class="mono">${x.code}</td><td><span class="clamp-2">${x.text}</span>${x.status !== 'active' ? html` ${UI.Badge('Ngưng', 'outline')}` : ''}</td><td class="text-sm">${x.competency}</td><td>${x.difficulty}</td></tr>`)}</tbody></table></div></section>
        </div>
        <aside class="stack" style="--gap:24px;align-self:start;position:sticky;top:80px">
          <section class="card card--pad stack" style="--gap:14px"><h2 class="text-lg">Cách lấy đề</h2>
            <label class="option-card"><input type="radio" name="src" value="random" data-c="source" ${q.source === 'random' ? raw('checked') : ''}><span><strong>Lấy ngẫu nhiên</strong><br><span class="text-xs text-muted">Mỗi lượt bốc ${q.questionCount} câu bất kỳ từ pool</span></span></label>
            <label class="option-card"><input type="radio" name="src" value="manual" data-c="source" ${q.source === 'manual' ? raw('checked') : ''}><span><strong>Cố định theo thứ tự chọn</strong><br><span class="text-xs text-muted">Lấy ${q.questionCount} câu đầu tiên của pool</span></span></label>
            <label class="switch"><input type="checkbox" data-c="shuffleQuestions" ${q.shuffleQuestions ? raw('checked') : ''}>Trộn thứ tự câu hỏi</label>
            <label class="switch"><input type="checkbox" data-c="shuffleOptions" ${q.shuffleOptions ? raw('checked') : ''}>Trộn thứ tự đáp án</label></section>
          <section class="card card--pad stack" style="--gap:10px"><h2 class="text-lg">Phân bố pool</h2>${meta.competencies.map((k) => { const n = active.filter((x) => x.competency === k).length; return n ? html`<div class="row-between text-sm"><span>${k}</span><strong class="num">${n}</strong></div>` : ''; })}<hr>${DIFF.map((k) => html`<div class="row-between text-sm"><span>${k}</span><strong class="num">${active.filter((x) => x.difficulty === k).length}</strong></div>`)}
            ${q.questionCount > active.length ? html`<div class="alert alert--warning">${icon('alert')}<div class="text-sm">Số câu mỗi lượt (${q.questionCount}) lớn hơn pool (${active.length}).</div></div>` : ''}</section>
        </aside></form></div>`;
    },
    mount(ctx) {
      const f = ctx.el.querySelector('#qcf');
      const on = (e) => { const el = e.target; const q = ctx.state.q;
        if (el.dataset.c) { const k = el.dataset.c; q[k] = el.type === 'checkbox' ? el.checked : el.dataset.dt != null ? new Date(el.value).toISOString() : ['minutes', 'questionCount', 'passPct', 'maxAttempts', 'retakeWaitHours'].includes(k) ? +el.value : el.value; ctx.state.dirty = true; if (e.type === 'change' && ['source', 'questionCount'].includes(k)) ctx.rerender(); }
        if (el.dataset.pool) { const s = new Set(q.questionIds); el.checked ? s.add(el.dataset.pool) : s.delete(el.dataset.pool); q.questionIds = [...s]; ctx.state.dirty = true; ctx.rerender(); } };
      f.addEventListener('change', on); f.addEventListener('input', (e) => e.target.dataset.c && e.target.type !== 'checkbox' && e.target.type !== 'radio' && on(e));
    },
    actions: {
      picker: (el, ctx) => { ctx.state.picker = el.value; ctx.rerender(); },
      save: async (el, ctx) => {
        const f = ctx.el.querySelector('#qcf'); ui.clearErrors(f);
        const btn = el.matches && el.matches('form') ? ctx.el.querySelector('[data-action="save"]') : el;
        await ui.busy(btn, async () => { try { const r = await api.admin.saveQuiz({ ...ctx.state.q, id: ctx.params.id === 'new' ? null : ctx.params.id }); ctx.state.dirty = false; ctx.setGuard(null); ui.notify.success('Đã lưu cấu hình', 'Áp dụng cho các lượt thi bắt đầu từ bây giờ.'); if (ctx.params.id === 'new') location.hash = `#/admin/quizzes/${r.id}`; else { ctx.state.q = r; ctx.rerender(); } } catch (e) { LMS.handleError(e, f); } });
      },
    },
  });

  /* ======================= NHẬP DỮ LIỆU HÀNG LOẠT ======================= */
  const TEMPLATES = {
    questions: { label: 'Câu hỏi', icon: 'help', file: 'mau-cau-hoi.csv', csv: 'ma,noi_dung,loai,phuong_an,dap_an_dung,giai_thich,do_kho,nhom_kien_thuc\nIMP-001,"Lệnh nào dùng để khóa sổ cuối ngày?",mot,"Chạy EOD|Tắt máy chủ|Xóa log|Đổi mật khẩu",A,"EOD thực hiện khóa sổ.",Dễ,Vận hành EOD\nIMP-002,"Những bước nào thuộc kiểm tra trước EOD?",nhieu,"Đóng ca|Sao lưu|Tắt giám sát|Kiểm tra giao dịch treo",A|B|D,"Không tắt giám sát.",Trung bình,Vận hành EOD\nIMP-003,"Câu thiếu đáp án đúng (ví dụ dòng lỗi)",mot,"A|B",,"",Dễ,Vận hành EOD\nNV-001,"Câu trùng mã với câu đã có",mot,"Đúng|Sai",A,"",Dễ,Kiến trúc hệ thống' },
    users: { label: 'Học viên / người dùng', icon: 'users', file: 'mau-nguoi-dung.csv', csv: 'ho_ten,email,don_vi,nhom,vai_tro\nTrần Văn Mới,moi.tv@demo.cb,QLPTCB,Nhóm Phát triển nghiệp vụ,hoc_vien\nPhạm Thị Lan,lan.pt@demo.cb,TTVH,Phòng Vận hành hạ tầng,hoc_vien\nNguyễn Sai Email,sai-email,QLPTCB,Nhóm Tổng hợp & QA,hoc_vien\nLê Đơn Vị Lạ,la.ldv@demo.cb,XYZ,Nhóm A,hoc_vien' },
    org: { label: 'Đơn vị / phòng / nhóm', icon: 'building', file: 'mau-don-vi.csv', csv: 'ma_don_vi,ten_don_vi,ten_nhom\nBQLDA,Ban Quản lý dự án (giả lập),Nhóm Kiểm thử\nBQLDA,Ban Quản lý dự án (giả lập),Nhóm Triển khai' },
  };
  LMS.page('import', {
    title: 'Nhập dữ liệu hàng loạt', initState: (info) => ({ type: info.query.type || 'questions', step: 0, rows: null, overwrite: false, fileName: '', result: null }),
    view: (_, ctx) => {
      const s = ctx.state; const t = TEMPLATES[s.type]; const me = LMS.apiCore.me();
      const allowed = Object.keys(TEMPLATES).filter((k) => k === 'questions' || me.role === 'admin');
      const ok = s.rows ? s.rows.filter((r) => r.ok).length : 0; const bad = s.rows ? s.rows.length - ok : 0; const dup = s.rows ? s.rows.filter((r) => r.ok && r.data.duplicate).length : 0;
      return html`<div class="page">${UI.PageHeader({ eyebrow: 'Dữ liệu', title: 'Nhập dữ liệu hàng loạt', desc: 'Đưa bộ câu hỏi, danh sách học viên hoặc đơn vị mới vào hệ thống qua giao diện — không cần sửa mã nguồn hay cơ sở dữ liệu.' })}
      <div class="row mb-6" role="radiogroup" aria-label="Loại dữ liệu">${allowed.map((k) => html`<button class="chip" role="radio" aria-checked="${k === s.type}" data-action="type" data-id="${k}">${icon(TEMPLATES[k].icon, 'icon--sm')}${TEMPLATES[k].label}</button>`)}</div>
      <ol class="stepper mb-6">${['Tải tệp lên', 'Kiểm tra từng dòng', 'Kết quả'].map((x, i) => html`<li style="flex:1"><div class="stepper__step ${i < s.step ? 'is-done' : ''}" ${i === s.step ? raw('aria-current="step"') : ''}><span class="stepper__num">${i < s.step ? icon('check', 'icon--sm') : i + 1}</span><span class="stepper__title">${x}</span></div></li>`)}</ol>
      ${s.step === 0 ? html`<div class="grid grid-2"><section class="card card--pad stack" style="--gap:16px"><label class="dropzone" data-dropzone>${icon('upload', 'icon--xl')}<div class="fw-600">Kéo thả tệp CSV vào đây hoặc <span class="link-btn">chọn tệp</span></div><div class="text-xs">Định dạng .csv (UTF-8, xuất từ Excel: Lưu thành CSV UTF-8) · tối đa 2 MB</div><input type="file" accept=".csv,text/csv" hidden data-import-file></label><div data-import-msg></div><div class="row-between"><span class="text-sm text-muted">Chưa có tệp? Dùng dữ liệu mẫu có cả dòng lỗi để thử.</span>${UI.Button({ label: 'Dùng tệp mẫu', icon: 'file', action: 'use-sample' })}</div></section>
        <section class="card card--pad stack" style="--gap:12px"><h2 class="text-lg">Tệp mẫu: ${t.label}</h2><p class="text-sm text-secondary">Giữ nguyên dòng tiêu đề. ${s.type === 'questions' ? 'Phương án phân tách bằng "|"; đáp án đúng ghi chữ cái (A|C); loại: "mot" hoặc "nhieu".' : s.type === 'users' ? 'Đơn vị ghi mã (QLPTCB, TTVH); vai trò: hoc_vien | giang_vien | quan_tri | lanh_dao.' : 'Mỗi dòng một nhóm; đơn vị chưa có sẽ được tạo.'}</p><pre class="code-block">${t.csv.split('\n').slice(0, 3).join('\n')}</pre>${UI.Button({ label: 'Tải tệp mẫu (.csv)', icon: 'download', action: 'tpl' })}</section></div>` : ''}
      ${s.step === 1 ? html`<section class="card"><div class="card__header"><div class="row" style="--gap:8px">${icon('file', 'icon--sm')}<strong>${s.fileName}</strong>${UI.Badge(`${ok} hợp lệ`, 'success')}${bad ? UI.Badge(`${bad} lỗi`, 'danger') : ''}${dup ? UI.Badge(`${dup} trùng`, 'warning') : ''}</div>${UI.Button({ label: 'Chọn tệp khác', icon: 'refresh', size: 'sm', variant: 'ghost', action: 'restart' })}</div>
        ${UI.DataTable({ id: 'imp', state: s.tables.imp, rows: s.rows.map((r) => ({ ...r, id: 'l' + r.line })), pageSize: 10, caption: 'Kết quả kiểm tra từng dòng', columns: [
          { key: 'line', label: 'Dòng', render: (r) => html`<span class="num">${r.line}</span>` },
          { key: 'ok', label: 'Trạng thái', render: (r) => (r.ok ? (r.data.duplicate ? UI.Badge('Trùng', 'warning') : UI.Badge('Hợp lệ', 'success', 'check')) : UI.Badge('Lỗi', 'danger', 'x')) },
          { key: 'data', label: 'Dữ liệu', sort: false, render: (r) => s.type === 'questions' ? html`<span class="mono text-xs">${r.data.code || '(tự sinh)'}</span> ${r.data.text}<div class="table__sub">${r.data.options.length} phương án · đúng: ${r.data.correct.join(', ') || '—'} · ${r.data.competency}</div>` : s.type === 'users' ? html`<strong>${r.data.name}</strong> · ${r.data.email}<div class="table__sub">${r.data.unitName} · ${r.data.groupName}</div>` : html`${r.data.code} · ${r.data.name} · ${r.data.group}` },
          { key: 'errors', label: 'Lý do', sort: false, render: (r) => (r.errors.length ? html`<span class="text-danger text-sm">${r.errors.join('; ')}</span>` : r.data.duplicate ? html`<span class="text-sm text-warning">Đã tồn tại — ${s.overwrite ? 'sẽ ghi đè' : 'sẽ bỏ qua'}</span>` : '—') },
        ] })}
        <div class="card__footer row-between"><label class="switch"><input type="checkbox" data-change="overwrite" ${s.overwrite ? raw('checked') : ''}>Ghi đè bản ghi trùng mã/email</label><div class="row">${UI.Button({ label: 'Tải dòng lỗi (.csv)', icon: 'download', variant: 'ghost', action: 'bad-rows', disabled: !bad })}${UI.Button({ label: `Nhập ${ok} dòng hợp lệ`, icon: 'check', variant: 'primary', action: 'commit', disabled: !ok })}</div></div></section>` : ''}
      ${s.step === 2 ? html`<section class="card">${UI.Empty({ icon: 'check-circle', title: 'Nhập dữ liệu hoàn tất', desc: `Thêm mới ${s.result.added} · cập nhật ${s.result.updated} · bỏ qua ${s.result.skipped} · lỗi ${s.result.failed}. Dữ liệu đã sẵn sàng sử dụng ngay.`, action: html`<div class="row" style="justify-content:center">${UI.Button({ label: 'Nhập tệp khác', icon: 'upload', action: 'restart' })}${UI.Button({ label: s.type === 'questions' ? 'Mở ngân hàng câu hỏi' : s.type === 'users' ? 'Mở danh sách người dùng' : 'Mở đơn vị & nhóm', variant: 'primary', href: s.type === 'questions' ? '#/admin/questions' : s.type === 'users' ? '#/admin/users' : '#/admin/org' })}</div>` })}</section>` : ''}
      </div>`;
    },
    mount(ctx) {
      const z = ctx.el.querySelector('[data-dropzone]'); if (!z) return;
      const read = (file) => { const msg = ctx.el.querySelector('[data-import-msg]'); if (!/\.csv$/i.test(file.name)) { msg.innerHTML = String(html`<div class="alert alert--danger" role="alert">${icon('x-circle')}<div>Sai định dạng: chỉ nhận tệp .csv. Trong Excel chọn "Lưu thành → CSV UTF-8".</div></div>`); return; } if (file.size > 2097152) { msg.innerHTML = String(html`<div class="alert alert--danger" role="alert">${icon('x-circle')}<div>Tệp vượt quá 2 MB.</div></div>`); return; } const fr = new FileReader(); fr.onload = () => preview(ctx, file.name, String(fr.result)); fr.onerror = () => (msg.innerHTML = String(html`<div class="alert alert--danger">${icon('x-circle')}<div>Không đọc được tệp.</div></div>`)); fr.readAsText(file, 'utf-8'); };
      z.querySelector('input').addEventListener('change', (e) => e.target.files[0] && read(e.target.files[0]));
      z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('is-over'); }); z.addEventListener('dragleave', () => z.classList.remove('is-over'));
      z.addEventListener('drop', (e) => { e.preventDefault(); z.classList.remove('is-over'); e.dataTransfer.files[0] && read(e.dataTransfer.files[0]); });
    },
    actions: {
      type: (el, ctx) => { Object.assign(ctx.state, { type: el.dataset.id, step: 0, rows: null, result: null }); ctx.rerender(); },
      tpl: (el, ctx) => { const t = TEMPLATES[ctx.state.type]; ui.download(t.file, t.csv); ui.notify.success('Đã tải tệp mẫu', t.file); },
      'use-sample': (el, ctx) => preview(ctx, TEMPLATES[ctx.state.type].file, TEMPLATES[ctx.state.type].csv, el),
      restart: (el, ctx) => { Object.assign(ctx.state, { step: 0, rows: null, result: null }); ctx.rerender(); },
      overwrite: (el, ctx) => { ctx.state.overwrite = el.checked; ctx.rerender(); },
      'bad-rows': (el, ctx) => { ui.download('dong-loi.csv', ui.toCSV([{ label: 'Dòng', key: 'line' }, { label: 'Lỗi', value: (r) => r.errors.join('; ') }], ctx.state.rows.filter((r) => !r.ok))); },
      commit: async (el, ctx) => { if (!(await ui.confirm({ title: 'Nhập dữ liệu?', message: `${ctx.state.rows.filter((r) => r.ok).length} dòng hợp lệ sẽ được ghi vào hệ thống.`, confirmLabel: 'Nhập dữ liệu', icon: 'upload' }))) return; await ui.busy(el, async () => { try { ctx.state.result = await api.admin.commitImport(ctx.state.type, ctx.state.rows, { overwrite: ctx.state.overwrite }); ctx.state.step = 2; ctx.rerender(); ui.notify.success('Đã nhập dữ liệu'); } catch (e) { LMS.handleError(e); } }); },
    },
  });
  async function preview(ctx, name, text, btn) {
    const run = async () => { try { ctx.state.rows = await api.admin.previewImport(ctx.state.type, text); ctx.state.fileName = name; ctx.state.step = 1; ctx.rerender(); } catch (e) { const msg = ctx.el.querySelector('[data-import-msg]'); if (msg && e.status === 422) msg.innerHTML = String(html`<div class="alert alert--danger" role="alert">${icon('x-circle')}<div>${e.message}</div></div>`); else LMS.handleError(e); } };
    if (btn) await ui.busy(btn, run); else { const msg = ctx.el.querySelector('[data-import-msg]'); msg && (msg.innerHTML = String(html`<div class="row text-sm"><div class="spinner"></div>Đang đọc và kiểm tra ${name}…</div>`)); await run(); }
  }
})(window.LMS);
