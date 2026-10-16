import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Toaster } from '@lms/ui';
import { Subject } from 'rxjs';
import { invalidation, type Invalidation } from './invalidation';
import { serverMutation } from './server-mutation';

describe('serverMutation', () => {
  const toaster = {
    success: vi.fn<(title: string, message?: string) => void>(),
    error: vi.fn<(title: string, message?: string) => void>(),
  };

  beforeEach(() => {
    toaster.success.mockReset();
    toaster.error.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: Toaster, useValue: toaster }],
    });
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  /** A `run` whose every call returns a fresh subject the test can drive. */
  function sources() {
    const calls: { input: string; source: Subject<number> }[] = [];
    const run = (input: string) => {
      const source = new Subject<number>();
      calls.push({ input, source });
      return source;
    };
    return { calls, run };
  }

  it('is pending until the server answers', async () => {
    const { calls, run } = sources();
    const mutation = TestBed.runInInjectionContext(() =>
      serverMutation(run, { errors: 'toast', success: () => 'ok' }),
    );
    expect(mutation.isPending()).toBe(false);

    mutation.run('a');
    await settle();
    expect(mutation.isPending()).toBe(true);

    calls[0].source.next(1);
    calls[0].source.complete();
    await settle();
    expect(mutation.isPending()).toBe(false);
  });

  it('on success runs onSuccess, then bumps invalidations, then toasts', async () => {
    const { calls, run } = sources();
    const order: string[] = [];
    const token = (name: string): Invalidation => ({
      version: signal(0).asReadonly(),
      bump: () => order.push(`bump ${name}`),
    });
    toaster.success.mockImplementation(() => order.push('toast'));
    const mutation = TestBed.runInInjectionContext(() =>
      serverMutation(run, {
        errors: 'toast',
        success: () => 'ok',
        onSuccess: () => order.push('onSuccess'),
        invalidates: [token('a'), token('b')],
      }),
    );

    mutation.run('x');
    await settle();
    calls[0].source.next(1);
    await settle();

    expect(order).toEqual(['onSuccess', 'bump a', 'bump b', 'toast']);
  });

  it('builds the success message from the input and the result', async () => {
    const { calls, run } = sources();
    const mutation = TestBed.runInInjectionContext(() =>
      serverMutation(run, {
        errors: 'toast',
        success: (input, result) => ({
          title: `Saved ${input}`,
          detail: `as #${result}`,
        }),
      }),
    );

    mutation.run('role');
    await settle();
    calls[0].source.next(7);
    await settle();

    expect(toaster.success).toHaveBeenCalledWith('Saved role', 'as #7');
  });

  it('with errors "toast" shows the server message as an error toast', async () => {
    const { calls, run } = sources();
    const token = invalidation();
    const onSuccess = vi.fn();
    const mutation = TestBed.runInInjectionContext(() =>
      serverMutation(run, {
        errors: 'toast',
        success: () => 'ok',
        onSuccess,
        invalidates: token,
      }),
    );

    mutation.run('a');
    await settle();
    calls[0].source.error(
      new HttpErrorResponse({
        status: 409,
        error: { code: 'conflict', message: 'Vai trò đang được dùng' },
      }),
    );
    await settle();

    expect(toaster.error).toHaveBeenCalledWith('Vai trò đang được dùng');
    expect(toaster.success).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(token.version()).toBe(0);
  });

  it('with errors "inline" exposes the error and shows no toast', async () => {
    const { calls, run } = sources();
    const mutation = TestBed.runInInjectionContext(() =>
      serverMutation(run, { errors: 'inline', success: () => 'ok' }),
    );

    mutation.run('a');
    await settle();
    calls[0].source.error(
      new HttpErrorResponse({
        status: 422,
        error: {
          code: 'invalid',
          message: 'Sai',
          details: { name: 'Bắt buộc' },
        },
      }),
    );
    await settle();

    expect(mutation.error()?.kind).toBe('invalid');
    expect(mutation.error()?.details).toEqual({ name: 'Bắt buộc' });
    expect(toaster.error).not.toHaveBeenCalled();
  });

  it('calls the server again when the same input is resubmitted', async () => {
    const { calls, run } = sources();
    const mutation = TestBed.runInInjectionContext(() =>
      serverMutation(run, { errors: 'inline', success: () => 'ok' }),
    );

    mutation.run('same');
    await settle();
    calls[0].source.error(new HttpErrorResponse({ status: 500 }));
    await settle();
    mutation.run('same');
    await settle();

    expect(calls.map((c) => c.input)).toEqual(['same', 'same']);
  });

  it('reset() clears the error', async () => {
    const { calls, run } = sources();
    const mutation = TestBed.runInInjectionContext(() =>
      serverMutation(run, { errors: 'inline', success: () => 'ok' }),
    );
    mutation.run('a');
    await settle();
    calls[0].source.error(new HttpErrorResponse({ status: 500 }));
    await settle();
    expect(mutation.error()).toBeDefined();

    mutation.reset();
    await settle();

    expect(mutation.error()).toBeUndefined();
    expect(mutation.isPending()).toBe(false);
  });

  it('cancels the first run when a second one starts', async () => {
    const { calls, run } = sources();
    const mutation = TestBed.runInInjectionContext(() =>
      serverMutation(run, { errors: 'toast', success: (input) => input }),
    );

    mutation.run('first');
    await settle();
    mutation.run('second');
    await settle();

    expect(calls[0].source.observed).toBe(false);
    calls[0].source.next(1);
    calls[1].source.next(2);
    await settle();
    expect(toaster.success).toHaveBeenCalledTimes(1);
    expect(toaster.success).toHaveBeenCalledWith('second');
  });

  it('requires the error destination', () => {
    const { run } = sources();
    // @ts-expect-error `errors` has no default: leaving it out must not compile
    const missing = () => serverMutation(run, { success: () => 'ok' });
    expect(missing).toBeTypeOf('function');
  });
});
