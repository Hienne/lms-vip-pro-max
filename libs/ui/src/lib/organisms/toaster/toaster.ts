import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { inject, Injectable, signal } from '@angular/core';
import { ToastOutlet } from './toast-outlet';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

/** The one action a toast may offer; running it also dismisses the toast. */
export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly title: string;
  readonly message?: string;
  readonly action?: ToastAction;
}

/** How long a non-error toast stays (the mockup's 4200ms). */
export const TOAST_DURATION_MS = 4200;
/** How long an error toast stays: a little longer, so its message can be read. */
export const ERROR_TOAST_DURATION_MS = 5000;
/** Visible stack size: showing one more drops the oldest. */
export const MAX_TOASTS = 4;

type HoldSource = 'hover' | 'focus';

interface Timer {
  handle: ReturnType<typeof setTimeout> | undefined;
  remaining: number;
  startedAt: number;
  readonly holds: Set<HoldSource>;
}

/**
 * Root, presentation-only system feedback. Toasts stack bottom-right on a CDK overlay, oldest
 * first. Toasts dismiss themselves after {@link TOAST_DURATION_MS} ({@link ERROR_TOAST_DURATION_MS}
 * for errors), paused while hovered or focused. Every toast is also sent to the `LiveAnnouncer` (assertive
 * for errors, polite otherwise), so the outlet itself is not a live region.
 *
 * `inject(Toaster).success('Đã lưu thay đổi', 'Chi tiết tùy chọn')`
 */
@Injectable({ providedIn: 'root' })
export class Toaster {
  private readonly overlay = inject(Overlay);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly timers = new Map<number, Timer>();
  private readonly state = { toasts: signal<readonly Toast[]>([]) };
  private overlayRef: OverlayRef | undefined;
  private nextId = 1;

  readonly toasts = this.state.toasts.asReadonly();

  success(title: string, message?: string): void {
    this.show('success', title, message);
  }

  error(title: string, message?: string): void {
    this.show('error', title, message);
  }

  warning(title: string, message?: string): void {
    this.show('warning', title, message);
  }

  info(title: string, message?: string): void {
    this.show('info', title, message);
  }

  /**
   * An info toast with one action (`Tải lại`). It stays until the user acts on it or closes it,
   * since the action is the point of the toast.
   */
  offer(title: string, action: ToastAction, message?: string): void {
    this.show('info', title, message, action);
  }

  /** Runs the toast's action, then dismisses it. */
  act(id: number): void {
    const action = this.toasts().find((t) => t.id === id)?.action;
    this.dismiss(id);
    action?.run();
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.state.toasts.update((list) => list.filter((t) => t.id !== id));
    this.detachWhenEmpty();
  }

  dismissAll(): void {
    this.toasts().forEach((t) => this.clearTimer(t.id));
    this.state.toasts.set([]);
    this.detachWhenEmpty();
  }

  /** Pauses the auto-dismiss timer while the pointer or focus is on the toast. */
  hold(id: number, source: HoldSource): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    timer.holds.add(source);
    if (timer.handle !== undefined) {
      clearTimeout(timer.handle);
      timer.handle = undefined;
      timer.remaining -= Date.now() - timer.startedAt;
    }
  }

  /** Resumes with the time left once neither hover nor focus holds the toast. */
  release(id: number, source: HoldSource): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    timer.holds.delete(source);
    const sticky = this.toasts().some((t) => t.id === id && t.action);
    if (timer.holds.size === 0 && timer.handle === undefined && !sticky) {
      this.start(id, timer);
    }
  }

  private show(
    kind: ToastKind,
    title: string,
    message?: string,
    action?: ToastAction,
  ): void {
    const id = this.nextId++;
    const toast: Toast = { id, kind, title, message, action };
    const kept = this.toasts().slice(-(MAX_TOASTS - 1));
    this.toasts()
      .filter((t) => !kept.includes(t))
      .forEach((t) => this.clearTimer(t.id));
    this.state.toasts.set([...kept, toast]);

    const timer: Timer = {
      handle: undefined,
      remaining: kind === 'error' ? ERROR_TOAST_DURATION_MS : TOAST_DURATION_MS,
      startedAt: 0,
      holds: new Set(),
    };
    this.timers.set(id, timer);
    if (!action) this.start(id, timer);
    this.attach();
    void this.announcer.announce(
      message ? `${title}. ${message}` : title,
      kind === 'error' ? 'assertive' : 'polite',
    );
  }

  private start(id: number, timer: Timer): void {
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer?.handle !== undefined) clearTimeout(timer.handle);
    this.timers.delete(id);
  }

  private attach(): void {
    if (this.overlayRef?.hasAttached()) return;
    this.overlayRef ??= this.overlay.create({
      positionStrategy: this.overlay.position().global().bottom().right(),
      panelClass: 'toasts-pane',
    });
    this.overlayRef.attach(new ComponentPortal(ToastOutlet));
    // The pane spans the stack's margins (the owl's corner); only the toasts themselves take
    // clicks (`.toast` sets `pointer-events: auto`). Inline and after `attach`, because the CDK
    // resets the pane's pointer events on attach and its pane rule is unlayered.
    this.overlayRef.overlayElement.style.pointerEvents = 'none';
  }

  private detachWhenEmpty(): void {
    if (this.toasts().length === 0) this.overlayRef?.detach();
  }
}
