import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';

// The offer's own chunk belongs to the old build too: here it is gone from the server.
vi.mock('./stale-build-offer', () => {
  throw new TypeError('Failed to fetch dynamically imported module: /offer.js');
});

describe('stale build recovery when the offer chunk is gone too', () => {
  it('asks once with the native confirm and reloads, without offering again', async () => {
    const { offerReload, PAGE_LOCATION, STALE_BUILD_TITLE } = await import(
      './stale-build'
    );
    const page = {
      reload: vi.fn(),
      assign: vi.fn(),
      confirm: vi.fn(() => true),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PAGE_LOCATION, useValue: page }],
    });
    const injector = TestBed.inject(Injector);

    offerReload(injector);
    offerReload(injector);

    await vi.waitFor(() => expect(page.reload).toHaveBeenCalledOnce());
    expect(page.confirm).toHaveBeenCalledExactlyOnceWith(STALE_BUILD_TITLE);
  });
});
