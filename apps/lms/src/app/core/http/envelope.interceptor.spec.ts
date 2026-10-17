import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { authV1Endpoints } from '@lms/contracts';
import {
  BACKEND_RESPONSES,
  type BackendResponseKey,
  backendRefusal,
  envelopeOk,
  loginV1Body,
} from '@lms/mocks';
import { toAppError, type AppErrorKind } from '../errors/app-error';
import { ApiError } from './api-error';
import { ContractError } from './contract-error';
import { EndpointClient } from './endpoint-client';
import { provideEnvelopeHttpClient } from './http.testing';

const LOGIN_URL = '/api/v1/auth/login';

describe('envelopeInterceptor', () => {
  let backend: HttpTestingController;
  let client: EndpointClient;
  const handled: unknown[] = [];

  beforeEach(() => {
    handled.length = 0;
    TestBed.configureTestingModule({
      providers: [
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
    ['credentialsInvalid', 'server'],
    ['unauthenticated', 'unauthorized'],
    ['accessDenied', 'forbidden'],
    ['passwordChangeRequired', 'passwordChangeRequired'],
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
});
