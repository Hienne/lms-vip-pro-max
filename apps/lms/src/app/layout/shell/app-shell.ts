import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';
import { ShellStore } from './data-access/shell.store';

/**
 * The frame around every page (the mockup's `shell.render`): sidebar and header for the app
 * layout, a bare main for focus and login. There is one router outlet, so a page keeps its state
 * when the frame around it changes.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Header],
  providers: [ShellStore],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  protected readonly store = inject(ShellStore);
}
