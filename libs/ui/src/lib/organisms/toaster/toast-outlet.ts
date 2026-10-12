import { Component, computed, inject } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';
import { IconButton } from '../../atoms/icon-button/icon-button.directive';
import { Toaster, type ToastKind } from './toaster';

const ICON_BY_KIND: Record<ToastKind, IconName> = {
  success: 'circle-check',
  error: 'circle-x',
  warning: 'triangle-alert',
  info: 'info',
};

/** The stack rendered on the toaster's overlay. Internal: use `Toaster`. */
@Component({
  selector: 'ui-toast-outlet',
  imports: [Icon, IconButton],
  templateUrl: './toast-outlet.html',
  host: { class: 'toasts' },
})
export class ToastOutlet {
  protected readonly toaster = inject(Toaster);
  protected readonly toasts = computed(() =>
    this.toaster
      .toasts()
      .map((toast) => ({ ...toast, icon: ICON_BY_KIND[toast.kind] })),
  );
}
