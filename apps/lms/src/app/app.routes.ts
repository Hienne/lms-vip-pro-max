import { Routes } from '@angular/router';
import type { AppConfig } from './core/config/app-config';

/**
 * The app's routes. `devTools` registers the internal routes (the migration progress board);
 * production builds do not have them at all.
 */
export function createAppRoutes(config: Pick<AppConfig, 'devTools'>): Routes {
  return [
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
