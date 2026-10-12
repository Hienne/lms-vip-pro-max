import {
  openDesignSystem,
  placeholderMismatches,
} from './design-system.testing';

describe('/design-system alert demo', () => {
  it('replaces its placeholder with the four tones and a tip', async () => {
    const { page } = await openDesignSystem();
    const section = page.querySelector('#ds-feedback') as HTMLElement;

    expect(placeholderMismatches(section, ['alert-tip'])).toEqual([]);
    const tones = Array.from(section.querySelectorAll('ui-alert')).map(
      (el) => el.className,
    );
    expect(tones.some((c) => c.includes('alert--success'))).toBe(true);
    expect(tones.some((c) => c.includes('alert--warning'))).toBe(true);
    expect(tones.some((c) => c.includes('alert--danger'))).toBe(true);
    expect(section.querySelector('ui-tip')).not.toBeNull();
  });
});
