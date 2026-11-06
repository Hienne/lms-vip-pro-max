import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { BlockDetail } from '@lms/contracts';
import type { BlockView, OutlineChapter } from '../../data-access/lesson.store';
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

const blockView = (
  id: number,
  status: BlockView['status'],
  blockType: BlockDetail['block']['blockType'],
): BlockView => ({
  id,
  title: `Khối ${id}`,
  status,
  percent: status === 'in_progress' ? 40 : 0,
  detail: {
    block: { blockType },
    assets: [],
    steps: [],
  } as unknown as BlockDetail,
});

function mount(blocks: readonly BlockView[] = [], activeBlockId?: number) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(LessonOutline);
  fixture.componentRef.setInput('chapters', chapters);
  fixture.componentRef.setInput('blocks', blocks);
  fixture.componentRef.setInput('activeBlockId', activeBlockId);
  fixture.detectChanges();
  const chosen: number[] = [];
  fixture.componentInstance.blockSelected.subscribe((id) => chosen.push(id));
  return { el: fixture.nativeElement as HTMLElement, chosen };
}

function render(): HTMLElement {
  return mount().el;
}

const el = () => render();

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

  it('tells the states apart by shape: a check, a ring with a dot, an empty ring', () => {
    const marks = Array.from(el().querySelectorAll('li > .toc__state')).map(
      (mark) =>
        mark.querySelector('ui-icon')
          ? 'check'
          : mark.querySelector('.toc__ring--started')
            ? 'started'
            : mark.querySelector('.toc__ring')
              ? 'empty'
              : 'none',
    );
    expect(marks).toEqual(['check', 'started', 'empty']);
  });

  it('fills the row of the lesson on screen, not only its link', () => {
    const rows = Array.from(el().querySelectorAll('li'));
    expect(
      rows.map((row) => row.classList.contains('toc__lesson--current')),
    ).toEqual([false, true, false]);
  });

  it('lists the blocks of the current lesson under it, with their kind and state', () => {
    const { el, chosen } = mount(
      [
        blockView(1, 'completed', 'video'),
        blockView(2, 'in_progress', 'pdf'),
        blockView(3, 'not_started', 'text'),
      ],
      2,
    );
    const group = el.querySelector('.toc__blocks-item')!;
    expect(group.previousElementSibling?.classList).toContain(
      'toc__lesson--current',
    );
    const rows = Array.from(group.querySelectorAll<HTMLElement>('.toc__block'));
    expect(
      rows.map((r) =>
        r
          .querySelector('.toc__block-meta')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim(),
      ),
    ).toEqual(['Video', 'Tài liệu PDF · 40%', 'Bài đọc']);
    expect(rows.map((r) => r.getAttribute('aria-current'))).toEqual([
      null,
      'step',
      null,
    ]);
    rows[2].click();
    expect(chosen).toEqual([3]);
  });

  it('lists no blocks for a lesson with only one', () => {
    const { el } = mount([blockView(1, 'not_started', 'text')], 1);
    expect(el.querySelector('.toc__blocks')).toBeNull();
  });
});
