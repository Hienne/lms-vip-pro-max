/* ==========================================================================
   components/viewers.js — PdfViewer & VideoPlayer (component có state)
   Mockup mô phỏng nội dung (không cần tệp thật). Production:
   - PdfViewer: thay phần stage bằng pdf.js (render canvas), giữ toolbar & sự kiện.
   - VideoPlayer: thay đồng hồ mô phỏng bằng <video> (timeupdate), giữ controls.
   Props: render(block, start) ; mount(rootEl, { onProgress, onError })
   ========================================================================== */
(function (LMS) {
  const { html, raw, icon, fmt, UI } = LMS;

  const PARAS = [
    'Tài liệu mô tả nguyên tắc, phạm vi áp dụng và trách nhiệm của các bên liên quan khi thực hiện nghiệp vụ trên hệ thống Core Banking.',
    'Mọi thao tác thay đổi dữ liệu quan trọng phải tuân thủ cơ chế kiểm soát hai lớp (maker–checker) và được ghi nhật ký đầy đủ để phục vụ kiểm tra, đối soát.',
    'Cán bộ cần đối chiếu thông tin trước khi xác nhận, đặc biệt với các trường định danh và tham số ảnh hưởng tới hạch toán.',
    'Trường hợp phát sinh sai lệch, cán bộ dừng thao tác, ghi nhận hiện trạng và báo cáo đầu mối theo ma trận leo thang.',
    'Dữ liệu sử dụng trong tài liệu này là dữ liệu giả lập, chỉ phục vụ mục đích đào tạo nội bộ.',
  ];

  const PdfViewer = {
    render(block, start = 1) {
      const f = block.file || {};
      const label = `Tài liệu PDF: ${block.title}`;
      if (f.state !== 'ok') {
        return html`<div class="pdf" id="block-${block.id}" data-pdf="${block.id}"><div class="pdf__toolbar"><strong class="grow truncate">${icon('pdf', 'icon--sm')} ${f.name || block.title}</strong></div>
          ${UI.Empty({ icon: 'alert', tone: 'danger', title: 'Không tải được tài liệu', desc: 'Tệp đã bị xóa, di chuyển hoặc bị lỗi. Bạn có thể thử lại hoặc báo cho giảng viên để được thay thế.', action: html`<div class="row" style="justify-content:center">${UI.Button({ label: 'Thử lại', icon: 'refresh', action: 'pdf-retry' })}${UI.Button({ label: 'Báo tệp lỗi', icon: 'flag', variant: 'primary', action: 'report-file', attrs: `data-name="${LMS.esc(f.name || '')}"` })}</div>` })}</div>`;
      }
      const n = block.data.pages; const page = Math.max(1, Math.min(n, start || 1));
      return html`<div class="pdf" id="block-${block.id}" data-pdf="${block.id}" data-pages="${n}" data-page="${page}" data-zoom="1" role="region" aria-label="${label}">
        <div class="pdf__toolbar" role="toolbar" aria-label="Điều khiển tài liệu">
          <button class="btn btn--ghost btn--sm btn--icon" data-pdf-act="prev" aria-label="Trang trước">${icon('chevron-left')}</button>
          <label class="sr-only" for="pg-${block.id}">Trang hiện tại</label>
          <input class="input pdf__page-input num" id="pg-${block.id}" data-pdf-act="goto" type="number" min="1" max="${n}" value="${page}">
          <span class="text-muted num">/ ${n}</span>
          <button class="btn btn--ghost btn--sm btn--icon" data-pdf-act="next" aria-label="Trang sau">${icon('chevron-right')}</button>
          <span class="sep" aria-hidden="true"></span>
          <button class="btn btn--ghost btn--sm btn--icon" data-pdf-act="zoom-out" aria-label="Thu nhỏ">${icon('zoom-out')}</button>
          <span class="num text-sm" data-pdf-zoom style="min-width:44px;text-align:center">100%</span>
          <button class="btn btn--ghost btn--sm btn--icon" data-pdf-act="zoom-in" aria-label="Phóng to">${icon('zoom-in')}</button>
          <button class="btn btn--ghost btn--sm" data-pdf-act="fit">Vừa khung</button>
          <span class="grow"></span>
          <span class="text-xs text-muted hide-sm">${f.name} · ${fmt.bytes(f.size)}</span>
          <button class="btn btn--ghost btn--sm btn--icon" data-pdf-act="bookmark" aria-label="Đánh dấu trang này">${icon('bookmark')}</button>
          <button class="btn btn--ghost btn--sm btn--icon" data-pdf-act="fullscreen" aria-label="Toàn màn hình">${icon('maximize')}</button>
        </div>
        <div class="pdf__stage" tabindex="0" aria-live="polite" data-pdf-stage>${PdfViewer.page(block, page)}</div>
        <div class="pdf__toolbar" style="border-top:1px solid var(--color-border);border-bottom:0"><div class="grow">${UI.Progress((page / n) * 100, { sm: true, label: 'Đã đọc' })}</div><span class="text-xs text-muted num" data-pdf-read style="white-space:nowrap">Đã đọc ${page}/${n} trang</span></div></div>`;
    },
    page(block, i) {
      const n = block.data.pages; const outline = block.data.outline || [];
      const title = outline[(i - 1) % Math.max(1, outline.length)] || `Phần ${i}`;
      const ps = [0, 1, 2].map((k) => PARAS[(i + k) % PARAS.length]);
      return html`<article class="pdf__page" aria-label="Trang ${i}"><div class="text-xs" style="color:#5F6B69;margin-bottom:1.5em;display:flex;justify-content:space-between"><span>${block.title}</span><span>Lưu hành nội bộ</span></div><h4>${i}. ${title}</h4>${ps.map((p) => html`<p>${p}</p>`)}<div class="pdf__lines">${Array.from({ length: 6 }, (_, k) => html`<i style="width:${92 - ((i * 7 + k * 13) % 30)}%"></i>`)}</div><div class="pdf__foot"><span>Dữ liệu giả lập phục vụ đào tạo</span><span>Trang ${i}/${n}</span></div></article>`;
    },
    mount(root, block, { onPage, onBookmark } = {}) {
      const el = root.querySelector(`[data-pdf="${block.id}"]`); if (!el || !el.dataset.pages) return () => {};
      const n = +el.dataset.pages; let page = +el.dataset.page; let zoom = 1; let tmr;
      const stage = el.querySelector('[data-pdf-stage]'); const input = el.querySelector('[data-pdf-act="goto"]');
      const draw = () => {
        stage.innerHTML = String(PdfViewer.page(block, page)); stage.style.setProperty('--zoom', zoom); stage.scrollTop = 0;
        input.value = page; el.querySelector('[data-pdf-zoom]').textContent = Math.round(zoom * 100) + '%';
        el.querySelector('[data-pdf-read]').textContent = `Đã đọc ${page}/${n} trang`;
        el.querySelector('.progress__bar').style.width = (page / n) * 100 + '%';
        el.querySelector('[data-pdf-act="prev"]').disabled = page <= 1; el.querySelector('[data-pdf-act="next"]').disabled = page >= n;
        clearTimeout(tmr); tmr = setTimeout(() => onPage && onPage(page), 400);
      };
      const go = (p) => { page = Math.max(1, Math.min(n, p)); draw(); };
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pdf-act]'); if (!b) return;
        const a = b.dataset.pdfAct;
        if (a === 'prev') go(page - 1); if (a === 'next') go(page + 1);
        if (a === 'zoom-in') { zoom = Math.min(2, +(zoom + 0.25).toFixed(2)); draw(); }
        if (a === 'zoom-out') { zoom = Math.max(0.5, +(zoom - 0.25).toFixed(2)); draw(); }
        if (a === 'fit') { zoom = Math.max(0.5, Math.min(2, (stage.clientWidth - 48) / 560)); draw(); }
        if (a === 'fullscreen') { if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen && el.requestFullscreen().catch(() => LMS.ui.notify.warning('Trình duyệt chặn toàn màn hình')); }
        if (a === 'bookmark') onBookmark && onBookmark(page);
      });
      input.addEventListener('change', () => go(+input.value || 1));
      stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(page + 1); } if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(page - 1); } });
      draw();
      el.goTo = go;
      return () => clearTimeout(tmr);
    },
  };

  const VideoPlayer = {
    render(block, start = 0) {
      const f = block.file || {};
      if (f.state !== 'ok') return html`<div class="card" id="block-${block.id}">${UI.Empty({ icon: 'video', tone: 'danger', title: 'Không phát được video', desc: 'Tệp video bị lỗi hoặc đã bị xóa.', action: UI.Button({ label: 'Báo tệp lỗi', icon: 'flag', action: 'report-file', attrs: `data-name="${LMS.esc(f.name || '')}"` }) })}</div>`;
      const d = block.data.duration;
      return html`<div class="player" id="block-${block.id}" data-video="${block.id}" data-start="${start}" tabindex="0" role="region" aria-label="Trình phát video: ${block.title}. Phím tắt: Space phát/dừng, mũi tên tua 5 giây, M tắt tiếng, F toàn màn hình">
        <div class="player__screen" data-v-screen>
          ${start > 5 ? html`<div class="player__resume row" data-v-resume><span class="badge badge--reward">${icon('history')}Tiếp tục từ ${fmt.time(start)}</span><button class="btn btn--sm btn--on-dark" data-v-act="restart">Xem từ đầu</button></div>` : ''}
          <button class="player__big" data-v-act="toggle" aria-label="Phát video">${icon('play')}</button>
          <div class="player__caption" data-v-cap aria-live="off"></div>
        </div>
        <div class="player__controls">
          <button data-v-act="toggle" aria-label="Phát">${icon('play')}</button>
          <span class="player__time" data-v-time>${fmt.time(start)} / ${fmt.time(d)}</span>
          <label class="sr-only" for="seek-${block.id}">Thanh thời gian</label>
          <input class="player__seek" id="seek-${block.id}" type="range" min="0" max="${d}" value="${start}" data-v-seek aria-valuetext="${fmt.time(start)}">
          <button data-v-act="mute" aria-label="Tắt tiếng">${icon('volume')}</button>
          <label class="sr-only" for="vol-${block.id}">Âm lượng</label>
          <input class="player__vol" id="vol-${block.id}" type="range" min="0" max="100" value="80" data-v-vol>
          <label class="sr-only" for="rate-${block.id}">Tốc độ phát</label>
          <select class="player__rate" id="rate-${block.id}" data-v-rate><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="20">20× (demo)</option></select>
          <button data-v-act="fullscreen" aria-label="Toàn màn hình">${icon('maximize')}</button>
        </div></div>
        <div class="row-between mt-2 text-xs text-muted"><span data-v-watched>Đã xem 0%</span><span>Cần xem ≥ 80% để hoàn thành · ${fmt.minutes(d / 60)}</span></div>`;
    },
    mount(root, block, { onProgress, watched0 = 0 } = {}) {
      const el = root.querySelector(`[data-video="${block.id}"]`); if (!el) return () => {};
      const d = block.data.duration; let pos = +el.dataset.start || 0; let playing = false; let rate = 1; let muted = false; let vol = 80;
      const seen = new Set(); const bucket = 5; for (let i = 0; i < Math.floor((watched0 / 100) * d / bucket); i++) seen.add(i);
      const $ = (s) => el.querySelector(s); const seek = $('[data-v-seek]');
      const transcript = block.data.transcript || [];
      const watchedPct = () => Math.min(100, Math.round((seen.size * bucket * 100) / d));
      let last = 0;
      const ui = () => {
        $('[data-v-time]').textContent = `${fmt.time(pos)} / ${fmt.time(d)}`; seek.value = pos; seek.setAttribute('aria-valuetext', fmt.time(pos));
        const cur = transcript.filter((t) => t.t <= pos).pop(); $('[data-v-cap]').textContent = playing && cur ? cur.text : ''; $('[data-v-cap]').style.display = playing && cur ? '' : 'none';
        const ic = playing ? 'pause' : 'play';
        el.querySelectorAll('[data-v-act="toggle"]').forEach((b) => { b.innerHTML = String(icon(ic)); b.setAttribute('aria-label', playing ? 'Tạm dừng' : 'Phát'); });
        $('.player__big').style.display = playing ? 'none' : '';
        $('[data-v-act="mute"]').innerHTML = String(icon(muted || vol === 0 ? 'mute' : 'volume'));
        const wl = root.querySelector('[data-v-watched]'); if (wl) wl.textContent = `Đã xem ${watchedPct()}%`;
        root.querySelectorAll(`[data-seek-to]`).forEach((b) => b.classList.toggle('is-active', +b.dataset.seekTo <= pos && (+b.dataset.seekEnd || 1e9) > pos));
      };
      const report = (force) => { if (force || Date.now() - last > 4000) { last = Date.now(); onProgress && onProgress({ videoPos: pos, watchedPct: watchedPct() }); } };
      const timer = setInterval(() => {
        if (!playing) return;
        const step = 0.25 * rate; const from = pos; pos = Math.min(d, pos + step);
        for (let t = Math.floor(from / bucket); t <= Math.floor(pos / bucket); t++) seen.add(t);
        if (pos >= d) { playing = false; report(true); LMS.ui.notify.success('Đã xem hết video', 'Bạn có thể đánh dấu hoàn thành bài học.'); }
        ui(); report(false);
      }, 250);
      const toggle = () => { playing = !playing; const r = $('[data-v-resume]'); r && r.remove(); if (!playing) report(true); ui(); };
      const jump = (t) => { pos = Math.max(0, Math.min(d, t)); ui(); report(true); };
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v-act]'); if (!b) return;
        const a = b.dataset.vAct;
        if (a === 'toggle') toggle();
        if (a === 'restart') { jump(0); $('[data-v-resume]') && $('[data-v-resume]').remove(); }
        if (a === 'mute') { muted = !muted; ui(); }
        if (a === 'fullscreen') { if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen && el.requestFullscreen().catch(() => {}); }
      });
      $('.player__screen').addEventListener('dblclick', () => (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen().catch(() => {})));
      seek.addEventListener('input', () => jump(+seek.value));
      $('[data-v-vol]').addEventListener('input', (e) => { vol = +e.target.value; muted = vol === 0; ui(); });
      $('[data-v-rate]').addEventListener('change', (e) => { rate = +e.target.value; });
      el.addEventListener('keydown', (e) => {
        if (e.target.matches('input,select')) return;
        if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); jump(pos + 5); } if (e.key === 'ArrowLeft') { e.preventDefault(); jump(pos - 5); }
        if (e.key === 'm') { muted = !muted; ui(); } if (e.key === 'f') el.requestFullscreen && el.requestFullscreen().catch(() => {});
      });
      el.seekTo = jump; el.getPos = () => pos;
      ui();
      return () => { clearInterval(timer); if (playing) report(true); };
    },
  };

  LMS.PdfViewer = PdfViewer;
  LMS.VideoPlayer = VideoPlayer;
})(window.LMS);
