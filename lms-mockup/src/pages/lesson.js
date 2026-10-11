/* ==========================================================================
   pages/lesson.js — Lesson Viewer: nhiều khối nội dung + tiến độ + tương tác
   ========================================================================== */
(function (LMS) {
  const { html, raw, icon, mai, UI, fmt, ui, api, PdfViewer, VideoPlayer, AI } = LMS;

  const flowSvg = () => raw(`<svg viewBox="0 0 640 200" class="chart" role="img" aria-label="Sơ đồ: Kênh giao dịch → Lớp tích hợp → Hệ thống lõi → Sổ cái">
    ${[['Kênh giao dịch', 'Quầy · ATM · Mobile', 20], ['Lớp tích hợp', 'Xác thực · Định tuyến', 180], ['Hệ thống lõi', 'CIF · Tiền gửi · Thanh toán', 340], ['Sổ cái (GL)', 'Bút toán kép', 500]].map(([t, s, x], i) => `<rect x="${x}" y="60" width="130" height="80" rx="12" fill="${i === 2 ? 'var(--color-primary)' : 'var(--color-primary-subtle)'}" stroke="var(--color-primary)"/><text x="${x + 65}" y="96" text-anchor="middle" style="font-weight:700;font-size:13px;fill:${i === 2 ? 'var(--color-on-primary)' : 'var(--color-primary)'}">${t}</text><text x="${x + 65}" y="116" text-anchor="middle" style="font-size:10px;fill:${i === 2 ? 'var(--color-on-primary)' : 'var(--color-text-secondary)'}">${s}</text>${i < 3 ? `<path d="M${x + 134} 100h22" stroke="var(--color-primary)" stroke-width="2" marker-end="url(#ar)"/>` : ''}`).join('')}
    <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0l10 5-10 5z" fill="var(--color-primary)"/></marker></defs></svg>`);

  function block(b, d) {
    const p = d.progress;
    const head = (ic, label) => html`<div class="row" style="--gap:8px;margin-bottom:12px">${icon(ic, 'icon--sm')}<h2 class="text-md" style="font-size:var(--text-md)">${b.title || label}</h2></div>`;
    if (b.type === 'video') return html`<section class="lesson-block" aria-label="Video">${head('video', 'Video')}${VideoPlayer.render(b, p.videoPos)}
      ${b.data.chapters && b.data.chapters.length ? html`<div class="row mt-4" style="--gap:6px" aria-label="Mốc nội dung video">${b.data.chapters.map((c, i) => html`<button class="chip" data-seek-to="${c.t}" data-seek-end="${(b.data.chapters[i + 1] || {}).t || ''}" data-block="${b.id}">${fmt.time(c.t)} · ${c.title}</button>`)}</div>` : ''}
      ${b.data.transcript && b.data.transcript.length ? html`<details class="card mt-4"><summary class="card__header" style="cursor:pointer;border:0">${icon('file', 'icon--sm')}<strong class="grow">Transcript (${b.data.transcript.length} đoạn)</strong>${icon('chevron-down', 'icon--sm')}</summary><ol class="list" style="max-height:240px;overflow:auto">${b.data.transcript.map((t) => html`<li><button class="list__item text-sm" data-seek-to="${t.t}" data-block="${b.id}"><span class="mono text-muted">${fmt.time(t.t)}</span><span class="grow">${t.text}</span></button></li>`)}</ol></details>` : ''}</section>`;
    if (b.type === 'pdf') return html`<section class="lesson-block" aria-label="Tài liệu PDF">${head('pdf', 'Tài liệu')}${PdfViewer.render(b, p.lastPage || 1)}${p.lastPage > 1 ? html`<p class="text-xs text-muted mt-2">${icon('history', 'icon--sm')} Đã mở lại tại trang bạn đọc gần nhất (trang ${p.lastPage}).</p>` : ''}</section>`;
    if (b.type === 'text') return html`<section class="lesson-block card card--pad" aria-label="Bài đọc">${UI.Markdown(b.data.markdown)}</section>`;
    if (b.type === 'process') return html`<section class="lesson-block card card--pad" aria-label="Quy trình">${head('process', 'Quy trình')}<ol class="steps">${b.data.steps.map((s, i) => html`<li class="steps__item"><span class="steps__num">${i + 1}</span><div><div class="fw-600">${s.title}</div><p class="text-sm text-secondary">${s.text}</p></div></li>`)}</ol>
      ${b.data.links && b.data.links.length ? html`<div class="row mt-4" style="--gap:8px"><span class="text-xs text-muted">Liên quan:</span>${b.data.links.map((l) => html`<a class="cite" href="${l.href}">${icon('link', 'icon--sm')}${l.label}</a>`)}</div>` : ''}</section>`;
    if (b.type === 'image') return html`<figure class="lesson-block card card--pad" id="block-${b.id}">${b.file && b.file.state === 'ok' ? flowSvg() : UI.Empty({ icon: 'image', tone: 'danger', title: 'Không tải được hình ảnh' })}<figcaption class="text-sm text-muted mt-2" style="text-align:center">${b.data.caption}</figcaption></figure>`;
    if (b.type === 'attachment') return html`<section class="lesson-block card card--pad" id="block-${b.id}" aria-label="Tệp đính kèm">${head('paperclip', 'Tệp đính kèm')}<ul class="stack" style="--gap:8px;list-style:none;padding:0">${b.files.map((f) => html`<li class="upload-item ${f.state !== 'ok' ? 'is-error' : ''}"><span class="list__icon">${icon(f.mime.includes('sheet') ? 'spreadsheet' : 'file')}</span><span class="grow" style="min-width:0"><span class="text-sm fw-600 truncate" style="display:block">${f.name}</span><span class="text-xs text-muted">${fmt.bytes(f.size)} · ${f.name.split('.').pop().toUpperCase()}</span></span>${f.state === 'ok' ? UI.Button({ label: 'Tải xuống', icon: 'download', size: 'sm', action: 'download-file', attrs: `data-name="${LMS.esc(f.name)}"` }) : UI.Badge('Tệp lỗi', 'danger')}</li>`)}</ul></section>`;
    return '';
  }

  const interactions = (d, tab) => html`<section class="card" id="interact" aria-labelledby="int-h"><div class="card__header"><h2 id="int-h">Đánh giá & trao đổi</h2>${d.rating ? UI.Stars(d.rating.avg, d.rating.count) : html`<span class="text-xs text-muted">Chưa có đánh giá</span>`}</div>
    <div class="card__body stack" style="--gap:16px">
      <div class="row"><span class="text-sm fw-600">Bài học này hữu ích với bạn thế nào?</span><div class="rating" role="radiogroup" aria-label="Đánh giá từ 1 đến 5 sao">${[1, 2, 3, 4, 5].map((i) => html`<button role="radio" aria-checked="${d.myRating === i}" aria-label="${i} sao" class="${i <= d.myRating ? 'is-on' : ''}" data-action="rate" data-stars="${i}">${icon('star')}</button>`)}</div>${d.myRating ? html`<span class="text-xs text-success">Đã ghi nhận ${d.myRating} sao</span>` : ''}</div>
      ${UI.Tabs([{ id: 'comment', label: 'Nhận xét', icon: 'message', count: d.comments.length }, { id: 'question', label: 'Hỏi giảng viên', icon: 'help', count: d.questions.length }, { id: 'report', label: 'Báo nội dung không phù hợp', icon: 'flag' }], tab, 'fb-tab', 'Loại phản hồi')}
      <form class="stack" data-submit="send-fb" novalidate data-kind="${tab}">
        <div class="field"><label class="field__label" for="fb-text">${{ comment: 'Nhận xét của bạn', question: 'Câu hỏi cho giảng viên', report: 'Mô tả vấn đề (sai thông tin, lỗi tệp, nội dung nhạy cảm…)' }[tab]}</label>
        <textarea class="textarea" id="fb-text" name="text" rows="3" maxlength="1000" placeholder="${tab === 'question' ? 'Câu hỏi sẽ được gửi kèm vị trí đang học…' : ''}" aria-describedby="fb-help"></textarea><div class="field__help" id="fb-help">${tab === 'comment' ? 'Nhận xét hiển thị công khai cho học viên khác.' : tab === 'question' ? 'Chỉ bạn và giảng viên thấy câu hỏi cho tới khi được trả lời.' : 'Báo cáo được gửi riêng tới giảng viên/quản trị nội dung.'} Tối đa 1000 ký tự.</div></div>
        <div class="row" style="justify-content:flex-end">${UI.Button({ label: { comment: 'Gửi nhận xét', question: 'Gửi câu hỏi', report: 'Gửi báo cáo' }[tab], icon: 'send', variant: tab === 'report' ? 'danger' : 'primary', type: 'submit' })}</div></form>
      ${tab === 'comment' ? (d.comments.length ? html`<div class="thread">${d.comments.map((c) => html`<div class="comment">${UI.Avatar(c.userName, 'sm')}<div class="comment__bubble"><div class="comment__meta">${c.userName} · ${fmt.relative(c.createdAt)}${c.anchor ? ` · tại ${c.anchor}` : ''}</div>${c.text}</div></div>`)}</div>` : html`<p class="text-sm text-muted">Chưa có nhận xét — hãy là người đầu tiên.</p>`) : ''}
      ${tab === 'question' ? (d.questions.length ? html`<div class="thread">${d.questions.map((q) => html`<div class="comment">${UI.Avatar(q.userName, 'sm')}<div class="comment__bubble"><div class="comment__meta">${q.mine ? 'Bạn' : q.userName} · ${fmt.relative(q.createdAt)}${q.anchor ? ` · ${q.anchor}` : ''} · ${q.status === 'answered' ? UI.Badge('Đã trả lời', 'success') : UI.Badge('Chờ trả lời', 'warning')}</div>${q.text}</div></div>${q.reply ? html`<div class="comment comment--reply">${UI.Avatar(q.replyName, 'sm')}<div class="comment__bubble"><div class="comment__meta">${q.replyName} (Giảng viên) · ${fmt.relative(q.reply.at)}</div>${q.reply.text}</div></div>` : ''}`)}</div>` : html`<p class="text-sm text-muted">Bạn chưa đặt câu hỏi nào ở bài này.</p>`) : ''}
    </div></section>`;

  const notesPanel = (d) => html`<form class="stack" style="--gap:8px" data-submit="add-note" novalidate><label class="field__label" for="note-t">Ghi chú tại <span data-note-anchor class="badge badge--primary">vị trí hiện tại</span></label><textarea class="textarea" id="note-t" name="text" rows="3" placeholder="Ghi nhanh ý chính…"></textarea><div class="row" style="justify-content:flex-end">${UI.Button({ label: 'Lưu ghi chú', icon: 'note', size: 'sm', variant: 'primary', type: 'submit' })}</div></form>
    <ul class="stack mt-4" style="--gap:8px;list-style:none;padding:0">${d.notes.length ? d.notes.map((n) => html`<li class="card" style="padding:10px 12px"><div class="row-between"><button class="cite" data-action="jump" data-type="${n.anchor.type}" data-value="${n.anchor.value}">${n.anchor.type === 'video' ? `Video ${fmt.time(n.anchor.value)}` : `Trang ${n.anchor.value}`}</button><button class="btn btn--danger-ghost btn--sm btn--icon" data-action="del-note" data-id="${n.id}" aria-label="Xóa ghi chú">${icon('trash', 'icon--sm')}</button></div><p class="text-sm mt-2">${n.text}</p></li>`) : html`<li class="text-sm text-muted">Chưa có ghi chú. Ghi chú được gắn với trang PDF hoặc mốc video đang xem.</li>`}
    ${d.bookmarks.map((b) => html`<li class="card" style="padding:10px 12px"><div class="row" style="--gap:8px">${icon('bookmark', 'icon--sm')}<button class="cite" data-action="jump" data-type="${b.anchor.type}" data-value="${b.anchor.value}">${b.anchor.type === 'pdf' ? `Trang ${b.anchor.value}` : fmt.time(b.anchor.value)}</button><span class="text-sm grow">${b.label}</span></div></li>`)}</ul>`;

  LMS.page('lesson', {
    title: (ctx) => (ctx.data ? ctx.data.lesson.title : 'Bài học'),
    initState: (info) => ({ side: info.query.tab === 'qa' ? 'ai' : 'toc', fb: info.query.tab === 'qa' ? 'question' : 'comment', focus: false }),
    skeleton: () => html`<div class="focus-bar"><div class="skeleton skeleton--title" style="width:260px"></div></div><div class="page"><div class="skeleton" style="aspect-ratio:16/9;border-radius:14px"></div><div class="skeleton skeleton--text mt-4" style="width:60%"></div></div>`,
    load: (ctx) => api.learner.lesson(ctx.params.courseId, ctx.params.lessonId),
    view: (d, ctx) => {
      const req = d.requirement; const done = d.progress.status === 'completed';
      const chapterIds = [...new Set(d.toc.map((t) => t.chapterId))];
      return html`<div class="focus-bar">
        <a class="btn btn--ghost btn--sm" href="#/course/${d.course.id}">${icon('arrow-left', 'icon--sm')}<span class="hide-sm">Thoát</span></a>
        <div class="grow" style="min-width:0"><div class="text-xs text-muted truncate">${d.course.title} · ${d.chapter.title}</div><div class="fw-600 truncate">${d.lesson.title}</div></div>
        <span class="text-xs text-muted hide-sm" data-saved aria-live="polite">${icon('check', 'icon--sm')} Tiến độ tự động lưu</span>
        <button class="btn btn--ghost btn--sm" data-action="focus-mode" aria-pressed="${ctx.state.focus}">${icon('maximize', 'icon--sm')}<span class="hide-sm">${ctx.state.focus ? 'Hiện mục lục' : 'Chế độ tập trung'}</span></button>
        <button class="icon-btn" data-action="theme" aria-label="Đổi giao diện sáng/tối">${icon('moon')}</button>
      </div>
      <div class="lesson-layout ${ctx.state.focus ? 'is-focus' : ''}">
        <article class="lesson-main stack" style="--gap:24px" aria-labelledby="lesson-h">
          <header><span class="eyebrow">Bài ${d.toc.findIndex((t) => t.id === d.lesson.id) + 1}/${d.toc.length} · ${d.lesson.minutes} phút</span><h1 id="lesson-h" class="mt-2">${d.lesson.title}</h1></header>
          ${d.blocks.length ? d.blocks.map((b) => block(b, d)) : UI.Empty({ icon: 'file', title: 'Bài học chưa có nội dung', desc: 'Giảng viên đang cập nhật nội dung cho bài này.' })}
          <div class="card card--pad row-between lesson-complete" data-complete-box>
            <div class="row" style="--gap:12px">${done ? html`<span class="text-success">${icon('check-circle', 'icon--lg')}</span><div><div class="fw-600">Bạn đã hoàn thành bài học này</div><div class="text-xs text-muted">Hoàn thành ${fmt.datetime(d.progress.completedAt)}</div></div>` : html`<span class="${req.ok ? 'text-success' : 'text-muted'}">${icon(req.ok ? 'check-circle' : 'target', 'icon--lg')}</span><div><div class="fw-600">Điều kiện hoàn thành</div><div class="text-sm text-secondary" data-req>${req.message}</div></div>`}</div>
            ${done ? '' : UI.Button({ label: 'Đánh dấu hoàn thành', icon: 'check', variant: 'primary', action: 'complete', disabled: !req.ok, attrs: 'data-complete-btn' })}
          </div>
          ${interactions(d, ctx.state.fb)}
          <nav class="row-between" aria-label="Điều hướng bài học">${d.prev ? html`<a class="btn btn--secondary" href="${d.prev.quizId ? '#/quiz/' + d.prev.quizId : `#/lesson/${d.course.id}/${d.prev.id}`}">${icon('chevron-left', 'icon--sm')}Bài trước</a>` : html`<span></span>`}${d.next ? html`<a class="btn btn--primary" href="${d.next.quizId ? '#/quiz/' + d.next.quizId : `#/lesson/${d.course.id}/${d.next.id}`}">Bài tiếp theo${icon('chevron-right', 'icon--sm')}</a>` : html`<a class="btn btn--primary" href="#/course/${d.course.id}">Về trang khóa học</a>`}</nav>
        </article>
        <aside class="lesson-side card" aria-label="Công cụ bài học">
          ${UI.Tabs([{ id: 'toc', label: 'Mục lục', icon: 'list' }, { id: 'notes', label: 'Ghi chú', icon: 'note', count: d.notes.length }, { id: 'ai', label: 'Trợ lý AI', icon: 'sparkles' }], ctx.state.side, 'side-tab', 'Công cụ')}
          <div class="lesson-side__body" data-panel="toc" ${ctx.state.side !== 'toc' ? raw('hidden') : ''}>${chapterIds.map((cid) => html`<ol class="list">${d.toc.filter((t) => t.chapterId === cid).map((t) => html`<li><a class="list__item text-sm" href="${t.quizId ? '#/quiz/' + t.quizId : `#/lesson/${d.course.id}/${t.id}`}" ${t.id === d.lesson.id ? raw('aria-current="page" style="background:var(--color-primary-subtle);font-weight:600"') : ''}><span class="lesson-state lesson-state--${t.status}">${t.status === 'completed' ? icon('check', 'icon--sm') : t.status === 'in_progress' ? icon('play', 'icon--sm') : ''}</span><span class="grow">${t.title}</span><span class="text-xs text-muted">${t.minutes}p</span></a></li>`)}</ol>`)}</div>
          <div class="lesson-side__body" data-panel="notes" ${ctx.state.side !== 'notes' ? raw('hidden') : ''}>${notesPanel(d)}</div>
          <div class="lesson-side__body" data-panel="ai" ${ctx.state.side !== 'ai' ? raw('hidden') : ''}>${AI.render({ lessonId: d.lesson.id, compact: true })}</div>
        </aside>
      </div>`;
    },
    mount(ctx) {
      const d = ctx.data; const root = ctx.el; const cleanups = [];
      const savedEl = root.querySelector('[data-saved]');
      const applyReq = (req) => {
        if (!req || d.progress.status === 'completed') return;
        const btn = root.querySelector('[data-complete-btn]'); const msg = root.querySelector('[data-req]');
        if (btn) btn.disabled = !req.ok; if (msg) msg.textContent = req.message;
      };
      const save = async (patch) => {
        try { const r = await api.learner.saveProgress(d.lesson.id, patch); Object.assign(d.progress, r); applyReq(r.requirement); if (savedEl) savedEl.innerHTML = String(html`${icon('check', 'icon--sm')} Đã lưu lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`); }
        catch (err) { if (savedEl) savedEl.innerHTML = String(html`<span class="text-warning">${icon('wifi-off', 'icon--sm')} Chưa lưu được — sẽ thử lại</span>`); if (err.status === 401) LMS.handleError(err); }
      };
      d.blocks.forEach((b) => {
        if (b.type === 'pdf') cleanups.push(PdfViewer.mount(root, b, { onPage: (page) => { ctx.state.anchor = { type: 'pdf', value: page }; updAnchor(); save({ page }); }, onBookmark: async (page) => { try { const r = await api.learner.toggleBookmark(d.lesson.id, { type: 'pdf', value: page }, `${b.title} — trang ${page}`); ui.notify.success(r.saved ? `Đã đánh dấu trang ${page}` : 'Đã bỏ đánh dấu'); } catch (e) { LMS.handleError(e); } } }));
        if (b.type === 'video') cleanups.push(VideoPlayer.mount(root, b, { watched0: d.progress.watchedPct, onProgress: (p) => { ctx.state.anchor = { type: 'video', value: Math.round(p.videoPos) }; updAnchor(); save(p); } }));
      });
      const firstMedia = d.blocks.find((b) => b.type === 'video' || b.type === 'pdf');
      ctx.state.anchor = firstMedia ? (firstMedia.type === 'video' ? { type: 'video', value: d.progress.videoPos } : { type: 'pdf', value: d.progress.lastPage || 1 }) : { type: 'pdf', value: 1 };
      function updAnchor() { const a = root.querySelector('[data-note-anchor]'); if (a && ctx.state.anchor) a.textContent = ctx.state.anchor.type === 'video' ? `Video ${fmt.time(ctx.state.anchor.value)}` : `Trang ${ctx.state.anchor.value}`; }
      updAnchor();
      // Seek từ mốc chương / transcript
      const onSeek = (e) => { const s = e.target.closest('[data-seek-to]'); if (!s) return; const v = root.querySelector(`[data-video="${s.dataset.block}"]`); if (v && v.seekTo) { v.seekTo(+s.dataset.seekTo); v.scrollIntoView({ behavior: 'smooth', block: 'center' }); v.focus({ preventScroll: true }); } };
      root.addEventListener('click', onSeek); cleanups.push(() => root.removeEventListener('click', onSeek));
      AI.mount(root);
      // Cuộn tới khối khi hash có #block-…
      return () => cleanups.forEach((fn) => fn && fn());
    },
    actions: {
      'side-tab': (el, ctx) => { ctx.state.side = el.dataset.id; ctx.el.querySelectorAll('.lesson-side [role=tab]').forEach((t) => { const on = t.dataset.id === el.dataset.id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; }); ctx.el.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== el.dataset.id)); },
      'focus-mode': (el, ctx) => { ctx.state.focus = !ctx.state.focus; ctx.el.querySelector('.lesson-layout').classList.toggle('is-focus', ctx.state.focus); el.setAttribute('aria-pressed', String(ctx.state.focus)); el.querySelector('span') && (el.querySelector('span').textContent = ctx.state.focus ? 'Hiện mục lục' : 'Chế độ tập trung'); },
      'fb-tab': (el, ctx) => { ctx.state.fb = el.dataset.id; const box = ctx.el.querySelector('#interact'); box.outerHTML = String(interactions(ctx.data, ctx.state.fb)); },
      rate: async (el, ctx) => { const n = +el.dataset.stars; try { await api.learner.feedback(ctx.data.lesson.id, { kind: 'rating', stars: n }); ctx.data.myRating = n; ctx.el.querySelector('#interact').outerHTML = String(interactions(ctx.data, ctx.state.fb)); ui.notify.success('Cảm ơn bạn đã đánh giá', `${n}/5 sao`); } catch (e) { LMS.handleError(e); } },
      'send-fb': async (form, ctx) => {
        const kind = form.dataset.kind; const text = form.text.value; ui.clearErrors(form);
        const a = ctx.state.anchor; const anchor = a ? (a.type === 'video' ? fmt.time(a.value) : `Trang ${a.value}`) : null;
        if (kind === 'report' && !(await ui.confirm({ title: 'Gửi báo cáo nội dung?', message: 'Báo cáo sẽ được gửi tới giảng viên/quản trị nội dung để xem xét.', confirmLabel: 'Gửi báo cáo', icon: 'flag' }))) return;
        await ui.busy(form.querySelector('[type=submit]'), async () => {
          try { await api.learner.feedback(ctx.data.lesson.id, { kind, text, anchor }); const fresh = await api.learner.lesson(ctx.params.courseId, ctx.params.lessonId); Object.assign(ctx.data, { comments: fresh.comments, questions: fresh.questions, rating: fresh.rating }); ctx.el.querySelector('#interact').outerHTML = String(interactions(ctx.data, kind)); ui.notify.success({ comment: 'Đã gửi nhận xét', question: 'Đã gửi câu hỏi', report: 'Đã gửi báo cáo' }[kind], kind === 'question' ? 'Bạn sẽ nhận thông báo khi giảng viên trả lời.' : ''); }
          catch (e) { LMS.handleError(e, form); }
        });
      },
      'add-note': async (form, ctx) => { ui.clearErrors(form); try { const n = await api.learner.addNote(ctx.data.lesson.id, ctx.state.anchor, form.text.value); ctx.data.notes.push(n); ctx.el.querySelector('[data-panel="notes"]').innerHTML = String(notesPanel(ctx.data)); const a = ctx.el.querySelector('[data-note-anchor]'); a && (a.textContent = n.anchor.type === 'video' ? `Video ${fmt.time(n.anchor.value)}` : `Trang ${n.anchor.value}`); ui.notify.success('Đã lưu ghi chú'); } catch (e) { LMS.handleError(e, form); } },
      'del-note': async (el, ctx) => { if (!(await ui.confirm({ title: 'Xóa ghi chú?', message: 'Ghi chú sẽ bị xóa vĩnh viễn.', confirmLabel: 'Xóa', tone: 'danger' }))) return; try { await api.learner.deleteNote(el.dataset.id); ctx.data.notes = ctx.data.notes.filter((n) => n.id !== el.dataset.id); ctx.el.querySelector('[data-panel="notes"]').innerHTML = String(notesPanel(ctx.data)); ui.notify.success('Đã xóa ghi chú'); } catch (e) { LMS.handleError(e); } },
      jump: (el, ctx) => { const v = +el.dataset.value; if (el.dataset.type === 'video') { const p = ctx.el.querySelector('[data-video]'); p && p.seekTo && (p.seekTo(v), p.scrollIntoView({ behavior: 'smooth', block: 'center' })); } else { const p = ctx.el.querySelector('[data-pdf][data-pages]'); p && p.goTo && (p.goTo(v), p.scrollIntoView({ behavior: 'smooth', block: 'start' })); } },
      complete: async (el, ctx) => {
        await ui.busy(el, async () => {
          try { const r = await api.learner.completeLesson(ctx.data.lesson.id); ui.notify.success('Đã hoàn thành bài học', r.courseCompleted ? 'Chúc mừng! Bạn đã hoàn thành cả khóa học.' : 'Tiến độ khóa học đã được cập nhật.'); if (ctx.data.next) location.hash = ctx.data.next.quizId ? '#/quiz/' + ctx.data.next.quizId : `#/lesson/${ctx.data.course.id}/${ctx.data.next.id}`; else ctx.reload(); }
          catch (e) { LMS.handleError(e); }
        });
      },
      'download-file': (el) => { ui.download(el.dataset.name.replace(/\.\w+$/, '') + '-mau.txt', `Tệp mẫu giả lập: ${el.dataset.name}\nNội dung thật được tải từ kho lưu trữ có phân quyền (signed URL).`, 'text/plain;charset=utf-8'); ui.notify.success('Đang tải xuống', el.dataset.name); },
      'report-file': async (el, ctx) => { try { await api.learner.feedback(ctx.data.lesson.id, { kind: 'report', text: `Tệp "${el.dataset.name}" không mở được.` }); ui.notify.success('Đã báo tệp lỗi', 'Giảng viên sẽ thay thế tệp sớm nhất.'); } catch (e) { LMS.handleError(e); } },
      'pdf-retry': (el, ctx) => ctx.reload(),
      theme: () => LMS.shell.actions.theme(),
    },
  });
})(window.LMS);
