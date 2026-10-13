import { Routes } from '@angular/router';
import type { AppConfig } from './core/config/app-config';
import { homeGuard } from './core/session/home.guard';

const placeholder = (mockupPage: string) => ({
  data: { mockupPage },
  loadComponent: () =>
    import('./features/errors/route-placeholder/route-placeholder').then(
      (m) => m.RoutePlaceholder,
    ),
});

/**
 * The app's routes. `devTools` registers the internal routes (the migration progress board);
 * production builds do not have them at all.
 */
export function createAppRoutes(config: Pick<AppConfig, 'devTools'>): Routes {
  return [
    { path: '', pathMatch: 'full', canActivate: [homeGuard], children: [] },
    { path: 'login', title: 'Đăng nhập', ...placeholder('login') },
    { path: 'learn', title: 'Trang chủ học tập', ...placeholder('dashboard') },
    { path: 'instructor', title: 'Giảng viên', ...placeholder('instructor') },
    { path: 'admin', title: 'Quản trị', ...placeholder('adminHome') },
    { path: 'reports', title: 'Báo cáo', ...placeholder('reports') },
    {
      path: 'design-system',
      loadChildren: () =>
        import('./features/design-system/design-system.routes'),
    },
    ...(config.devTools
      ? ([
          {
            path: 'dev/migration',
            title: 'Tiến độ migrate',
            loadComponent: () =>
              import(
                './features/design-system/migration-board/migration-board'
              ).then((m) => m.MigrationBoard),
          },
        ] satisfies Routes)
      : []),
  ];
}
