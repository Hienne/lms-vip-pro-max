import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { knowledgeAnswerFixture } from '@lms/mocks';
import type { Answer, Turn } from '../../data-access/assistant.model';
import { ChatMessage } from './chat-message';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../../core/config/app-config';
import { testAppConfig } from '../../../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../../../core/http/http.testing';
import { SourceViewerStore } from '../../../../../core/assistant/source-viewer.store';

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
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        provideRouter([]),
      ],
    }),
  );
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

  it('turns each marker into a source badge where it stands', () => {
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
    expect(text()).not.toContain('Nguồn');
    expect(el.querySelector('details')).toBeNull();
  });

  it('drops a marker with no citation instead of printing it', () => {
    show({
      status: 'done',
      text: 'Đối chiếu sổ cái [1], rồi khóa ngày [7].',
      found: true,
      citations: [knowledgeAnswerFixture.citations[0]],
    });
    expect(badges().map((b) => b.textContent?.trim())).toEqual(['1']);
    expect(text()).toContain('rồi khóa ngày.');
    expect(text()).not.toContain('[7]');
  });

  const sourceRows = () =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('.sources li .source'));

  it('lists every source under a finished answer, numbered, with its page, and opens it on click', () => {
    const open = vi
      .spyOn(TestBed.inject(SourceViewerStore), 'open')
      .mockImplementation(() => undefined);
    show({
      status: 'done',
      text: 'Chạy EOD phải đối chiếu số dư sổ cái trước.',
      found: true,
      citations: knowledgeAnswerFixture.citations,
    });
    expect(el.querySelector('.sources ol')?.getAttribute('aria-label')).toBe(
      'Nguồn của câu trả lời',
    );
    expect(sourceRows()).toHaveLength(2);
    expect(
      sourceRows()[0].querySelector('.source__n')?.textContent?.trim(),
    ).toBe('1');
    expect(sourceRows()[0].textContent).toContain('Quy-trinh-EOD.pdf');
    expect(sourceRows()[0].textContent).toContain('trang 1 · dòng 3–9');
    expect(sourceRows()[0].getAttribute('aria-label')).toBe(
      'Mở Nguồn 1: Quy-trinh-EOD.pdf, trang 1, dòng 3–9',
    );
    sourceRows()[1].click();
    expect(open).toHaveBeenCalledWith(knowledgeAnswerFixture.citations[1]);
  });

  it('lists no sources until the answer is finished', () => {
    show({
      status: 'composing',
      text: 'Chạy EOD',
      citations: knowledgeAnswerFixture.citations,
    });
    expect(el.querySelector('.sources')).toBeNull();
  });

  it('labels an answer that used documents but marks none as "Chưa có nguồn"', () => {
    show({
      status: 'done',
      text: 'Chạy EOD phải đối chiếu số dư sổ cái trước.',
      found: true,
      grounded: false,
    });
    expect(el.querySelector('.message__no-source')?.textContent?.trim()).toBe(
      'Chưa có nguồn',
    );
    expect(el.querySelector('app-source-badge')).toBeNull();
  });

  it('shows no label on a grounded answer, on one still streaming, or on a not-found one', () => {
    show({ status: 'done', text: 'Đã có nguồn [1].', found: true });
    expect(el.querySelector('.message__no-source')).toBeNull();
    show({ status: 'composing', text: 'Đang viết', grounded: false });
    expect(el.querySelector('.message__no-source')).toBeNull();
    show({ status: 'done', text: 'Không tìm thấy.', found: false });
    expect(el.querySelector('.message__no-source')).toBeNull();
  });

  it('shows no sources when the answer has no citations', () => {
    show({ status: 'done', text: 'Không tìm thấy.', found: false });
    expect(el.querySelector('app-source-badge')).toBeNull();
    expect(el.querySelector('.sources')).toBeNull();
  });

  it('shows no marker as text while the answer streams, before its sources arrive', () => {
    show({ status: 'composing', retrieved: 2, text: 'khóa ngày [1].' });
    expect(el.querySelector('app-source-badge')).toBeNull();
    expect(text()).toContain('khóa ngày.');
    expect(text()).not.toContain('[1]');
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
