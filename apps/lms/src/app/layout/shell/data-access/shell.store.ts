import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  type TemplateRef,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
} from '@angular/router';
import { type DrawerContext, openDrawer } from '@lms/ui';
import { filter } from 'rxjs';
import type { Layout } from '../../../core/routing/route-table';
import { SessionStore } from '../../../core/session/session.store';

/** Which frame surrounds the page: sidebar and header, the plain focus frame, or nothing. */
export type Chrome = 'app' | 'focus' | 'bare';

function leaf(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return snapshot.firstChild ? leaf(snapshot.firstChild) : snapshot;
}

/**
 * What the shell shows: the frame chosen from the active route's `data.layout` and the session
 * (the mockup's `shell.render`), the current path for the sidebar, and the navigation drawer
 * used below the `lg` breakpoint. One instance per shell, provided by the shell component.
 */
@Injectable()
export class ShellStore {
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);

  private readonly state = { navOpen: signal(false) };

  /** The CDK handle of the open drawer: an imperative UI object, not state. */
  private drawer?: { close(): void };

  private readonly navigated = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)),
    { initialValue: null },
  );

  readonly navOpen$ = this.state.navOpen.asReadonly();

  readonly path$ = computed(() => {
    this.navigated();
    return this.router.url.split(/[?#]/)[0];
  });

  private readonly layout = computed<Layout>(() => {
    this.navigated();
    const layout: unknown = leaf(this.router.routerState.snapshot.root).data[
      'layout'
    ];
    return layout === 'focus' || layout === 'bare' ? layout : 'app';
  });

  readonly chrome$ = computed<Chrome>(() => {
    if (!this.session.isSignedIn$() || this.layout() === 'bare') return 'bare';
    return this.layout() === 'focus' ? 'focus' : 'app';
  });

  readonly role$ = this.session.role$;
  readonly isScoped$ = computed(() => !!this.session.user$()?.adminScope);

  private readonly closeOnNavigation = effect(() => {
    this.path$();
    untracked(() => this.drawer?.close());
  });

  private setNavOpen(open: boolean): void {
    this.state.navOpen.set(open);
  }

  /** Opens the navigation in a drawer; it closes on the next navigation. */
  openNav(body: TemplateRef<DrawerContext>): void {
    const ref = openDrawer(this.dialog, body, {
      title: 'Điều hướng chính',
      side: 'start',
    });
    this.drawer = ref;
    this.setNavOpen(true);
    ref.closed.subscribe(() => {
      this.drawer = undefined;
      this.setNavOpen(false);
    });
  }
}
