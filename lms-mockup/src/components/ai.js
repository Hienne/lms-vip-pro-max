/* ==========================================================================
   components/ai.js — AIAssistant: hỏi đáp có trích nguồn, tóm tắt, sinh câu ôn tập
   Mockup: truy hồi theo từ khóa trên nội dung đã giao (RAG mô phỏng).
   Production: api.learner.ask → Edge Function gọi LLM + vector search, giữ nguyên format {answer, citations}.
   ========================================================================== */
(function (LMS) {
  const { html, icon, UI, api } = LMS;

  const AI = {
    render({ lessonId, compact } = {}) {
      return html`<div class="stack ai" style="--gap:16px" data-ai data-lesson="${lessonId || ''}">
        <div class="alert">${icon('sparkles')}<div class="text-sm">Trợ lý chỉ trả lời dựa trên tài liệu bạn được giao và luôn kèm <strong>nguồn trích dẫn</strong>. Nội dung AI có thể chưa chính xác — đối chiếu với tài liệu gốc.</div></div>
        ${lessonId ? html`<div class="row" style="--gap:8px">${UI.Button({ label: 'Tóm tắt bài này', icon: 'file', size: 'sm', attrs: 'data-ai-act="summary"' })}${UI.Button({ label: 'Tạo 3 câu ôn tập', icon: 'help', size: 'sm', attrs: 'data-ai-act="practice"' })}</div>` : html`<div class="row" style="--gap:8px">${['CIF dùng để làm gì?', 'Trước khi chạy EOD cần kiểm tra gì?', 'Thay đổi khẩn cấp xử lý thế nào?'].map((q) => html`<button class="chip" data-ai-suggest="${q}">${q}</button>`)}</div>`}
        <div class="stack ai__log" style="--gap:14px;${compact ? 'max-height:52vh;overflow:auto' : 'min-height:280px'}" aria-live="polite" data-ai-log>
          <div class="ai-msg"><span class="avatar avatar--sm" style="background:var(--color-accent);color:var(--color-on-accent)">${icon('sparkles', 'icon--sm')}</span><div class="ai-msg__bubble">Xin chào! Hãy hỏi mình bất kỳ điều gì về nội dung khóa học — ví dụ "CIF dùng để làm gì?".</div></div>
        </div>
        <form class="row" style="--gap:8px;flex-wrap:nowrap" data-ai-form><label class="sr-only" for="ai-q-${lessonId || 'all'}">Câu hỏi cho trợ lý</label><input class="input" id="ai-q-${lessonId || 'all'}" name="q" placeholder="Nhập câu hỏi…" autocomplete="off" maxlength="300"><button class="btn btn--primary" type="submit">${icon('send', 'icon--sm')}<span>Hỏi</span></button></form>
      </div>`;
    },
    mount(root) {
      const el = root.querySelector('[data-ai]'); if (!el) return;
      const log = el.querySelector('[data-ai-log]'); const lessonId = el.dataset.lesson || undefined;
      const push = (who, body) => { const d = document.createElement('div'); d.className = `ai-msg ${who === 'user' ? 'ai-msg--user' : ''}`; d.innerHTML = String(html`${who === 'user' ? UI.Avatar(LMS.apiCore.me().name, 'sm') : html`<span class="avatar avatar--sm" style="background:var(--color-accent);color:var(--color-on-accent)">${icon('sparkles', 'icon--sm')}</span>`}<div class="ai-msg__bubble">${body}</div>`); log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
      const typing = () => push('ai', html`<span class="typing" aria-label="Đang soạn câu trả lời"><span></span><span></span><span></span></span>`);
      const run = async (label, fn, renderFn) => {
        push('user', label); const t = typing();
        try { const r = await fn(); t.querySelector('.ai-msg__bubble').innerHTML = String(renderFn(r)); }
        catch (err) { t.querySelector('.ai-msg__bubble').innerHTML = String(html`<span class="text-danger">${err.status === 0 ? 'Mất kết nối — không gửi được câu hỏi. Thử lại khi có mạng.' : err.message}</span>`); }
        log.scrollTop = log.scrollHeight;
      };
      const ask = (q) => run(q, () => api.learner.ask(q, { lessonId }), (r) => html`<p>${r.answer}</p>${r.citations.length ? html`<div class="row mt-2" style="--gap:6px"><span class="text-xs text-muted">Nguồn:</span>${r.citations.map((c) => html`<a class="cite" href="${c.href}">[${c.n}] ${c.lessonTitle} · ${c.where}</a>`)}</div>` : ''}`);
      el.querySelector('[data-ai-form]').addEventListener('submit', (e) => { e.preventDefault(); const q = e.target.q.value.trim(); if (!q) return e.target.q.focus(); e.target.q.value = ''; ask(q); });
      el.addEventListener('click', (e) => {
        const s = e.target.closest('[data-ai-suggest]'); if (s) return ask(s.dataset.aiSuggest);
        const a = e.target.closest('[data-ai-act]'); if (!a) return;
        if (a.dataset.aiAct === 'summary') run('Tóm tắt bài học này', () => api.learner.summarize(lessonId), (r) => html`<strong>Tóm tắt: ${r.title}</strong><ul class="mt-2">${r.bullets.map((b) => html`<li>${b}</li>`)}</ul><div class="mt-2"><span class="cite">Nguồn: ${r.source}</span></div>`);
        if (a.dataset.aiAct === 'practice') run('Tạo câu hỏi ôn tập', () => api.learner.practice(lessonId), (qs) => qs.length ? html`<strong>3 câu ôn tập từ ngân hàng câu hỏi của bài:</strong><ol class="mt-2 stack" style="--gap:10px">${qs.map((q) => html`<li><div>${q.text}</div><details><summary class="link-btn" style="cursor:pointer">Xem đáp án</summary><div class="text-sm"><strong>${q.options.filter((o) => q.correct.includes(o.id)).map((o) => o.text).join('; ')}</strong>${q.explanation ? html` — ${q.explanation}` : ''}</div></details></li>`)}</ol>` : html`Bài này chưa có câu hỏi trong ngân hàng.`);
      });
    },
  };
  LMS.AI = AI;
})(window.LMS);
