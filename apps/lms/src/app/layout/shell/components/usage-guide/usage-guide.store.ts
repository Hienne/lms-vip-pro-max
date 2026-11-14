import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Profile } from '../../../../core/session/profile';
import { SessionStore } from '../../../../core/session/session.store';
import {
  GUIDE_STEPS,
  type GuideAudience,
  type UsageGuideStep,
} from './usage-guide.steps';

const VERSION = '1';

/** Per-account and per-audience preferences on this browser; never changes data or grants. */
@Injectable()
export class UsageGuideStore {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly state = {
    stage: signal<'closed' | 'welcome' | 'tour'>('closed'),
    audience: signal<GuideAudience>('learner'),
    index: signal(0),
    busy: signal(false),
    error: signal(''),
    offeredKey: signal(''),
  };
  private readonly remembered = new Set<string>();
  private navigation = 0;
  readonly stage$ = this.state.stage.asReadonly();
  readonly audience$ = this.state.audience.asReadonly();
  readonly index$ = this.state.index.asReadonly();
  readonly busy$ = this.state.busy.asReadonly();
  readonly error$ = this.state.error.asReadonly();
  readonly shown$ = computed(() => this.stage$() !== 'closed' && !this.busy$());
  readonly audiences$ = computed<readonly GuideAudience[]>(() => {
    const menus = this.session.menus$();
    const isAdmin = this.session
      .user$()
      ?.grants.some(
        (grant) =>
          grant.roleCode === 'ADMIN' || grant.roleCode === 'SUPER_ADMIN',
      );
    return [
      ...(isAdmin &&
      GUIDE_STEPS.admin.some((step) => menus.includes(step.permission))
        ? ['admin' as const]
        : []),
      ...(menus.includes('COURSE_LEARNING') ? ['learner' as const] : []),
      ...(menus.includes('COURSE_MANAGEMENT') ? ['instructor' as const] : []),
    ];
  });
  readonly steps$ = computed(() =>
    GUIDE_STEPS[this.audience$()].filter((step) =>
      this.session.menus$().includes(step.permission),
    ),
  );
  readonly step$ = computed<UsageGuideStep | undefined>(
    () => this.steps$()[this.index$()],
  );
  readonly total$ = computed(() => this.steps$().length);

  private setStage(value: 'closed' | 'welcome' | 'tour'): void {
    this.state.stage.set(value);
  }
  private setAudience(value: GuideAudience): void {
    this.state.audience.set(value);
  }
  private setIndex(value: number): void {
    this.state.index.set(value);
  }
  private setBusy(value: boolean): void {
    this.state.busy.set(value);
  }
  private setError(value: string): void {
    this.state.error.set(value);
  }
  private setOfferedKey(value: string): void {
    this.state.offeredKey.set(value);
  }
  private key(audience: GuideAudience): string {
    return `lms.usage-guide.v${VERSION}.${this.session.user$()?.userId ?? ''}.${audience}`;
  }
  private seen(key: string): boolean {
    if (this.remembered.has(key)) return true;
    try {
      return ['complete', 'skipped'].includes(
        this.document.defaultView?.localStorage.getItem(key) ?? '',
      );
    } catch {
      return false;
    }
  }
  private remember(outcome: 'complete' | 'skipped'): void {
    const key = this.key(this.audience$());
    this.remembered.add(key);
    try {
      this.document.defaultView?.localStorage.setItem(key, outcome);
    } catch {
      /* Browsers may disable storage. */
    }
  }

  /** Called only once the app chrome and authenticated profile are available. */
  offer(profile: Profile | null): void {
    if (!profile) {
      this.navigation++;
      this.setBusy(false);
      this.setStage('closed');
      this.setOfferedKey('');
      return;
    }
    if (profile.mustChangePassword) return;
    const audience = this.audiences$().includes('admin')
      ? 'admin'
      : profile.grants.some((grant) => grant.roleCode === 'INSTRUCTOR') &&
          this.audiences$().includes('instructor')
        ? 'instructor'
        : this.audiences$().includes('learner')
          ? 'learner'
          : undefined;
    if (!audience) return;
    const key = this.key(audience);
    if (this.state.offeredKey() === key) return;
    this.setOfferedKey(key);
    this.setAudience(audience);
    if (!this.seen(key)) this.open(audience);
  }
  open(
    audience = this.audiences$().includes(this.audience$())
      ? this.audience$()
      : this.audiences$()[0],
  ): void {
    if (!audience || !this.audiences$().includes(audience) || this.busy$())
      return;
    this.setAudience(audience);
    this.setIndex(0);
    this.setError('');
    this.setStage('welcome');
  }
  chooseAudience(value: GuideAudience): void {
    if (!this.audiences$().includes(value)) return;
    this.setAudience(value);
    this.setIndex(0);
  }
  async next(): Promise<void> {
    if (this.busy$()) return;
    if (this.stage$() === 'tour' && this.index$() + 1 >= this.total$()) {
      this.remember('complete');
      this.setStage('closed');
      return;
    }
    await this.go(this.stage$() === 'welcome' ? 0 : this.index$() + 1);
  }
  async back(): Promise<void> {
    if (!this.busy$() && this.index$() > 0) await this.go(this.index$() - 1);
  }
  skip(): void {
    if (this.busy$()) return;
    this.remember('skipped');
    this.setStage('closed');
  }
  private async go(index: number): Promise<void> {
    const step = this.steps$()[index];
    if (!step || !this.session.isSignedIn$()) return;
    const navigation = ++this.navigation;
    const userId = this.session.user$()?.userId;
    this.setBusy(true);
    this.setError('');
    try {
      // Let the modal close before a route guard can ask about unsaved work.
      await new Promise<void>((resolve) =>
        this.document.defaultView?.requestAnimationFrame
          ? this.document.defaultView.requestAnimationFrame(() => resolve())
          : resolve(),
      );
      if (
        navigation !== this.navigation ||
        this.session.user$()?.userId !== userId
      )
        return;
      const navigated =
        this.router.url.split('?')[0] === step.path ||
        (await this.router.navigateByUrl(step.path));
      if (
        navigation !== this.navigation ||
        this.session.user$()?.userId !== userId
      )
        return;
      if (navigated && this.session.isSignedIn$()) {
        this.setIndex(index);
        this.setStage('tour');
      } else
        this.setError(
          'Hãy lưu nháp hoặc hủy thay đổi trên trang hiện tại trước khi chuyển bước hướng dẫn.',
        );
    } catch {
      if (navigation === this.navigation)
        this.setError(
          'Chưa mở được trang hướng dẫn. Bạn có thể thử lại hoặc bỏ qua.',
        );
    } finally {
      if (navigation === this.navigation) this.setBusy(false);
    }
  }
}
