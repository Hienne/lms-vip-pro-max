import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { knowledgeAnswerFixture } from '@lms/mocks';
import type { Answer, Turn } from '../../data-access/assistant.model';
import { ChatMessage } from './chat-message';

const answer = (over: Partial<Answer>): Answer => ({
  status: 'done',
  text: '',
  retrieved: null,
  found: null,
  citations: [],
  error: null,
  ...over,
});

@Component({
  imports: [ChatMessage],
  template: `<app-chat-message
    [turn]="turn()"
    (retry)="retried.push($event)"
  />`,
})
class Host {
  readonly turn = signal<Turn>({
    id: 7,
    question: 'Quy trình EOD?',
    answer: answer({}),
  });
  readonly retried: number[] = [];
}

describe('ChatMessage', () => {
  let host: Host;
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<Host>>;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  const show = (a: Partial<Answer>) => {
    host.turn.update((t) => ({ ...t, answer: answer(a) }));
    fixture.detectChanges();
  };
  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';

  it('shows the question and a searching state', () => {
    show({ status: 'searching' });
    expect(text()).toContain('Quy trình EOD?');
    expect(text()).toContain('Đang tìm trong tài liệu…');
    expect(el.querySelector('app-source-badge')).toBeNull();
  });

  it('says how many passages were found while composing', () => {
    show({ status: 'composing', retrieved: 3 });
    expect(text()).toContain(
      'Đã tìm thấy 3 đoạn liên quan, đang soạn câu trả lời…',
    );
  });

  it('keeps the streamed text and drops the progress line once text arrives', () => {
    show({ status: 'composing', retrieved: 3, text: 'Chạy EOD phải' });
    expect(text()).toContain('Chạy EOD phải');
    expect(text()).not.toContain('đang soạn');
  });

  const badges = () =>
    Array.from(
      el.querySelectorAll<HTMLButtonElement>('app-source-badge button'),
    );

  it('turns each marker into a source badge where it stands, with no source list', () => {
    show({
      status: 'done',
      text: knowledgeAnswerFixture.answer,
      found: true,
      citations: knowledgeAnswerFixture.citations,
    });
    expect(badges().map((b) => b.textContent?.trim())).toEqual(['1', '2']);
    expect(badges()[0].getAttribute('aria-label')).toBe(
      'Nguồn 1: Quy-trinh-EOD.pdf, trang 1, dòng 3–9',
    );
    const answer = el.querySelector('.message__answer p') as HTMLElement;
    // Text, badge, text, badge, text: each badge stands where its marker was.
    expect(
      Array.from(answer.children).map((child) => child.tagName.toLowerCase()),
    ).toEqual(['span', 'app-source-badge', 'span', 'app-source-badge', 'span']);
    expect(answer.children[0].textContent).toMatch(/khóa ngày giao dịch $/);
    expect(answer.children[2].textContent).toMatch(/^\. Mọi chênh lệch/);
    expect(el.querySelector('.message__sources')).toBeNull();
    expect(text()).not.toContain('Nguồn');
    expect(el.querySelector('details')).toBeNull();
  });

  it('keeps a marker with no citation as plain text', () => {
    show({
      status: 'done',
      text: 'Đối chiếu sổ cái [1], rồi khóa ngày [7].',
      found: true,
      citations: [knowledgeAnswerFixture.citations[0]],
    });
    expect(badges().map((b) => b.textContent?.trim())).toEqual(['1']);
    expect(text()).toContain('rồi khóa ngày [7].');
  });

  it('shows every source in a row under an answer that marks none', () => {
    show({
      status: 'done',
      text: 'Chạy EOD phải đối chiếu số dư sổ cái trước.',
      found: true,
      citations: knowledgeAnswerFixture.citations,
    });
    const row = el.querySelector('.message__sources') as HTMLElement;
    expect(row.getAttribute('aria-label')).toBe('Nguồn của câu trả lời');
    expect(row.querySelectorAll('li app-source-badge')).toHaveLength(2);
    expect(el.querySelector('.message__answer app-source-badge')).toBeNull();
    expect(text()).not.toContain('Nguồn');
  });

  it('shows no sources when the answer has no citations', () => {
    show({ status: 'done', text: 'Không tìm thấy.', found: false });
    expect(el.querySelector('app-source-badge')).toBeNull();
    expect(el.querySelector('.message__sources')).toBeNull();
  });

  it('keeps markers as text while the answer streams', () => {
    show({ status: 'composing', retrieved: 2, text: 'khóa ngày [1].' });
    expect(el.querySelector('app-source-badge')).toBeNull();
    expect(text()).toContain('khóa ngày [1].');
  });

  it('marks a stopped answer and offers to ask again', () => {
    show({ status: 'stopped', text: 'Một phần' });
    expect(text()).toContain('Đã dừng.');
    el.querySelector<HTMLButtonElement>('button')?.click();
    expect(host.retried).toEqual([7]);
  });

  it('shows what went wrong and offers to ask again', () => {
    show({ status: 'error', error: 'Kết nối bị ngắt khi đang trả lời.' });
    expect(text()).toContain('Kết nối bị ngắt khi đang trả lời.');
    el.querySelector<HTMLButtonElement>('button')?.click();
    expect(host.retried).toEqual([7]);
  });
});
