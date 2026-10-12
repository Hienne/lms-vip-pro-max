import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, vi } from 'vitest';
import {
  openDesignSystem,
  placeholderMismatches,
} from './design-system.testing';

describe('tooltip demo', () => {
  beforeEach(() =>
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }),
  );
  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  it('replaces the placeholder and shows a tooltip on hover', async () => {
    const { page } = await openDesignSystem();
    const section = page.querySelector('#ds-buttons') as HTMLElement;
    expect(placeholderMismatches(section, ['tooltip'])).toEqual([]);

    const trigger = section.querySelector('[uiTooltip]') as HTMLElement;
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(400);
    TestBed.tick();

    const bubble = TestBed.inject(OverlayContainer)
      .getContainerElement()
      .querySelector('[role="tooltip"]');
    expect(bubble?.textContent?.trim()).toBe('Mở danh mục khóa học');
    expect(trigger.getAttribute('aria-describedby')).toBe(bubble?.id);
  });
});
