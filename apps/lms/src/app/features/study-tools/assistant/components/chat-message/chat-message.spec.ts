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
    expect(el.querySelector('details')).toBeNull();
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

  it('lists each citation as a closed details with its location and snippet', () => {
    show({
      status: 'done',
      text: knowledgeAnswerFixture.answer,
      found: true,
      citations: knowledgeAnswerFixture.citations,
    });
    const rows = Array.from(el.querySelectorAll('details'));
    expect(rows).toHaveLength(knowledgeAnswerFixture.citations.length);
    expect(rows.every((d) => !d.open)).toBe(true);
    expect(rows[0].querySelector('summary')?.textContent).toMatch(
      /^\[1\] .+ · (trang \d+ · dòng|dòng|đoạn) /,
    );
    expect(rows[0].querySelector('blockquote')?.textContent?.trim()).toBe(
      knowledgeAnswerFixture.citations[0].snippet,
    );
    expect(text()).toContain('Nguồn');
  });

  it('shows no source list when the answer has no citations', () => {
    show({ status: 'done', text: 'Không tìm thấy.', found: false });
    expect(el.querySelector('details')).toBeNull();
    expect(text()).not.toContain('Nguồn');
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
