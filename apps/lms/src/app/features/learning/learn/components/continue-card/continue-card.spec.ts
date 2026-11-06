import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ContinueView } from '../../data-access/learn.store';
import { ContinueCard } from './continue-card';

const view: ContinueView = {
  courseTitle: 'Tổng quan hệ thống Core Banking',
  lessonTitle: 'Kiến trúc tổng thể',
  context: 'Tổng quan hệ thống Core Banking · Chương 1',
  hasCover: false,
  coverUrl: null,
  position: { number: 2, total: 4 },
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
  it('names the lesson as its heading, then course and chapter, and the server percentage with the lesson position', () => {
    const el = render(view);
    expect(el.querySelector('h2')?.textContent).toBe('Kiến trúc tổng thể');
    expect(el.textContent).toContain(
      'Tổng quan hệ thống Core Banking · Chương 1',
    );
    expect(
      el
        .querySelector('.continue-card__pct')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('62% · Bài 2/4');
    expect(
      el.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow'),
    ).toBe('62');
  });

  it('shows the cover first, as decoration, beside the text', () => {
    const el = render({ ...view, hasCover: true, coverUrl: 'blob:cover' });
    const card = el.querySelector('.continue-card')!;
    expect(card.classList).toContain('continue-card--cover');
    const image = card.firstElementChild as HTMLImageElement;
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe('blob:cover');
    expect(image.alt).toBe('');
  });

  it('keeps the place of a cover still being read as a plain box, and is text only without one', () => {
    const loading = render({ ...view, hasCover: true }).querySelector(
      '.continue-card__cover',
    )!;
    expect(loading.tagName).toBe('DIV');
    expect(loading.getAttribute('aria-hidden')).toBe('true');
    TestBed.resetTestingModule();
    const plain = render(view);
    expect(plain.querySelector('.continue-card__cover')).toBeNull();
    expect(plain.querySelector('.continue-card--cover')).toBeNull();
  });

  it('leaves the position out until the lesson is known', () => {
    const el = render({ ...view, position: null });
    expect(el.querySelector('.continue-card__pct')?.textContent?.trim()).toBe(
      '62%',
    );
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
