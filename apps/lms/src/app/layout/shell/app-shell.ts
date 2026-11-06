import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  signal,
  type Type,
  untracked,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { DrawerOutlet } from '@lms/ui';
import { AgentChatStore } from '../../core/assistant/agent-chat.store';
import { APP_CONFIG } from '../../core/config/app-config';
import { DEV_FEATURES } from '../../core/dev/dev-features';
import { ChatWidget } from '../chat-widget/chat-widget';
import { Header } from '../header/header';
import { NetBanner } from '../net-banner/net-banner';
import { Owl } from '../owl/owl';
import { Sidebar } from '../sidebar/sidebar';
import { UploadPanel } from '../upload-panel/upload-panel';
import { ShellStore } from './data-access/shell.store';

/**
 * The frame around every page (the mockup's `shell.render`): sidebar and header for the app
 * layout, a bare main for focus and login. There is one router outlet, so a page keeps its state
 * when the frame around it changes.
 */
@Component({
  selector: 'app-shell',
  imports: [
    DrawerOutlet,
    RouterOutlet,
    Sidebar,
    Header,
    NetBanner,
    NgComponentOutlet,
    Owl,
    ChatWidget,
    UploadPanel,
  ],
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' },
  providers: [ShellStore],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  protected readonly store = inject(ShellStore);
  /** Whether the quick assistant is docked, so the frame makes room for it. */
  protected readonly chat = inject(AgentChatStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The dev toolbar once its chunk has loaded; stays null where the build has none. */
  protected readonly devToolbar = signal<Type<unknown> | null>(null);

  constructor() {
    const load = inject(APP_CONFIG).devTools ? DEV_FEATURES.toolbar : null;
    void load?.().then((toolbar) => this.devToolbar.set(toolbar));
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
