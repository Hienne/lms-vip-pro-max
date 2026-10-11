/* ==========================================================================
   pages/tools.js — Tiến độ, Bảng xếp hạng, Chứng nhận, Đã lưu, Flashcard, Trợ lý AI
   ========================================================================== */
(function (LMS) {
  const { html, raw, icon, mai, UI, Charts, fmt, ui, api, AI } = LMS;

  /* ---------------- Tiến độ của tôi ---------------- */
  LMS.page('progress', {
    title: 'Tiến độ của tôi',
    load: () => api.learner.progress(),
    view: (d, ctx) => html`<div class="page">${UI.PageHeader({ eyebrow: 'Hồ sơ học tập', title: 'Kết quả & tiến độ của tôi', desc: 'Toàn bộ số liệu được tính từ dữ liệu học tập thực tế và đồng bộ trên mọi thiết bị.', actions: UI.Button({ label: 'Xuất CSV', icon: 'download', action: 'export' }) })}
      <div class="grid grid-4">${UI.Kpi({ icon: 'book', value: d.rows.filter((r) => r.status === 'completed').length, suffix: `/${d.rows.length}`, label: 'Khóa đã hoàn thành' })}${UI.Kpi({ icon: 'clock', value: d.hours, suffix: ' giờ', label: 'Thời lượng đã học' })}${UI.Kpi({ icon: 'clipboard', value: d.avgScore ?? '—', suffix: d.avgScore != null ? '%' : '', label: 'Điểm thi trung bình' })}${UI.Kpi({ icon: 'flame', tone: 'reward', value: d.streak, suffix: ' ngày', label: 'Chuỗi học liên tục' })}</div>
      <section class="card mt-6"><div class="card__header"><h2>Tiến độ từng khóa học</h2><span class="text-xs text-muted">Bấm vào dòng để mở khóa học</span></div>
      ${UI.DataTable({ id: 'courses', state: ctx.state.tables.courses, rows: d.rows, rowAction: (r) => `#/course/${r.id}`, caption: 'Tiến độ khóa học', columns: [
        { key: 'title', label: 'Khóa học', render: (r) => html`<div class="table__primary">${r.title}</div><div class="table__sub">${r.code} · ${r.required ? 'Bắt buộc' : 'Tự chọn'}</div>` },
        { key: 'pct', label: 'Tiến độ', render: (r) => html`<div style="min-width:120px">${UI.Progress(r.pct, { sm: true, tone: r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : '' })}<span class="text-xs num">${r.pct}% · ${r.done}/${r.total} bài</span></div>` },
        { key: 'status', label: 'Trạng thái', render: (r) => UI.CourseStatus(r.status, r.overdue) },
        { key: 'startedAt', label: 'Bắt đầu', render: (r) => fmt.date(r.startedAt) },
        { key: 'lastAccessAt', label: 'Truy cập gần nhất', render: (r) => (r.lastAccessAt ? fmt.relative(r.lastAccessAt) : '—') },
        { key: 'completedAt', label: 'Hoàn thành', render: (r) => fmt.date(r.completedAt) },
        { key: 'dueAt', label: 'Hạn', render: (r) => UI.Due(r.dueAt, r.status === 'completed') },
        { key: 'best', label: 'Điểm cao nhất', sortValue: (r) => (r.quiz ? r.quiz.best : null), render: (r) => (r.quiz && r.quiz.best != null ? html`<strong class="num">${r.quiz.best}%</strong>` : '—') },
      ] })}</section>
      <div class="grid grid-2 mt-6">
        ${UI.Card({ title: 'Năng lực theo nhóm kiến thức', body: Charts.Radar({ data: d.competency, size: 320 }) })}
        <div class="stack" style="--gap:24px">${UI.Card({ title: 'Số ngày học mỗi tuần', actions: html`<span class="text-xs text-muted">8 tuần gần nhất</span>`, body: Charts.Columns({ data: d.weeks.map((w) => ({ label: w.label, value: w.days })), max: 7, unit: ' ngày', label: 'Số ngày học mỗi tuần' }) })}
        ${UI.Card({ title: 'Lịch sử thi', pad: false, body: d.attempts.length ? html`<ul class="list">${d.attempts.slice(0, 6).map((a) => html`<li><a class="list__item" href="#/quiz/${a.quizId}/result/${a.id}"><span class="list__icon">${icon('clipboard', 'icon--sm')}</span><span class="grow" style="min-width:0"><span class="text-sm fw-600 truncate" style="display:block">${a.title}</span><span class="text-xs text-muted">${fmt.datetime(a.at)}${a.auto ? ' · tự nộp' : ''}</span></span><strong class="num">${a.score}%</strong>${UI.Badge(a.passed ? 'Đạt' : 'Chưa đạt', a.passed ? 'success' : 'danger')}</a></li>`)}</ul>` : html`<div class="card__body">${UI.Empty({ icon: 'clipboard', title: 'Chưa có lần thi' })}</div>` })}</div>
      </div>
      ${UI.Card({ title: 'Tủ huy hiệu cánh mai', cls: 'mt-6', actions: html`<span class="text-sm text-muted">${d.badges.filter((b) => b.earned).length}/${d.badges.length} đã đạt</span>`, body: html`<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr));--gap:20px">${d.badges.map(UI.MaiBadge)}</div>` })}
    </div>`,
    actions: { export: (el, ctx) => { ui.download('tien-do-cua-toi.csv', ui.toCSV([{ label: 'Mã', key: 'code' }, { label: 'Khóa học', key: 'title' }, { label: 'Tiến độ %', key: 'pct' }, { label: 'Trạng thái', key: 'statusLabel' }, { label: 'Quá hạn', value: (r) => (r.overdue ? 'Có' : '') }, { label: 'Bắt đầu', value: (r) => fmt.date(r.startedAt) }, { label: 'Hoàn thành', value: (r) => fmt.date(r.completedAt) }, { label: 'Hạn', value: (r) => fmt.date(r.dueAt) }, { label: 'Điểm cao nhất', value: (r) => (r.quiz ? r.quiz.best : '') }], ctx.data.rows)); ui.notify.success('Đã xuất tệp CSV'); } },
  });

  /* ---------------- Bảng xếp hạng ---------------- */
  LMS.page('leaderboard', {
    title: 'Bảng xếp hạng', initState: () => ({ scope: 'unit' }),
    load: (ctx) => api.learner.leaderboard(ctx.state.scope),
    view: (d, ctx) => html`<div class="page">${UI.PageHeader({ eyebrow: 'Cộng đồng học tập', title: 'Bảng xếp hạng & thành tích', desc: 'Điểm thưởng tính tự động từ bài học hoàn thành, bài kiểm tra đạt, khóa học hoàn thành và chuỗi ngày học.', actions: UI.Segmented([{ id: 'group', label: 'Nhóm của tôi' }, { id: 'unit', label: 'Đơn vị' }, { id: 'all', label: 'Toàn hệ thống' }], ctx.state.scope, 'scope', 'Phạm vi xếp hạng') })}
      <div class="dash-grid">
        <section class="card"><div class="card__header"><h2>Xếp hạng</h2><span class="text-xs text-muted">${d.rows.length} học viên</span></div><ol class="list">${d.rows.map((r) => html`<li class="list__item" style="${r.me ? 'background:var(--color-primary-subtle)' : ''}"><span class="rank ${r.rank <= 3 ? 'rank--top' : ''}">${r.rank <= 3 ? mai(28, 'var(--color-accent)', 'var(--color-primary-strong)') : ''}<span>${r.rank}</span></span>${UI.Avatar(r.name, '', r.rank === 1)}<span class="grow" style="min-width:0"><span class="fw-600">${r.name}${r.me ? html` ${UI.Badge('Bạn', 'primary')}` : ''}</span><br><span class="text-xs text-muted">${r.group} · chuỗi ${r.streak} ngày</span></span><strong class="num text-accent" style="font-size:var(--text-lg)">${fmt.num(r.points)}</strong></li>`)}</ol></section>
        <aside class="stack" style="--gap:24px">
          <div class="card card--reward card--pad stack" style="--gap:12px"><div class="row">${mai(40)}<div><div class="num fw-700 text-accent" style="font-size:var(--text-3xl);line-height:1">${fmt.num(d.points.total)}</div><div class="text-sm text-secondary">Điểm thưởng của bạn · hạng ${d.me ? d.me.rank : '—'}</div></div></div>
            ${[['Bài học hoàn thành', d.points.parts.lessons], ['Bài kiểm tra đạt', d.points.parts.quizzes], ['Khóa học hoàn thành', d.points.parts.courses], ['Chuỗi ngày học', d.points.parts.streak]].map(([k, v]) => html`<div class="row-between text-sm"><span>${k}</span><strong class="num">+${v}</strong></div>`)}</div>
          ${UI.Card({ title: 'Mốc ghi nhận', body: html`<ul class="stack" style="--gap:12px;list-style:none;padding:0">${[[300, 'Giấy chứng nhận "Học viên tích cực" của Ban'], [600, 'Được giới thiệu trong bản tin Đoàn thanh niên'], [1000, 'Ưu tiên tham gia lớp chuyên sâu Core Banking']].map(([pt, t]) => { const ok = d.points.total >= pt; return html`<li class="stack" style="--gap:6px"><div class="row-between text-sm"><span class="row" style="--gap:8px">${ok ? html`<span class="text-success">${icon('check-circle', 'icon--sm')}</span>` : icon('target', 'icon--sm')}${t}</span><span class="num text-muted">${pt} đ</span></div>${UI.Progress(Math.min(100, (d.points.total / pt) * 100), { sm: true, tone: ok ? 'success' : 'reward' })}</li>`; })}</ul><p class="text-xs text-muted mt-4">Cơ chế ghi nhận phi vật chất, phù hợp quy chế thi đua nội bộ.</p>` })}
          ${UI.Card({ title: 'Huy hiệu', body: html`<div class="grid grid-2" style="--gap:16px">${d.badges.slice(0, 4).map(UI.MaiBadge)}</div><a class="link-btn mt-4" href="#/progress">Xem tủ huy hiệu</a>` })}
        </aside></div></div>`,
    actions: { scope: (el, ctx) => { ctx.state.scope = el.dataset.id; ctx.reload(); } },
  });

  /* ---------------- Chứng nhận ---------------- */
  LMS.page('certificates', {
    title: 'Chứng nhận',
    load: () => api.learner.certificates(),
    view: (list) => html`<div class="page">${UI.PageHeader({ eyebrow: 'Thành tích', title: 'Chứng nhận hoàn thành', desc: 'Chứng nhận tự động cấp khi bạn hoàn thành khóa học. Mỗi chứng nhận có mã xác thực.' })}
      ${list.length ? html`<div class="grid grid-auto">${list.map((c) => html`<a class="card card--interactive card--pad stack" style="--gap:12px;text-decoration:none;color:inherit" href="#/certificate/${c.id}"><div class="row">${mai(40)}<span class="badge badge--success">${icon('check')}Đã cấp</span></div><h3>${c.title}</h3><div class="text-sm text-muted">${c.code} · Hoàn thành ${fmt.date(c.completedAt)}${c.score != null ? ` · Điểm ${c.score}%` : ''}</div><span class="mono text-xs">${c.verify}</span><span class="link-btn">Xem & in chứng nhận ${icon('arrow-right', 'icon--sm')}</span></a>`)}</div>` : html`<div class="card">${UI.Empty({ icon: 'award', title: 'Chưa có chứng nhận', desc: 'Hoàn thành khóa học đầu tiên để nhận chứng nhận.', action: UI.Button({ label: 'Xem khóa học của tôi', href: '#/learn', variant: 'primary' }) })}</div>`}</div>`,
  });
  LMS.page('certificate', {
    title: 'Chứng nhận',
    load: async (ctx) => { const list = await api.learner.certificates(); const c = list.find((x) => x.id === ctx.params.id); if (!c) throw new LMS.apiCore.ApiError(404, 'Chứng nhận không tồn tại hoặc bạn chưa hoàn thành khóa học.'); return c; },
    view: (c) => html`<div class="page">${UI.Breadcrumb([{ label: 'Chứng nhận', href: '#/certificates' }, { label: c.title }])}<div class="row-between mb-4 no-print"><h1>Chứng nhận hoàn thành</h1>${UI.Button({ label: 'In / Lưu PDF', icon: 'printer', variant: 'primary', action: 'print' })}</div>
      <div class="certificate"><div style="position:absolute;right:-40px;top:-40px;opacity:.08">${mai(260)}</div>${mai(56)}<div class="eyebrow" style="color:#5F6B69">Core Banking Academy · Ban QL&PT Core Banking</div><h2>CHỨNG NHẬN HOÀN THÀNH</h2><div style="color:#4A5553">Chứng nhận</div><div class="who">${c.userName}</div><div style="color:#4A5553;max-width:56ch">đã hoàn thành khóa đào tạo <strong>${c.title}</strong> (${c.code})${c.score != null ? ` với kết quả bài kiểm tra ${c.score}%` : ''}.</div><div class="row" style="--gap:48px;margin-top:4%;color:#4A5553;font-size:14px"><div>Ngày hoàn thành<br><strong>${fmt.date(c.completedAt)}</strong></div><div>Mã xác thực<br><strong class="mono">${c.verify}</strong></div></div><div class="text-xs" style="color:#5F6B69;margin-top:2%">Dữ liệu giả lập — bản mockup</div></div></div>`,
    actions: { print: () => window.print() },
  });

  /* ---------------- Đã lưu & ghi chú ---------------- */
  LMS.page('saved', {
    title: 'Đã lưu & ghi chú', initState: () => ({ tab: 'notes' }),
    load: () => api.learner.saved(),
    view: (d, ctx) => html`<div class="page page--narrow">${UI.PageHeader({ eyebrow: 'Công cụ học', title: 'Đã lưu & ghi chú', desc: 'Ghi chú gắn với trang PDF hoặc mốc video; bấm để mở đúng vị trí.' })}
      <div class="card">${UI.Tabs([{ id: 'notes', label: 'Ghi chú', count: d.notes.length }, { id: 'bookmarks', label: 'Đánh dấu', count: d.bookmarks.length }], ctx.state.tab)}
      ${(() => { const list = ctx.state.tab === 'notes' ? d.notes : d.bookmarks; if (!list.length) return UI.Empty({ icon: ctx.state.tab === 'notes' ? 'note' : 'bookmark', title: 'Chưa có mục nào', desc: 'Trong bài học, dùng tab "Ghi chú" hoặc nút đánh dấu trên tài liệu để lưu lại.' }); return html`<ul class="list">${list.map((x) => html`<li><a class="list__item" href="#/lesson/${x.courseId}/${x.lessonId}"><span class="list__icon">${icon(x.anchor.type === 'video' ? 'video' : 'pdf', 'icon--sm')}</span><span class="grow" style="min-width:0"><span class="text-sm fw-600">${x.text || x.label}</span><br><span class="text-xs text-muted">${x.lessonTitle} · ${x.anchor.type === 'video' ? 'Video ' + fmt.time(x.anchor.value) : 'Trang ' + x.anchor.value} · ${fmt.relative(x.at)}</span></span>${icon('chevron-right', 'icon--sm')}</a></li>`)}</ul>`; })()}</div></div>`,
    actions: { tab: (el, ctx) => { ctx.state.tab = el.dataset.id; ctx.rerender(); } },
  });

  /* ---------------- Flashcard ---------------- */
  LMS.page('flashcards', {
    title: 'Flashcard ôn tập', initState: () => ({ i: 0, flip: false, filter: 'due' }),
    load: () => api.learner.flashcards(),
    view: (cards, ctx) => {
      const list = ctx.state.filter === 'due' ? cards.filter((c) => c.state !== 'known') : cards;
      const i = Math.min(ctx.state.i, Math.max(0, list.length - 1)); const c = list[i];
      const known = cards.filter((x) => x.state === 'known').length;
      return html`<div class="page page--narrow">${UI.PageHeader({ eyebrow: 'Công cụ học', title: 'Flashcard ôn tập', desc: 'Thẻ được sinh tự động từ ngân hàng câu hỏi của các khóa bạn đang học.', actions: UI.Segmented([{ id: 'due', label: 'Cần ôn' }, { id: 'all', label: 'Tất cả' }], ctx.state.filter, 'ffilter', 'Lọc thẻ') })}
        <div class="row-between mb-4"><span class="text-sm text-muted">Đã nhớ <strong class="text-success">${known}</strong>/${cards.length} thẻ</span>${list.length ? html`<span class="text-sm num">Thẻ ${i + 1}/${list.length}</span>` : ''}</div>
        ${UI.Progress((known / Math.max(1, cards.length)) * 100, { tone: 'success', label: 'Đã nhớ' })}
        ${c ? html`<div class="flashcard mt-6 ${ctx.state.flip ? 'is-flipped' : ''}"><button class="flashcard__inner w-full" data-action="flip" aria-label="${ctx.state.flip ? 'Mặt sau: đáp án. Nhấn để lật lại' : 'Mặt trước: câu hỏi. Nhấn để xem đáp án'}" aria-pressed="${ctx.state.flip}">
            <span class="flashcard__face flashcard__face--front"><span class="badge badge--primary">${c.competency}</span><span>${c.front}</span><span class="text-xs text-muted" style="font-weight:400">Nhấn (hoặc phím Space) để xem đáp án</span></span>
            <span class="flashcard__face flashcard__face--back"><span class="eyebrow">Đáp án</span><strong>${c.back.join(' · ')}</strong>${c.explanation ? html`<span class="text-sm text-secondary">${c.explanation}</span>` : ''}</span></button></div>
          <div class="row mt-6" style="justify-content:center">${UI.Button({ label: 'Thẻ trước', icon: 'chevron-left', action: 'fprev', disabled: i === 0 })}${UI.Button({ label: 'Ôn lại sau', icon: 'refresh', action: 'rate', attrs: 'data-v="again"' })}${UI.Button({ label: 'Đã nhớ', icon: 'check', variant: 'primary', action: 'rate', attrs: 'data-v="known"' })}${UI.Button({ label: 'Thẻ sau', icon: 'chevron-right', iconRight: true, action: 'fnext', disabled: i >= list.length - 1 })}</div>`
        : html`<div class="card mt-6">${UI.Empty({ icon: 'check-circle', title: 'Bạn đã nhớ hết các thẻ!', desc: 'Chuyển sang "Tất cả" để ôn lại toàn bộ.', action: UI.Button({ label: 'Xem tất cả thẻ', action: 'ffilter', attrs: 'data-id="all"' }) })}</div>`}</div>`;
    },
    mount(ctx) { const k = (e) => { if (e.key === ' ' && !e.target.matches('input,textarea,button')) { e.preventDefault(); ctx.state.flip = !ctx.state.flip; ctx.rerender(); } }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); },
    actions: {
      flip: (el, ctx) => { ctx.state.flip = !ctx.state.flip; ctx.rerender(); },
      fprev: (el, ctx) => { ctx.state.i--; ctx.state.flip = false; ctx.rerender(); },
      fnext: (el, ctx) => { ctx.state.i++; ctx.state.flip = false; ctx.rerender(); },
      ffilter: (el, ctx) => { ctx.state.filter = el.dataset.id; ctx.state.i = 0; ctx.state.flip = false; ctx.rerender(); },
      rate: async (el, ctx) => { const list = ctx.state.filter === 'due' ? ctx.data.filter((c) => c.state !== 'known') : ctx.data; const c = list[Math.min(ctx.state.i, list.length - 1)]; try { await api.learner.rateFlashcard(c.id, el.dataset.v); c.state = el.dataset.v; if (!(ctx.state.filter === 'due' && el.dataset.v === 'known')) ctx.state.i = Math.min(ctx.state.i + 1, list.length - 1); ctx.state.flip = false; ctx.rerender(); } catch (e) { LMS.handleError(e); } },
    },
  });

  /* ---------------- Trợ lý AI ---------------- */
  LMS.page('assistant', {
    title: 'Trợ lý AI',
    view: () => html`<div class="page page--narrow">${UI.PageHeader({ eyebrow: 'Công cụ học', title: 'Trợ lý AI tra cứu tài liệu', desc: 'Hỏi đáp dựa trên tài liệu, video, quy trình và giải thích câu hỏi trong các khóa bạn được giao — luôn kèm nguồn.' })}<section class="card card--pad">${AI.render({})}</section></div>`,
    mount: (ctx) => { AI.mount(ctx.el); },
  });
})(window.LMS);
