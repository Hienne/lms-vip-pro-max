import { z } from 'zod';
import { defineEndpoint, toUrl } from './endpoint';

const getCourse = defineEndpoint({
  method: 'get',
  path: '/api/courses/{courseId}',
  params: z.object({ courseId: z.string() }),
  response: z.object({ id: z.string() }),
});

const list = defineEndpoint({
  method: 'get',
  path: '/api/courses',
  response: z.array(z.string()),
});

describe('toUrl', () => {
  it('returns a static path unchanged', () => {
    expect(toUrl(list)).toBe('/api/courses');
  });

  it('fills path params and encodes them', () => {
    expect(toUrl(getCourse, { courseId: 'c 1/x' })).toBe(
      '/api/courses/c%201%2Fx',
    );
  });

  it('rejects missing params at type level and at runtime', () => {
    // @ts-expect-error params are required when the endpoint declares them
    expect(() => toUrl(getCourse)).toThrow(/courseId/);
    // @ts-expect-error unknown param name
    expect(() => toUrl(getCourse, { id: 'x' })).toThrow(/courseId/);
  });
});

describe('defineEndpoint', () => {
  it('keeps the declaration as given', () => {
    expect(getCourse.method).toBe('get');
  });
});

describe('defineEndpoint, binary body and headers', () => {
  const putPart = defineEndpoint({
    method: 'put',
    path: '/api/uploads/{uploadId}/parts/{partNumber}',
    params: z.object({ uploadId: z.string(), partNumber: z.number() }),
    encoding: 'binary',
    headers: z.object({ 'X-Part-SHA256': z.string() }),
    body: z.instanceof(Blob),
    response: z.object({ uploadedBytes: z.number() }),
  });

  it('keeps the encoding and the header names it declares', () => {
    expect(putPart.encoding).toBe('binary');
    expect(Object.keys(putPart.headers.shape)).toEqual(['X-Part-SHA256']);
  });

  it('declares no headers unless asked', () => {
    expect(list.headers).toBeUndefined();
  });

  it('still fills the path params', () => {
    expect(toUrl(putPart, { uploadId: 'u1', partNumber: 2 })).toBe(
      '/api/uploads/u1/parts/2',
    );
  });
});
