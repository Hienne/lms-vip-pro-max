/* ==========================================================================
   components/components.js — Component thuần: (props) => SafeHTML
   Mỗi hàm tương ứng 1 component React (<PageHeader/>) hoặc Angular (<app-page-header>).
   Sự kiện dùng data-action="..." → handler trong page.actions (≈ onClick / (click)).
   ========================================================================== */
(function (LMS) {
  const { html, raw, icon, cx, attr, fmt, mai } = LMS;
  const UI = {};

  UI.PageHeader = ({ eyebrow, title, desc, actions = '', breadcrumb }) => html`
    ${breadcrumb ? UI.Breadcrumb(breadcrumb) : ''}
    <header class="page-header animate-enter"><div class="page-header__title">${eyebrow ? html`<span class="eyebrow">${eyebrow}</span>` : ''}<h1>${title}</h1>${desc ? html`<p class="page-header__desc">${desc}</p>` : ''}</div>${actions ? html`<div class="page-header__actions">${actions}</div>` : ''}</header>`;

  UI.Breadcrumb = (items) => html`<nav aria-label="Đường dẫn" class="mb-4"><ol class="breadcrumb">${items.map((it, i) => html`<li>${it.href && i < items.length - 1 ? html`<a href="${it.href}">${it.label}</a>` : html`<span aria-current="page">${it.label}</span>`}</li>`)}</ol></nav>`;

  UI.Button = ({ label, icon: ic, variant = 'secondary', size, action, href, attrs = '', disabled, type = 'button', iconRight, title }) => {
    const cls = cx('btn', `btn--${variant}`, size && `btn--${size}`, !label && 'btn--icon');
    const inner = html`${ic && !iconRight ? icon(ic, size === 'sm' ? 'icon--sm' : '') : ''}${label ? html`<span>${label}</span>` : ''}${ic && iconRight ? icon(ic, 'icon--sm') : ''}`;
    if (href && !disabled) return html`<a class="${cls}" href="${href}" ${raw(String(attrs))}${attr('title', title)}>${inner}</a>`;
    return html`<button type="${type}" class="${cls}" ${action ? raw(`data-action="${action}"`) : ''} ${raw(String(attrs))}${attr('disabled', disabled)}${attr('aria-label', !label ? title : null)}${attr('title', title)}>${inner}</button>`;
  };

  UI.Card = ({ title, actions = '', body, footer, cls = '', pad = true, id }) => html`<section class="card ${cls}"${attr('id', id)}${title ? raw(` aria-label="${LMS.esc(typeof title === 'string' ? title : '')}"`) : ''}>
    ${title ? html`<div class="card__header"><h2>${title}</h2>${actions ? html`<div class="row" style="--gap:8px">${actions}</div>` : ''}</div>` : ''}
    ${pad ? html`<div class="card__body">${body}</div>` : body}${footer ? html`<div class="card__footer">${footer}</div>` : ''}</section>`;

  UI.Kpi = ({ icon: ic, value, suffix, label, tone = '', delta, href }) => {
    const inner = html`<div class="kpi"><div class="kpi__icon ${tone ? 'kpi__icon--' + tone : ''}">${typeof ic === 'string' ? icon(ic) : ic}</div><div class="grow"><div class="kpi__value">${value}${suffix ? html`<small>${suffix}</small>` : ''}</div><div class="kpi__label">${label}</div>${delta ? html`<div class="kpi__delta text-muted">${delta}</div>` : ''}</div></div>`;
    return href ? html`<a class="card card--interactive" style="text-decoration:none;color:inherit" href="${href}">${inner}</a>` : html`<div class="card">${inner}</div>`;
  };

  UI.Badge = (label, tone = '', ic) => html`<span class="badge ${tone ? 'badge--' + tone : ''}">${ic ? icon(ic) : ''}${label}</span>`;

  const COURSE_STATUS = { not_started: ['Chưa bắt đầu', ''], in_progress: ['Đang học', 'info'], completed: ['Đã hoàn thành', 'success', 'check'], failed: ['Chưa đạt', 'danger', 'x'] };
  UI.CourseStatus = (status, overdue) => html`${UI.Badge(...[COURSE_STATUS[status][0], COURSE_STATUS[status][1], COURSE_STATUS[status][2]])}${overdue ? html` ${UI.Badge('Quá hạn', 'danger', 'clock')}` : ''}`;
  const PUB = { draft: ['Nháp', 'outline'], published: ['Đã xuất bản', 'success'], paused: ['Tạm dừng', 'warning'], locked: ['Đã khóa', 'danger'] };
  UI.PublishStatus = (s) => UI.Badge(PUB[s][0], PUB[s][1] + ' badge--dot');
  const ACC = { active: ['Hoạt động', 'success'], suspended: ['Tạm dừng', 'warning'], locked: ['Đã khóa', 'danger'] };
  UI.AccountStatus = (s) => UI.Badge(ACC[s][0], ACC[s][1] + ' badge--dot');
  const ROLE = { learner: ['Học viên', 'primary'], instructor: ['Giảng viên', 'info'], admin: ['Quản trị viên', 'warning'], viewer: ['Lãnh đạo', 'outline'] };
  UI.RoleBadge = (r, scoped) => UI.Badge(ROLE[r][0] + (scoped ? ' đơn vị' : ''), ROLE[r][1]);
  UI.Required = (req) => (req ? UI.Badge('Bắt buộc', 'danger') : UI.Badge('Tự chọn', 'outline'));

  UI.Due = (dueAt, done) => {
    if (!dueAt) return html`<span class="text-muted text-sm">Không có hạn</span>`;
    const d = fmt.daysLeft(dueAt);
    if (done) return html`<span class="text-sm text-muted">Hạn ${fmt.date(dueAt)}</span>`;
    if (d < 0) return html`<span class="text-sm text-danger fw-600">Quá hạn ${-d} ngày</span>`;
    if (d <= 3) return html`<span class="text-sm text-warning fw-600">Còn ${d} ngày</span>`;
    return html`<span class="text-sm text-muted">Còn ${d} ngày · ${fmt.date(dueAt)}</span>`;
  };

  UI.Progress = (pct, { tone, label, sm } = {}) => html`<div class="progress ${sm ? 'progress--sm' : ''} ${tone ? 'progress--' + tone : ''}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="${label || 'Tiến độ'}"><div class="progress__bar" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;

  /** Ring: đạt 100% → nở thành cánh mai vàng (signature) */
  UI.Ring = (pct, { size = 96, stroke = 9, label = 'hoàn thành' } = {}) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, pct) / 100);
    if (pct >= 100) return html`<div class="ring animate-reward" style="width:${size}px;height:${size}px" role="img" aria-label="Hoàn thành 100%">${mai(size * 0.9)}</div>`;
    return html`<div class="ring" role="img" aria-label="${Math.round(pct)}% ${label}"><svg width="${size}" height="${size}"><circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/><circle class="ring__bar" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg><div class="ring__label"><div class="ring__value" style="font-size:${size * 0.22}px">${Math.round(pct)}%</div><div class="text-xs text-muted">${label}</div></div></div>`;
  };

  UI.Avatar = (name, size = '', top) => html`<span class="avatar ${size ? 'avatar--' + size : ''} ${top ? 'avatar--top' : ''}" aria-hidden="true">${fmt.initials(name)}</span>`;

  UI.Empty = ({ icon: ic = 'inbox', title, desc, action = '', tone = '' }) => html`<div class="empty animate-enter"><div class="empty__art ${tone ? 'empty__art--' + tone : ''}">${icon(ic, 'icon--xl')}</div><h3>${title}</h3>${desc ? html`<p>${desc}</p>` : ''}${action}</div>`;

  UI.Skeleton = (kind = 'page') => {
    if (kind === 'table') return html`<div class="card card--pad" aria-busy="true" aria-label="Đang tải">${Array.from({ length: 6 }, () => html`<div class="row" style="padding:10px 0"><div class="skeleton skeleton--text" style="width:30%"></div><div class="skeleton skeleton--text grow"></div><div class="skeleton skeleton--text" style="width:12%"></div></div>`)}</div>`;
    return html`<div class="page" aria-busy="true" aria-label="Đang tải nội dung"><div class="skeleton skeleton--title mb-2"></div><div class="skeleton skeleton--text" style="width:55%"></div>
      <div class="grid grid-4 mt-6">${Array.from({ length: 4 }, () => html`<div class="skeleton skeleton--block" style="height:96px"></div>`)}</div>
      <div class="grid grid-3 mt-6">${Array.from({ length: 3 }, () => html`<div class="card"><div class="skeleton" style="height:112px;border-radius:14px 14px 0 0"></div><div class="card__body"><div class="skeleton skeleton--text" style="width:40%"></div><div class="skeleton skeleton--text"></div><div class="skeleton skeleton--text" style="width:70%"></div></div></div>`)}</div></div>`;
  };

  UI.Tabs = (tabs, current, action = 'tab', label = 'Các mục') => html`<div class="tabs" role="tablist" aria-label="${label}">${tabs.map((t) => html`<button class="tabs__tab" role="tab" aria-selected="${t.id === current}" data-action="${action}" data-id="${t.id}" tabindex="${t.id === current ? 0 : -1}">${t.icon ? icon(t.icon, 'icon--sm') : ''}${t.label}${t.count != null ? html`<span class="tabs__count">${t.count}</span>` : ''}</button>`)}</div>`;

  UI.Segmented = (opts, current, action, label) => html`<div class="segmented" role="group" aria-label="${label}">${opts.map((o) => html`<button aria-pressed="${o.id === current}" data-action="${action}" data-id="${o.id}">${o.label}</button>`)}</div>`;

  UI.Stars = (value, count) => html`<span class="row" style="--gap:6px"><span class="stars-static" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => html`<span style="${i <= Math.round(value) ? '' : 'opacity:.25'}">${icon('star')}</span>`)}</span><span class="text-sm"><strong>${fmt.score(value)}</strong>${count != null ? html` <span class="text-muted">(${count} đánh giá)</span>` : ''}</span><span class="sr-only">${fmt.score(value)} trên 5 sao</span></span>`;

  UI.Field = ({ label, name, type = 'text', value = '', required, help, placeholder, attrs = '', options, rows, id, prefix }) => {
    id = id || `f-${name}-${LMS.uid('x')}`;
    const helpId = help ? id + '-help' : null;
    let control;
    if (type === 'select') control = html`<select class="select" id="${id}" name="${name}" ${required ? raw('required aria-required="true"') : ''}${attr('aria-describedby', helpId)} ${raw(String(attrs))}>${options.map((o) => html`<option value="${o.value}" ${String(o.value) === String(value) ? raw('selected') : ''}${attr('disabled', o.disabled)}>${o.label}</option>`)}</select>`;
    else if (type === 'textarea') control = html`<textarea class="textarea" id="${id}" name="${name}" rows="${rows || 4}" ${required ? raw('required aria-required="true"') : ''}${attr('placeholder', placeholder)}${attr('aria-describedby', helpId)} ${raw(String(attrs))}>${value}</textarea>`;
    else control = html`<input class="input" id="${id}" type="${type}" name="${name}" value="${value}" ${required ? raw('required aria-required="true"') : ''}${attr('placeholder', placeholder)}${attr('aria-describedby', helpId)} ${raw(String(attrs))}>`;
    return html`<div class="field"><label class="field__label" for="${id}">${label}${required ? html`<span class="req" aria-hidden="true">*</span>` : ''}</label>${prefix ? html`<div class="input-icon">${icon(prefix)}${control}</div>` : control}${help ? html`<div class="field__help" id="${helpId}">${help}</div>` : ''}</div>`;
  };
  UI.Search = ({ value = '', placeholder = 'Tìm kiếm…', action = 'search', label = 'Tìm kiếm', width = '280px' }) => html`<div class="input-icon" style="width:min(100%,${width})">${icon('search')}<input class="input" type="search" value="${value}" placeholder="${placeholder}" aria-label="${label}" data-input="${action}"></div>`;
  UI.FilterSelect = ({ label, value, options, action, all = 'Tất cả' }) => html`<label class="sr-only" for="fs-${action}">${label}</label><select class="select" id="fs-${action}" style="width:auto;min-width:150px" data-change="${action}" aria-label="${label}"><option value="">${label}: ${all}</option>${options.map((o) => html`<option value="${o.value}" ${String(o.value) === String(value) ? raw('selected') : ''}>${o.label}</option>`)}</select>`;

  /* ---------------- DataTable ---------------- */
  /**
   * DataTable({ id, columns:[{key,label,sort,render,cls,label}], rows, state:{sort,dir,page,selected}, pageSize, selectable, empty, bulk })
   * Hành động chung: tbl-sort, tbl-page, tbl-sel, tbl-sel-all (router xử lý, cập nhật ctx.state.tables[id])
   */
  UI.DataTable = ({ id, columns, rows, state = {}, pageSize = 8, selectable, empty, bulk, caption, rowAction }) => {
    const st = { sort: null, dir: 'asc', page: 1, selected: [], ...state };
    let list = rows.slice();
    if (st.sort) { const col = columns.find((c) => c.key === st.sort); const get = col && col.sortValue ? col.sortValue : (r) => r[st.sort]; list.sort((a, b) => { const x = get(a), y = get(b); const r = x == null ? 1 : y == null ? -1 : typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'vi'); return st.dir === 'asc' ? r : -r; }); }
    const pages = Math.max(1, Math.ceil(list.length / pageSize)); const page = Math.min(st.page, pages);
    const view = list.slice((page - 1) * pageSize, page * pageSize);
    const sel = new Set(st.selected);
    const allOn = view.length && view.every((r) => sel.has(r.id));
    if (!rows.length) return empty || UI.Empty({ title: 'Chưa có dữ liệu', desc: 'Dữ liệu sẽ hiển thị khi được tạo.' });
    return html`${selectable && sel.size && bulk ? html`<div class="bulk-bar" role="region" aria-label="Thao tác hàng loạt"><span>Đã chọn ${sel.size}</span>${bulk}<button class="btn btn--ghost btn--sm" data-action="tbl-sel-clear" data-table="${id}">Bỏ chọn</button></div>` : ''}
    <div class="table-wrap"><table class="table table--responsive">${caption ? html`<caption class="sr-only">${caption}</caption>` : ''}<thead><tr>
      ${selectable ? html`<th class="col-check"><input type="checkbox" class="check" aria-label="Chọn tất cả trên trang" data-action="tbl-sel-all" data-table="${id}" data-ids="${view.map((r) => r.id).join(',')}" ${allOn ? raw('checked') : ''}></th>` : ''}
      ${columns.map((c) => html`<th scope="col" class="${c.cls || ''}" ${st.sort === c.key ? raw(`aria-sort="${st.dir === 'asc' ? 'ascending' : 'descending'}"`) : ''}>${c.sort === false || !c.key ? c.label : html`<button data-action="tbl-sort" data-table="${id}" data-key="${c.key}">${c.label}${icon(st.sort === c.key ? (st.dir === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down', 'icon--sm')}</button>`}</th>`)}
    </tr></thead><tbody>${view.map((r) => html`<tr class="${sel.has(r.id) ? 'is-selected' : ''}" ${rowAction ? raw(`data-row-href="${LMS.esc(rowAction(r))}"`) : ''}>
      ${selectable ? html`<td class="col-check"><input type="checkbox" aria-label="Chọn dòng" data-action="tbl-sel" data-table="${id}" data-id="${r.id}" ${sel.has(r.id) ? raw('checked') : ''}></td>` : ''}
      ${columns.map((c) => html`<td class="${c.cls || ''}" data-label="${c.label}">${c.render ? c.render(r) : r[c.key] ?? '—'}</td>`)}</tr>`)}</tbody></table></div>
    <div class="pagination"><span>Hiển thị ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, list.length)} / ${list.length}</span>${pages > 1 ? html`<nav class="pagination__pages" aria-label="Phân trang">
      <button data-action="tbl-page" data-table="${id}" data-page="${page - 1}" ${page === 1 ? raw('disabled') : ''} aria-label="Trang trước">${icon('chevron-left', 'icon--sm')}</button>
      ${Array.from({ length: pages }, (_, i) => html`<button data-action="tbl-page" data-table="${id}" data-page="${i + 1}" ${i + 1 === page ? raw('aria-current="page"') : ''}>${i + 1}</button>`)}
      <button data-action="tbl-page" data-table="${id}" data-page="${page + 1}" ${page === pages ? raw('disabled') : ''} aria-label="Trang sau">${icon('chevron-right', 'icon--sm')}</button></nav>` : ''}</div>`;
  };

  /* ---------------- Course card ---------------- */
  const COVERS = { layers: '#E6F2F1', process: '#E8F0F9', clock: '#FEF3E2', building: '#FFF6DC', database: '#EDE9FE', shield: '#FDECEA' };
  UI.CourseCard = (c) => html`<a class="card card--interactive course-card animate-enter" href="#/course/${c.id}">
    <div class="course-card__cover" style="--cover:${COVERS[c.cover] || '#E6F2F1'}"><div class="badges">${UI.Required(c.required)}${c.status === 'completed' ? UI.Badge('Hoàn thành', 'success', 'check') : c.overdue ? UI.Badge('Quá hạn', 'danger', 'clock') : ''}</div>${icon(c.cover || 'book', 'icon--xl')}</div>
    <div class="course-card__body"><span class="eyebrow">${c.domain} · ${c.module}</span><h3 class="course-card__title clamp-2">${c.title}</h3>
      <div class="course-card__meta"><span>${icon('clock', 'icon--sm')}${fmt.minutes(c.minutes)}</span><span>${icon('book', 'icon--sm')}${c.lessons} bài</span><span>${icon('target', 'icon--sm')}${c.level}</span></div>
      <div class="course-card__foot">${UI.Progress(c.pct, { sm: true, tone: c.status === 'completed' ? 'success' : c.status === 'failed' ? 'danger' : '', label: `Tiến độ ${c.title}` })}
        <div class="row-between text-xs"><span class="${c.status === 'failed' ? 'text-danger fw-600' : 'text-muted'}">${c.statusLabel}${c.quiz && c.quiz.best != null ? html` · Điểm cao nhất ${c.quiz.best}%` : ''}</span><strong class="num">${c.pct}%</strong></div>
        ${c.dueAt ? UI.Due(c.dueAt, c.status === 'completed') : ''}</div></div></a>`;

  /* ---------------- Journey ---------------- */
  UI.Journey = (stops) => html`<ol class="journey">${stops.map((s, i) => { const state = s.pct >= 100 ? 'is-done' : (stops.slice(0, i).every((x) => x.pct >= 100) || s.pct > 0) ? 'is-current' : ''; return html`<li class="journey__stop ${state}"><span class="journey__dot">${s.pct >= 100 ? icon('check', 'icon--sm') : state ? mai(16, 'var(--color-on-accent)', 'var(--color-accent)') : html`<span class="text-xs">${i + 1}</span>`}</span><div><div class="journey__name">${s.name}</div><div class="journey__pct">${s.pct >= 100 ? 'Hoàn thành' : s.pct > 0 ? `${s.pct}%` : 'Chưa bắt đầu'} · ${s.courses} khóa</div></div></li>`; })}</ol>`;

  UI.MaiBadge = (b) => html`<div class="stack" style="--gap:8px;align-items:center;text-align:center" title="${b.desc}"><div class="mai-badge ${b.earned ? 'animate-reward' : 'is-locked'}">${mai(40)}</div><div class="text-sm fw-600">${b.name}</div><div class="text-xs text-muted" style="max-width:16ch">${b.earned ? b.desc : 'Chưa mở khóa · ' + b.desc}</div></div>`;

  UI.ErrorState = (err, { retry = true } = {}) => {
    const map = { 0: ['wifi-off', 'warning', 'Mất kết nối', 'Không thể tải dữ liệu do mất kết nối mạng. Dữ liệu bạn đã nhập vẫn được giữ nguyên.'], 403: ['lock', 'danger', 'Không đủ quyền truy cập', err.message], 404: ['search', '', 'Không tìm thấy', err.message], 422: ['alert', 'warning', 'Dữ liệu không hợp lệ', err.message] };
    const [ic, tone, title, desc] = map[err.status] || ['alert', 'danger', 'Đã có lỗi xảy ra', err.message || 'Vui lòng thử lại sau.'];
    return html`<div class="page page--narrow">${UI.Empty({ icon: ic, tone, title, desc, action: html`<div class="row" style="justify-content:center">${retry && (err.status === 0 || !err.status) ? UI.Button({ label: 'Thử lại', icon: 'refresh', variant: 'primary', action: 'retry' }) : ''}${UI.Button({ label: 'Về trang chủ', icon: 'home', href: '#/' })}</div>` })}${err.status === 403 ? html`<p class="text-xs text-muted" style="text-align:center">Mã lỗi 403 · Quyền được kiểm tra tại lớp dữ liệu/API, không chỉ ẩn nút trên giao diện.</p>` : ''}</div>`;
  };

  /** Markdown tối giản (an toàn: escape trước, rồi mới định dạng) */
  UI.Markdown = (md) => {
    const lines = LMS.esc(md || '').split('\n'); const out = []; let list = null;
    const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>');
    const flush = () => { if (list) { out.push(`<${list.t}>${list.items.join('')}</${list.t}>`); list = null; } };
    lines.forEach((l) => {
      let m;
      if ((m = l.match(/^(#{2,3})\s+(.*)/))) { flush(); out.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`); }
      else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (!list || list.t !== 'ul') { flush(); list = { t: 'ul', items: [] }; } list.items.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = l.match(/^\s*\d+\.\s+(.*)/))) { if (!list || list.t !== 'ol') { flush(); list = { t: 'ol', items: [] }; } list.items.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = l.match(/^&gt;\s?(.*)/))) { flush(); out.push(`<blockquote class="alert">${inline(m[1])}</blockquote>`); }
      else if (l.trim()) { flush(); out.push(`<p>${inline(l)}</p>`); } else flush();
    });
    flush(); return raw(`<div class="prose">${out.join('')}</div>`);
  };

  LMS.UI = UI;
})(window.LMS);
