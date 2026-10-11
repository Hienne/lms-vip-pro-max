/* ==========================================================================
   pages/quiz.js — Giới thiệu bài thi, Làm bài, Kết quả, Lịch sử thi
   ========================================================================== */
(function (LMS) {
  const { html, raw, icon, mai, UI, fmt, ui, api } = LMS;
  const REVIEW = { never: 'Không cho xem đáp án', after_submit: 'Xem đáp án & giải thích ngay sau khi nộp', after_pass: 'Xem đáp án khi đã đạt', after_close: 'Xem đáp án sau khi đóng đề' };

  /* ======================= INTRO ======================= */
  LMS.page('quizIntro', {
    title: (ctx) => (ctx.data ? ctx.data.quiz.title : 'Bài kiểm tra'),
    load: (ctx) => api.learner.quizIntro(ctx.params.id),
    view: (d) => {
      const q = d.quiz, s = d.summary;
      return html`<div class="page page--narrow">${UI.Breadcrumb([{ label: d.course.title, href: `#/course/${d.course.id}` }, { label: 'Bài kiểm tra' }])}
      ${UI.PageHeader({ eyebrow: 'Bài kiểm tra', title: q.title, desc: `Thuộc khóa "${d.course.title}". Kết quả được chấm tự động và lưu vào hồ sơ học tập.` })}
      <div class="grid grid-4">${[['help', `${q.questionCount} câu`, q.hasMultiple ? 'Có câu nhiều đáp án' : 'Một đáp án/câu'], ['clock', `${q.minutes} phút`, 'Tự động nộp khi hết giờ'], ['target', `≥ ${q.passPct}%`, 'Điểm đạt'], ['refresh', `${s.left}/${q.maxAttempts}`, 'Lượt thi còn lại']].map(([ic, v, l]) => html`<div class="card"><div class="kpi"><div class="kpi__icon">${icon(ic)}</div><div><div class="kpi__value" style="font-size:var(--text-xl)">${v}</div><div class="kpi__label">${l}</div></div></div></div>`)}</div>
      <div class="grid grid-2 mt-6">
        ${UI.Card({ title: 'Quy chế bài thi', body: html`<ul class="stack text-sm" style="--gap:10px">
          <li>Đồng hồ bắt đầu đếm khi bạn nhấn <strong>Bắt đầu làm bài</strong>; tải lại trang hay đổi thiết bị đồng hồ vẫn tiếp tục.</li>
          <li>Đáp án được lưu ngay khi chọn. Có thể đánh dấu câu để xem lại và chuyển câu tự do.</li>
          <li>Hệ thống <strong>${q.shuffleQuestions ? 'trộn thứ tự câu hỏi' : 'giữ thứ tự câu hỏi'}</strong>${q.shuffleOptions ? ' và trộn phương án' : ''}; mỗi lượt có thể nhận bộ câu khác nhau.</li>
          <li>Mở đề: ${fmt.datetime(q.openAt)} — Đóng đề: ${fmt.datetime(q.closeAt)}.</li>
          <li>${q.retakeWaitHours ? `Chờ ${q.retakeWaitHours} giờ giữa hai lượt thi.` : 'Được thi lại ngay nếu còn lượt.'} ${REVIEW[q.reviewPolicy]}.</li></ul>` })}
        ${UI.Card({ title: 'Kết quả của bạn', body: s.attempts ? html`<dl class="stack" style="--gap:10px">${[['Số lần đã thi', `${s.attempts}`], ['Điểm gần nhất', `${s.last}%`], ['Điểm cao nhất', `${s.best}%`], ['Trạng thái', s.passed ? 'Đã đạt' : s.failedOut ? 'Chưa đạt — hết lượt' : 'Chưa đạt']].map(([k, v]) => html`<div class="row-between text-sm"><dt class="text-muted">${k}</dt><dd class="fw-600 num">${v}</dd></div>`)}</dl><a class="link-btn mt-4" href="#/quiz/${q.id}/attempts">${icon('history', 'icon--sm')}Xem lịch sử ${s.attempts} lần thi</a>` : UI.Empty({ icon: 'clipboard', title: 'Chưa có lần thi nào', desc: 'Kết quả và lịch sử thi sẽ hiển thị tại đây.' }) })}
      </div>
      ${!d.lessonsDone && !d.block ? html`<div class="alert alert--warning mt-6">${icon('alert')}<div>Bạn chưa học hết các bài nội dung của khóa. Bạn vẫn có thể làm bài, nhưng nên hoàn thành nội dung trước để đạt kết quả tốt.</div></div>` : ''}
      <div class="card card--pad row-between mt-6" style="position:sticky;bottom:16px;box-shadow:var(--shadow-md)">
        ${d.block ? html`<div class="row" style="--gap:10px"><span class="${d.block.code === 'passed' ? 'text-success' : 'text-warning'}">${icon(d.block.code === 'passed' ? 'check-circle' : 'lock')}</span><span class="text-sm">${d.block.message}</span></div>${d.block.code === 'passed' ? UI.Button({ label: 'Về khóa học', href: `#/course/${d.course.id}`, variant: 'primary' }) : UI.Button({ label: 'Về khóa học', href: `#/course/${d.course.id}` })}` : html`<div class="text-sm text-secondary">${d.pendingAttemptId ? 'Bạn có một lượt thi đang làm dở — tiếp tục để không mất thời gian.' : `Lượt thi thứ ${s.attempts + 1}/${q.maxAttempts}`}</div>${UI.Button({ label: d.pendingAttemptId ? 'Tiếp tục làm bài' : 'Bắt đầu làm bài', icon: 'play', variant: 'primary', size: 'lg', action: 'start' })}`}
      </div></div>`;
    },
    actions: {
      start: async (el, ctx) => {
        if (!ctx.data.pendingAttemptId && !(await ui.confirm({ title: 'Bắt đầu làm bài?', message: `Bạn có ${ctx.data.quiz.minutes} phút cho ${ctx.data.quiz.questionCount} câu. Lượt thi sẽ được tính khi bắt đầu.`, confirmLabel: 'Bắt đầu', icon: 'play' }))) return;
        location.hash = `#/quiz/${ctx.params.id}/take`;
      },
    },
  });

  /* ======================= TAKE ======================= */
  LMS.page('quizTake', {
    title: 'Làm bài kiểm tra', layout: 'focus',
    initState: () => ({ i: 0, pending: {} }),
    skeleton: () => html`<div class="focus-bar"><div class="skeleton skeleton--title" style="width:240px"></div></div><div class="page"><div class="skeleton skeleton--block" style="height:320px"></div></div>`,
    load: (ctx) => api.learner.startAttempt(ctx.params.id),
    view: (d, ctx) => {
      const N = d.questions.length; const i = Math.min(ctx.state.i, N - 1); const q = d.questions[i];
      const ans = d.attempt.answers; const flags = new Set(d.attempt.flags);
      const mine = ans[q.id] || []; const answered = d.questions.filter((x) => (ans[x.id] || []).length).length;
      return html`<div class="focus-bar"><div class="grow" style="min-width:0"><div class="text-xs text-muted">Bài kiểm tra</div><div class="fw-600 truncate">${d.quiz.title}</div></div>
        <span class="text-xs text-muted hide-sm" data-save-state aria-live="polite"></span>
        <div class="timer" role="timer" aria-live="off" data-timer>${icon('clock', 'icon--sm')}<span data-timer-text>--:--</span></div>
        ${UI.Button({ label: 'Nộp bài', variant: 'primary', action: 'submit' })}</div>
      <div class="quiz-layout page">
        <section class="stack" style="--gap:20px" aria-labelledby="q-h">
          <div class="row-between"><span class="eyebrow">Câu ${i + 1} / ${N} · ${q.code}</span><button class="btn btn--ghost btn--sm" data-action="flag" aria-pressed="${flags.has(q.id)}">${icon('flag', 'icon--sm')}${flags.has(q.id) ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại'}</button></div>
          <h1 id="q-h" style="font-size:var(--text-xl);font-weight:600;line-height:1.4">${q.text}</h1>
          <p class="text-sm ${q.type === 'multiple' ? 'text-warning fw-600' : 'text-muted'}">${q.type === 'multiple' ? 'Chọn TẤT CẢ đáp án đúng (có thể nhiều hơn 1).' : 'Chọn 1 đáp án đúng.'} Phím tắt: 1–${q.options.length} chọn, ← → chuyển câu.</p>
          <fieldset class="stack" style="--gap:10px;border:0;padding:0"><legend class="sr-only">Phương án trả lời</legend>
            ${q.options.map((o, k) => html`<label class="option-card"><input type="${q.type === 'multiple' ? 'checkbox' : 'radio'}" name="opt" value="${o.id}" data-change="answer" ${mine.includes(o.id) ? raw('checked') : ''}><span class="badge badge--outline" aria-hidden="true">${String.fromCharCode(65 + k)}</span><span class="grow">${o.text}</span></label>`)}
          </fieldset>
          <div class="row-between">${UI.Button({ label: 'Câu trước', icon: 'chevron-left', action: 'prev', disabled: i === 0 })}${i < N - 1 ? UI.Button({ label: 'Câu tiếp', icon: 'chevron-right', iconRight: true, variant: 'secondary', action: 'next' }) : UI.Button({ label: 'Xem lại & nộp bài', icon: 'check', variant: 'primary', action: 'submit' })}</div>
        </section>
        <aside class="card card--pad stack" style="--gap:16px;align-self:start;position:sticky;top:76px" aria-label="Danh sách câu hỏi">
          <div class="row-between"><span class="eyebrow">Danh sách câu</span><span class="text-sm num"><strong>${answered}</strong>/${N} đã trả lời</span></div>
          ${UI.Progress((answered / N) * 100, { sm: true, label: 'Đã trả lời' })}
          <div class="q-grid">${d.questions.map((x, k) => html`<button class="q-cell ${(ans[x.id] || []).length ? 'is-answered' : ''} ${flags.has(x.id) ? 'is-flagged' : ''}" data-action="goto" data-i="${k}" aria-current="${k === i}" aria-label="Câu ${k + 1}${(ans[x.id] || []).length ? ', đã trả lời' : ', chưa trả lời'}${flags.has(x.id) ? ', đã đánh dấu' : ''}">${k + 1}</button>`)}</div>
          <div class="q-legend"><span><i style="background:var(--color-primary);border-color:var(--color-primary)"></i>Đã trả lời</span><span><i></i>Chưa trả lời</span><span><i style="background:var(--color-warning);border-color:var(--color-warning);border-radius:50%"></i>Đánh dấu xem lại</span><span><i style="outline:2px solid var(--color-text);outline-offset:1px"></i>Câu đang xem</span></div>
          ${UI.Button({ label: 'Nộp bài', variant: 'primary', action: 'submit', attrs: 'style="width:100%"' })}
        </aside></div>`;
    },
    mount(ctx) {
      const d = ctx.data; const deadline = new Date(d.attempt.deadlineAt).getTime(); let warned = false; let done = false;
      ctx.setGuard(() => (done ? null : 'Bài thi đang diễn ra — đồng hồ vẫn tiếp tục chạy kể cả khi bạn rời trang. Đáp án đã chọn được giữ lại.'));
      const tick = () => {
        const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
        const t = ctx.el.querySelector('[data-timer-text]'); const box = ctx.el.querySelector('[data-timer]');
        if (t) { t.textContent = fmt.time(left); box.classList.toggle('is-low', left <= 60); box.setAttribute('aria-label', `Còn ${Math.floor(left / 60)} phút ${left % 60} giây`); }
        if (left <= 60 && !warned) { warned = true; ui.notify.warning('Còn 1 phút', 'Bài sẽ tự động nộp khi hết giờ.'); }
        if (left <= 0 && !done) { done = true; clearInterval(iv); submit(ctx, true); }
      };
      const iv = setInterval(tick, 1000); tick();
      const keys = (e) => {
        if (e.target.matches('textarea,input[type=text]') || document.querySelector('.overlay')) return;
        const q = d.questions[ctx.state.i];
        if (/^[1-9]$/.test(e.key) && q.options[+e.key - 1]) { const inp = ctx.el.querySelectorAll('input[name=opt]')[+e.key - 1]; inp.checked = q.type === 'multiple' ? !inp.checked : true; inp.dispatchEvent(new Event('change', { bubbles: true })); }
        if (e.key === 'ArrowRight' && ctx.state.i < d.questions.length - 1) { ctx.state.i++; ctx.rerender(); }
        if (e.key === 'ArrowLeft' && ctx.state.i > 0) { ctx.state.i--; ctx.rerender(); }
      };
      document.addEventListener('keydown', keys);
      ctx.state.markDone = () => { done = true; };
      return () => { clearInterval(iv); document.removeEventListener('keydown', keys); };
    },
    actions: {
      answer: async (el, ctx) => {
        const d = ctx.data; const q = d.questions[ctx.state.i];
        const ids = [...ctx.el.querySelectorAll('input[name=opt]:checked')].map((x) => x.value);
        d.attempt.answers[q.id] = ids;
        const st = ctx.el.querySelector('[data-save-state]');
        ctx.el.querySelectorAll('.q-cell')[ctx.state.i].classList.toggle('is-answered', ids.length > 0);
        const cnt = d.questions.filter((x) => (d.attempt.answers[x.id] || []).length).length;
        const lbl = ctx.el.querySelector('aside .num strong'); if (lbl) lbl.textContent = cnt;
        const bar = ctx.el.querySelector('aside .progress__bar'); if (bar) bar.style.width = (cnt / d.questions.length) * 100 + '%';
        try { await api.learner.saveAnswer(d.attempt.id, q.id, ids); delete ctx.state.pending[q.id]; if (st) st.innerHTML = String(html`${icon('check', 'icon--sm')} Đã lưu đáp án`); }
        catch (e) { ctx.state.pending[q.id] = ids; if (st) st.innerHTML = String(html`<span class="text-warning">${icon('wifi-off', 'icon--sm')} Lưu tạm trên máy — sẽ gửi lại</span>`); if (e.status === 401) LMS.handleError(e); }
      },
      flag: async (el, ctx) => { const d = ctx.data; const q = d.questions[ctx.state.i]; const on = !d.attempt.flags.includes(q.id); d.attempt.flags = on ? [...d.attempt.flags, q.id] : d.attempt.flags.filter((x) => x !== q.id); ctx.rerender(); try { await api.learner.saveAnswer(d.attempt.id, q.id, null, on); } catch (e) { /* cờ chỉ mang tính hỗ trợ */ } },
      prev: (el, ctx) => { ctx.state.i = Math.max(0, ctx.state.i - 1); ctx.rerender(); },
      next: (el, ctx) => { ctx.state.i = Math.min(ctx.data.questions.length - 1, ctx.state.i + 1); ctx.rerender(); },
      goto: (el, ctx) => { ctx.state.i = +el.dataset.i; ctx.rerender(); },
      submit: (el, ctx) => submit(ctx, false),
    },
  });

  async function submit(ctx, auto) {
    const d = ctx.data;
    // Gửi lại các đáp án chưa lưu được (mất mạng tạm thời)
    for (const [qid, ids] of Object.entries(ctx.state.pending)) { try { await api.learner.saveAnswer(d.attempt.id, qid, ids); delete ctx.state.pending[qid]; } catch (e) { /* thử lại khi nộp */ } }
    if (!auto) {
      const un = d.questions.map((q, k) => ((d.attempt.answers[q.id] || []).length ? null : k + 1)).filter(Boolean);
      const fl = d.attempt.flags.length;
      const ok = await ui.modal({ title: 'Nộp bài kiểm tra?', icon: un.length ? 'alert' : 'check-circle', tone: un.length ? 'warning' : 'primary', body: html`${un.length ? html`<div class="alert alert--warning mb-4">${icon('alert')}<div><strong>Còn ${un.length} câu chưa trả lời:</strong> câu ${un.join(', ')}. Câu chưa trả lời được tính là sai.</div></div>` : html`<p class="mb-2">Bạn đã trả lời tất cả ${d.questions.length} câu.</p>`}${fl ? html`<p class="mb-2">Có ${fl} câu đang được đánh dấu xem lại.</p>` : ''}<p>Sau khi nộp, bạn không thể thay đổi đáp án.</p>`, actions: [{ label: 'Xem lại', variant: 'ghost', value: false }, { label: 'Nộp bài', variant: 'primary', value: true }] });
      if (!ok) return;
    }
    try {
      const r = await api.learner.submitAttempt(d.attempt.id, { auto });
      ctx.state.markDone && ctx.state.markDone(); ctx.setGuard(null);
      if (auto) await ui.modal({ title: 'Đã hết giờ làm bài', icon: 'clock', tone: 'warning', dismissible: false, body: html`<p>Hệ thống đã tự động nộp bài với các đáp án bạn đã chọn.</p>`, actions: [{ label: 'Xem kết quả', variant: 'primary', value: true }] });
      location.hash = `#/quiz/${ctx.params.id}/result/${r.id}`;
    } catch (e) {
      if (e.status === 0) ui.notify.error('Chưa nộp được bài', 'Mất kết nối. Đáp án đã được giữ — nhấn Nộp bài lại khi có mạng.'); else LMS.handleError(e);
    }
  }

  /* ======================= RESULT ======================= */
  LMS.page('quizResult', {
    title: 'Kết quả bài kiểm tra', initState: () => ({ review: false }),
    load: (ctx) => api.learner.attemptResult(ctx.params.attemptId),
    view: (d, ctx) => {
      const a = d.attempt, s = d.summary, pass = a.passed;
      const canRetry = !s.passed && s.left > 0;
      return html`<div class="page page--narrow">${UI.Breadcrumb([{ label: d.course.title, href: `#/course/${d.course.id}` }, { label: d.quiz.title, href: `#/quiz/${d.quiz.id}` }, { label: `Kết quả lần ${a.nth}` }])}
      <section class="card result ${pass ? 'result--pass' : 'result--fail'} animate-enter">
        <div class="result__score">${pass ? html`<div class="animate-reward">${mai(84)}</div>` : html`<div class="empty__art empty__art--danger" style="width:84px;height:84px">${icon('x-circle', 'icon--xl')}</div>`}<div class="num" style="font-size:56px;font-weight:700;line-height:1">${a.score}%</div><div class="text-sm text-muted">${a.correct}/${a.total} câu đúng · điểm đạt ${d.quiz.passPct}%</div></div>
        <div class="stack" style="--gap:10px"><span class="badge ${pass ? 'badge--success' : 'badge--danger'}" style="align-self:flex-start">${icon(pass ? 'check' : 'x')}Trạng thái: ${pass ? 'ĐẠT' : 'CHƯA ĐẠT'}</span>
          <h1>${pass ? 'Chúc mừng, bạn đã đạt!' : 'Chưa đạt — cố gắng thêm nhé'}</h1>
          <p class="text-secondary">${pass ? (d.courseCompleted ? `Bạn đã hoàn thành khóa "${d.course.title}". Chứng nhận đã sẵn sàng.` : 'Bài kiểm tra đã được ghi nhận vào tiến độ khóa học.') : canRetry ? `Bạn còn ${s.left} lượt thi. Xem lại nhóm kiến thức còn yếu bên dưới trước khi thi lại.` : 'Bạn đã dùng hết lượt thi. Giảng viên sẽ xem xét kết quả của bạn.'}</p>
          <div class="row text-sm text-muted" style="--gap:16px"><span>Lần thi ${a.nth}/${s.maxAttempts}</span><span>Điểm cao nhất ${s.best}%</span><span>Nộp ${fmt.datetime(a.submittedAt)}</span>${a.autoSubmitted ? UI.Badge('Tự động nộp khi hết giờ', 'warning', 'clock') : ''}</div>
          ${pass ? html`<div class="card card--reward" style="padding:12px 14px;display:flex;gap:12px;align-items:center">${mai(28)}<div class="text-sm"><strong class="text-accent">+${LMS.store.db.settings.points.quizPass} điểm thưởng</strong>${d.courseCompleted ? html` · <strong class="text-accent">+${d.course.rewardPoints}</strong> hoàn thành khóa` : ''}</div></div>` : ''}</div>
      </section>
      <div class="row mt-4" style="justify-content:flex-end">${UI.Button({ label: 'Lịch sử thi', icon: 'history', href: `#/quiz/${d.quiz.id}/attempts` })}${canRetry ? UI.Button({ label: 'Thi lại', icon: 'refresh', href: `#/quiz/${d.quiz.id}` }) : ''}${d.courseCompleted ? UI.Button({ label: 'Xem chứng nhận', icon: 'award', href: '#/certificates' }) : ''}${UI.Button({ label: 'Về khóa học', variant: 'primary', href: `#/course/${d.course.id}` })}</div>
      ${UI.Card({ title: 'Phân tích theo nhóm kiến thức', cls: 'mt-6', body: html`<div role="list">${d.competency.map((c) => { const pct = Math.round((c.c / c.t) * 100); return html`<div class="hbar" role="listitem"><span>${c.name}</span><div class="hbar__track"><div class="hbar__fill" style="width:${pct}%;background:${pct >= d.quiz.passPct ? 'var(--color-success)' : 'var(--color-warning)'}"></div></div><strong class="num" style="text-align:right">${c.c}/${c.t}</strong></div>`; })}</div><p class="text-xs text-muted mt-4">Biểu đồ năng lực trên Dashboard đã được cập nhật theo lần thi tốt nhất.</p>` })}
      <section class="card mt-6"><div class="card__header"><h2>Xem lại đáp án & giải thích</h2>${d.review ? UI.Button({ label: ctx.state.review ? 'Thu gọn' : 'Xem lại', icon: ctx.state.review ? 'chevron-up' : 'eye', size: 'sm', action: 'toggle-review' }) : ''}</div>
        <div class="card__body">${!d.review ? html`<div class="alert">${icon('lock')}<div>${d.reviewMsg}</div></div>` : ctx.state.review ? html`<ol class="stack" style="--gap:20px;list-style:none;padding:0">${d.review.map((r) => html`<li class="stack" style="--gap:10px"><div class="row" style="--gap:8px">${UI.Badge(r.ok ? 'Đúng' : 'Sai', r.ok ? 'success' : 'danger', r.ok ? 'check' : 'x')}<span class="text-xs text-muted">Câu ${r.n} · ${r.code} · ${r.type === 'multiple' ? 'Nhiều đáp án' : 'Một đáp án'}</span></div><div class="fw-600">${r.text}</div>
          ${r.options.map((o) => { const isC = r.correct.includes(o.id), isM = r.mine.includes(o.id); return html`<div class="answer ${isC ? 'answer--correct' : isM ? 'answer--wrong' : ''}">${icon(isC ? 'check-circle' : isM ? 'x-circle' : 'minus', 'icon--sm')}<span class="grow">${o.text}</span>${isM ? html`<span class="text-xs fw-600">Bạn chọn</span>` : ''}${isC ? html`<span class="text-xs fw-600 text-success">Đáp án đúng</span>` : ''}</div>`; })}
          ${r.explanation ? html`<div class="alert">${icon('info')}<div><strong>Giải thích:</strong> ${r.explanation}</div></div>` : ''}</li>`)}</ol>` : html`<p class="text-sm text-muted">Nhấn "Xem lại" để xem từng câu, đáp án bạn chọn, đáp án đúng và giải thích.</p>`}</div></section></div>`;
    },
    actions: { 'toggle-review': (el, ctx) => { ctx.state.review = !ctx.state.review; ctx.rerender(); } },
  });

  /* ======================= ATTEMPTS ======================= */
  LMS.page('quizAttempts', {
    title: 'Lịch sử thi',
    load: (ctx) => api.learner.attempts(ctx.params.id),
    view: (d, ctx) => html`<div class="page page--narrow">${UI.Breadcrumb([{ label: 'Bài kiểm tra', href: `#/quiz/${d.quiz.id}` }, { label: 'Lịch sử thi' }])}${UI.PageHeader({ eyebrow: 'Lịch sử thi', title: d.quiz.title, actions: UI.Button({ label: 'Về bài kiểm tra', href: `#/quiz/${d.quiz.id}`, variant: 'primary' }) })}
      <div class="grid grid-4 mb-4">${UI.Kpi({ icon: 'history', value: d.summary.attempts, suffix: `/${d.summary.maxAttempts}`, label: 'Lượt đã thi' })}${UI.Kpi({ icon: 'clipboard', value: d.summary.last ?? '—', suffix: d.summary.last != null ? '%' : '', label: 'Điểm gần nhất' })}${UI.Kpi({ icon: 'trophy', tone: 'reward', value: d.summary.best ?? '—', suffix: d.summary.best != null ? '%' : '', label: 'Điểm cao nhất' })}${UI.Kpi({ icon: d.summary.passed ? 'check-circle' : 'target', tone: d.summary.passed ? '' : 'warn', value: d.summary.passed ? 'Đạt' : 'Chưa', label: `Điểm đạt ≥ ${d.quiz.passPct}%` })}</div>
      <section class="card">${UI.DataTable({ id: 'att', state: ctx.state.tables.att, caption: 'Lịch sử các lần thi', rows: d.attempts, rowAction: (r) => `#/quiz/${d.quiz.id}/result/${r.id}`, empty: UI.Empty({ icon: 'clipboard', title: 'Chưa có lần thi nào' }), columns: [
        { key: 'n', label: 'Lần', render: (r) => html`<strong>#${r.n}</strong>` },
        { key: 'submittedAt', label: 'Ngày nộp', render: (r) => fmt.datetime(r.submittedAt) },
        { key: 'minutes', label: 'Thời gian', render: (r) => `${r.minutes} phút` },
        { key: 'score', label: 'Điểm', render: (r) => html`<strong class="num">${r.score}%</strong> <span class="text-xs text-muted">(${r.correct}/${r.total})</span>${r.score === d.summary.best ? html` ${UI.Badge('Cao nhất', 'reward')}` : ''}` },
        { key: 'passed', label: 'Kết quả', render: (r) => html`${UI.Badge(r.passed ? 'Đạt' : 'Chưa đạt', r.passed ? 'success' : 'danger')}${r.auto ? html` ${UI.Badge('Tự nộp', 'warning')}` : ''}` },
        { key: 'id', label: '', sort: false, cls: 'col-actions', render: (r) => html`<a class="link-btn" href="#/quiz/${d.quiz.id}/result/${r.id}">Chi tiết ${icon('chevron-right', 'icon--sm')}</a>` },
      ] })}</section></div>`,
  });
})(window.LMS);
