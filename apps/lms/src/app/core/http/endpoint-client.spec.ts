import { ErrorHandler } from '@angular/core';
import {
  HttpClient,
  HttpEventType,
  provideHttpClient,
} from '@angular/common/http';
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
import { parseAppConfig, provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
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

describe('EndpointClient WebSocket transport', () => {
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    static readonly OPEN = 1;
    readonly readyState = 1;
    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onclose: ((event: { code: number }) => void) | null = null;
    onerror: (() => void) | null = null;
    readonly send = vi.fn();
    readonly close = vi.fn();
    constructor(readonly url: URL) {
      sockets.push(this);
    }
  }
  const endpoint = {
    path: '/api/v1/test/socket',
    request: z.object({ type: z.literal('ping') }),
    response: z.object({ type: z.literal('pong') }),
  };
  const handled: unknown[] = [];
  beforeEach(() => {
    sockets.length = 0;
    handled.length = 0;
    vi.stubGlobal('WebSocket', FakeSocket);
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(testAppConfig()),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ErrorHandler,
          useValue: { handleError: (error: unknown) => handled.push(error) },
        },
      ],
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('uses a same-origin ticket and parses both directions', () => {
    const observer = { opened: vi.fn(), message: vi.fn(), closed: vi.fn() };
    const connection = TestBed.inject(EndpointClient).connect(
      endpoint,
      'one-use-ticket',
      observer,
    );
    const socket = sockets[0];
    socket.onopen?.();
    connection.send({ type: 'ping' });
    socket.onmessage?.(
      new MessageEvent('message', { data: '{"type":"pong"}' }),
    );
    expect(socket.url.origin).toBe(location.origin.replace(/^http/, 'ws'));
    expect(socket.url.searchParams.get('ticket')).toBe('one-use-ticket');
    expect(socket.send).toHaveBeenCalledWith('{"type":"ping"}');
    expect(observer.message).toHaveBeenCalledWith({ type: 'pong' });
    connection.close();
    expect(socket.onmessage).toBeNull();
    expect(socket.onclose).toBeNull();
  });
  it('reports invalid server data and closes the socket', () => {
    const observer = { opened: vi.fn(), message: vi.fn(), closed: vi.fn() };
    TestBed.inject(EndpointClient).connect(
      endpoint,
      'one-use-ticket',
      observer,
    );
    sockets[0].onmessage?.(
      new MessageEvent('message', { data: '{"type":"unexpected"}' }),
    );
    expect(handled[0]).toBeInstanceOf(ContractError);
    expect(observer.message).not.toHaveBeenCalled();
    expect(sockets[0].close).toHaveBeenCalledWith(1002);
  });
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

const putPart = defineEndpoint({
  method: 'put',
  path: '/api/uploads/{uploadId}/parts/{partNumber}',
  params: z.object({ uploadId: z.string(), partNumber: z.number() }),
  encoding: 'binary',
  headers: z.object({ 'X-Part-SHA256': z.string() }),
  body: z.instanceof(Blob),
  response: z.object({ uploadedBytes: z.number() }),
});

const exportAll = defineEndpoint({
  method: 'get',
  path: '/api/export',
  responseType: 'blob',
  response: z.instanceof(Blob).refine((blob) => blob.type === 'text/csv'),
});

const chat = defineEndpoint({
  method: 'post',
  path: '/api/chat',
  body: z.object({ question: z.string() }),
  responseType: 'ndjson',
  response: z.discriminatedUnion('type', [
    z.object({ type: z.literal('delta'), text: z.string() }),
    z.object({ type: z.literal('done') }),
  ]),
});

describe('EndpointClient', () => {
  let backend: HttpTestingController;
  let client: EndpointClient;
  const handled: unknown[] = [];

  beforeEach(() => {
    handled.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(testAppConfig()),
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

  describe('stream', () => {
    const progress = (
      request: { event: (e: never) => void },
      partialText: string,
    ) =>
      request.event({
        type: HttpEventType.DownloadProgress,
        loaded: partialText.length,
        partialText,
      } as never);

    const open = () => {
      const events: unknown[] = [];
      const outcome: { error?: unknown; completed: boolean } = {
        completed: false,
      };
      const subscription = client
        .stream(chat, { body: { question: 'q' } })
        .subscribe({
          next: (event) => events.push(event),
          error: (error: unknown) => (outcome.error = error),
          complete: () => (outcome.completed = true),
        });
      return {
        events,
        outcome,
        subscription,
        request: backend.expectOne('/api/chat'),
      };
    };

    it('sends the body as JSON and asks for events as text with progress', () => {
      const { request } = open();
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ question: 'q' });
      expect(request.request.responseType).toBe('text');
      expect(request.request.reportProgress).toBe(true);
      expect(request.request.headers.get('Accept')).toBe(
        'application/x-ndjson, application/json',
      );
      request.flush('');
    });

    it('emits each complete line as it arrives, even when a line is split across chunks', () => {
      const { events, request } = open();
      progress(request, '{"type":"delta","text":"Xin');
      expect(events).toEqual([]);
      progress(request, '{"type":"delta","text":"Xin "}\n{"type":"del');
      expect(events).toEqual([{ type: 'delta', text: 'Xin ' }]);
      progress(
        request,
        '{"type":"delta","text":"Xin "}\n{"type":"delta","text":"chào"}\n',
      );
      expect(events).toEqual([
        { type: 'delta', text: 'Xin ' },
        { type: 'delta', text: 'chào' },
      ]);
      request.flush(
        '{"type":"delta","text":"Xin "}\n{"type":"delta","text":"chào"}\n',
      );
    });

    it('emits several lines that arrive in one chunk, in order', () => {
      const { events, request } = open();
      progress(
        request,
        '{"type":"delta","text":"a"}\n{"type":"delta","text":"b"}\n{"type":"done"}\n',
      );
      expect(events.map((e) => (e as { type: string }).type)).toEqual([
        'delta',
        'delta',
        'done',
      ]);
      request.flush('');
    });

    it('reads everything from the final response when no progress was reported, and a last line needs no newline', () => {
      const { events, outcome, request } = open();
      request.flush('{"type":"delta","text":"a"}\n{"type":"done"}');
      expect(events).toEqual([{ type: 'delta', text: 'a' }, { type: 'done' }]);
      expect(outcome.completed).toBe(true);
    });

    it('does not emit a line twice when the final response repeats the whole body', () => {
      const { events, request } = open();
      progress(request, '{"type":"delta","text":"a"}\n');
      request.flush('{"type":"delta","text":"a"}\n{"type":"done"}\n');
      expect(events).toEqual([{ type: 'delta', text: 'a' }, { type: 'done' }]);
    });

    it('errors with a ContractError, reported to ErrorHandler, when a line does not match the schema', () => {
      const { events, outcome, request } = open();
      progress(
        request,
        '{"type":"delta","text":"a"}\n{"type":"delta","text":7}\n',
      );
      expect(events).toEqual([{ type: 'delta', text: 'a' }]);
      expect(outcome.error).toBeInstanceOf(ContractError);
      expect(handled).toEqual([outcome.error]);
    });

    it('treats a line that is not JSON as a contract mismatch', () => {
      const { outcome, request } = open();
      progress(request, 'upstream timeout\n');
      expect(outcome.error).toBeInstanceOf(ContractError);
    });

    it('aborts the request when the subscriber unsubscribes', () => {
      const { request, subscription } = open();
      progress(request, '{"type":"delta","text":"a"}\n');
      subscription.unsubscribe();
      expect(request.cancelled).toBe(true);
    });

    it('passes a transport failure through', () => {
      const { outcome, request } = open();
      request.error(new ProgressEvent('error'), { status: 0 });
      expect(toAppError(outcome.error).kind).toBe('offline');
    });

    it('is the only way to read an ndjson endpoint: call rejects it at type level', () => {
      // @ts-expect-error an ndjson endpoint is read with stream
      client.call(chat, { body: { question: 'q' } });
    });
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

  describe('binary', () => {
    const part = new Blob(['abc'], { type: 'video/mp4' });
    const url = '/api/uploads/u1/parts/2';
    const input = {
      params: { uploadId: 'u1', partNumber: 2 },
      headers: { 'X-Part-SHA256': 'ab'.repeat(32) },
      body: part,
    };

    it('sends the Blob as it is, as application/octet-stream, with the declared header', () => {
      let result: unknown;
      client.call(putPart, input).subscribe((v) => (result = v));
      const req = backend.expectOne(url);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toBe(part);
      expect(req.request.headers.get('Content-Type')).toBe(
        'application/octet-stream',
      );
      expect(req.request.headers.get('X-Part-SHA256')).toBe('ab'.repeat(32));
      req.flush({ uploadedBytes: 3 });
      expect(result).toEqual({ uploadedBytes: 3 });
    });

    it('still parses the response with the endpoint schema', () => {
      const outcome: { error?: unknown } = {};
      client
        .call(putPart, input)
        .subscribe({ error: (error: unknown) => (outcome.error = error) });
      backend.expectOne(url).flush({ uploadedBytes: 'x' });
      expect(outcome.error).toBeInstanceOf(ContractError);
    });

    it('refuses a call without the headers the endpoint declares', () => {
      expect(() =>
        // @ts-expect-error the declared headers are required
        client.call(putPart, { params: input.params, body: part }),
      ).toThrow(/headers/);
    });

    it('refuses headers on an endpoint that declares none', () => {
      expect(() =>
        client.call(getCourse, {
          params: { courseId: 'c1' },
          // @ts-expect-error getCourse declares no headers
          headers: { 'X-Part-SHA256': 'x' },
        }),
      ).toThrow(/headers/);
    });

    it('refuses a body that is not a Blob', () => {
      expect(() =>
        client.call(putPart, {
          ...input,
          body: 'abc' as unknown as Blob,
        }),
      ).toThrow(/Blob/);
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
        provideAppConfig(testAppConfig()),
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

  describe('isServed', () => {
    const mockOnly = defineEndpoint({
      method: 'get',
      path: '/api/mock-only',
      response: z.unknown(),
      served: 'mock',
    });

    const serving = (mockApi: boolean) => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideAppConfig(parseAppConfig(testAppConfig({ mockApi }))),
          provideHttpClient(),
          provideHttpClientTesting(),
        ],
      });
      return TestBed.inject(EndpointClient);
    };

    it('serves a backend endpoint in every build', () => {
      expect(serving(false).isServed(ping)).toBe(true);
      expect(serving(true).isServed(ping)).toBe(true);
    });

    it('serves a mock endpoint only while the mock API is on', () => {
      expect(serving(false).isServed(mockOnly)).toBe(false);
      expect(serving(true).isServed(mockOnly)).toBe(true);
    });
  });
});
