import { ApiErrorSchema, authV1Endpoints } from '@lms/contracts';
import { MOCK_FIXTURES } from '../examples';
import {
  loginV1Body,
  loginV1Invalid,
  logoutV1Body,
  meV1Body,
} from './auth-v1.fixtures';

describe('auth v1 fixtures', () => {
  it.each([
    ['login', loginV1Body],
    ['logout', logoutV1Body],
    ['me', meV1Body],
  ] as const)('%s body parses with its endpoint schema', (key, body) => {
    expect(() => authV1Endpoints[key].response.parse(body)).not.toThrow();
  });

  it('keeps the staff code, a null email and null org fields as sent', () => {
    const user = {
      ...meV1Body.data.user,
      orgId: null,
      orgCode: null,
      orgName: null,
      orgType: null,
    };
    const body = { ...meV1Body, data: { ...meV1Body.data, user } };
    expect(authV1Endpoints.me.response.parse(body)).toEqual(body.data);
  });

  it('are not answered by the mock API', () => {
    for (const endpoint of Object.values(authV1Endpoints)) {
      expect(MOCK_FIXTURES.has(endpoint)).toBe(false);
    }
  });

  it('the login 422 body parses as an API error', () => {
    expect(() => ApiErrorSchema.parse(loginV1Invalid)).not.toThrow();
  });
});
