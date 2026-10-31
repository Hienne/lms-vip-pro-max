import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  learnerQuizEndpoints,
  type Envelope,
  type LearnerQuizIntro,
} from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import { firstValueFrom } from 'rxjs';
import type { MockInstance } from 'vitest';
import { createAppRoutes } from '../../../app.routes';
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
import { EndpointClient } from '../../../core/http/endpoint-client';
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';

/** The providers every learner quiz screen spec needs: the app routes on the in-app mock backend. */
export function provideLearnerQuizSpec() {
  TestBed.configureTestingModule({
    providers: [
      provideMockBackendHttp(),
      provideAppConfig(
        parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
      ),
      provideRouter(createAppRoutes({ devTools: true })),
      { provide: SessionStore, useClass: FakeSessionStore },
    ],
  });
  return vi.spyOn(TestBed.inject(MockBackend), 'handle');
}

export async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Signs in as `hocvien` (000004), who is learning course 1 on the mock. */
export function signInAsLearner(): void {
  signInToMockBackend('hocvien');
  fakeSession().user.set(seedProfile('000004'));
}

/** Starts an attempt of a quiz on the mock and leaves it running. */
export async function startAttempt(quizId: number) {
  return firstValueFrom(
    TestBed.inject(EndpointClient).call(learnerQuizEndpoints.startAttempt, {
      params: { quizId },
    }),
  );
}

/** Starts and submits one attempt of a quiz on the mock, so the learner has a history. */
export async function takeAttempt(quizId: number): Promise<number> {
  const session = await startAttempt(quizId);
  await firstValueFrom(
    TestBed.inject(EndpointClient).call(learnerQuizEndpoints.submitAttempt, {
      params: { attemptId: session.attemptId },
    }),
  );
  return session.attemptId;
}

/** What the mock backend would answer, for a spec that changes one answer and keeps the rest. */
export function mockReply(
  endpoint: unknown,
  request: unknown,
): ReturnType<MockBackend['handle']> {
  return MockBackend.prototype.handle.call(
    TestBed.inject(MockBackend),
    endpoint as never,
    request as never,
  );
}

/** Makes the server answer the intro of every quiz with `patch` laid over what the mock sends. */
export function answerIntroWith(
  handle: MockInstance<MockBackend['handle']>,
  patch: Partial<LearnerQuizIntro>,
): void {
  handle.mockImplementation((endpoint, request) => {
    const reply = mockReply(endpoint, request);
    if (endpoint !== learnerQuizEndpoints.quizIntro || !reply) return reply;
    const body = reply.body as Envelope & { data: LearnerQuizIntro };
    return {
      ...reply,
      body: { ...body, data: { ...body.data, ...patch } },
    };
  });
}

/** Makes one endpoint fail with a server error, leaving the rest as the mock answers them. */
export function failEndpoint(
  handle: MockInstance<MockBackend['handle']>,
  failing: unknown,
): void {
  handle.mockImplementation((endpoint, request) =>
    endpoint === failing
      ? backendRefusal('internalError')
      : mockReply(endpoint, request),
  );
}

/** Lays `patch` over the data of what the mock answers for `endpoint`; other endpoints are untouched. */
export function patchReply(
  handle: MockInstance<MockBackend['handle']>,
  endpoint: unknown,
  patch: (data: never) => object,
): void {
  handle.mockImplementation((e, request) => {
    const reply = mockReply(e, request);
    if (e !== endpoint || !reply) return reply;
    const body = reply.body as Envelope & { data: never };
    return {
      ...reply,
      body: {
        ...body,
        data: { ...(body.data as object), ...patch(body.data) },
      },
    };
  });
}

/** Goes back to the mock's own answers after a spec bent some of them. */
export function restoreReplies(
  handle: MockInstance<MockBackend['handle']>,
): void {
  handle.mockImplementation((endpoint, request) =>
    mockReply(endpoint, request),
  );
}
