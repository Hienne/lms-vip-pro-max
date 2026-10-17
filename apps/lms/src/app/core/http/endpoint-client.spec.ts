import { ErrorHandler } from '@angular/core';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { defineEndpoint } from '@lms/contracts';
import { envelopeError, envelopeOk } from '@lms/mocks';
import { z } from 'zod';
import { toAppError } from '../errors/app-error';
import { ContractError } from './contract-error';
import { ENDPOINT, EndpointClient } from './endpoint-client';
import { provideEnvelopeHttpClient } from './http.testing';

const getCourse = defineEndpoint({
  method: 'get',
  path: '/api/courses/{courseId}',
  params: z.object({ courseId: z.string() }),
  response: z.object({ id: z.string() }),
});

const listCourses = defineEndpoint({
  method: 'get',
  path: '/api/courses',
  query: z.object({
    q: z.string().optional(),
    tag: z.array(z.string()).optional(),
    page: z.number().optional(),
  }),
  response: z.array(z.string()),
});

const saveCourse = defineEndpoint({
  method: 'put',
  path: '/api/courses/{courseId}',
  params: z.object({ courseId: z.string() }),
  body: z.object({ title: z.string().trim() }),
  response: z.object({ id: z.string() }),
});

const ping = defineEndpoint({
  method: 'get',
  path: '/api/ping',
  response: z.literal(true),
});

const upload = defineEndpoint({
  method: 'post',
  path: '/api/files',
  encoding: 'multipart',
  body: z.object({
    title: z.string(),
    file: z.file(),
    tags: z.array(z.string()).optional(),
    size: z.number().optional(),
    public: z.boolean().optional(),
    note: z.string().nullable().optional(),
  }),
  response: z.object({ id: z.string() }),
});

const exportAll = defineEndpoint({
  method: 'get',
  path: '/api/export',
  responseType: 'blob',
  response: z.instanceof(Blob).refine((blob) => blob.type === 'text/csv'),
});

describe('EndpointClient', () => {
  let backend: HttpTestingController;
  let client: EndpointClient;
  const handled: unknown[] = [];

  beforeEach(() => {
    handled.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ErrorHandler,
          useValue: { handleError: (e: unknown) => handled.push(e) },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    client = TestBed.inject(EndpointClient);
  });
  afterEach(() => backend.verify());

  it('takes the verb from the registry and returns the parsed body', () => {
    let result: unknown;
    client.call(ping).subscribe((v) => (result = v));
    const req = backend.expectOne('/api/ping');
    expect(req.request.method).toBe('GET');
    req.flush(true);
    expect(result).toBe(true);
  });

  it('fills and encodes path params', () => {
    client.call(getCourse, { params: { courseId: 'c 1' } }).subscribe();
    backend.expectOne('/api/courses/c%201').flush({ id: 'c 1' });
  });

  it('sends a JSON body exactly as passed, without parsing it', () => {
    client
      .call(saveCourse, {
        params: { courseId: 'c1' },
        body: { title: '  x  ' },
      })
      .subscribe();
    const req = backend.expectOne('/api/courses/c1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ title: '  x  ' });
    req.flush({ id: 'c1' });
  });

  it('sends query values: skips null/undefined, repeats array keys, stringifies the rest', () => {
    client
      .call(listCourses, { query: { q: undefined, tag: ['a', 'b'], page: 2 } })
      .subscribe();
    const req = backend.expectOne((r) => r.url === '/api/courses');
    expect(req.request.params.getAll('tag')).toEqual(['a', 'b']);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('q')).toBe(false);
    req.flush([]);
  });

  it('reports a contract mismatch to ErrorHandler and errors the stream', () => {
    let error: unknown;
    client.call(ping).subscribe({ error: (e: unknown) => (error = e) });
    backend.expectOne('/api/ping').flush('nope');
    expect(error).toBeInstanceOf(ContractError);
    expect(handled).toEqual([error]);
  });

  it('does not report HTTP errors to ErrorHandler', () => {
    let error: unknown;
    client.call(ping).subscribe({ error: (e: unknown) => (error = e) });
    backend.expectOne('/api/ping').flush({}, { status: 500, statusText: 'x' });
    expect(error).toBeDefined();
    expect(handled).toEqual([]);
  });

  it('tags the request with its endpoint', () => {
    client.call(ping).subscribe();
    const req = backend.expectOne('/api/ping');
    expect(req.request.context.get(ENDPOINT)).toBe(ping);
    req.flush(true);
  });

  describe('multipart', () => {
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' });

    it('sends a flat typed body as FormData without setting Content-Type', () => {
      client
        .call(upload, {
          body: {
            title: 'T',
            file,
            tags: ['a', 'b'],
            size: 3,
            public: true,
            note: null,
          },
        })
        .subscribe();
      const req = backend.expectOne('/api/files');
      const form = req.request.body as FormData;
      expect(form).toBeInstanceOf(FormData);
      expect(form.get('title')).toBe('T');
      expect(form.get('file')).toBeInstanceOf(File);
      expect(form.getAll('tags')).toEqual(['a', 'b']);
      expect(form.get('size')).toBe('3');
      expect(form.get('public')).toBe('true');
      expect(form.has('note')).toBe(false);
      expect(req.request.headers.has('Content-Type')).toBe(false);
      req.flush({ id: 'f1' });
    });

    it('throws on a nested object instead of guessing an encoding', () => {
      expect(() =>
        client.call(upload, {
          body: { title: 'T', file, tags: [{ x: 1 }] as unknown as string[] },
        }),
      ).toThrow(/tags/);
    });
  });

  describe('blob', () => {
    it('requests a blob and returns it', () => {
      let result: Blob | undefined;
      client.call(exportAll).subscribe((blob) => (result = blob));
      const req = backend.expectOne('/api/export');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['a,b'], { type: 'text/csv' }));
      expect(result).toBeInstanceOf(Blob);
    });

    it('still parses the blob: a mismatch is reported and errors the stream', () => {
      let error: unknown;
      client.call(exportAll).subscribe({ error: (e: unknown) => (error = e) });
      backend
        .expectOne('/api/export')
        .flush(new Blob(['x'], { type: 'text/plain' }));
      expect(error).toBeInstanceOf(ContractError);
      expect(handled).toEqual([error]);
    });

    it('does not compile with a non-Blob response schema', () => {
      const never = () =>
        defineEndpoint({
          method: 'get',
          path: '/api/bad',
          responseType: 'blob',
          // @ts-expect-error a blob endpoint must declare a Blob response schema
          response: z.string(),
        });
      expect(never).toBeTypeOf('function');
    });
  });

  it('requires params and forbids a body on a GET at type level', () => {
    const never = () => {
      // @ts-expect-error params are required when the endpoint declares them
      client.call(getCourse);
      // @ts-expect-error params are required when the endpoint declares them
      client.call(getCourse, {});
      // @ts-expect-error a GET without a declared body takes no body
      client.call(ping, { body: {} });
      // @ts-expect-error an endpoint without input takes no second argument shape
      client.call(ping, { params: { id: 'x' } });
      // @ts-expect-error body is required when declared
      client.call(saveCourse, { params: { courseId: 'c' } });
    };
    expect(never).toBeTypeOf('function');
  });
});

