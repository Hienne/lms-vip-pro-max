import {
  afterRenderEffect,
  Component,
  computed,
  effect,
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
import { OPEN_PAGE_GUIDE } from '../../core/routing/page-guide-action';
import { MyLevelStore } from '../../core/learning/my-level.store';
import { ChatWidget } from '../chat-widget/chat-widget';
import { Header } from '../header/header';
import { NetBanner } from '../net-banner/net-banner';
import { Owl } from '../owl/owl';
import { Sidebar } from '../sidebar/sidebar';
import { UploadPanel } from '../upload-panel/upload-panel';
import { SourceViewer } from '../../shared/assistant/source-viewer/source-viewer';
import { ShellInsets } from '../shell-insets';
import { ShellStore } from './data-access/shell.store';
import { UsageGuide } from './components/usage-guide/usage-guide';
import { UsageGuideStore } from './components/usage-guide/usage-guide.store';
import type { UserMenuValue } from '../header/header';

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
    SourceViewer,
    UsageGuide,
  ],
  host: {
    '(window:beforeunload)': 'warnBeforeUnload($event)',
    '[style.--owl-inset.px]': 'inset()',
    '[style.--shell-gutter]': 'gutter()',
  },
  providers: [
    ShellStore,
    UsageGuideStore,
    {
      provide: OPEN_PAGE_GUIDE,
      useFactory: () => {
        const store = inject(ShellStore);
        const guide = inject(UsageGuideStore);
        return () => guide.openPage(store.path$());
      },
    },
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  protected readonly store = inject(ShellStore);
  protected readonly guide = inject(UsageGuideStore);
  protected readonly level = inject(MyLevelStore);
  /** Whether the quick assistant is docked, so the frame makes room for it. */
  protected readonly chat = inject(AgentChatStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Height of a bar a page pins to the bottom; the content ends above it and the owl. */
  protected readonly inset = inject(ShellInsets).bottom;
  /** Right space the floating buttons need: wider beside the dev toolbar, which sits in the same corner. */
  protected readonly gutter = computed(() =>
    this.devToolbar() ? '10.5rem' : null,
  );

  /** The dev toolbar once its chunk has loaded; stays null where the build has none. */
  protected readonly devToolbar = signal<Type<unknown> | null>(null);

  constructor() {
    effect(() => {
      const profile = this.store.user$(),
        chrome = this.store.chrome$();
      untracked(() => {
        if (!profile) this.guide.offer(null);
        else if (chrome === 'app') this.guide.offer(profile);
      });
    });
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

  protected pick(choice: UserMenuValue): void {
    if (choice === 'guide') this.guide.open();
    else if (choice === 'page-guide') this.guide.openPage(this.store.path$());
    else this.store.pick(choice);
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
