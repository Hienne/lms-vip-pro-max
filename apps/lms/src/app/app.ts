import { Component, inject } from '@angular/core';
import { AppShell } from './layout/shell/app-shell';
import { BootError } from './features/errors/boot-error/boot-error';
import { SessionStore } from './core/session/session.store';

@Component({
  selector: 'app-root',
  imports: [AppShell, BootError],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly session = inject(SessionStore);
}
