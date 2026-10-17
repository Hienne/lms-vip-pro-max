import { authV1Endpoints } from './auth-v1.endpoints';

describe('auth v1 endpoints', () => {
  it('declare the backend paths and methods', () => {
    expect(
      Object.entries(authV1Endpoints).map(([key, e]) => [
        key,
        e.method,
        e.path,
      ]),
    ).toEqual([
      ['login', 'post', '/api/v1/auth/login'],
      ['logout', 'post', '/api/v1/auth/logout'],
      ['me', 'get', '/api/v1/auth/me'],
    ]);
  });

  it('login takes a username and a password', () => {
    expect(
      authV1Endpoints.login.body.parse({ username: '000123', password: 'x' }),
    ).toEqual({
      username: '000123',
      password: 'x',
    });
    expect(() =>
      authV1Endpoints.login.body.parse({ email: 'x', password: 'x' }),
    ).toThrow();
  });
});
