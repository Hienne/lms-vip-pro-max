import type { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Design System v2',
    loadComponent: () =>
      import('./design-system/design-system').then((m) => m.DesignSystem),
  },
] satisfies Routes;
