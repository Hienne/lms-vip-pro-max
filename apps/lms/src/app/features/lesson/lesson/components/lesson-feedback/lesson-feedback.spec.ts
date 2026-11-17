import { TestBed } from '@angular/core/testing';
import type {
  Anchor,
  FeedbackKind,
  FeedbackView,
  LessonCommentView,
} from '@lms/contracts';
import { LessonFeedback } from './lesson-feedback';

const none: Anchor = { type: 'none', blockId: null, page: null, second: null };
const page3: Anchor = { type: 'pdf', blockId: 32, page: 3, second: null };
const second12: Anchor = {
  type: 'video',
  blockId: 33,
  page: null,
  second: 12,
};

const comment = (
  id: number,
  text: string,
  extra: Partial<LessonCommentView> = {},
): LessonCommentView => ({
  id,
  authorName: 'Học viên tích hợp Demo',
  text,
  anchor: none,
  createTime: '2026-11-02T09:00:00Z',
  mine: false,
  ...extra,
});

const feedback = (
  id: number,
  kind: Exclude<FeedbackKind, 'comment'>,
  text: string,
  extra: Partial<FeedbackView> = {},
): FeedbackView => ({
  id,
  kind,
  text,
  anchor: none,
  status: 'new',
  reply: null,
  replyTime: null,
  createTime: '2026-11-02T09:00:00Z',
  ...extra,
});

