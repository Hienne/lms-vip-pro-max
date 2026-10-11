/* ==========================================================================
   components/charts.js — biểu đồ SVG thuần, có bảng dữ liệu thay thế (a11y)
   React/Angular: có thể thay bằng Recharts / ngx-charts, giữ nguyên props.
   ========================================================================== */
(function (LMS) {
  const { html, raw, esc } = LMS;
  const Charts = {};

  /** Radar năng lực: 5–8 trục, 1 dataset fill 20% (+ dataset so sánh tuỳ chọn, nét đứt) */
  Charts.Radar = ({ data, compare, size = 300, label = 'Biểu đồ năng lực', compareLabel = 'Trung bình đơn vị', seriesLabel = 'Của bạn (lần thi tốt nhất)' }) => {
    // Chừa lề ngang cho nhãn dài (tiếng Việt) để không bị cắt
    const n = data.length, padX = 70, W = size + padX * 2, cx = W / 2, cy = size / 2 + 10, R = size / 2 - 42;
    const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)]; };
    const rings = [25, 50, 75, 100].map((v) => `<polygon class="chart__grid" fill="none" points="${data.map((_, i) => pt(i, v).join(',')).join(' ')}"/>`).join('');
    const axes = data.map((_, i) => { const [x, y] = pt(i, 100); return `<line class="chart__grid" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; }).join('');
    const poly = (vals, cls) => `<polygon points="${vals.map((v, i) => pt(i, v).join(',')).join(' ')}" ${cls}/>`;
    // Nhãn dài tách 2 dòng tại khoảng trắng gần giữa nhất
    const wrap = (t) => { if (t.length <= 12) return [t]; const ws = t.split(' '); let best = 1, diff = 1e9; for (let k = 1; k < ws.length; k++) { const d = Math.abs(ws.slice(0, k).join(' ').length - ws.slice(k).join(' ').length); if (d < diff) { diff = d; best = k; } } return [ws.slice(0, best).join(' '), ws.slice(best).join(' ')]; };
    const labels = data.map((d, i) => { const [x, y0] = pt(i, 118); const anchor = Math.abs(x - cx) < 10 ? 'middle' : x > cx ? 'start' : 'end'; const lines = wrap(d.name); const y = y0 - (lines.length - 1) * 7 - (Math.abs(x - cx) < 10 && y0 < cy ? 10 : 0); return `<text class="chart__label" x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle">${lines.map((l, k) => `<tspan x="${x}" dy="${k ? 14 : 0}">${esc(l)}</tspan>`).join('')}<tspan x="${x}" dy="15" style="font-weight:700;fill:var(--color-text)">${d.answered === 0 ? '—' : d.value + '%'}</tspan></text>`; }).join('');
    const dots = data.map((d, i) => { const [x, y] = pt(i, d.value); return `<circle cx="${x}" cy="${y}" r="4" fill="var(--chart-1)" stroke="var(--color-surface)" stroke-width="2"><title>${esc(d.name)}: ${d.value}%</title></circle>`; }).join('');
    const svg = `<svg class="chart" viewBox="0 0 ${W} ${size + 24}" role="img" aria-label="${esc(label)}">${rings}${axes}${compare ? poly(compare.map((c) => c.value), 'fill="none" stroke="var(--chart-3)" stroke-width="2" stroke-dasharray="5 4"') : ''}${poly(data.map((d) => d.value), 'fill="var(--chart-1)" fill-opacity=".2" stroke="var(--chart-1)" stroke-width="2"')}${dots}${labels}</svg>`;
    return html`<figure class="stack" style="--gap:8px">${raw(svg)}
      <figcaption class="chart-legend"><span><i style="background:var(--chart-1)"></i>${seriesLabel}</span>${compare ? html`<span><i style="background:none;border:2px dashed var(--chart-3)"></i>${compareLabel}</span>` : ''}</figcaption>
      <details><summary class="link-btn" style="cursor:pointer">Xem dạng bảng</summary><table class="table mt-2"><thead><tr><th>Nhóm kiến thức</th><th>Tỷ lệ đúng</th>${compare ? html`<th>${compareLabel}</th>` : ''}</tr></thead><tbody>${data.map((d, i) => html`<tr><td>${d.name}</td><td class="num">${d.answered === 0 ? 'Chưa có dữ liệu' : d.value + '%'}</td>${compare ? html`<td class="num">${compare[i].value}%</td>` : ''}</tr>`)}</tbody></table></details></figure>`;
  };

  /** Cột dọc đơn giản (tuần) */
  Charts.Columns = ({ data, height = 160, unit = '', label = 'Biểu đồ cột', max }) => {
    const w = 520, pad = 24, bw = (w - pad * 2) / data.length;
    const m = max || Math.max(1, ...data.map((d) => d.value));
    const bars = data.map((d, i) => { const h = ((height - 40) * d.value) / m; const x = pad + i * bw + bw * 0.2; const y = height - 22 - h; return `<rect x="${x}" y="${y}" width="${bw * 0.6}" height="${Math.max(h, 1)}" rx="4" fill="${i === data.length - 1 ? 'var(--chart-1)' : 'color-mix(in srgb, var(--chart-1) 45%, transparent)'}"><title>${esc(d.label)}: ${d.value}${unit}</title></rect><text x="${x + bw * 0.3}" y="${y - 6}" text-anchor="middle" style="font-weight:600;fill:var(--color-text-secondary)">${d.value}</text><text x="${x + bw * 0.3}" y="${height - 6}" text-anchor="middle">${esc(d.label)}</text>`; }).join('');
    return html`<figure>${raw(`<svg class="chart" viewBox="0 0 ${w} ${height}" role="img" aria-label="${esc(label)}"><line class="chart__grid" x1="${pad}" x2="${w - pad}" y1="${height - 22}" y2="${height - 22}"/>${bars}</svg>`)}<figcaption class="sr-only">${data.map((d) => `${d.label}: ${d.value}${unit}`).join('; ')}</figcaption></figure>`;
  };

  /** Thanh ngang theo nhóm (đơn vị/phòng) — kèm số, không phụ thuộc màu */
  Charts.HBars = (rows, { valueKey = 'pct', suffix = '%', tone } = {}) => html`<div role="list">${rows.map((r) => { const v = r[valueKey] || 0; const color = tone ? tone(r) : v >= 80 ? 'var(--color-success)' : v >= 50 ? 'var(--chart-1)' : 'var(--color-warning)'; return html`<div class="hbar" role="listitem"><span class="truncate" title="${r.name}">${r.name}</span><div class="hbar__track" aria-hidden="true"><div class="hbar__fill" style="width:${Math.min(100, v)}%;background:${color}"></div></div><strong class="num" style="text-align:right">${v}${suffix}</strong></div>`; })}</div>`;

  /** Donut trạng thái (hoàn thành/đang học/chưa bắt đầu/chưa đạt) */
  Charts.Donut = ({ parts, size = 150, label }) => {
    const total = parts.reduce((s, p) => s + p.value, 0) || 1; const r = size / 2 - 14, c = 2 * Math.PI * r; let off = 0;
    const segs = parts.map((p) => { const len = (p.value / total) * c; const s = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.color}" stroke-width="18" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}"><title>${esc(p.label)}: ${p.value}</title></circle>`; off += len; return s; }).join('');
    return html`<div class="row" style="--gap:20px;align-items:center"><svg width="${size}" height="${size}" role="img" aria-label="${esc(label)}" style="transform:rotate(-90deg)"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--color-surface-sunken)" stroke-width="18"/>${raw(segs)}</svg>
      <ul class="list" style="font-size:var(--text-sm)">${parts.map((p) => html`<li class="row" style="--gap:8px;padding:3px 0"><i style="width:12px;height:12px;border-radius:3px;background:${p.color};display:inline-block"></i><span class="grow">${p.label}</span><strong class="num">${p.value}</strong><span class="text-muted num">(${Math.round((p.value / total) * 100)}%)</span></li>`)}</ul></div>`;
  };

  LMS.Charts = Charts;
})(window.LMS);
