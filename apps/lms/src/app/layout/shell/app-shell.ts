import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  untracked,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../header/header';
import { NetBanner } from '../net-banner/net-banner';
import { Sidebar } from '../sidebar/sidebar';
import { ShellStore } from './data-access/shell.store';

/**
 * The frame around every page (the mockup's `shell.render`): sidebar and header for the app
 * layout, a bare main for focus and login. There is one router outlet, so a page keeps its state
 * when the frame around it changes.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Header, NetBanner],
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' },
  providers: [ShellStore],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  protected readonly store = inject(ShellStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // After each navigation the page heading takes focus, so a screen reader announces the new page.
    afterRenderEffect(() => {
      this.store.path$();
      untracked(() => this.focusHeading());
    });
  }

  private main(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('main');
  }

  private focusHeading(): void {
    const target = this.main()?.querySelector<HTMLElement>('h1') ?? this.main();
    if (!target) return;
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }

  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.main()?.focus();
  }

  /** Reload and tab close: the browser asks, only when the page reports unsaved changes. */
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
