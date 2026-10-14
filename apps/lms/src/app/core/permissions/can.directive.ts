import {
  computed,
  Directive,
  effect,
  EmbeddedViewRef,
  inject,
  input,
  TemplateRef,
  untracked,
  ViewContainerRef,
} from '@angular/core';
import type { Permission } from '@lms/contracts';
import { SessionStore } from '../session/session.store';
import { hasPermissions } from './has-permissions';

/**
 * `<button *appCan="'content.write'">` shows its host only when the server granted that
 * permission; a list needs all of them. It hides UI and nothing more: the server enforces
 * permissions, so never rely on it for protection.
 */
@Directive({ selector: '[appCan]' })
export class Can {
  readonly appCan = input.required<Permission | readonly Permission[]>();

  private readonly session = inject(SessionStore);
  private readonly template = inject(TemplateRef);
  private readonly container = inject(ViewContainerRef);
  private view?: EmbeddedViewRef<unknown>;

  private readonly allowed = computed(() =>
    hasPermissions(this.session.perms$(), this.appCan()),
  );

  private readonly render = effect(() => {
    const allowed = this.allowed();
    untracked(() => {
      if (allowed && !this.view) {
        this.view = this.container.createEmbeddedView(this.template);
      } else if (!allowed && this.view) {
        this.container.clear();
        this.view = undefined;
      }
    });
  });
}
