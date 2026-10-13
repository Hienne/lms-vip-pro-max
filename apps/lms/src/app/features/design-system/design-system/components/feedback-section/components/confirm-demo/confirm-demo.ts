import { Component, inject } from '@angular/core';
import { Button, Icon } from '@lms/ui';
import { ConfirmDemoStore } from './data-access/confirm-demo.store';

@Component({
  selector: 'app-confirm-demo',
  imports: [Button, Icon],
  providers: [ConfirmDemoStore],
  templateUrl: './confirm-demo.html',
  styleUrl: './confirm-demo.scss',
})
export class ConfirmDemo {
  protected readonly store = inject(ConfirmDemoStore);
}