/** Renders the section opened, as most tests read its content; `closed` leaves it as it starts. */
async function render(
  inputs: Record<string, unknown> = {},
  { closed = false } = {},
) {
  const fixture = TestBed.createComponent(LessonFeedback);
  const defaults = { comments: [], questions: [], reports: [], ...inputs };
  for (const [name, value] of Object.entries(defaults)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  const found = probe(fixture);
  if (!closed && found.toggle().getAttribute('aria-expanded') === 'false') {
    await found.open();
  }
  return found;
}

function probe(
  fixture: ReturnType<typeof TestBed.createComponent<LessonFeedback>>,
) {
  const el = fixture.nativeElement as HTMLElement;
  const rated: number[] = [];
  const sent: { kind: FeedbackKind; text: string }[] = [];
  let more = 0;
  let retries = 0;
  fixture.componentInstance.rate.subscribe((n) => rated.push(n));
  fixture.componentInstance.send.subscribe((s) => sent.push(s));
  fixture.componentInstance.more.subscribe(() => (more += 1));
  fixture.componentInstance.retry.subscribe(() => (retries += 1));
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  /** The panel of the tab on screen: the other two are hidden. */
  const panel = (kind: FeedbackKind) =>
    el.querySelector<HTMLElement>(`[id$="${kind}"], .feedback__panel`)!;
  const panels = () =>
    Array.from(el.querySelectorAll<HTMLElement>('.feedback__panel'));
  const shown = () =>
    panels().find((p) => !p.hasAttribute('inert') && !p.hidden)!;
  const toggle = () =>
    el.querySelector<HTMLButtonElement>('.feedback__toggle')!;
  return {
    fixture,
    el,
    toggle,
    open: async () => {
      toggle().click();
      await settle();
    },
    rated,
    sent,
    more: () => more,
    retries: () => retries,
    panel,
    shown,
    text: () => el.textContent?.replace(/\s+/g, ' ') ?? '',
    shownText: () => shown().textContent?.replace(/\s+/g, ' ') ?? '',
    set: async (name: string, value: unknown) => {
      fixture.componentRef.setInput(name, value);
      await settle();
    },
    tab: async (label: string) => {
      Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
        .find((t) => t.textContent?.includes(label))!
        .click();
      await settle();
    },
    type: async (value: string) => {
      const field = shown().querySelector('textarea')!;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
    },
    submit: async () => {
      shown()
        .querySelector<HTMLButtonElement>('button[type="submit"]')!
        .click();
      await settle();
    },
    settle,
  };
}

describe('LessonFeedback', () => {
  describe('closed by default', () => {
    it('starts closed: a titled section card with its open button in the header, then the stars and the counts', async () => {
      const { el, toggle, text } = await render(
        {
          rating: { average: 4.5, count: 12 },
          commentTotal: 2,
          questions: [feedback(1, 'question', 'Hỏi về đối soát')],
        },
        { closed: true },
      );
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(el.querySelector('ui-section-card h2')?.textContent?.trim()).toBe(
        'Đánh giá & trao đổi',
      );
      expect(toggle().closest('.section-card__action')).not.toBeNull();
      expect(toggle().textContent?.trim()).toBe('Mở');
      expect(text()).toContain('Đánh giá & trao đổi');
      expect(text()).toContain('2 nhận xét · 1 câu hỏi');
      expect(el.querySelector('ui-stars')).not.toBeNull();
      expect(el.querySelector('#feedback-body')).toBeNull();
      expect(el.querySelector('textarea')).toBeNull();
    });

    it('opens and closes on a click on the row', async () => {
      const { el, toggle, open } = await render({}, { closed: true });
      await open();
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(toggle().getAttribute('aria-controls')).toBe('feedback-body');
      expect(el.querySelector('#feedback-body textarea')).not.toBeNull();
      await open();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('stays open after a send', async () => {
      const { toggle, type, submit, set } = await render({ lessonId: 16 });
      await type('Một nhận xét đủ dài');
      await submit();
      await set('sent', { comment: 1 });
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
    });

    it('opens on its own when loading failed, so the error is seen', async () => {
      const { toggle, text } = await render(
        { error: { message: 'Máy chủ bận.' } },
        { closed: true },
      );
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(text()).toContain('Máy chủ bận.');
    });
  });

  describe('header and rating', () => {
    it('says there is no rating yet', async () => {
      const { text } = await render();
      expect(text()).toContain('Đánh giá & trao đổi');
      expect(text()).toContain('Chưa có đánh giá');
    });

    it('shows the average and the count once someone rated', async () => {
      const { text } = await render({ rating: { average: 4.5, count: 12 } });
      expect(text()).toContain('4,5');
      expect(text()).toContain('12 đánh giá');
      expect(text()).not.toContain('Chưa có đánh giá');
    });

    it('asks the question, and confirms the stars the learner gave', async () => {
      const { text, set } = await render();
      expect(text()).toContain('Bài học này hữu ích với bạn thế nào?');
      expect(text()).not.toContain('Đã ghi nhận');
      await set('myStars', 4);
      expect(text()).toContain('Đã ghi nhận 4 sao');
    });

    it('rates by click on a star', async () => {
      const { el, rated, settle } = await render();
      el.querySelector<HTMLButtonElement>(
        'button[aria-label="4 sao"]',
      )!.click();
      await settle();
      expect(rated).toEqual([4]);
    });

    it('rates by the arrow keys: each step chooses, so the store keeps the last', async () => {
      const { el, rated, settle } = await render({ myStars: 3 });
      const star = el.querySelector<HTMLButtonElement>(
        'button[aria-label="3 sao"]',
      )!;
      star.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
      await settle();
      el.querySelector<HTMLButtonElement>(
        'button[aria-label="4 sao"]',
      )!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
      await settle();
      expect(rated).toEqual([4, 5]);
    });
  });

  describe('tabs and forms', () => {
    it('counts the comments and the questions in their tabs, and not the reports', async () => {
      const { el } = await render({
        commentTotal: 23,
        questions: [feedback(1, 'question', 'Hỏi gì đó nhỉ')],
      });
      const tabs = Array.from(el.querySelectorAll('[role="tab"]')).map((t) =>
        t.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(tabs).toEqual([
        'Nhận xét 23',
        'Hỏi giảng viên 1',
        'Báo nội dung không phù hợp',
      ]);
    });

    it('has the copy of each tab: label, help, button', async () => {
      const { shownText, tab } = await render();
      expect(shownText()).toContain('Nhận xét của bạn');
      expect(shownText()).toContain(
        'Nhận xét hiển thị công khai cho học viên khác. Tối đa 1000 ký tự.',
      );
      expect(shownText()).toContain('Gửi nhận xét');

      await tab('Hỏi giảng viên');
      expect(shownText()).toContain('Câu hỏi cho giảng viên');
      expect(shownText()).toContain(
        'Chỉ bạn và giảng viên thấy câu hỏi này. Tối đa 1000 ký tự.',
      );
      expect(shownText()).toContain('Gửi câu hỏi');
      expect(shownText()).not.toContain('thông báo');

      await tab('Báo nội dung');
      expect(shownText()).toContain(
        'Mô tả vấn đề (sai thông tin, lỗi tệp, nội dung nhạy cảm…)',
      );
      expect(shownText()).toContain(
        'Báo cáo được gửi riêng tới giảng viên/quản trị nội dung. Tối đa 1000 ký tự.',
      );
      expect(shownText()).toContain('Gửi báo cáo');
    });

    it('makes the report button the danger one and the others secondary', async () => {
      const { shown, tab } = await render();
      const button = () =>
        shown().querySelector<HTMLButtonElement>('button[type="submit"]')!;
      expect(button().classList.contains('btn--secondary')).toBe(true);
      await tab('Báo nội dung');
      expect(button().classList.contains('btn--danger')).toBe(true);
    });

    it('says where the text goes when there is a spot, and nothing for the whole lesson', async () => {
      const { shownText, set } = await render({ spot: 'Trang 3' });
      expect(shownText()).toContain('Gửi kèm vị trí: Trang 3');
      await set('spot', 'Video 0:12');
      expect(shownText()).toContain('Gửi kèm vị trí: Video 0:12');
      await set('spot', null);
      expect(shownText()).not.toContain('Gửi kèm vị trí');
    });

    it('sends the trimmed text with its kind, once', async () => {
      const { type, submit, sent } = await render();
      await type('  Trang ba rất rõ  ');
      await submit();
      expect(sent).toEqual([{ kind: 'comment', text: 'Trang ba rất rõ' }]);
    });

    it('sends a question and a report from their own tabs', async () => {
      const { type, submit, sent, tab } = await render();
      await tab('Hỏi giảng viên');
      await type('Đoạn này giải thích gì?');
      await submit();
      await tab('Báo nội dung');
      await type('Sai thông tin ở trang 2');
      await submit();
      expect(sent).toEqual([
        { kind: 'question', text: 'Đoạn này giải thích gì?' },
        { kind: 'report', text: 'Sai thông tin ở trang 2' },
      ]);
    });

    it('keeps a draft in its own tab: a comment never turns into a question', async () => {
      const { type, shown, tab } = await render();
      await type('Nhận xét dở dang');
      await tab('Hỏi giảng viên');
      expect(shown().querySelector('textarea')!.value).toBe('');
      await tab('Nhận xét');
      expect(shown().querySelector('textarea')!.value).toBe('Nhận xét dở dang');
    });

    it('refuses text under 5 characters, trimmed, and text over 1000', async () => {
      const { type, submit, sent, shownText } = await render();
      await type('  abcd  ');
      await submit();
      expect(sent).toEqual([]);
      expect(shownText()).toContain('Nội dung cần tối thiểu 5 ký tự.');

      await type('a'.repeat(1001));
      await submit();
      expect(sent).toEqual([]);
      expect(shownText()).toContain('Nội dung tối đa 1000 ký tự.');

      await type('a'.repeat(1000));
      await submit();
      expect(sent).toHaveLength(1);
    });

    it('asks for text when the form is empty', async () => {
      const { submit, sent, shownText } = await render();
      await submit();
      expect(sent).toEqual([]);
      expect(shownText()).toContain('Nội dung cần tối thiểu 5 ký tự.');
    });

    it('empties only the form of the kind that was sent, with no error left', async () => {
      const { type, submit, shown, set, tab, shownText } = await render();
      await type('Nhận xét gửi đi');
      await submit();
      await tab('Hỏi giảng viên');
      await type('Câu hỏi chưa gửi');
      await tab('Nhận xét');
      await set('sent', { comment: 1 });
      expect(shown().querySelector('textarea')!.value).toBe('');
      expect(shownText()).not.toContain('Nội dung cần tối thiểu');
      await tab('Hỏi giảng viên');
      expect(shown().querySelector('textarea')!.value).toBe('Câu hỏi chưa gửi');
    });

    it('starts over on the comments tab with empty forms when another lesson comes on screen', async () => {
      const { type, set, tab, shown, toggle, open } = await render({
        lessonId: 16,
      });
      await type('Nhận xét dở dang');
      await tab('Báo nội dung');
      await type('Báo cáo dở dang');
      await set('lessonId', 17);
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      await open();
      expect(shown().querySelector('textarea')!.value).toBe('');
      expect(
        shown().querySelector('button[type="submit"]')!.textContent,
      ).toContain('Gửi nhận xét');
      await tab('Báo nội dung');
      expect(shown().querySelector('textarea')!.value).toBe('');
    });

    it('keeps the drafts while the same lesson stays on screen', async () => {
      const { type, set, shown } = await render({ lessonId: 16 });
      await type('Nhận xét dở dang');
      await set('lessonId', 16);
      expect(shown().querySelector('textarea')!.value).toBe('Nhận xét dở dang');
    });

    it('disables the button while a send is on its way, and sends nothing meanwhile', async () => {
      const { type, shown, submit, sent, set } = await render();
      await type('Nhận xét hợp lệ');
      await set('sending', true);
      expect(
        shown().querySelector<HTMLButtonElement>('button[type="submit"]')!
          .disabled,
      ).toBe(true);
      await submit();
      expect(sent).toEqual([]);
    });
  });

  describe('lists', () => {
    it('lists the comments with the author, the time and the spot', async () => {
      const { shownText } = await render({
        comments: [
          comment(3, 'Trang ba rất rõ', { anchor: page3 }),
          comment(2, 'Nhận xét của tôi', { mine: true }),
          comment(1, 'Cả bài hay', { anchor: second12 }),
        ],
      });
      expect(shownText()).toContain('Học viên tích hợp Demo');
      expect(shownText()).toContain('tại Trang 3');
      expect(shownText()).toContain('tại Video 0:12');
      expect(shownText()).toContain('Bạn');
      expect(shownText()).toContain('Nhận xét của tôi');
      expect(shownText()).not.toContain('tại Cả bài');
      expect(shownText()).not.toContain('Chưa có nhận xét');
    });

    it('says there are no comments yet', async () => {
      const { shownText } = await render();
      expect(shownText()).toContain('Chưa có nhận xét. Hãy là người đầu tiên.');
    });

    it('offers "Xem thêm nhận xét" only while comments are left, and asks for the next page once', async () => {
      const { shown, more, set, settle } = await render({
        comments: [comment(1, 'Một nhận xét')],
      });
      const button = () =>
        Array.from(shown().querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Xem thêm nhận xét'),
        );
      expect(button()).toBeUndefined();
      await set('hasMore', true);
      button()!.click();
      await settle();
      expect(more()).toBe(1);
      await set('moreBusy', true);
      expect(button()!.disabled).toBe(true);
      await set('hasMore', false);
      expect(button()).toBeUndefined();
    });

    it('lists the learner’s questions with their status, and the instructor’s reply', async () => {
      const { shownText, tab } = await render({
        questions: [
          feedback(2, 'question', 'Hỏi lần hai', {
            anchor: second12,
            status: 'answered',
            reply: 'Tạo CIF mới theo quy trình.',
            replyTime: '2026-11-02T10:00:00Z',
          }),
          feedback(1, 'question', 'Hỏi lần một'),
        ],
      });
      await tab('Hỏi giảng viên');
      expect(shownText()).toContain('Hỏi lần hai');
      expect(shownText()).toContain('Đã trả lời');
      expect(shownText()).toContain('Chờ trả lời');
      expect(shownText()).toContain('Video 0:12');
      expect(shownText()).toContain('Giảng viên');
      expect(shownText()).toContain('Tạo CIF mới theo quy trình.');
      expect(shownText()).not.toContain('Bạn chưa đặt câu hỏi nào');
    });

    it('says there are no questions yet', async () => {
      const { shownText, tab } = await render();
      await tab('Hỏi giảng viên');
      expect(shownText()).toContain('Bạn chưa đặt câu hỏi nào ở bài này.');
    });

    it('lists the learner’s reports as waiting or handled', async () => {
      const { shownText, tab } = await render({
        reports: [
          feedback(5, 'report', 'Đã được xử lý rồi', { status: 'resolved' }),
          feedback(4, 'report', 'Sai thông tin ở trang 2', { anchor: page3 }),
        ],
      });
      await tab('Báo nội dung');
      expect(shownText()).toContain('Chờ xử lý');
      expect(shownText()).toContain('Đã xử lý');
      expect(shownText()).toContain('Sai thông tin ở trang 2');
      expect(shownText()).not.toContain('Bạn chưa gửi báo cáo nào');
    });

    it('says there are no reports yet', async () => {
      const { shownText, tab } = await render();
      await tab('Báo nội dung');
      expect(shownText()).toContain('Bạn chưa gửi báo cáo nào ở bài này.');
    });
  });

  describe('loading and failing', () => {
    it('shows a skeleton and neither stars nor forms while loading', async () => {
      const { el, text } = await render({ loading: true });
      expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(el.querySelector('textarea')).toBeNull();
      expect(text()).not.toContain('Chưa có đánh giá');
    });

    it('fails with the message and a retry', async () => {
      const { el, text, retries, settle } = await render({
        error: { message: 'Máy chủ bận.' },
      });
      expect(text()).toContain('Không tải được đánh giá và nhận xét');
      expect(text()).toContain('Máy chủ bận.');
      expect(el.querySelector('textarea')).toBeNull();
      Array.from(el.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Thử lại'))!
        .click();
      await settle();
      expect(retries()).toBe(1);
    });
  });
});
