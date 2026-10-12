/** A swatch: a theme token with the purpose copy from the mockup page. */
export interface ColorToken {
  /** CSS custom property, e.g. `--color-primary`. */
  readonly token: string;
  readonly name: string;
  readonly purpose: string;
}

export interface ColorTokenGroup {
  readonly group: string;
  readonly tokens: readonly ColorToken[];
}

export const COLOR_TOKEN_GROUPS: readonly ColorTokenGroup[] = [
  {
    group: 'Brand',
    tokens: [
      {
        token: '--color-primary',
        name: 'Primary',
        purpose: 'CTA, link, trạng thái active, tiến độ',
      },
      {
        token: '--color-primary-hover',
        name: 'Primary hover',
        purpose: 'Hover của primary',
      },
      {
        token: '--color-primary-strong',
        name: 'Primary strong',
        purpose: 'Sidebar, hero',
      },
      {
        token: '--color-primary-subtle',
        name: 'Primary subtle',
        purpose: 'Nền chọn, hover nhẹ',
      },
      {
        token: '--color-accent',
        name: 'Vàng hoa mai',
        purpose: 'CHỈ làm nền/fill cho phần thưởng',
      },
      {
        token: '--color-accent-subtle',
        name: 'Accent subtle',
        purpose: 'Nền khối điểm thưởng',
      },
      {
        token: '--color-accent-ink',
        name: 'Accent ink',
        purpose: 'Chữ vàng trên nền sáng (thay cho #FFC62F)',
      },
    ],
  },
  {
    group: 'Semantic',
    tokens: [
      {
        token: '--color-success',
        name: 'Success',
        purpose: 'Hoàn thành, đạt — xanh lá, khác primary',
      },
      {
        token: '--color-warning',
        name: 'Warning',
        purpose: 'Sắp hạn, cảnh báo — cam, khác vàng thưởng',
      },
      {
        token: '--color-danger',
        name: 'Danger',
        purpose: 'Lỗi, quá hạn, chưa đạt, xóa',
      },
      {
        token: '--color-info',
        name: 'Info',
        purpose: 'Thông tin, đang học',
      },
    ],
  },
  {
    group: 'Neutral',
    tokens: [
      { token: '--color-bg', name: 'Nền trang', purpose: '' },
      { token: '--color-surface', name: 'Bề mặt', purpose: 'Card, modal' },
      {
        token: '--color-surface-2',
        name: 'Bề mặt 2',
        purpose: 'Header bảng, hover',
      },
      { token: '--color-text', name: 'Chữ chính', purpose: '' },
      { token: '--color-text-secondary', name: 'Chữ phụ', purpose: '' },
      {
        token: '--color-text-muted',
        name: 'Chữ nhạt',
        purpose: 'Mức nhạt nhất cho chữ (≥ 4.5:1)',
      },
      { token: '--color-border', name: 'Viền trang trí', purpose: '' },
      {
        token: '--color-border-strong',
        name: 'Viền điều khiển',
        purpose: 'Input, checkbox (≥ 3:1)',
      },
    ],
  },
];

/** Foreground / background token pairs of the live contrast table (the mockup's list). */
export const CONTRAST_PAIRS: readonly (readonly [
  foreground: string,
  background: string,
])[] = [
  ['--color-text', '--color-surface'],
  ['--color-text-secondary', '--color-surface'],
  ['--color-text-muted', '--color-surface'],
  ['--color-text-muted', '--color-bg'],
  ['--color-primary', '--color-surface'],
  ['--color-on-primary', '--color-primary'],
  ['--color-accent-ink', '--color-accent-subtle'],
  ['--color-success', '--color-success-subtle'],
  ['--color-warning', '--color-warning-subtle'],
  ['--color-danger', '--color-danger-subtle'],
  ['--color-info', '--color-info-subtle'],
  ['--color-border-strong', '--color-surface'],
];
