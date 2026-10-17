import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  Injector,
  linkedSignal,
  signal,
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
import { type NavCounts, shellEndpoints } from '@lms/contracts';
import { confirm, Toaster } from '@lms/ui';
import { filter, switchMap, take, tap } from 'rxjs';
import type { UserMenuValue } from '../../header/header';
import { searchTarget } from '../../header/search-target';
import { APP_CONFIG } from '../../../core/config/app-config';
import { EndpointClient } from '../../../core/http/endpoint-client';
import {
  hasUnsavedChanges,
  LeavePrompt,
} from '../../../core/routing/unsaved-changes.guard';
import type { Layout } from '../../../core/routing/route-table';
import { screenHref } from '../../../core/routing/screens';
import { SessionStore } from '../../../core/session/session.store';
import {
  LOCAL_STORAGE,
  type PreferenceStorage,
} from '../../../core/storage/local-storage';

/** Which frame surrounds the page: sidebar and header, the plain focus frame, or nothing. */
export type Chrome = 'app' | 'focus' | 'bare';

const NO_COUNTS: NavCounts = { notifications: 0, inbox: 0 };

/** Remembers per browser that the desktop sidebar is collapsed to its icon rail. */
export const SIDEBAR_COLLAPSED_KEY = 'lms.sidebar-collapsed';

function readCollapsed(storage: PreferenceStorage | null): boolean {
  try {
    return storage?.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function leaf(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return snapshot.firstChild ? leaf(snapshot.firstChild) : snapshot;
}

/**
 * What the shell shows: the frame chosen from the active route's `data.layout` and the session
 * (the mockup's `shell.render`), the current path for the sidebar, whether the desktop sidebar
 * is collapsed to an icon rail, and the navigation drawer used below the `lg` breakpoint. One instance per shell, provided by the shell component.
 */
@Injectable()
export class ShellStore {
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly client = inject(EndpointClient);
  private readonly toaster = inject(Toaster);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storage = inject(LOCAL_STORAGE);
  private readonly mockApi = inject(APP_CONFIG).mockApi;

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

  private readonly state = {
    /** Open until the path changes: navigating closes the navigation drawer. */
    navOpen: linkedSignal<string, boolean>({
      source: () => this.path$(),
      computation: () => false,
    }),
    /** The desktop sidebar shows icons only; the drawer below `lg` always shows the full menu. */
    sidebarCollapsed: signal(readCollapsed(this.storage)),
  };

  /** The routed page component, for the unsaved-changes check on reload or tab close. */
  private page: unknown;

  private readonly navigated = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)),
    { initialValue: null },
  );

  readonly navOpen$ = this.state.navOpen.asReadonly();
  readonly sidebarCollapsed$ = this.state.sidebarCollapsed.asReadonly();

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
  readonly roleText$ = computed(() => this.session.user$()?.roleText ?? '');

  /**
   * Reloaded after sign-in and on every navigation, as the mockup refreshes its badges. The
   * backend has no such endpoint yet, so it is only asked while the mock API answers it.
   */
  private readonly countsResource = rxResource({
    params: () => {
      const user = this.session.user$();
      return user && this.mockApi
        ? { userId: user.userId, path: this.path$() }
        : undefined;
    },
    stream: () => this.client.call(shellEndpoints.navCounts),
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

  /** Opens the navigation drawer; navigating closes it again. */
  openNav(): void {
    this.setNavOpen(true);
  }

  closeNav(): void {
    this.setNavOpen(false);
  }

  private setSidebarCollapsed(collapsed: boolean): void {
    this.state.sidebarCollapsed.set(collapsed);
  }

  /** Collapses the sidebar to its icon rail or expands it again, and remembers the choice. */
  toggleSidebar(): void {
    const collapsed = !this.sidebarCollapsed$();
    this.setSidebarCollapsed(collapsed);
    try {
      this.storage?.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // Storage is blocked or full: the choice still applies for this page view.
    }
  }

  /** Header search: sends the query to the list the user's menus allow (nothing for an empty query). */
  search(text: string): void {
    const target = searchTarget(this.session.menus$(), text);
    if (target) {
      void this.router.navigate([target.path], { queryParams: target.query });
    }
  }

  /** Acts on a user-menu choice. */
  pick(choice: UserMenuValue): void {
    if (choice === 'sign-out') this.signOut();
    else
      void this.router.navigateByUrl(
        screenHref(choice === 'profile' ? 'profile' : 'notifications'),
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
        void this.router.navigateByUrl(screenHref('login'));
      });
  }
}
