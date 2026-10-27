import { TestBed } from '@angular/core/testing';
import { defineEndpoint, shellEndpoints } from '@lms/contracts';
import { z } from 'zod';
import { parseAppConfig, provideAppConfig } from '../../config/app-config';
import { testAppConfig } from '../../config/app-config.testing';
import { EndpointClient } from '../../http/endpoint-client';
import {
  provideMockBackendHttp,
  ReplyGate,
  signInToMockBackend,
} from './mock-backend.testing';

const unmocked = defineEndpoint({
  method: 'get',
  path: '/api/unmocked',
  response: z.unknown(),
});

describe('provideMockBackendHttp', () => {
  let client: EndpointClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
      ],
    });
    signInToMockBackend('quantri');
    client = TestBed.inject(EndpointClient);
  });

  it('fails a request no mock answers at once, naming it, instead of leaving it open', async () => {
    const outcome = await new Promise<unknown>((resolve) =>
      client.call(unmocked).subscribe({
        next: () => resolve('answered'),
        error: (error: unknown) => resolve(error),
      }),
    );

    expect(String(outcome)).toContain('GET /api/unmocked');
  });

  describe('holding replies', () => {
    const call = () => client.call(shellEndpoints.navCounts);

    it('keeps a request open until it is released, then answers it', async () => {
      const hold = TestBed.inject(ReplyGate).hold(shellEndpoints.navCounts);
      let answered = 0;
      call().subscribe(() => answered++);
      call().subscribe(() => answered++);

      expect(hold.pending()).toBe(2);
      expect(answered).toBe(0);

      hold.releaseNext();
      expect(hold.pending()).toBe(1);
      expect(answered).toBe(1);

      hold.release();
      expect(hold.pending()).toBe(0);
      expect(answered).toBe(2);

      call().subscribe(() => answered++);
      expect(answered).toBe(3);
    });

    it('forgets a request whose caller gave up', () => {
      const hold = TestBed.inject(ReplyGate).hold(shellEndpoints.navCounts);
      const subscription = call().subscribe();
      expect(hold.pending()).toBe(1);

      subscription.unsubscribe();
      expect(hold.pending()).toBe(0);
    });

    it('leaves the other endpoints alone', () => {
      TestBed.inject(ReplyGate).hold(unmocked);
      let answered = false;
      call().subscribe(() => (answered = true));
      expect(answered).toBe(true);
    });
  });
});
