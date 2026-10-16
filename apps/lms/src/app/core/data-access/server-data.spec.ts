import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { invalidation } from './invalidation';
import { serverData } from './server-data';

describe('serverData', () => {
  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  /** A `load` whose every call returns a fresh subject the test can drive. */
  function sources() {
    const calls: Subject<string>[] = [];
    const load = () => {
      const source = new Subject<string>();
      calls.push(source);
      return source;
    };
    return { calls, load };
  }

  it('is loading until the first value arrives, then holds it', async () => {
    const { calls, load } = sources();
    const data = TestBed.runInInjectionContext(() => serverData(load));
    await settle();

    expect(data.isLoading()).toBe(true);
    expect(data.value()).toBeUndefined();

    calls[0].next('first');
    await settle();

    expect(data.isLoading()).toBe(false);
    expect(data.value()).toBe('first');
  });

  it('keeps the value on screen while an invalidation reloads it', async () => {
    const { calls, load } = sources();
    const token = invalidation();
    const data = TestBed.runInInjectionContext(() =>
      serverData(load, { reloadOn: token }),
    );
    await settle();
    calls[0].next('first');
    await settle();

    token.bump();
    await settle();

    expect(calls).toHaveLength(2);
    expect(data.isLoading()).toBe(false);
    expect(data.value()).toBe('first');

    calls[1].next('second');
    await settle();

    expect(data.value()).toBe('second');
  });

  it('reloads on any of several tokens', async () => {
    const { calls, load } = sources();
    const a = invalidation();
    const b = invalidation();
    TestBed.runInInjectionContext(() => serverData(load, { reloadOn: [a, b] }));
    await settle();

    b.bump();
    await settle();

    expect(calls).toHaveLength(2);
  });

  it('keeps the value on screen while reload() runs', async () => {
    const { calls, load } = sources();
    const data = TestBed.runInInjectionContext(() => serverData(load));
    await settle();
    calls[0].next('first');
    await settle();

    data.reload();
    await settle();

    expect(calls).toHaveLength(2);
    expect(data.isLoading()).toBe(false);
    expect(data.value()).toBe('first');
  });

  it('exposes a load error as an AppError', async () => {
    const { calls, load } = sources();
    const data = TestBed.runInInjectionContext(() => serverData(load));
    await settle();

    calls[0].error(new HttpErrorResponse({ status: 403 }));
    await settle();

    expect(data.error()?.kind).toBe('forbidden');
    expect(data.isLoading()).toBe(false);
  });

  it('recovers from a load error when reload() runs again', async () => {
    const { calls, load } = sources();
    const data = TestBed.runInInjectionContext(() => serverData(load));
    await settle();
    calls[0].error(new HttpErrorResponse({ status: 500 }));
    await settle();
    expect(data.error()).toBeDefined();

    data.reload();
    await settle();
    calls[1].next('recovered');
    await settle();

    expect(data.error()).toBeUndefined();
    expect(data.value()).toBe('recovered');
  });

  describe('with params', () => {
    function keyed() {
      const calls: { id: string; source: Subject<string> }[] = [];
      const load = (id: string) => {
        const source = new Subject<string>();
        calls.push({ id, source });
        return source;
      };
      return { calls, load };
    }

    it('stays idle while the params are undefined, then loads', async () => {
      const { calls, load } = keyed();
      const id = signal<string | undefined>(undefined);
      const data = TestBed.runInInjectionContext(() =>
        serverData(load, { params: () => id() }),
      );
      await settle();

      expect(calls).toHaveLength(0);
      expect(data.isLoading()).toBe(false);
      expect(data.value()).toBeUndefined();

      id.set('a');
      await settle();

      expect(calls.map((c) => c.id)).toEqual(['a']);
      expect(data.isLoading()).toBe(true);
    });

    it('drops the value when the params change', async () => {
      const { calls, load } = keyed();
      const id = signal<string | undefined>('a');
      const data = TestBed.runInInjectionContext(() =>
        serverData(load, { params: () => id() }),
      );
      await settle();
      calls[0].source.next('user a');
      await settle();
      expect(data.value()).toBe('user a');

      id.set('b');
      await settle();

      expect(data.value()).toBeUndefined();
      expect(data.isLoading()).toBe(true);

      calls[1].source.next('user b');
      await settle();
      expect(data.value()).toBe('user b');
    });

    it('ignores a late answer for the previous params', async () => {
      const { calls, load } = keyed();
      const id = signal<string | undefined>('a');
      const data = TestBed.runInInjectionContext(() =>
        serverData(load, { params: () => id() }),
      );
      await settle();

      id.set('b');
      calls[0].source.next('user a, too late');
      await settle();

      expect(data.value()).toBeUndefined();
      expect(data.isLoading()).toBe(true);
    });

    it('goes idle and drops the value when the params become undefined', async () => {
      const { calls, load } = keyed();
      const id = signal<string | undefined>('a');
      const data = TestBed.runInInjectionContext(() =>
        serverData(load, { params: () => id() }),
      );
      await settle();
      calls[0].source.next('user a');
      await settle();

      id.set(undefined);
      await settle();

      expect(data.value()).toBeUndefined();
      expect(data.isLoading()).toBe(false);
    });

    it('keeps the value on an invalidation reload with the same params', async () => {
      const { calls, load } = keyed();
      const token = invalidation();
      const id = signal<string | undefined>('a');
      const data = TestBed.runInInjectionContext(() =>
        serverData(load, { params: () => id(), reloadOn: token }),
      );
      await settle();
      calls[0].source.next('user a');
      await settle();

      token.bump();
      await settle();

      expect(calls.map((c) => c.id)).toEqual(['a', 'a']);
      expect(data.isLoading()).toBe(false);
      expect(data.value()).toBe('user a');
    });

    it('compares the params by value', async () => {
      const calls: Subject<string>[] = [];
      const params = signal<{ id: string }>({ id: 'a' });
      const data = TestBed.runInInjectionContext(() =>
        serverData(
          (_: { id: string }) => {
            const source = new Subject<string>();
            calls.push(source);
            return source;
          },
          { params: () => params() },
        ),
      );
      await settle();
      calls[0].next('user a');
      await settle();

      params.set({ id: 'a' });
      await settle();

      expect(calls).toHaveLength(1);
      expect(data.value()).toBe('user a');
    });
  });
});
