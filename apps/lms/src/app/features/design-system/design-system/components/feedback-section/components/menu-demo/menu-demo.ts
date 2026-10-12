import { Component, inject } from '@angular/core';
import { Menu } from '@lms/ui';
import { MenuDemoStore } from './data-access/menu-demo.store';

@Component({
  selector: 'app-menu-demo',
  imports: [Menu],
  providers: [MenuDemoStore],
  templateUrl: './menu-demo.html',
})
export class MenuDemo {
  protected readonly store = inject(MenuDemoStore);
}
