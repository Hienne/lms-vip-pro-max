import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { knowledgeAnswerFixture } from '@lms/mocks';
import type {
  AgentReply,
  AgentTurn,
} from '../../../../core/assistant/agent-chat.model';
import { AgentMessage } from './agent-message';

const reply = (patch: Partial<AgentReply> = {}): AgentReply => ({
  status: 'done',
  toolName: null,
  text: '',
  citations: [],
  navigatedTo: null,
  action: null,
  error: null,
  ...patch,
});

const turn = (patch: Partial<AgentReply> = {}): AgentTurn => ({
  id: 1,
  question: 'EOD là gì?',
  reply: reply(patch),
});

@Component({
  selector: 'app-host',
  imports: [AgentMessage],
  template: `<app-agent-message [turn]="turn()" />`,
})
class Host {
  readonly turn = signal(turn());
}

describe('AgentMessage', () => {
  async function render(value: AgentTurn) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.turn.set(value);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const text = () => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return { fixture, el, text };
  }

  it('shows the question and a status line for the tool that is running', async () => {
    const { el, text } = await render(
      turn({ status: 'working', toolName: 'search_documents' }),
    );
    expect(el.querySelector('.message--user')?.textContent).toContain(
      'EOD là gì?',
    );
    expect(text()).toContain('Đang tìm trong tài liệu…');
    expect(el.querySelector('[role="status"]')).not.toBeNull();
  });

  it('names a tool it does not know generically, and the other two by what they do', async () => {
    expect(
      (
        await render(turn({ status: 'working', toolName: 'create_course' }))
      ).text(),
    ).toContain('Đang xử lý…');
    TestBed.resetTestingModule();
    expect(
      (
        await render(turn({ status: 'working', toolName: 'open_screen' }))
      ).text(),
    ).toContain('Đang mở màn hình…');
    TestBed.resetTestingModule();
    expect(
      (
        await render(turn({ status: 'working', toolName: 'update_profile' }))
      ).text(),
    ).toContain('Đang chuẩn bị thay đổi…');
  });

  it('shows streamed text instead of the status line', async () => {
    const { el, text } = await render(
      turn({
        status: 'composing',
        toolName: 'search_documents',
        text: 'Chạy EOD',
      }),
    );
    expect(text()).toContain('Chạy EOD');
    expect(el.querySelector('[role="status"]')).toBeNull();
  });

  it('turns [n] markers into source badges, as /assistant does', async () => {
    const { el } = await render(
      turn({
        text: knowledgeAnswerFixture.answer,
        citations: knowledgeAnswerFixture.citations,
      }),
    );
    expect(
      el.querySelectorAll('.message__answer app-source-badge button'),
    ).toHaveLength(2);
    expect(el.querySelector('.message__sources')).toBeNull();
  });

  it('lists the sources no marker points at in a row under the text', async () => {
    const { el } = await render(
      turn({
        text: 'Không có dấu nguồn.',
        citations: knowledgeAnswerFixture.citations,
      }),
    );
    expect(
      el.querySelectorAll('.message__sources app-source-badge'),
    ).toHaveLength(2);
  });

  it('links the page title of a reply that opened a page', async () => {
    const { el } = await render(
      turn({
        text: 'Đã mở trang Quản lý người dùng.',
        navigatedTo: { path: '/admin/users', title: 'Quản lý người dùng' },
      }),
    );
    const link = el.querySelector<HTMLAnchorElement>('a.message__link');
    expect(link?.textContent).toBe('Quản lý người dùng');
    expect(link?.getAttribute('href')).toBe('/admin/users');
    expect(el.querySelector('.message__answer')?.textContent?.trim()).toBe(
      'Đã mở trang Quản lý người dùng.',
    );
  });

  it('shows the error in the danger style and a stopped reply as stopped, keeping its text', async () => {
    const failed = await render(
      turn({ status: 'error', error: 'Kết nối bị ngắt khi đang trả lời.' }),
    );
    expect(
      failed.el.querySelector('.message__note--error')?.textContent,
    ).toContain('Kết nối bị ngắt');
    TestBed.resetTestingModule();
    const stopped = await render(turn({ status: 'stopped', text: 'Một nửa' }));
    expect(stopped.text()).toContain('Một nửa');
    expect(stopped.text()).toContain('Đã dừng.');
  });

  it('renders text as text, never as HTML', async () => {
    const { el } = await render(
      turn({ text: '<img src=x onerror=alert(1)> [9]' }),
    );
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)> [9]');
  });
});
