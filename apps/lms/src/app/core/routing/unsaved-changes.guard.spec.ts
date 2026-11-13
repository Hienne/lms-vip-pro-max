import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import {
  fakeSession,
  FakeSessionStore,
  seedProfile,
} from '../session/session.testing';
import { SessionStore } from '../session/session.store';
import { LeavePrompt, unsavedChangesGuard } from './unsaved-changes.guard';

let dirty = false;

@Component({ template: '<h1>Form</h1>' })
class Form {
  hasUnsavedChanges(): boolean {
    return dirty;
  }
}

@Component({ template: '<h1>Plain</h1>' })
class Plain {}

@Component({ template: '<h1>Elsewhere</h1>' })
class Elsewhere {}

describe('unsavedChangesGuard', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  const ask = vi.fn();

  beforeEach(async () => {
    dirty = false;
    ask.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'form',
            component: Form,
            canDeactivate: [unsavedChangesGuard],
          },
          {
            path: 'plain',
            component: Plain,
            canDeactivate: [unsavedChangesGuard],
          },
          { path: 'elsewhere', component: Elsewhere },
        ]),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    fakeSession().user.set(seedProfile('000004'));
    TestBed.inject(LeavePrompt).use(ask);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  it('leaves freely when nothing is unsaved', async () => {
    await harness.navigateByUrl('/form');
    await harness.navigateByUrl('/elsewhere');
    expect(router.url).toBe('/elsewhere');
    expect(ask).not.toHaveBeenCalled();
  });

  it('leaves freely from a page that does not track changes', async () => {
    await harness.navigateByUrl('/plain');
    await harness.navigateByUrl('/elsewhere');
    expect(router.url).toBe('/elsewhere');
    expect(ask).not.toHaveBeenCalled();
  });

  it('leaves without asking once the session has ended, since the draft is kept', async () => {
    await harness.navigateByUrl('/form');
    dirty = true;
    fakeSession().user.set(null);
    await harness.navigateByUrl('/elsewhere');
    expect(ask).not.toHaveBeenCalled();
    expect(router.url).toBe('/elsewhere');
  });

  it('stays when the user chooses to stay', async () => {
    await harness.navigateByUrl('/form');
    dirty = true;
    ask.mockReturnValue(of(false));
    await harness.navigateByUrl('/elsewhere');
    expect(ask).toHaveBeenCalledOnce();
    expect(router.url).toBe('/form');
  });

  it('leaves once the user confirms', async () => {
    await harness.navigateByUrl('/form');
    dirty = true;
    ask.mockReturnValue(of(true));
    await harness.navigateByUrl('/elsewhere');
    expect(router.url).toBe('/elsewhere');
  });

  it('allows leaving when no shell has registered a prompt', async () => {
    TestBed.inject(LeavePrompt).use(undefined as never);
    await harness.navigateByUrl('/form');
    dirty = true;
    await harness.navigateByUrl('/elsewhere');
    expect(router.url).toBe('/elsewhere');
  });
});