describe('EndpointClient with the backend envelope', () => {
  let backend: HttpTestingController;
  let client: EndpointClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    client = TestBed.inject(EndpointClient);
  });
  afterEach(() => backend.verify());

  const callGetCourse = () => {
    const outcome: { value?: unknown; error?: unknown } = {};
    client.call(getCourse, { params: { courseId: 'c1' } }).subscribe({
      next: (value) => (outcome.value = value),
      error: (error) => (outcome.error = error),
    });
    return { outcome, request: backend.expectOne('/api/courses/c1') };
  };

  it('returns the parsed data of a SUCCESS envelope', () => {
    const { outcome, request } = callGetCourse();
    request.flush(envelopeOk({ id: 'c1' }));
    expect(outcome.value).toEqual({ id: 'c1' });
  });

  it('turns an ERROR envelope into a server error with the backend title and message', () => {
    const { outcome, request } = callGetCourse();
    request.flush(
      envelopeError('CORE-0409', 'Trùng email', 'Email đã tồn tại.'),
    );
    expect(toAppError(outcome.error)).toEqual({
      kind: 'server',
      title: 'Trùng email',
      message: 'Email đã tồn tại.',
      messageCode: 'CORE-0409',
      httpStatus: 200,
      responseId: '00000000-0000-4000-8000-000000000000',
    });
  });

  it('turns CORE-UNAUTHENTICATED into an unauthorized error', () => {
    const { outcome, request } = callGetCourse();
    request.flush(
      envelopeError(
        'CORE-UNAUTHENTICATED',
        'Authentication required',
        'Token is invalid',
      ),
    );
    expect(toAppError(outcome.error)).toMatchObject({
      kind: 'unauthorized',
      messageCode: 'CORE-UNAUTHENTICATED',
      message: 'Token is invalid',
    });
  });

  it('reports a malformed envelope as a contract error', () => {
    const { outcome, request } = callGetCourse();
    request.flush({ id: 'c1' });
    expect(outcome.error).toBeInstanceOf(ContractError);
    expect(toAppError(outcome.error).kind).toBe('contract');
  });

  it('reports a SUCCESS envelope whose data breaks the endpoint schema as a contract error', () => {
    const { outcome, request } = callGetCourse();
    request.flush(envelopeOk({ id: 7 }));
    expect(outcome.error).toBeInstanceOf(ContractError);
  });

  it('leaves a request without an endpoint alone', () => {
    let body: unknown;
    TestBed.inject(HttpClient)
      .get('/assets/logo.json')
      .subscribe((value) => (body = value));
    backend.expectOne('/assets/logo.json').flush({ plain: true });
    expect(body).toEqual({ plain: true });
  });

  it('still reports status 0 as offline', () => {
    const { outcome, request } = callGetCourse();
    request.error(new ProgressEvent('error'), { status: 0 });
    expect(toAppError(outcome.error).kind).toBe('offline');
  });

  it('hands a blob endpoint its body without looking for an envelope', () => {
    let blob: unknown;
    client.call(exportAll).subscribe((value) => (blob = value));
    backend
      .expectOne('/api/export')
      .flush(new Blob(['a,b'], { type: 'text/csv' }));
    expect(blob).toBeInstanceOf(Blob);
  });
});
