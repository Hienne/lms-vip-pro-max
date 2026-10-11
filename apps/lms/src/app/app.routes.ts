import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: 'design-system',
    loadChildren: () => import('./features/design-system/design-system.routes'),
  },
];
