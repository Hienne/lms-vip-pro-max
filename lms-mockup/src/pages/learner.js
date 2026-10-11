/* ==========================================================================
   pages/learner.js — Dashboard học viên, Danh mục khóa học, Chi tiết khóa học
   ========================================================================== */
(function (LMS) {
  const { html, raw, icon, mai, UI, Charts, fmt, ui, api } = LMS;
  const TYPE = { video: ['video', 'Video'], pdf: ['pdf', 'Tài liệu PDF'], text: ['file', 'Bài đọc'], process: ['process', 'Quy trình'], image: ['image', 'Hình ảnh'], attachment: ['paperclip', 'Tệp đính kèm'], quiz: ['clipboard', 'Bài kiểm tra'] };

  /* ======================= DASHBOARD ======================= */
  LMS.page('dashboard', {
    title: 'Trang chủ học tập', initState: () => ({ tab: 'in_progress' }),
    load: () => api.learner.dashboard(),
    view: (d, ctx) => {
      const first = d.user.name.split(' ').pop();
      const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
      const msg = d.counts.overdue ? `Bạn có ${d.counts.overdue} khóa đã quá hạn — ưu tiên hoàn thành sớm nhé.` : d.deadlines.length ? `Khóa gần hạn nhất: "${d.deadlines[0].title}" (${fmt.daysLeft(d.deadlines[0].dueAt)} ngày).` : 'Bạn đã theo kịp toàn bộ lộ trình được giao.';
      const tabs = [{ id: 'in_progress', label: 'Đang học', count: d.counts.inProgress }, { id: 'not_started', label: 'Chưa bắt đầu', count: d.counts.notStarted }, { id: 'completed', label: 'Đã hoàn thành', count: d.counts.completed }, { id: 'required', label: 'Bắt buộc', count: d.counts.required }, { id: 'assigned', label: 'Được giao', count: d.counts.assigned }];
      const list = d.cards.filter((c) => (ctx.state.tab === 'required' ? c.required : ctx.state.tab === 'assigned' ? c.assigned : ctx.state.tab === 'in_progress' ? c.status === 'in_progress' || c.status === 'failed' : c.status === ctx.state.tab));
      return html`<div class="page">
      <section class="hero animate-enter" aria-labelledby="greet">
        <div class="hero__mai" aria-hidden="true">${mai(360, '#fff', '#fff')}</div>
        <div class="hero__main"><span class="eyebrow" style="color:#A9CFCC">${today}</span><h1 id="greet" style="color:#fff">Chào ${first}, hôm nay học gì tiếp nhỉ?</h1><p style="color:#CFE6E4">${msg}</p>
          ${d.continue ? html`<div class="row mt-4"><a class="btn btn--on-dark btn--lg" href="${d.continue.href}">${icon('play')}Tiếp tục học</a><span class="text-sm" style="color:#E6F2F1">${d.continue.lessonTitle}<br><span style="color:#A9CFCC">${d.continue.where} · ${d.continue.courseTitle}</span></span></div>` : html`<a class="btn btn--on-dark btn--lg mt-4" href="#/catalog">${icon('library')}Khám phá khóa học</a>`}
        </div>
        <a class="hero__reward" href="#/leaderboard" aria-label="Điểm thưởng ${fmt.num(d.points.total)} — xem bảng xếp hạng">${mai(36)}<div><div class="num" style="font-size:var(--text-2xl);font-weight:700;color:#FFD15C">${fmt.num(d.points.total)}</div><div class="text-xs" style="color:#E6F2F1">Điểm thưởng · chuỗi ${d.streak} ngày</div></div></a>
      </section>

      <div class="grid grid-4 mt-6">
        ${UI.Kpi({ icon: 'book', value: d.counts.assigned, label: 'Khóa học được giao', delta: `${d.counts.required} bắt buộc · ${d.counts.overdue} quá hạn`, href: '#/catalog?status=assigned' })}
        <div class="card"><div class="kpi">${UI.Ring(d.completionPct, { size: 56, stroke: 6, label: '' })}<div><div class="kpi__value">${d.completionPct}<small>%</small></div><div class="kpi__label">Tỷ lệ hoàn thành</div><div class="kpi__delta text-muted">${d.counts.completed}/${d.cards.length} khóa đã xong</div></div></div></div>
        ${UI.Kpi({ icon: 'clipboard', tone: d.lastScore && !d.lastScore.passed ? 'danger' : 'info', value: d.lastScore ? d.lastScore.score : '—', suffix: d.lastScore ? '%' : '', label: 'Điểm kiểm tra gần nhất', delta: d.lastScore ? `${d.lastScore.passed ? 'Đạt' : 'Chưa đạt'} · ${d.lastScore.quiz}` : 'Chưa làm bài kiểm tra', href: '#/progress' })}
        ${UI.Kpi({ icon: 'trophy', tone: 'reward', value: d.bestScore ?? '—', suffix: d.bestScore != null ? '%' : '', label: 'Điểm cao nhất', delta: `Đạt ${d.passedQuizzes}/${d.totalQuizzes} bài kiểm tra`, href: '#/progress' })}
      </div>

      <div class="dash-grid mt-6">
        <div class="stack" style="--gap:24px">
          <section class="card"><div class="card__header"><h2>Khóa học của tôi</h2><a class="link-btn" href="#/catalog">Xem tất cả ${icon('arrow-right', 'icon--sm')}</a></div>
            ${UI.Tabs(tabs, ctx.state.tab, 'tab', 'Lọc khóa học theo trạng thái')}
            <div class="card__body">${list.length ? html`<div class="grid grid-auto">${list.map(UI.CourseCard)}</div>` : UI.Empty({ icon: 'book', title: 'Không có khóa học ở trạng thái này', desc: 'Chọn trạng thái khác hoặc khám phá thêm khóa học tự chọn.', action: UI.Button({ label: 'Mở danh mục', href: '#/catalog', variant: 'secondary' }) })}</div></section>
          ${UI.Card({ title: 'Biểu đồ năng lực', actions: html`<a class="link-btn" href="#/progress">Chi tiết</a>`, body: d.competency.some((c) => c.answered) ? html`<div class="radar-row">${Charts.Radar({ data: d.competency, size: 300 })}<ul class="stack" style="--gap:10px;list-style:none;padding:0">${d.competency.map((c) => html`<li class="stack" style="--gap:4px"><div class="row-between text-sm"><span>${c.name}</span><strong class="num">${c.answered ? c.value + '%' : '—'}</strong></div>${UI.Progress(c.value, { sm: true, tone: !c.answered ? '' : c.value >= 70 ? 'success' : c.value >= 50 ? '' : 'warning', label: c.name })}</li>`)}<li class="text-xs text-muted">Tính từ lần thi tốt nhất của từng bài kiểm tra. "—" = chưa có câu hỏi thuộc nhóm.</li></ul></div>` : UI.Empty({ icon: 'target', title: 'Chưa có dữ liệu năng lực', desc: 'Làm bài kiểm tra đầu tiên để hệ thống tính năng lực theo nhóm kiến thức.' }) })}
          ${d.journey.length ? UI.Card({ title: 'Lộ trình theo chương trình', actions: html`<span class="text-xs text-muted">Tính từ tiến độ các khóa được giao</span>`, body: UI.Journey(d.journey) }) : ''}
        </div>
        <div class="stack" style="--gap:24px">
          ${UI.Card({ title: 'Hạn hoàn thành', pad: false, body: d.deadlines.length ? html`<ul class="list">${d.deadlines.slice(0, 5).map((c) => html`<li><a class="list__item" href="#/course/${c.id}"><span class="list__icon" style="${c.overdue ? 'background:var(--color-danger-subtle);color:var(--color-danger)' : ''}">${icon(c.overdue ? 'alert' : 'calendar', 'icon--sm')}</span><span class="grow" style="min-width:0"><span class="text-sm fw-600 truncate" style="display:block">${c.title}</span>${UI.Due(c.dueAt, false)}</span><span class="num text-sm fw-600">${c.pct}%</span></a></li>`)}</ul>` : html`<div class="card__body">${UI.Empty({ icon: 'calendar', title: 'Không có hạn sắp tới', desc: 'Các khóa được giao kèm hạn sẽ hiển thị ở đây.' })}</div>` })}
          ${UI.Card({ title: 'Công cụ học nhanh', pad: false, body: html`<ul class="list">${[['#/assistant', 'sparkles', 'Hỏi trợ lý AI', 'Tra cứu tài liệu có trích nguồn'], ['#/flashcards', 'layers', 'Ôn bằng flashcard', 'Sinh từ ngân hàng câu hỏi'], ['#/saved', 'bookmark', 'Ghi chú & đánh dấu', 'Mở đúng trang / mốc video']].map(([h, ic, t, s2]) => html`<li><a class="list__item" href="${h}"><span class="list__icon">${icon(ic, 'icon--sm')}</span><span class="grow"><span class="text-sm fw-600">${t}</span><br><span class="text-xs text-muted">${s2}</span></span>${icon('chevron-right', 'icon--sm')}</a></li>`)}</ul>` })}
        </div>
      </div></div>`;
    },
    actions: { tab: (el, ctx) => { ctx.state.tab = el.dataset.id; ctx.rerender(); } },
  });

  /* ======================= CATALOG ======================= */
  const STATUS_OPTS = [{ value: 'not_started', label: 'Chưa bắt đầu' }, { value: 'in_progress', label: 'Đang học' }, { value: 'completed', label: 'Đã hoàn thành' }, { value: 'failed', label: 'Chưa đạt' }, { value: 'overdue', label: 'Quá hạn' }, { value: 'assigned', label: 'Được giao' }];
  LMS.page('catalog', {
    title: 'Danh mục khóa học',
    initState: (info) => ({ q: info.query.q || '', domain: info.query.domain || '', module: '', program: '', level: '', status: info.query.status || '', req: '', sort: 'due' }),
    load: () => api.learner.catalog(),
    view: (d, ctx) => {
      const s = ctx.state; const q = s.q.trim().toLowerCase();
      let list = d.courses.filter((c) => (!q || [c.title, c.desc, c.code, c.module, c.program, c.domain].join(' ').toLowerCase().includes(q)) && (!s.domain || c.domainId === s.domain) && (!s.module || c.module === s.module) && (!s.program || c.programId === s.program) && (!s.level || c.level === s.level) && (!s.req || String(c.required) === s.req) && (!s.status || (s.status === 'overdue' ? c.overdue : s.status === 'assigned' ? c.assigned : c.status === s.status)));
      const sorters = { due: (a, b) => new Date(a.dueAt || 8e15) - new Date(b.dueAt || 8e15), name: (a, b) => a.title.localeCompare(b.title, 'vi'), progress: (a, b) => b.pct - a.pct };
      list = list.sort(sorters[s.sort]);
      const active = ['q', 'domain', 'module', 'program', 'level', 'status', 'req'].filter((k) => s[k]).length;
      return html`<div class="page">${UI.PageHeader({ eyebrow: 'Thư viện đào tạo', title: 'Danh mục khóa học', desc: 'Tìm theo tên, lĩnh vực, phân hệ nghiệp vụ, chương trình, mức độ, trạng thái học tập hoặc từ khóa.' })}
        <section class="card card--pad stack" style="--gap:12px" aria-label="Bộ lọc">
          <div class="row">${UI.Search({ value: s.q, placeholder: 'Từ khóa: CIF, EOD, thay đổi…', action: 'f-q', label: 'Tìm theo từ khóa', width: '340px' })}
            ${UI.FilterSelect({ label: 'Lĩnh vực', value: s.domain, action: 'f-domain', options: d.domains.map((x) => ({ value: x.id, label: x.name })) })}
            ${UI.FilterSelect({ label: 'Phân hệ', value: s.module, action: 'f-module', options: d.modules.map((x) => ({ value: x, label: x })) })}
            ${UI.FilterSelect({ label: 'Chương trình', value: s.program, action: 'f-program', options: d.programs.map((x) => ({ value: x.id, label: x.name })) })}</div>
          <div class="row">${UI.FilterSelect({ label: 'Mức độ', value: s.level, action: 'f-level', options: d.levels.map((x) => ({ value: x, label: x })) })}
            ${UI.FilterSelect({ label: 'Trạng thái', value: s.status, action: 'f-status', options: STATUS_OPTS })}
            ${UI.FilterSelect({ label: 'Loại', value: s.req, action: 'f-req', options: [{ value: 'true', label: 'Bắt buộc' }, { value: 'false', label: 'Tự chọn' }] })}
            <span class="grow"></span>${active ? UI.Button({ label: `Xóa ${active} bộ lọc`, icon: 'x', variant: 'ghost', action: 'clear' }) : ''}</div>
        </section>
        <div class="row-between mt-4 mb-4"><p class="text-sm text-muted" role="status" aria-live="polite"><strong class="text-secondary">${list.length}</strong> khóa học phù hợp</p>
          <div class="row" style="--gap:8px"><label for="sort" class="text-sm text-muted">Sắp xếp</label><select id="sort" class="select" style="width:auto" data-change="f-sort"><option value="due" ${s.sort === 'due' ? raw('selected') : ''}>Hạn gần nhất</option><option value="progress" ${s.sort === 'progress' ? raw('selected') : ''}>Tiến độ cao nhất</option><option value="name" ${s.sort === 'name' ? raw('selected') : ''}>Tên A–Z</option></select></div></div>
        ${list.length ? html`<div class="grid grid-auto">${list.map(UI.CourseCard)}</div>` : html`<div class="card">${UI.Empty({ icon: 'search', title: 'Không có khóa học phù hợp', desc: 'Thử bỏ bớt bộ lọc hoặc dùng từ khóa khác.', action: UI.Button({ label: 'Xóa bộ lọc', variant: 'primary', action: 'clear' }) })}</div>`}
      </div>`;
    },
    actions: Object.assign({ clear: (el, ctx) => { Object.assign(ctx.state, { q: '', domain: '', module: '', program: '', level: '', status: '', req: '' }); ctx.rerender(); } },
      ...['q', 'domain', 'module', 'program', 'level', 'status', 'req', 'sort'].map((k) => ({ ['f-' + k]: (el, ctx) => { ctx.state[k] = el.value; ctx.rerender(); } }))),
  });

  /* ======================= COURSE DETAIL ======================= */
  LMS.page('course', {
    title: (ctx) => (ctx.data ? ctx.data.title : 'Chi tiết khóa học'),
    load: (ctx) => api.learner.course(ctx.params.id),
    view: (c) => {
      const cont = c.continue; const contHref = cont ? (cont.quizId ? `#/quiz/${cont.quizId}` : `#/lesson/${c.id}/${cont.lessonId}`) : null;
      const cta = c.status === 'completed' ? UI.Button({ label: 'Xem chứng nhận', icon: 'award', variant: 'primary', href: '#/certificates', size: 'lg' }) : !c.enrolled && !c.required ? UI.Button({ label: 'Đăng ký học', icon: 'plus', variant: 'primary', action: 'enroll', size: 'lg' }) : contHref ? html`<a class="btn btn--primary btn--lg btn--block" href="${contHref}">${icon('play')}${c.pct > 0 ? 'Tiếp tục học' : 'Bắt đầu học'}</a>` : '';
      return html`<div class="page">${UI.Breadcrumb([{ label: 'Danh mục khóa học', href: '#/catalog' }, { label: c.program, href: `#/catalog` }, { label: c.title }])}
      <section class="hero hero--compact animate-enter"><div class="hero__mai" aria-hidden="true">${mai(300, '#fff', '#fff')}</div><div class="hero__main">
        <div class="row" style="--gap:8px">${UI.Required(c.required)}<span class="badge" style="background:rgba(255,255,255,.14);color:#fff">${c.domain} · ${c.module}</span><span class="badge" style="background:rgba(255,255,255,.14);color:#fff">${c.code}</span></div>
        <h1 style="color:#fff">${c.title}</h1><p style="color:#CFE6E4">${c.desc}</p>
        <div class="row text-sm" style="color:#E6F2F1;--gap:20px"><span class="row" style="--gap:6px">${icon('clock', 'icon--sm')}${fmt.minutes(c.minutes)}</span><span class="row" style="--gap:6px">${icon('book', 'icon--sm')}${c.lessons} bài · ${c.chapters.length} chương</span><span class="row" style="--gap:6px">${icon('target', 'icon--sm')}${c.level}</span>${c.dueAt ? html`<span class="row" style="--gap:6px">${icon('calendar', 'icon--sm')}Hạn ${fmt.date(c.dueAt)}</span>` : ''}${c.rating ? html`<span class="row" style="--gap:6px">${icon('star', 'icon--sm')}${fmt.score(c.rating.avg)} (${c.rating.count})</span>` : ''}</div></div></section>
      <div class="dash-grid mt-6">
        <div class="stack" style="--gap:24px">
          ${c.overdue ? html`<div class="alert alert--danger">${icon('alert')}<div><strong>Khóa học đã quá hạn ${-fmt.daysLeft(c.dueAt)} ngày.</strong> Hoàn thành sớm để cập nhật trạng thái — quản lý trực tiếp đã nhận được thông báo.</div></div>` : ''}
          ${c.status === 'failed' ? html`<div class="alert alert--danger">${icon('x-circle')}<div><strong>Bạn đã dùng hết lượt thi mà chưa đạt.</strong> Liên hệ giảng viên để được xem xét cấp thêm lượt.</div></div>` : ''}
          ${UI.Card({ title: 'Mục tiêu đầu ra', body: html`<ul class="stack" style="--gap:10px;list-style:none;padding:0">${c.outcomes.map((o) => html`<li class="row" style="--gap:10px;align-items:flex-start;flex-wrap:nowrap">${mai(18)}<span>${o}</span></li>`)}</ul>` })}
          <section class="card" aria-labelledby="toc-h"><div class="card__header"><h2 id="toc-h">Nội dung khóa học</h2><span class="text-sm text-muted">${c.done}/${c.total} bài đã hoàn thành</span></div>
            ${c.chapters.map((ch, i) => { const done = ch.lessons.filter((l) => l.status === 'completed').length; return html`<details class="chapter" ${i === 0 || ch.lessons.some((l) => l.status === 'in_progress') ? raw('open') : ''}><summary class="chapter__head"><span class="chapter__num">${i + 1}</span><span class="grow"><span class="fw-600">Chương ${i + 1} · ${ch.title}</span><br><span class="text-xs text-muted">${ch.lessons.length} bài · đã xong ${done}/${ch.lessons.length}</span></span>${icon('chevron-down', 'icon--sm chapter__chev')}</summary>
              <ol class="list">${ch.lessons.map((l) => html`<li><a class="list__item" href="${l.quizId ? `#/quiz/${l.quizId}` : `#/lesson/${c.id}/${l.id}`}"><span class="lesson-state lesson-state--${l.status}" aria-label="${{ completed: 'Đã hoàn thành', in_progress: 'Đang học', not_started: 'Chưa học' }[l.status]}">${l.status === 'completed' ? icon('check', 'icon--sm') : l.status === 'in_progress' ? icon('play', 'icon--sm') : ''}</span><span class="grow" style="min-width:0"><span class="text-sm fw-600">${l.title}</span><br><span class="row text-xs text-muted" style="--gap:10px">${l.types.map((t) => html`<span class="row" style="--gap:4px">${icon(TYPE[t][0], 'icon--sm')}${TYPE[t][1]}</span>`)}</span></span><span class="text-xs text-muted num">${l.minutes} phút</span></a></li>`)}</ol></details>`; })}
          </section>
        </div>
        <aside class="stack" style="--gap:24px">
          <section class="card card--pad stack" style="--gap:16px;align-items:center;text-align:center">${UI.Ring(c.pct, { size: 128, stroke: 11 })}<div class="text-sm text-secondary">Đã học ${c.done}/${c.total} bài · ${UI.CourseStatus(c.status, c.overdue)}</div>${cta}
            ${c.lastAccessAt ? html`<div class="text-xs text-muted">Truy cập gần nhất ${fmt.relative(c.lastAccessAt)}${c.startedAt ? ` · bắt đầu ${fmt.date(c.startedAt)}` : ''}</div>` : ''}</section>
          ${c.quiz ? UI.Card({ title: 'Bài kiểm tra cuối khóa', body: html`<dl class="stack" style="--gap:10px">${[['Điểm đạt', `≥ ${c.quiz.passPct}%`], ['Lượt đã dùng', `${c.quiz.attempts}/${c.quiz.maxAttempts}`], ['Điểm gần nhất', c.quiz.last != null ? c.quiz.last + '%' : '—'], ['Điểm cao nhất', c.quiz.best != null ? c.quiz.best + '%' : '—']].map(([k, v]) => html`<div class="row-between text-sm"><dt class="text-muted">${k}</dt><dd class="fw-600 num">${v}</dd></div>`)}</dl>${c.quiz.attempts ? html`<a class="link-btn mt-2" href="#/quiz/${c.quiz.quizId}/attempts">${icon('history', 'icon--sm')}Lịch sử thi</a>` : ''}` }) : ''}
          ${UI.Card({ title: 'Điều kiện hoàn thành', body: html`<ul class="stack" style="--gap:10px;list-style:none;padding:0">${[[c.done >= c.total - (c.quiz ? 1 : 0), `Học đủ ${c.total - (c.quiz ? 1 : 0)} bài nội dung`], ...(c.quiz ? [[c.quiz.passed, `Đạt bài kiểm tra ≥ ${c.quiz.passPct}%`]] : [])].map(([ok, t]) => html`<li class="row text-sm" style="--gap:10px">${ok ? html`<span class="text-success">${icon('check-circle')}</span>` : html`<span class="text-muted">${icon('target')}</span>`}<span>${t}</span></li>`)}</ul>` })}
          <div class="card card--reward card--pad row" style="--gap:14px">${mai(36)}<div><div class="fw-700 text-accent num" style="font-size:var(--text-xl)">+${c.rewardPoints}</div><div class="text-sm text-secondary">Điểm thưởng khi hoàn thành</div></div></div>
        </aside></div></div>`;
    },
    actions: { enroll: async (el, ctx) => { await ui.busy(el, () => api.learner.enroll(ctx.params.id)); ui.notify.success('Đã đăng ký khóa học', 'Khóa học đã được thêm vào "Khóa học của tôi".'); ctx.reload(); } },
  });
})(window.LMS);
