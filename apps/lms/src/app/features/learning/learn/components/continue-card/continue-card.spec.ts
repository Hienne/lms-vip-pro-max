import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ContinueView } from '../../data-access/learn.store';
import { ContinueCard } from './continue-card';

const view: ContinueView = {
  courseTitle: 'Tổng quan hệ thống Core Banking',
  lessonTitle: 'Kiến trúc tổng thể',
  context: 'Chương 1 · Tổng quan hệ thống Core Banking',
  pct: 62,
  link: '/lesson/1/3',
  query: { block: 7 },
};

@Component({
  imports: [ContinueCard],
  template: `<app-continue-card [resume]="resume()" />`,
})
class Host {
  readonly resume = signal<ContinueView | null>(view);
}

function render(resume: ContinueView | null) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.resume.set(resume);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ContinueCard', () => {
  it('names the lesson, its chapter and course, and shows the server percentage', () => {
    const el = render(view);
    expect(el.querySelector('h2')?.textContent).toContain('Kiến trúc tổng thể');
    expect(el.textContent).toContain(
      'Chương 1 · Tổng quan hệ thống Core Banking',
    );
    expect(el.textContent).toContain('62%');
    expect(
      el.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow'),
    ).toBe('62');
  });

  it('has one link only: "Tiếp tục học" to the lesson, with its block', () => {
    const links = render(view).querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toContain('Tiếp tục học');
    expect(links[0].getAttribute('href')).toBe('/lesson/1/3?block=7');
  });

  it('points to the catalogue when nothing is in progress', () => {
    const el = render(null);
    expect(el.textContent).toContain('Bạn chưa có khóa học đang học.');
    const links = el.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toContain('Khám phá khóa học');
    expect(links[0].getAttribute('href')).toBe('/catalog');
    expect(el.querySelector('[role=progressbar]')).toBeNull();
  });
});
