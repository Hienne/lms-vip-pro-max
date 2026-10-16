import { Component, inject } from '@angular/core';
import { Button, DrawerOutlet, Icon } from '@lms/ui';
import { DrawerDemoStore } from './data-access/drawer-demo.store';

@Component({
  selector: 'app-drawer-demo',
  imports: [Button, DrawerOutlet, Icon],
  providers: [DrawerDemoStore],
  templateUrl: './drawer-demo.html',
  styleUrl: './drawer-demo.scss',
})
export class DrawerDemo {
  protected readonly store = inject(DrawerDemoStore);
}
