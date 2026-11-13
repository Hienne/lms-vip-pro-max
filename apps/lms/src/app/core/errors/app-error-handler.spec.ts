import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppErrorHandler } from './app-error-handler';
import { StaleBuild } from './stale-build-offer';

describe('global error handler', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports unexpected errors instead of swallowing them', () => {
    const report = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [provideAppErrorHandler()] });
    const failure = new Error('boom');

    TestBed.inject(ErrorHandler).handleError(failure);

    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0]).toContain(failure);
  });

  it('offers a reload when a chunk of an older build is gone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [provideAppErrorHandler()] });
    const offerReload = vi.spyOn(TestBed.inject(StaleBuild), 'offerReload');

    TestBed.inject(ErrorHandler).handleError(new Error('boom'));
    expect(offerReload).not.toHaveBeenCalled();

    TestBed.inject(ErrorHandler).handleError(
      new TypeError(
        'Failed to fetch dynamically imported module: /chunk-ABC.js',
      ),
    );
    await vi.waitFor(() => expect(offerReload).toHaveBeenCalledOnce());
  });
});
