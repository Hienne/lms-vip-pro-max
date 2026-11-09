import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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
        title: 'Bài kiểm tra giữa khóa',
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

function mount(
  options: {
    blocks?: readonly BlockView[];
    activeBlockId?: number;
    finalQuizId?: number | null;
  } = {},
) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const navigate = vi
    .spyOn(TestBed.inject(Router), 'navigateByUrl')
    .mockResolvedValue(true);
  const fixture = TestBed.createComponent(LessonOutline);
  fixture.componentRef.setInput('chapters', chapters);
  fixture.componentRef.setInput('blocks', options.blocks ?? []);
  fixture.componentRef.setInput('activeBlockId', options.activeBlockId);
  fixture.componentRef.setInput('finalQuizId', options.finalQuizId ?? null);
  fixture.detectChanges();
  const chosen: number[] = [];
  fixture.componentInstance.blockSelected.subscribe((id) => chosen.push(id));
  const el = fixture.nativeElement as HTMLElement;
  const rows = () =>
    Array.from(el.querySelectorAll<HTMLElement>('[role="treeitem"]'));
  const row = (label: string) =>
    rows().find(
      (r) =>
        r.querySelector(':scope > .tree__node .tree__label')?.textContent ===
        label,
    )!;
  const press = (label: string) => {
    row(label).querySelector<HTMLElement>('.tree__node')!.click();
    fixture.detectChanges();
  };
  return { el, chosen, navigate, rows, row, press, fixture };
}

const own = (row: HTMLElement, selector: string) =>
  row.querySelector(`:scope > .tree__node ${selector}`);

describe('LessonOutline', () => {
  it('is a tree: chapters, then their lessons one level down', () => {
    const { rows } = mount();
    expect(
      rows().map((r) => [
        r.getAttribute('aria-level'),
        r.querySelector('.tree__label')?.textContent,
      ]),
    ).toEqual([
      ['1', 'Kiến trúc'],
      ['2', 'Tổng quan'],
      ['2', 'Dữ liệu'],
      ['1', 'Kiểm tra'],
      ['2', 'Bài kiểm tra giữa khóa'],
    ]);
  });

  it('opens every chapter and gives each lesson its status in words', () => {
    const { row } = mount();
    expect(row('Kiến trúc').getAttribute('aria-expanded')).toBe('true');
    expect(row('Kiểm tra').getAttribute('aria-expanded')).toBe('true');
    expect(
      ['Tổng quan', 'Dữ liệu', 'Bài kiểm tra giữa khóa'].map((title) =>
        own(row(title), '.lesson-status__sr')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim(),
      ),
    ).toEqual(['Đã hoàn thành', 'Đang học', 'Chưa học']);
  });

  it('tells the states apart by icon: a check, a play arrow, a dash', () => {
    const { row } = mount();
    const shape = (title: string) =>
      own(row(title), '.toc__state')?.querySelector('svg')?.innerHTML ?? 'none';
    const shapes = ['Tổng quan', 'Dữ liệu', 'Bài kiểm tra giữa khóa'].map(
      shape,
    );
    expect(new Set(shapes).size).toBe(3);
    expect(shapes).not.toContain('none');
  });

  it('marks the lesson on screen as the selected row and gives a quiz lesson its own icon', () => {
    const { rows, row } = mount();
    expect(
      rows()
        .filter((r) => r.getAttribute('aria-selected') === 'true')
        .map((r) => r.querySelector('.tree__label')?.textContent),
    ).toEqual(['Dữ liệu']);
    expect(own(row('Bài kiểm tra giữa khóa'), 'ui-icon')).not.toBeNull();
  });

  it('opens a lesson on selection, and does nothing for the lesson already open', () => {
    const first = mount();
    first.press('Tổng quan');
    expect(first.navigate).toHaveBeenCalledWith('/lesson/1/10');
    TestBed.resetTestingModule();
    const second = mount();
    second.press('Dữ liệu');
    expect(second.navigate).not.toHaveBeenCalled();
  });

  it('only folds a chapter and leaves the highlight on the lesson on screen', () => {
    const { press, row, rows, navigate } = mount();
    press('Kiểm tra');
    expect(row('Kiểm tra').getAttribute('aria-expanded')).toBe('false');
    expect(navigate).not.toHaveBeenCalled();
    expect(
      rows()
        .filter((r) => r.getAttribute('aria-selected') === 'true')
        .map((r) => r.querySelector('.tree__label')?.textContent),
    ).toEqual(['Dữ liệu']);
  });

  describe('the final exam', () => {
    it('is absent when the course has none', () => {
      expect(
        mount()
          .rows()
          .some((r) => r.textContent?.includes('Bài thi cuối khóa')),
      ).toBe(false);
    });

    it('comes last, at the top level, and opens the exam on selection', () => {
      const { rows, row, press, navigate } = mount({ finalQuizId: 6 });
      const last = rows().at(-1)!;
      expect(last.getAttribute('aria-level')).toBe('1');
      expect(last).toBe(row('Bài thi cuối khóa'));
      expect(last.textContent).toContain('Cần đạt để hoàn thành khóa học');
      press('Bài thi cuối khóa');
      expect(navigate).toHaveBeenCalledWith('/quiz/6');
    });
  });

  describe('the blocks of the current lesson', () => {
    const blocks = [
      blockView(1, 'completed', 'video'),
      blockView(2, 'in_progress', 'pdf'),
      blockView(3, 'not_started', 'text'),
    ];

    it('are listed under it with their kind, state and the active one selected', () => {
      const { rows, row } = mount({ blocks, activeBlockId: 2 });
      const blockRows = rows().filter(
        (r) => r.getAttribute('aria-level') === '3',
      );
      expect(blockRows.map((r) => r.parentElement?.closest('li'))).toEqual([
        row('Dữ liệu'),
        row('Dữ liệu'),
        row('Dữ liệu'),
      ]);
      expect(
        blockRows.map((r) =>
          own(r, '.tree__description')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim(),
        ),
      ).toEqual(['Video', 'Tài liệu PDF · 40%', 'Bài đọc']);
      expect(blockRows.map((r) => r.getAttribute('aria-selected'))).toEqual([
        'false',
        'true',
        'false',
      ]);
      expect(row('Dữ liệu').getAttribute('aria-selected')).toBe('false');
    });

    it('report the block chosen', () => {
      const { press, chosen, navigate } = mount({ blocks, activeBlockId: 1 });
      press('Khối 3');
      expect(chosen).toEqual([3]);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('are not listed for a lesson with only one', () => {
      const { rows } = mount({
        blocks: [blockView(1, 'not_started', 'text')],
        activeBlockId: 1,
      });
      expect(rows().some((r) => r.getAttribute('aria-level') === '3')).toBe(
        false,
      );
    });
  });
});
