import { toUrl } from '../http/endpoint';
import { shellEndpoints } from './shell.endpoints';
import { NavCountsSchema } from './shell.schema';

describe('shell endpoints', () => {
  it('registers navCounts on /api/me/nav-counts', () => {
    expect(Object.keys(shellEndpoints)).toEqual(['navCounts']);
    expect(shellEndpoints.navCounts.method).toBe('get');
    expect(toUrl(shellEndpoints.navCounts)).toBe('/api/me/nav-counts');
  });

  it('answers the unread notifications and the new inbox items', () => {
    expect(NavCountsSchema.parse({ notifications: 2, inbox: 3 })).toEqual({
      notifications: 2,
      inbox: 3,
    });
  });

  it.each([
    { notifications: -1, inbox: 0 },
    { notifications: 1.5, inbox: 0 },
    { notifications: 0 },
    { notifications: '2', inbox: 0 },
  ])('rejects %j', (body) => {
    expect(() => NavCountsSchema.parse(body)).toThrow();
  });
});
