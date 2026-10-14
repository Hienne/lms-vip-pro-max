import { Component, inject } from '@angular/core';
import { Button, Icon, Toaster } from '@lms/ui';
import { NetworkStore } from '../../core/network/network.store';

/**
 * The offline notice (the mockup's `.net-banner`), announced with `role="alert"` the moment it
 * appears. "Kết nối lại" switches the simulation off; a real reconnect clears it by itself.
 */
@Component({
  selector: 'app-net-banner',
  imports: [Button, Icon],
  templateUrl: './net-banner.html',
  styleUrl: './net-banner.scss',
})
export class NetBanner {
  protected readonly network = inject(NetworkStore);
  private readonly toaster = inject(Toaster);

  protected reconnect(): void {
    this.network.goOnline();
    this.toaster.success('Đã kết nối lại');
  }
}
