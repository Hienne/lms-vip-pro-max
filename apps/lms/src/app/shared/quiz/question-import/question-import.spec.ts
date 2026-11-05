import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { programAssessmentEndpoints as api } from '@lms/contracts';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../core/dev/mock-api/mock-backend.testing';
import {
  fakeSession,
  FakeSessionStore,
  seedProfile,
} from '../../../core/session/session.testing';
import { SessionStore } from '../../../core/session/session.store';
import {
  QUESTION_IMPORT_HOST,
  type QuestionImportHost,
} from './data-access/question-import.host';
import { QuestionImport } from './question-import';

describe('QuestionImport with a fixed course', () => {
  const finishImport = vi.fn();
  const closeImport = vi.fn();
  const host: QuestionImportHost = {
    programId$: signal(2),
    programName$: signal('Nền tảng nghiệp vụ Core Banking'),
    fixedCourse$: signal({ courseId: 1, title: 'Tổng quan hệ thống' }),
    finishImport,
    closeImport,
  };

  beforeEach(() => {
    finishImport.mockClear();
    closeImport.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: QUESTION_IMPORT_HOST, useValue: host },
      ],
    });
    signInToMockBackend('quantri');
    fakeSession().user.set(seedProfile('000002'));
  });

  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  const drawer = () =>
    document.querySelector<HTMLElement>('[role="dialog"]') ?? undefined;
  const press = (label: string) => {
    const found = [...(drawer()?.querySelectorAll('button') ?? [])].find((b) =>
      b.textContent?.includes(label),
    );
    if (!found) throw Error('Button missing: ' + label);
    return found;
  };

  it('names the course as text instead of asking for one', async () => {
    const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    TestBed.createComponent(QuestionImport);
    await settle();

    expect(drawer()?.textContent).toContain('Tổng quan hệ thống');
    expect(drawer()?.querySelector('select')).toBeNull();
    expect(
      spy.mock.calls.some(([endpoint]) =>
        endpoint.path.includes('/instructor'),
      ),
    ).toBe(false);
  });

  it('imports into that course and tells the host', async () => {
    const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    TestBed.createComponent(QuestionImport);
    await settle();
    const input = drawer()?.querySelector<HTMLInputElement>(
      'input[type="file"]',
    ) as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File([new Uint8Array(10)], 'cau-hoi.xlsx')],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    press('Kiểm tra').click();
    await settle();
    press('Nhập câu hỏi').click();
    await settle();

    const imports = spy.mock.calls.filter(
      ([endpoint]) => endpoint === api.importQuestions,
    );
    expect(imports.map(([, r]) => r.query['courseId'])).toEqual(['1', '1']);
    expect(imports.map(([, r]) => r.query['programId'])).toEqual(['2', '2']);
    expect(finishImport).toHaveBeenCalledTimes(1);
  });
});
