import { Route, Routes } from '@angular/router';
import type { AppConfig } from './core/config/app-config';
import { authGuard } from './core/routing/auth.guard';
import { unsavedChangesGuard } from './core/routing/unsaved-changes.guard';
import { menuGuard } from './core/routing/menu.guard';
import {
  HOME_META,
  metaOf,
  NOT_FOUND_META,
  ROUTE_DEFS,
  type RouteDef,
  type RouteMeta,
} from './core/routing/route-table';
import { DEV_FEATURES } from './core/dev/dev-features';
import { guestGuard } from './core/session/guest.guard';
import { homeGuard } from './core/session/home.guard';

type Loader = NonNullable<Route['loadComponent']>;

/** Until its screen is migrated, a route shows the placeholder naming the mockup page. */
const placeholder: Loader = () =>
  import('./features/errors/route-placeholder/route-placeholder').then(
    (m) => m.RoutePlaceholder,
  );

/** Migrated screens by route path; every other route keeps the placeholder. */
const SCREENS: Readonly<Record<string, Loader>> = {
  login: () => import('./features/auth/login/login').then((m) => m.Login),
  '403': () =>
    import('./features/errors/forbidden/forbidden').then((m) => m.Forbidden),
};

const routeData = (meta: RouteMeta): Route['data'] => ({ ...meta });

function toRoute(def: RouteDef): Route {
  return {
    path: def.path,
    // `full`, or `/admin/courses` would run the guards of the `admin` route first.
    pathMatch: 'full',
    title: def.title,
    data: routeData(metaOf(def)),
    canMatch: def.public ? [] : [authGuard, menuGuard],
    canActivate: def.guestOnly ? [guestGuard] : [],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: SCREENS[def.path] ?? placeholder,
  };
}

/**
 * The app's routes: the mockup's route table, each route carrying `data.menu` and `data.layout`.
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
    ...ROUTE_DEFS.map(toRoute),
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
