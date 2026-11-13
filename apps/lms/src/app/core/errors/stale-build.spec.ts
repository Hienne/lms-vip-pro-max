import { TestBed } from '@angular/core/testing';
import { NavigationError } from '@angular/router';
import { Toaster } from '@lms/ui';
import {
  isStaleBuildError,
  offerReloadOnStaleNavigation,
  PAGE_LOCATION,
} from './stale-build';
import {
  RELOAD_LABEL,
  STALE_BUILD_TITLE,
  StaleBuild,
} from './stale-build-offer';

describe('stale build recovery', () => {
  const reload = vi.fn();

  beforeEach(() => {
    reload.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: PAGE_LOCATION, useValue: { reload, assign: vi.fn() } },
      ],
    });
  });

  afterEach(() => TestBed.inject(Toaster).dismissAll());

  it('knows the errors of a chunk the server no longer has', () => {
    expect(
      isStaleBuildError(
        new TypeError('Failed to fetch dynamically imported module: /a.js'),
      ),
    ).toBe(true);
    expect(
      isStaleBuildError(new TypeError('Importing a module script failed.')),
    ).toBe(true);
    expect(isStaleBuildError(new Error('Http failure 500'))).toBe(false);
    expect(isStaleBuildError(undefined)).toBe(false);
  });

  it('offers the reload once, and the action reloads the page', () => {
    const toaster = TestBed.inject(Toaster);
    const staleBuild = TestBed.inject(StaleBuild);

    staleBuild.offerReload();
    staleBuild.offerReload();

    expect(toaster.toasts()).toHaveLength(1);
    const [toast] = toaster.toasts();
    expect(toast.title).toBe(STALE_BUILD_TITLE);
    expect(toast.action?.label).toBe(RELOAD_LABEL);
    toaster.act(toast.id);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('a navigation that fails on a stale chunk offers the reload, any other does not', async () => {
    const offerReload = vi.spyOn(TestBed.inject(StaleBuild), 'offerReload');
    const failed = (error: unknown) => new NavigationError(1, '/x', error);

    TestBed.runInInjectionContext(() =>
      offerReloadOnStaleNavigation(failed(new Error('guard threw'))),
    );
    await Promise.resolve();
    expect(offerReload).not.toHaveBeenCalled();

    TestBed.runInInjectionContext(() =>
      offerReloadOnStaleNavigation(
        failed(
          new TypeError('Failed to fetch dynamically imported module: /b.js'),
        ),
      ),
    );
    await vi.waitFor(() => expect(offerReload).toHaveBeenCalledOnce());
  });
});
