import { Route, Routes } from '@angular/router';
import type { AppConfig } from './core/config/app-config';
import { authGuard } from './core/routing/auth.guard';
import { unsavedChangesGuard } from './core/routing/unsaved-changes.guard';
import { menuGuard } from './core/routing/menu.guard';
import { passwordChangeGuard } from './core/routing/password-change.guard';
import {
  HOME_META,
  NOT_FOUND_META,
  type RouteMeta,
} from './core/routing/route-table';
import {
  metaOf,
  SCREEN_ENTRIES,
  type ScreenEntry,
} from './core/routing/screens';
import { DEV_FEATURES } from './core/dev/dev-features';
import { guestGuard } from './core/session/guest.guard';
import { homeGuard } from './core/session/home.guard';

type Loader = NonNullable<Route['loadComponent']>;

/** Until its screen is migrated, a route shows the placeholder naming the mockup page. */
const placeholder: Loader = () =>
  import('./features/errors/route-placeholder/route-placeholder').then(
    (m) => m.RoutePlaceholder,
  );

const routeData = (meta: RouteMeta): Route['data'] => ({ ...meta });

function toRoute(entry: ScreenEntry): Route {
  const { screen } = entry;
  if (screen.redirectTo) {
    // Authorization belongs to the destination's guards, including COMMUNITY access.
    return {
      path: screen.path,
      pathMatch: 'full',
      redirectTo: screen.redirectTo,
    };
  }
  return {
    path: screen.path,
    // `full`, or `/admin/courses` would run the guards of the `admin` route first.
    pathMatch: 'full',
    title: screen.title,
    data: routeData(metaOf(entry)),
    canMatch: screen.public ? [] : [authGuard, passwordChangeGuard, menuGuard],
    canActivate: screen.guestOnly ? [guestGuard] : [],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: screen.load ?? placeholder,
  };
}

/**
 * The app's routes: the screen table (`core/routing/screens.ts`), each route carrying `data.menu` and `data.layout`.
 * `devTools` registers the internal routes (the migration progress board); the production build
 * replaces `DEV_FEATURES` with an empty one, so it does not even contain them.
 */
export function createAppRoutes(config: Pick<AppConfig, 'devTools'>): Routes {
  return [
    {
      // Redirects by returning a UrlTree: the home path of the role, or the login page for a visitor.
      path: '',
      pathMatch: 'full',
      data: routeData(HOME_META),
      canActivate: [homeGuard],
      children: [],
    },
    ...SCREEN_ENTRIES.map(toRoute),
    {
      path: 'design-system',
      loadChildren: () =>
        import('./features/design-system/design-system.routes'),
    },
    ...(config.devTools ? DEV_FEATURES.routes : []),
    {
      path: '**',
      title: 'Không tìm thấy',
      data: routeData({ ...NOT_FOUND_META }),
      loadComponent: () =>
        import('./features/errors/not-found/not-found').then((m) => m.NotFound),
    },
  ];
}
