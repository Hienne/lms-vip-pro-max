import { ErrorHandler } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { defineEndpoint } from '@lms/contracts';
import { z } from 'zod';
import { ContractError } from './contract-error';
import { ENDPOINT, EndpointClient } from './endpoint-client';

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
