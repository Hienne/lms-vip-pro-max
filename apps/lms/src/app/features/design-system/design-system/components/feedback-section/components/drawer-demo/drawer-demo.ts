import { Dialog } from '@angular/cdk/dialog';
import { Component, inject, type TemplateRef } from '@angular/core';
import {
  Button,
  Icon,
  openDrawer,
  type DrawerContext,
  type DrawerSide,
} from '@lms/ui';

@Component({
  selector: 'app-drawer-demo',
  imports: [Button, Icon],
  templateUrl: './drawer-demo.html',
})
export class DrawerDemo {
  private readonly dialog = inject(Dialog);

  protected open(
    body: TemplateRef<DrawerContext>,
    footer: TemplateRef<DrawerContext>,
    side: DrawerSide,
  ): void {
    openDrawer(this.dialog, body, { title: 'Drawer mẫu', side, footer });
  }
}
