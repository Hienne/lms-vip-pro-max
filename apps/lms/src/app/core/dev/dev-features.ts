import type { DevFeatures } from './dev-features.model';
import { offlineSimulationInterceptor } from './offline-simulation.interceptor';

export const DEV_FEATURES: DevFeatures = {
  routes: [
    {
      path: 'dev/migration',
      title: 'Tiến độ migrate',
      loadComponent: () =>
        import(
          '../../features/design-system/migration-board/migration-board'
        ).then((m) => m.MigrationBoard),
    },
  ],
  toolbar: () => import('./dev-toolbar/dev-toolbar').then((m) => m.DevToolbar),
  interceptors: [offlineSimulationInterceptor],
};
