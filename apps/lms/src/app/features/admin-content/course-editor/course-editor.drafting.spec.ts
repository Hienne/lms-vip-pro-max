import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { draftingSessionEndpoints, type DraftingSession } from '@lms/contracts';
import {
  basicsProposalFixture,
  draftingSessionFixture,
  draftingStepFixture,
  envelopeOk,
  type FakeReply,
} from '@lms/mocks';
import { of } from 'rxjs';
import { DRAFTING_POLL_INTERVAL_MS } from '../../../core/course-drafting/course-drafting.store';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import { ReplyGate } from '../../../core/dev/mock-api/mock-backend.testing';
import { LeavePrompt } from '../../../core/routing/unsaved-changes.guard';
import type { CourseEditor } from './course-editor';
import { FakeHasher } from './data-access/fake-hasher.testing';
import { DRAFTING_FIELD_DELAY_MS } from './data-access/drafting-fill';
import { Sha256Hasher } from './data-access/sha256-hasher';

const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});

/** Session 1 with step 1 still being worked on by the server. */
const proposing = (): DraftingSession => ({
  ...draftingSessionFixture(1),
  steps: [draftingStepFixture(1, 'proposing')],
});

/**
 * The writes of the fixture's proposal: title, programme, code, level, kind and summary (its module
 * is empty, so not written), then one per objective.
 */
const PATCHES = 6 + basicsProposalFixture.objectives.length;

