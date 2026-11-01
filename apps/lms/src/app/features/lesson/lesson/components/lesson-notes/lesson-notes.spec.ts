import { TestBed } from '@angular/core/testing';
import type {
  Anchor,
  LessonBookmarkView,
  LessonNoteView,
} from '@lms/contracts';
import { LessonNotes } from './lesson-notes';

const none: Anchor = { type: 'none', blockId: null, page: null, second: null };
const page3: Anchor = { type: 'pdf', blockId: 32, page: 3, second: null };
const second75: Anchor = {
  type: 'video',
  blockId: 33,
  page: null,
  second: 75,
};

const note = (id: number, anchor: Anchor, text: string): LessonNoteView => ({
  id,
  lessonId: 16,
  anchor,
  text,
  createTime: '2026-11-01T09:00:00Z',
});

const bookmark = (id: number, anchor: Anchor): LessonBookmarkView => ({
  id,
  lessonId: 16,
  anchor,
  label: 'Tài liệu — trang 3',
  createTime: '2026-11-01T09:00:00Z',
});

async function render(
  inputs: Record<string, unknown> = {},
): Promise<ReturnType<typeof probe>> {
  const fixture = TestBed.createComponent(LessonNotes);
  const defaults = {
    anchorLabel: 'Trang 3',
    notes: [],
    bookmarks: [],
    ...inputs,
  };
  for (const [name, value] of Object.entries(defaults)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  return probe(fixture);
}

function probe(
  fixture: ReturnType<typeof TestBed.createComponent<LessonNotes>>,
) {
  const el = fixture.nativeElement as HTMLElement;
  const added: string[] = [];
  const followed: Anchor[] = [];
  const removed: LessonNoteView[] = [];
  let retries = 0;
  fixture.componentInstance.add.subscribe((t) => added.push(t));
  fixture.componentInstance.follow.subscribe((a) => followed.push(a));
  fixture.componentInstance.remove.subscribe((n) => removed.push(n));
  fixture.componentInstance.retry.subscribe(() => (retries += 1));
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return {
    fixture,
    el,
    added,
    followed,
    removed,
    retries: () => retries,
    text: () => el.textContent?.replace(/\s+/g, ' ') ?? '',
    field: () => el.querySelector('textarea')!,
    set: async (name: string, value: unknown) => {
      fixture.componentRef.setInput(name, value);
      await settle();
    },
    type: async (value: string) => {
      const field = el.querySelector('textarea')!;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
    },
    submit: async () => {
      el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await settle();
    },
    settle,
  };
}

describe('LessonNotes', () => {
  it('names the spot a note goes to in the label of the form', async () => {
    const { text } = await render({ anchorLabel: 'Video 1:15' });
    expect(text()).toContain('Ghi chú tại Video 1:15');
  });

  it('sends the trimmed text once, and asks for text when there is none', async () => {
    const { submit, type, added, text } = await render();
    await submit();
    expect(added).toEqual([]);
    expect(text()).toContain('Hãy nhập nội dung ghi chú.');

    await type('  Đổi CCCD  ');
    await submit();
    expect(added).toEqual(['Đổi CCCD']);
  });

  it('empties the form when a note was saved, and not before', async () => {
    const { type, submit, field, set } = await render();
    await type('Ghi chú');
    await submit();
    expect(field().value).toBe('Ghi chú');
    await set('savedKey', 1);
    expect(field().value).toBe('');
  });

  it('shows no error on the empty form after a note was saved, only when the learner submits empty', async () => {
    const { type, submit, set, text } = await render();
    await type('Ghi chú');
    await submit();
    await set('savedKey', 1);
    expect(text()).not.toContain('Hãy nhập nội dung ghi chú.');

    await submit();
    expect(text()).toContain('Hãy nhập nội dung ghi chú.');
  });

  it('disables the save button while a note is being saved', async () => {
    const { el, set } = await render();
    const save = () =>
      el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(save().disabled).toBe(false);
    await set('saving', true);
    expect(save().disabled).toBe(true);
  });

  it('lists the notes with their anchors, a whole-lesson note without a link', async () => {
    const { el, text } = await render({
      notes: [
        note(3, second75, 'Mốc 1:15'),
        note(2, page3, 'Trang ba'),
        note(1, none, 'Cả bài'),
      ],
    });
    const anchors = Array.from(el.querySelectorAll('.notes__anchor'));
    expect(anchors.map((a) => a.textContent?.trim())).toEqual([
      'Video 1:15',
      'Trang 3',
      'Cả bài',
    ]);
    expect(anchors.map((a) => a.tagName)).toEqual(['BUTTON', 'BUTTON', 'SPAN']);
    expect(text()).not.toContain('Chưa có ghi chú.');
  });

  it('follows the anchor of a note and of a bookmark, and removes a note', async () => {
    const { el, followed, removed, settle } = await render({
      notes: [note(2, page3, 'Trang ba')],
      bookmarks: [bookmark(5, second75)],
    });
    const links = el.querySelectorAll<HTMLButtonElement>(
      '.notes__anchor--link',
    );
    links[0].click();
    links[1].click();
    expect(followed).toEqual([page3, second75]);

    el.querySelector<HTMLButtonElement>(
      'button[aria-label="Xóa ghi chú"]',
    )!.click();
    await settle();
    expect(removed.map((n) => n.id)).toEqual([2]);
  });

  it('shows the bookmarks with their label after the notes, and none when there are none', async () => {
    const { text, set } = await render({ bookmarks: [bookmark(5, page3)] });
    expect(text()).toContain('Đánh dấu');
    expect(text()).toContain('Tài liệu — trang 3');
    await set('bookmarks', []);
    expect(text()).not.toContain('Đánh dấu');
  });

  it('says there are no notes, loads, and fails with a retry', async () => {
    const { text, set, el, retries, settle } = await render();
    expect(text()).toContain(
      'Chưa có ghi chú. Ghi chú được gắn với trang PDF hoặc mốc video đang xem.',
    );

    await set('loading', true);
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(text()).not.toContain('Chưa có ghi chú.');

    await set('loading', false);
    await set('error', { message: 'Máy chủ bận.' });
    expect(text()).toContain('Không tải được ghi chú');
    expect(text()).toContain('Máy chủ bận.');
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Thử lại'))!
      .click();
    await settle();
    expect(retries()).toBe(1);
  });
});
