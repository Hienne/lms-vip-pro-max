import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  authV1Endpoints,
  defineEndpoint,
  knowledgeEndpoints,
} from '@lms/contracts';
import { z } from 'zod';
import {
  BACKEND_RESPONSES,
  type BackendResponseKey,
  backendRefusal,
  envelopeOk,
} from '@lms/mocks';
import { toAppError, type AppErrorKind } from '../errors/app-error';
import { ApiError } from './api-error';
import { ContractError } from './contract-error';
import { EndpointClient } from './endpoint-client';
import { provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { provideEnvelopeHttpClient } from './http.testing';

const LOGIN_URL = '/api/v1/auth/login';
const CHAT_URL = '/api/v1/knowledge/chat/stream';
const EXPORT_URL = '/api/v1/test/export';

const exportFile = defineEndpoint({
  method: 'get',
  path: EXPORT_URL,
  responseType: 'blob',
  response: z.instanceof(Blob),
});

const loginData = {
  accessToken: 'fixture.jwt.token',
  tokenType: 'Bearer',
  expiresInSeconds: 3600,
};
const loginV1Body = { ...envelopeOk(loginData), data: loginData };

describe('envelopeInterceptor', () => {
  let backend: HttpTestingController;
  let client: EndpointClient;
  const handled: unknown[] = [];

  beforeEach(() => {
    handled.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(testAppConfig()),
        provideEnvelopeHttpClient(),
        {
          provide: ErrorHandler,
          useValue: { handleError: handled.push.bind(handled) },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    client = TestBed.inject(EndpointClient);
  });
  afterEach(() => backend.verify());

  /** Calls `login` and answers it with `body` under the given HTTP status. */
  function login(body: string | object, status = 200) {
    const outcome: { value?: unknown; error?: unknown } = {};
    client
      .call(authV1Endpoints.login, {
        body: { username: 'hocvien', password: 'x' },
      })
      .subscribe({
        next: (value) => (outcome.value = value),
        error: (error) => (outcome.error = error),
      });
    backend
      .expectOne(LOGIN_URL)
      .flush(body, { status, statusText: `HTTP ${status}` });
    return outcome;
  }

  it('unwraps the data of a SUCCESS envelope', () => {
    expect(login(loginV1Body).value).toEqual(loginV1Body.data);
  });

  it('accepts the 201 a create answers with', () => {
    expect(login(envelopeOk(loginV1Body.data), 201).value).toEqual(
      loginV1Body.data,
    );
  });

  it('turns a 200 ERROR envelope into an ApiError with status 200', () => {
    const { body } = backendRefusal('validationFailed');
    const error = login(body).error as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      messageCode: 'CORE-VALIDATION_FAILED',
      httpStatus: 200,
    });
    expect(toAppError(error).kind).toBe('server');
  });

  it.each<[BackendResponseKey, AppErrorKind]>([
    ['credentialsInvalid', 'unauthorized'],
    ['unauthenticated', 'unauthorized'],
    ['accessDenied', 'forbidden'],
    ['passwordChangeRequired', 'forbidden'],
    ['malformedRequest', 'server'],
    ['endpointNotFound', 'server'],
    ['internalError', 'server'],
  ])('reads the envelope in the body of the %s answer', (key, kind) => {
    const { status, body } = backendRefusal(key);
    const error = login(body, status === 200 ? 400 : status).error;
    const { code, title, message } = BACKEND_RESPONSES[key];
    expect(error).toBeInstanceOf(ApiError);
    expect(toAppError(error)).toMatchObject({
      kind,
      messageCode: code,
      title,
      message,
      responseId: '00000000-0000-4000-8000-000000000000',
    });
  });

  it('keeps the HTTP status of the answer on the error', () => {
    const { body } = backendRefusal('internalError');
    expect((login(body, 500).error as ApiError).httpStatus).toBe(500);
  });

  it('passes a failure without an envelope through as the HttpErrorResponse', () => {
    const error = login('<html>Bad gateway</html>', 502).error;
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(502);
  });

  it('reports a 2xx body that is not an envelope as a contract error', () => {
    const error = login({ accessToken: 'x' }).error;
    expect(error).toBeInstanceOf(ContractError);
    expect(handled).toHaveLength(1);
  });

  describe('a streamed endpoint', () => {
    const NDJSON = { 'Content-Type': 'application/x-ndjson' };

    function ask(reply: (request: ReturnType<typeof expectChat>) => void) {
      const outcome: { events: unknown[]; error?: unknown } = { events: [] };
      client
        .stream(knowledgeEndpoints.askStream, {
          body: { question: 'CIF là gì?' },
        })
        .subscribe({
          next: (event) => outcome.events.push(event),
          error: (error) => (outcome.error = error),
        });
      reply(expectChat());
      return outcome;
    }

    const expectChat = () => backend.expectOne(CHAT_URL);

    it('leaves an application/x-ndjson answer alone: its lines are events, not an envelope', () => {
      const outcome = ask((request) =>
        request.flush(
          '{"type":"retrieved","count":1}\n{"type":"done","found":false,"answer":"Không tìm thấy.","citations":[]}\n',
          {
            headers: NDJSON,
          },
        ),
      );
      expect(outcome.error).toBeUndefined();
      expect(outcome.events).toEqual([
        { type: 'retrieved', count: 1 },
        {
          type: 'done',
          found: false,
          answer: 'Không tìm thấy.',
          citations: [],
        },
      ]);
    });

    it('turns a JSON envelope refusal sent before the stream into an ApiError', () => {
      const { body } = backendRefusal('aiUnavailable');
      const outcome = ask((request) =>
        request.flush(JSON.stringify(body), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(outcome.events).toEqual([]);
      expect(outcome.error).toBeInstanceOf(ApiError);
      expect(toAppError(outcome.error)).toMatchObject({
        messageCode: 'KNOWLEDGE-AI_UNAVAILABLE',
      });
    });

    it('reads the envelope of a 4xx refusal, which arrives as text', () => {
      const { body } = backendRefusal('unauthenticated');
      const outcome = ask((request) =>
        request.flush(JSON.stringify(body), {
          status: 401,
          statusText: 'Unauthorized',
        }),
      );
      expect(outcome.error).toBeInstanceOf(ApiError);
      expect((outcome.error as ApiError).httpStatus).toBe(401);
    });
  });
  describe('a blob endpoint', () => {
    function download(
      answer: (request: ReturnType<HttpTestingController['expectOne']>) => void,
    ) {
      const outcome: { file?: Blob; error?: unknown } = {};
      client.call(exportFile).subscribe({
        next: (file) => (outcome.file = file),
        error: (error: unknown) => (outcome.error = error),
      });
      answer(backend.expectOne(EXPORT_URL));
      return outcome;
    }

    /** `FileReader` answers on a later task, how much later depends on the load: wait for it. */
    const settled = (outcome: { file?: Blob; error?: unknown }) =>
      vi.waitFor(() => expect(outcome.file ?? outcome.error).toBeDefined());

    it('passes a file through untouched', async () => {
      const csv = new Blob(['a,b'], { type: 'text/csv' });
      const outcome = download((request) => request.flush(csv));
      await settled(outcome);
      expect(outcome.file).toBe(csv);
      expect(outcome.error).toBeUndefined();
    });

    it('turns a JSON ERROR envelope sent instead of the file into an ApiError', async () => {
      const { body } = backendRefusal('validationFailed');
      const outcome = download((request) =>
        request.flush(
          new Blob([JSON.stringify(body)], { type: 'application/json' }),
        ),
      );
      await settled(outcome);
      expect(outcome.file).toBeUndefined();
      expect(outcome.error).toBeInstanceOf(ApiError);
      expect((outcome.error as ApiError).httpStatus).toBe(200);
    });

    it('keeps the status of a 403 whose body is a JSON envelope', async () => {
      const { body } = backendRefusal('accessDenied');
      const outcome = download((request) =>
        request.flush(
          new Blob([JSON.stringify(body)], { type: 'application/json' }),
          { status: 403, statusText: 'Forbidden' },
        ),
      );
      await settled(outcome);
      expect(outcome.error).toBeInstanceOf(ApiError);
      expect((outcome.error as ApiError).httpStatus).toBe(403);
    });

    it('leaves an HTTP error that is not an envelope as it is', async () => {
      const outcome = download((request) =>
        request.flush(new Blob(['<html>'], { type: 'text/html' }), {
          status: 502,
          statusText: 'Bad Gateway',
        }),
      );
      await settled(outcome);
      expect(outcome.error).toBeInstanceOf(HttpErrorResponse);
    });
  });
});
