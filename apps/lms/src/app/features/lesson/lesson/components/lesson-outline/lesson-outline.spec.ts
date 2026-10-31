import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { OutlineChapter } from '../../data-access/lesson.store';
import { LessonOutline } from './lesson-outline';

const chapters: readonly OutlineChapter[] = [
  {
    id: 1,
    title: 'Kiến trúc',
    lessons: [
      {
        id: 10,
        title: 'Tổng quan',
        state: 'completed',
        quiz: false,
        link: '/lesson/1/10',
        current: false,
      },
      {
        id: 11,
        title: 'Dữ liệu',
        state: 'in_progress',
        quiz: false,
        link: '/lesson/1/11',
        current: true,
      },
    ],
  },
  {
    id: 2,
    title: 'Kiểm tra',
    lessons: [
      {
        id: 12,
        title: 'Bài kiểm tra cuối khóa',
        state: 'not_started',
        quiz: true,
        link: '/lesson/1/12',
        current: false,
      },
    ],
  },
];

function render(): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(LessonOutline);
  fixture.componentRef.setInput('chapters', chapters);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('LessonOutline', () => {
  it('lists the chapters and their lessons with a status each', () => {
    const el = render();
    expect(
      Array.from(el.querySelectorAll('h3')).map((h) => h.textContent),
    ).toEqual(['Kiến trúc', 'Kiểm tra']);
    const states = Array.from(el.querySelectorAll('li > .toc__sr')).map((s) =>
      s.textContent?.trim(),
    );
    expect(states).toEqual(['Đã hoàn thành', 'Đang học', 'Chưa học']);
  });

  it('links every lesson, marks the current one and the quiz lesson with its own label', () => {
    const el = render();
    const links = Array.from(el.querySelectorAll('a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/lesson/1/10',
      '/lesson/1/11',
      '/lesson/1/12',
    ]);
    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual([
      null,
      'page',
      null,
    ]);
    const quiz = el.querySelectorAll('li')[2];
    expect(quiz.textContent).toContain('Bài kiểm tra cuối khóa');
    expect(quiz.querySelector('a ui-icon')).not.toBeNull();
    expect(quiz.querySelector('a .toc__sr')?.textContent).toContain(
      'Bài kiểm tra',
    );
    expect(el.querySelectorAll('li')[0].querySelector('a ui-icon')).toBeNull();
  });
});
