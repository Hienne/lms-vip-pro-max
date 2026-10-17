import { authV1Endpoints, type Me } from '@lms/contracts';
import { FakeBackend } from './fake-backend';
import { SEED_PASSWORD, SEED_USERS } from './seed';

/**
 * What `GET /auth/me` answers for a seed user, computed by the fake backend from the seed's roles,
 * functions and grants. Specs use it to sign a user in without repeating the grants by hand.
 */
export function seedMe(userId: string): Me {
  const backend = new FakeBackend();
  const user = SEED_USERS.find((u) => u.userId === userId);
  if (!user) throw new Error(`No seed user "${userId}"`);
  const login = backend.handle(authV1Endpoints.login, {
    token: null,
    params: {},
    query: {},
    body: { username: user.username, password: SEED_PASSWORD },
  });
  const token = (login?.body.data as { accessToken: string }).accessToken;
  const me = backend.handle(authV1Endpoints.me, {
    token,
    params: {},
    query: {},
    body: undefined,
  });
  return me?.body.data as Me;
}
