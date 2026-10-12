import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppErrorHandler } from './app-error-handler';

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
});