describe('CourseEditor following a drafting session', () => {
  const screen = setUpAdminScreen([
    { provide: Sha256Hasher, useValue: new FakeHasher() },
  ]);

  let session: DraftingSession;

  const original = (endpoint: unknown, request: unknown): FakeReply =>
    MockBackend.prototype.handle.call(
      TestBed.inject(MockBackend),
      endpoint as never,
      request as never,
    ) as FakeReply;

  beforeEach(() => {
    session = proposing();
    screen.calls.mockImplementation((endpoint, request) => {
      if (endpoint === draftingSessionEndpoints.get) return ok(session);
      if (endpoint === draftingSessionEndpoints.stop) {
        session = {
          ...session,
          steps: session.steps.map((step) =>
            step.state === 'proposing' ? { ...step, state: 'manual' } : step,
          ),
        };
        return ok(session);
      }
      return original(endpoint, request);
    });
  });

  afterEach(() => vi.useRealTimers());

  const advance = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
  };

  /**
   * Opens the page, then reads the session under fake timers: the harness waits on real ones, so
   * the session's reply is held until the page is open and the poll and the writes run on the fake
   * clock.
   */
  async function open(url = '/admin/courses/new?session=1') {
    const reply = TestBed.inject(ReplyGate).hold(draftingSessionEndpoints.get);
    await screen.open(url);
    vi.useFakeTimers();
    reply.release();
    await advance(0);
  }

  const tap = async (target: HTMLElement | undefined) => {
    if (!target) throw new Error('Nothing to click');
    target.click();
    await advance(0);
  };

  /** The server finishes the proposal; the page sees it at its next look. */
  const propose = async () => {
    session = draftingSessionFixture(1);
    await advance(DRAFTING_POLL_INTERVAL_MS);
  };

  const fieldset = () =>
    screen.el.querySelector<HTMLFieldSetElement>(
      'fieldset.course-editor__body',
    )!;
  const box = (label: string) =>
    Array.from(screen.el.querySelectorAll<HTMLElement>('ui-field')).find((f) =>
      f.querySelector('label')?.textContent?.includes(label),
    )!;
  const objectives = () =>
    screen.el.querySelectorAll<HTMLInputElement>(
      'input[aria-label^="Mục tiêu"]',
    );
  const marked = () =>
    Array.from(screen.el.querySelectorAll('.course-info__suggested')).length;

  it('reads the session in the URL and locks step 1 while the assistant works', async () => {
    await open();

    expect(screen.callsTo(draftingSessionEndpoints.get)).toBe(1);
    expect(screen.lastCall(draftingSessionEndpoints.get)).toMatchObject({
      params: { sessionId: '1' },
    });
    expect(screen.text()).toContain('Trợ lý đang soạn…');
    expect(screen.button('Dừng')).toBeDefined();
    expect(fieldset().disabled).toBe(true);
    expect((screen.button('Lưu nháp') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.field('Tên khóa học').value).toBe('');
  });

  it('asks again while step 1 is proposing', async () => {
    await open();
    await advance(DRAFTING_POLL_INTERVAL_MS);

    expect(screen.callsTo(draftingSessionEndpoints.get)).toBe(2);
  });

  it('writes the proposal one field at a time, the objectives one by one, then unlocks the step', async () => {
    await open();
    await propose();

    expect(screen.field('Tên khóa học').value).toBe(
      basicsProposalFixture.title,
    );
    expect(screen.field('Mã khóa học').value).toBe('');
    expect(fieldset().disabled).toBe(true);

    await advance(DRAFTING_FIELD_DELAY_MS);
    expect(screen.field('Chương trình').value).toBe('1');
    expect(screen.field('Mã khóa học').value).toBe('');

    await advance(DRAFTING_FIELD_DELAY_MS * (PATCHES - 3));
    expect(objectives()).toHaveLength(1);
    expect(objectives()[0].value).toBe(basicsProposalFixture.objectives[0]);
    expect(fieldset().disabled).toBe(true);
    expect(screen.text()).toContain('Trợ lý đang soạn…');

    await advance(DRAFTING_FIELD_DELAY_MS);
    expect(objectives()).toHaveLength(2);
    expect(screen.field('Mã khóa học').value).toBe(basicsProposalFixture.code);
    expect(screen.field('Mô tả ngắn').value).toBe(
      basicsProposalFixture.summary,
    );
    expect(fieldset().disabled).toBe(false);
    expect(screen.text()).not.toContain('Trợ lý đang soạn…');
  });

  it('marks what the assistant wrote "AI đề xuất" until the author edits it', async () => {
    await open();
    await propose();
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);

    expect(box('Tên khóa học').textContent).toContain('AI đề xuất');
    expect(box('Mã khóa học').textContent).toContain('AI đề xuất');
    const before = marked();

    const title = screen.field('Tên khóa học') as HTMLInputElement;
    title.value = 'Tên do tác giả đặt';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await advance(0);

    expect(box('Tên khóa học').textContent).not.toContain('AI đề xuất');
    expect(box('Mã khóa học').textContent).toContain('AI đề xuất');
    expect(marked()).toBe(before - 1);
  });

  it('leaves an empty module empty, with a hint and no marker', async () => {
    await open();
    await propose();
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);

    expect(screen.field('Phân hệ nghiệp vụ').value).toBe('');
    expect(box('Phân hệ nghiệp vụ').textContent).toContain(
      'Trợ lý chưa chọn được phân hệ',
    );
    expect(box('Phân hệ nghiệp vụ').textContent).not.toContain('AI đề xuất');
  });

  it('"Dừng" while the server works stops it, and nothing is written afterwards', async () => {
    await open();

    await tap(screen.button('Dừng'));
    expect(screen.callsTo(draftingSessionEndpoints.stop)).toBe(1);
    expect(fieldset().disabled).toBe(false);
    expect(screen.text()).not.toContain('Trợ lý đang soạn…');

    await propose();
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);
    expect(screen.field('Tên khóa học').value).toBe('');
  });

  it('"Dừng" while the fields are written keeps what is there and writes nothing more', async () => {
    await open();
    await propose();
    await advance(DRAFTING_FIELD_DELAY_MS);

    await tap(screen.button('Dừng'));
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);

    expect(screen.callsTo(draftingSessionEndpoints.stop)).toBe(0);
    expect(screen.field('Tên khóa học').value).toBe(
      basicsProposalFixture.title,
    );
    expect(screen.field('Mã khóa học').value).toBe('');
    expect(fieldset().disabled).toBe(false);
  });

  it('warns about unsaved changes when leaving before step 1 is confirmed', async () => {
    await open();
    await propose();
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);

    expect(screen.page<CourseEditor>().hasUnsavedChanges()).toBe(true);
    const ask = vi.fn((_message?: string) => of(false));
    TestBed.inject(LeavePrompt).use(ask);
    const leaving = TestBed.inject(Router).navigateByUrl('/admin/courses');
    await advance(10);

    expect(ask).toHaveBeenCalledTimes(1);
    expect(await leaving).toBe(false);
  });

  it('follows no session on a new course opened without one', async () => {
    await open('/admin/courses/new');

    expect(screen.callsTo(draftingSessionEndpoints.get)).toBe(0);
    expect(screen.text()).not.toContain('Trợ lý đang soạn…');
    expect(fieldset().disabled).toBe(false);
  });
});
