import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BootError } from './features/errors/boot-error/boot-error';
import { SessionStore } from './core/session/session.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BootError],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly session = inject(SessionStore);
}
