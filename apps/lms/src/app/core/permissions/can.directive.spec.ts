import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Permission } from '@lms/contracts';
import { SessionStore } from '../session/session.store';
import { Can } from './can.directive';

class FakeSession {
  readonly granted = signal<readonly Permission[]>([]);
  readonly perms$ = this.granted.asReadonly();
}

@Component({
  imports: [Can],
  template: `
    <button *appCan="'content.write'" id="write">Soạn khóa</button>
    <button *appCan="['users.manage', 'system.manage']" id="both">
      Hệ thống
    </button>
  `,
})
class Host {}

describe('*appCan', () => {
  let session: FakeSession;

  beforeEach(() => {
    session = new FakeSession();
    TestBed.configureTestingModule({
      providers: [{ provide: SessionStore, useValue: session }],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('hides the element when the permission was not granted', async () => {
    const el = await render();
    expect(el.querySelector('#write')).toBeNull();
    expect(el.querySelector('#both')).toBeNull();
  });

  it('shows the element when one permission is granted', async () => {
    session.granted.set(['content.write']);
    const el = await render();
    expect(el.querySelector('#write')).not.toBeNull();
    expect(el.querySelector('#both')).toBeNull();
  });

  it('needs every permission of a list', async () => {
    session.granted.set(['users.manage']);
    const el = await render();
    expect(el.querySelector('#both')).toBeNull();

    session.granted.set(['users.manage', 'system.manage']);
    TestBed.tick();
    expect(el.querySelector('#both')).not.toBeNull();
  });

  it('follows the session when permissions change', async () => {
    session.granted.set(['content.write']);
    const el = await render();
    expect(el.querySelector('#write')).not.toBeNull();

    session.granted.set([]);
    TestBed.tick();
    expect(el.querySelector('#write')).toBeNull();

    session.granted.set(['content.write']);
    TestBed.tick();
    expect(el.querySelector('#write')).not.toBeNull();
  });
});
