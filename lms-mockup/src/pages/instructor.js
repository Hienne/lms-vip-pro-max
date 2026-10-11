/* ==========================================================================
   pages/instructor.js — Tổng quan giảng viên, Hộp phản hồi
   ========================================================================== */
(function (LMS) {
  const { html, raw, icon, UI, fmt, ui, api } = LMS;
  const KIND = { question: ['Câu hỏi', 'help', 'info'], comment: ['Nhận xét', 'message', 'primary'], report: ['Báo cáo nội dung', 'flag', 'danger'] };
  const ST = { new: ['Mới', 'warning'], answered: ['Đã trả lời', 'success'], resolved: ['Đã xử lý', 'success'], dismissed: ['Đã bỏ qua', 'outline'] };

  LMS.page('instructor', {
    title: 'Tổng quan giảng viên',
    load: () => api.admin.instructor(),
    view: (d) => html`<div class="page">${UI.PageHeader({ eyebrow: 'Giảng dạy', title: 'Tổng quan giảng viên', desc: 'Theo dõi kết quả học tập các khóa bạn phụ trách và phản hồi của học viên.', actions: html`${UI.Button({ label: 'Hộp phản hồi', icon: 'inbox', variant: 'primary', href: '#/instructor/inbox' })}${UI.Button({ label: 'Thêm câu hỏi', icon: 'plus', href: '#/admin/questions?new=1' })}` })}
      ${d.pending ? html`<a class="alert alert--warning mb-4" href="#/instructor/inbox" style="text-decoration:none">${icon('inbox')}<div><strong>${d.pending} câu hỏi / báo cáo đang chờ xử lý.</strong> Học viên nhận thông báo ngay khi bạn trả lời.</div></a>` : ''}
      <section class="card">${UI.DataTable({ id: 'ic', rows: d.courses, caption: 'Khóa học phụ trách', columns: [
        { key: 'title', label: 'Khóa học', render: (r) => html`<div class="table__primary">${r.title}</div><div class="table__sub">${r.code}</div>` },
        { key: 'learners', label: 'Học viên', render: (r) => html`<span class="num">${r.learners}</span>` },
        { key: 'pct', label: 'Hoàn thành TB', render: (r) => html`<div style="min-width:120px">${UI.Progress(r.pct, { sm: true })}<span class="text-xs num">${r.pct}%</span></div>` },
        { key: 'avgScore', label: 'Điểm thi TB', render: (r) => (r.avgScore != null ? html`<strong class="num">${r.avgScore}%</strong>` : '—') },
        { key: 'rating', label: 'Đánh giá', render: (r) => (r.rating ? UI.Stars(r.rating, r.ratings) : html`<span class="text-muted text-sm">Chưa có</span>`) },
        { key: 'id', label: '', sort: false, cls: 'col-actions', render: (r) => html`<a class="link-btn" href="#/admin/courses/${r.id}/edit">Sửa nội dung</a>` },
      ] })}</section>
      ${UI.Card({ title: 'Câu hỏi học viên trả lời sai nhiều nhất', cls: 'mt-6', actions: html`<span class="text-xs text-muted">Gợi ý rà soát đề hoặc bổ sung nội dung</span>`, pad: false, body: d.hardest.length ? html`<ul class="list">${d.hardest.map((q) => html`<li class="list__item"><span class="mono text-xs text-muted">${q.code}</span><span class="grow" style="min-width:0"><span class="text-sm">${q.text}</span><br><span class="text-xs text-muted">${q.lessonTitle} · ${q.answered} lượt trả lời</span></span><span class="badge ${q.wrongPct >= 50 ? 'badge--danger' : 'badge--warning'}">${q.wrongPct}% sai</span><a class="btn btn--ghost btn--sm" href="#/admin/questions?edit=${q.id}">Xem câu</a></li>`)}</ul>` : html`<div class="card__body">${UI.Empty({ icon: 'chart', title: 'Chưa đủ dữ liệu' })}</div>` })}
    </div>`,
  });

  LMS.page('inbox', {
    title: 'Hộp phản hồi', initState: (info) => ({ kind: info.query.kind || '', status: 'open', sel: null }),
    load: () => api.admin.inbox(),
    view: (list, ctx) => {
      const s = ctx.state;
      const rows = list.filter((f) => (!s.kind || f.kind === s.kind) && (s.status === 'all' || (s.status === 'open' ? f.status === 'new' : f.status !== 'new')));
      const sel = list.find((f) => f.id === s.sel) || rows[0];
      return html`<div class="page page--wide">${UI.PageHeader({ eyebrow: 'Giảng dạy', title: 'Hộp phản hồi học viên', desc: 'Trả lời câu hỏi, xử lý báo cáo nội dung không phù hợp và theo dõi nhận xét.' })}
      <div class="row mb-4">${UI.Tabs([{ id: '', label: 'Tất cả', count: list.length }, ...Object.entries(KIND).map(([k, v]) => ({ id: k, label: v[0], count: list.filter((f) => f.kind === k && f.status === 'new').length || null }))], s.kind, 'kind', 'Loại phản hồi')}<span class="grow"></span>${UI.Segmented([{ id: 'open', label: 'Cần xử lý' }, { id: 'done', label: 'Đã xử lý' }, { id: 'all', label: 'Tất cả' }], s.status, 'status', 'Trạng thái')}</div>
      <div class="inbox">
        <section class="card" aria-label="Danh sách phản hồi">${rows.length ? html`<ul class="list">${rows.map((f) => html`<li><button class="list__item" data-action="pick" data-id="${f.id}" ${sel && sel.id === f.id ? raw('aria-current="true" style="background:var(--color-primary-subtle)"') : ''}><span class="list__icon" style="color:var(--color-${KIND[f.kind][2] === 'primary' ? 'primary' : KIND[f.kind][2]})">${icon(KIND[f.kind][1], 'icon--sm')}</span><span class="grow" style="min-width:0"><span class="text-sm fw-600 truncate" style="display:block">${f.text}</span><span class="text-xs text-muted">${f.userName} · ${f.lessonTitle} · ${fmt.relative(f.createdAt)}</span></span>${UI.Badge(...ST[f.status])}</button></li>`)}</ul>` : UI.Empty({ icon: 'inbox', title: 'Không còn mục cần xử lý', desc: 'Bạn đã xử lý hết phản hồi trong bộ lọc này.' })}</section>
        <section class="card" aria-label="Chi tiết phản hồi">${sel ? html`<div class="card__header"><div class="row" style="--gap:8px">${UI.Badge(KIND[sel.kind][0], KIND[sel.kind][2], KIND[sel.kind][1])}${UI.Badge(...ST[sel.status])}</div><a class="link-btn" href="#/admin/courses/${sel.courseId}/edit">Mở nội dung bài ${icon('arrow-right', 'icon--sm')}</a></div>
          <div class="card__body stack" style="--gap:16px"><div class="text-sm text-muted">${sel.courseTitle} › <strong class="text-secondary">${sel.lessonTitle}</strong>${sel.anchor ? ` · tại ${sel.anchor}` : ''}</div>
            <div class="comment">${UI.Avatar(sel.userName, 'sm')}<div class="comment__bubble"><div class="comment__meta">${sel.userName} · ${fmt.datetime(sel.createdAt)}</div>${sel.text}</div></div>
            ${sel.reply ? html`<div class="comment comment--reply">${UI.Avatar(sel.replyName, 'sm')}<div class="comment__bubble"><div class="comment__meta">${sel.replyName} · ${fmt.datetime(sel.reply.at)}</div>${sel.reply.text}</div></div>` : ''}
            ${sel.kind === 'question' ? html`<form class="stack" data-submit="reply" data-id="${sel.id}" novalidate><div class="field"><label class="field__label" for="rep">${sel.reply ? 'Cập nhật câu trả lời' : 'Trả lời học viên'}</label><textarea class="textarea" id="rep" name="reply" rows="4" placeholder="Câu trả lời sẽ hiển thị trong bài học và gửi thông báo cho học viên"></textarea></div><div class="row" style="justify-content:flex-end">${UI.Button({ label: 'Gửi trả lời', icon: 'send', variant: 'primary', type: 'submit' })}</div></form>` : ''}
            ${sel.kind === 'report' && sel.status === 'new' ? html`<div class="row" style="justify-content:flex-end">${UI.Button({ label: 'Bỏ qua', variant: 'ghost', action: 'set', attrs: `data-id="${sel.id}" data-s="dismissed"` })}${UI.Button({ label: 'Đã sửa nội dung', icon: 'check', variant: 'primary', action: 'set', attrs: `data-id="${sel.id}" data-s="resolved"` })}</div>` : ''}
            ${sel.kind === 'comment' && sel.status === 'new' ? html`<div class="row" style="justify-content:flex-end">${UI.Button({ label: 'Đánh dấu đã xem', icon: 'check', action: 'set', attrs: `data-id="${sel.id}" data-s="resolved"` })}</div>` : ''}
          </div>` : UI.Empty({ icon: 'message', title: 'Chọn một phản hồi để xem chi tiết' })}</section></div></div>`;
    },
    actions: {
      kind: (el, ctx) => { ctx.state.kind = el.dataset.id; ctx.state.sel = null; ctx.rerender(); },
      status: (el, ctx) => { ctx.state.status = el.dataset.id; ctx.state.sel = null; ctx.rerender(); },
      pick: (el, ctx) => { ctx.state.sel = el.dataset.id; ctx.rerender(); },
      reply: async (form, ctx) => { ui.clearErrors(form); await ui.busy(form.querySelector('[type=submit]'), async () => { try { await api.admin.reply(form.dataset.id, form.reply.value); ui.notify.success('Đã gửi trả lời', 'Học viên đã nhận thông báo.'); ctx.state.sel = form.dataset.id; ctx.reload(); } catch (e) { LMS.handleError(e, form); } }); },
      set: async (el, ctx) => { try { await api.admin.setFeedbackStatus(el.dataset.id, el.dataset.s); ui.notify.success('Đã cập nhật trạng thái'); ctx.reload(); } catch (e) { LMS.handleError(e); } },
    },
  });
})(window.LMS);
