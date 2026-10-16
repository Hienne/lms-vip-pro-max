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
