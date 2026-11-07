import {
  authV1Endpoints,
  learnerEndpoints,
  MyBadgesSchema,
  type AnyEndpoint,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

describe('the badges of the mock backend', () => {
  let backend: FakeBackend;
  beforeEach(() => (backend = new FakeBackend()));

  const call = (
    endpoint: AnyEndpoint,
    token: string | null,
    body?: unknown,
  ): FakeReply =>
    backend.handle(endpoint, {
      token,
      params: {},
      query: {},
      body,
    }) as FakeReply;

  const login = (username: string): string =>
    (
      call(authV1Endpoints.login, null, {
        username,
        password: SEED_PASSWORD,
      }).body.data as { accessToken: string }
    ).accessToken;

  it('answers a learner the earned badges and the ones still to earn, with programme progress', () => {
    const badges = MyBadgesSchema.parse(
      call(learnerEndpoints.myBadges, login('hocvien')).body.data,
    );
    expect(badges.earned.map((badge) => badge.name)).toEqual([
      'Khóa học đầu tiên',
    ]);
    expect(badges.notEarned.map((badge) => badge.progress)).toEqual([
      { done: 1, total: 4 },
      null,
    ]);
  });

  it.each(['quantri', 'baocao'])('refuses %s, who is not a learner', (user) => {
    expect(call(learnerEndpoints.myBadges, login(user)).body.messageCode).toBe(
      'CORE-ACCESS_DENIED',
    );
  });
});
