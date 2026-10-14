import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  linkedSignal,
  signal,
  type TemplateRef,
  untracked,
} from '@angular/core';
import {
  rxResource,
  takeUntilDestroyed,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import {
  type ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
} from '@angular/router';
import type { NavCounts } from '@lms/contracts';
import { confirm, type DrawerContext, openDrawer, Toaster } from '@lms/ui';
import { filter, switchMap, take, tap } from 'rxjs';
import type { UserMenuValue } from '../../header/header';
import { searchTarget } from '../../header/search-target';
import { NavCountsApi } from './nav-counts.api';
import {
  hasUnsavedChanges,
  LeavePrompt,
} from '../../../core/routing/unsaved-changes.guard';
import type { Layout } from '../../../core/routing/route-table';
import { SessionStore } from '../../../core/session/session.store';

/** Which frame surrounds the page: sidebar and header, the plain focus frame, or nothing. */
export type Chrome = 'app' | 'focus' | 'bare';

const NO_COUNTS: NavCounts = { notifications: 0, inbox: 0 };

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
  private readonly api = inject(NavCountsApi);
  private readonly toaster = inject(Toaster);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    inject(LeavePrompt).use(() =>
      confirm(this.dialog, {
        title: 'Rời trang khi chưa lưu?',
        message: 'Các thay đổi chưa lưu sẽ bị mất nếu bạn rời khỏi trang này.',
        confirmLabel: 'Rời trang',
        cancelLabel: 'Ở lại',
        tone: 'warning',
      }),
    );
  }

  private readonly state = { navOpen: signal(false) };

  /** The routed page component, for the unsaved-changes check on reload or tab close. */
  private page: unknown;

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

  readonly user$ = this.session.user$;
  readonly role$ = this.session.role$;
  readonly isScoped$ = computed(() => !!this.session.user$()?.adminScope);

  /** Reloaded after sign-in and on every navigation, as the mockup refreshes its badges. */
  private readonly countsResource = rxResource({
    params: () => {
      const user = this.session.user$();
      return user ? { userId: user.id, path: this.path$() } : undefined;
    },
    stream: () => this.api.navCounts(),
  });

  /** Keeps the last counts while a reload runs, so badges do not blink on navigation. */
  private readonly counts = linkedSignal<NavCounts | undefined, NavCounts>({
    source: () => this.countsResource.value(),
    computation: (value, previous) =>
      value ??
      (this.session.isSignedIn$() ? previous?.value : undefined) ??
      NO_COUNTS,
  });

  readonly unread$ = computed(() => this.counts().notifications);
  readonly inboxCount$ = computed(() => this.counts().inbox);

  private readonly closeOnNavigation = effect(() => {
    this.path$();
    untracked(() => this.drawer?.close());
  });

  /** The router outlet's `activate` and `deactivate` events keep track of the current page. */
  activated(page: unknown): void {
    this.page = page;
  }

  deactivated(): void {
    this.page = undefined;
  }

  hasUnsavedChanges(): boolean {
    return hasUnsavedChanges(this.page);
  }

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

  /** Header search: sends the query to the list a role searches (nothing for an empty query). */
  search(text: string): void {
    const role = this.session.role$();
    const target = role ? searchTarget(role, text) : null;
    if (target) {
      void this.router.navigate([target.path], { queryParams: target.query });
    }
  }

  /** Acts on a user-menu choice. */
  pick(choice: UserMenuValue): void {
    if (choice === 'sign-out') this.signOut();
    else
      void this.router.navigateByUrl(
        choice === 'profile' ? '/profile' : '/notifications',
      );
  }

  /** Confirms, signs out, then shows the login page with a toast (the mockup's `logout`). */
  private signOut(): void {
    confirm(this.dialog, {
      title: 'Đăng xuất?',
      message:
        'Tiến độ học đã được lưu tự động. Bạn có thể tiếp tục trên thiết bị khác.',
      confirmLabel: 'Đăng xuất',
    })
      .pipe(
        filter(Boolean),
        tap(() => this.session.signOut()),
        switchMap(() =>
          toObservable(this.session.isSignedIn$, {
            injector: this.injector,
          }).pipe(
            filter((signedIn) => !signedIn),
            take(1),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toaster.success('Đã đăng xuất');
        void this.router.navigateByUrl('/login');
      });
  }
}
