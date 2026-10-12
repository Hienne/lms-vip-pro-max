import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Journey, type JourneyStop } from './journey';

const STOPS: readonly JourneyStop[] = [
  { name: 'Hội nhập', pct: 100, courses: 1 },
  { name: 'Nền tảng nghiệp vụ', pct: 62, courses: 2 },
  { name: 'Vận hành hệ thống', pct: 10, courses: 2 },
  { name: 'An toàn thông tin', pct: 0, courses: 1 },
];

@Component({ imports: [Journey], template: `<app-journey [stops]="stops" />` })
class Host {
  stops = STOPS;
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const stops = () =>
    Array.from(root.querySelectorAll<HTMLElement>('.journey__stop'));
  return { fixture, stops };
}

const text = (el: Element | null) =>
  el?.textContent?.replace(/\s+/g, ' ').trim();

describe('Journey', () => {
  it('lists every stop with its name, progress and course count', () => {
    const { stops } = render();
    expect(stops().map((s) => text(s.querySelector('.journey__name')))).toEqual(
      STOPS.map((s) => s.name),
    );
    expect(stops().map((s) => text(s.querySelector('.journey__pct')))).toEqual([
      'Hoàn thành · 1 khóa',
      '62% · 2 khóa',
      '10% · 2 khóa',
      'Chưa bắt đầu · 1 khóa',
    ]);
  });

  it('marks 100% stops done with a check, and the first started stop after them current', () => {
    const { stops } = render();
    expect(stops()[0].classList.contains('journey__stop--done')).toBe(true);
    expect(stops()[0].querySelector('.journey__dot ui-icon')).not.toBeNull();
    expect(stops()[1].classList.contains('journey__stop--current')).toBe(true);
  });

  it('shows the mai flower on a current stop, and the number on an upcoming one', () => {
    const { stops } = render();
    expect(stops()[1].querySelector('.journey__dot ui-mai')).not.toBeNull();
    expect(text(stops()[3].querySelector('.journey__dot'))).toBe('4');
    expect(stops()[3].classList.contains('journey__stop--current')).toBe(false);
  });

  it('treats every started stop as current, like the mockup', () => {
    const { stops } = render();
    expect(
      stops().map((s) => s.classList.contains('journey__stop--current')),
    ).toEqual([false, true, true, false]);
  });

  it('marks the current stops with aria-current="step"', () => {
    const { stops } = render();
    expect(stops().map((s) => s.getAttribute('aria-current'))).toEqual([
      null,
      'step',
      'step',
      null,
    ]);
  });
});
