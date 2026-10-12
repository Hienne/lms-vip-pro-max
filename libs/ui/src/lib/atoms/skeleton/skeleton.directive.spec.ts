import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Skeleton } from './skeleton.directive';

@Component({
  imports: [Skeleton],
  template: `
    <div uiSkeleton variant="title"></div>
    <div uiSkeleton></div>
    <div uiSkeleton variant="block"></div>
  `,
})
class Host {}

describe('Skeleton', () => {
  it('has text, title and block shapes, text being the default', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const shapes = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.skeleton'),
    ).map((el) => el.className);
    expect(shapes).toEqual([
      'skeleton skeleton--title',
      'skeleton skeleton--text',
      'skeleton skeleton--block',
    ]);
  });

  it('is hidden from assistive technology', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const first = (fixture.nativeElement as HTMLElement).querySelector(
      '.skeleton',
    );
    expect(first?.getAttribute('aria-hidden')).toBe('true');
  });

  it('stops shimmering under prefers-reduced-motion', () => {
    const scss = readFileSync(
      join(import.meta.dirname, '../../../styles/components/_skeleton.scss'),
      'utf8',
    );
    expect(scss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*animation: none/,
    );
  });
});
