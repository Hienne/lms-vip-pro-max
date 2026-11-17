import { DOCUMENT } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type { Profile } from '../../../../core/session/profile';
import { SessionStore } from '../../../../core/session/session.store';
import {
  GUIDE_STEPS,
  PAGE_GUIDE_STEPS,
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
    mode: signal<'intro' | 'full' | 'page'>('full'),
    pageSteps: signal<readonly UsageGuideStep[]>([]),
    autoEnabled: linkedSignal(() => {
      const key = `lms.usage-guide.auto.${this.session.user$()?.userId ?? ''}`;
      try {
        return this.document.defaultView?.localStorage.getItem(key) !== 'false';
      } catch {
        return true;
      }
    }),
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
  readonly mode$ = this.state.mode.asReadonly();
  readonly autoEnabled$ = this.state.autoEnabled.asReadonly();
  readonly steps$ = computed(() => {
    const steps = (
      this.mode$() === 'page'
        ? this.state.pageSteps()
        : GUIDE_STEPS[this.audience$()]
    ).filter((step) => this.session.menus$().includes(step.permission));
    return this.mode$() === 'intro' ? steps.slice(0, 3) : steps;
  });
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
  private setMode(mode: 'intro' | 'full' | 'page'): void {
    this.state.mode.set(mode);
  }
  private setPageSteps(steps: readonly UsageGuideStep[]): void {
    this.state.pageSteps.set(steps);
  }
  setAutoEnabled(enabled: boolean): void {
    this.state.autoEnabled.set(enabled);
    try {
      this.document.defaultView?.localStorage.setItem(
        `lms.usage-guide.auto.${this.session.user$()?.userId ?? ''}`,
        String(enabled),
      );
    } catch {
      /* The choice still applies to this session when storage is blocked. */
    }
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
    if (!this.seen(key) && this.autoEnabled$()) {
      this.open(audience);
      this.setMode('intro');
    }
  }
  open(
    audience = this.audiences$().includes(this.audience$())
      ? this.audience$()
      : this.audiences$()[0],
  ): void {
    if (!audience || !this.audiences$().includes(audience) || this.busy$())
      return;
    this.setAudience(audience);
    this.setMode('full');
    this.setIndex(0);
    this.setError('');
    this.setStage('welcome');
  }
  openPage(path: string): void {
    if (this.busy$() || !this.session.isSignedIn$()) return;
    const cleanPath = path.split(/[?#]/)[0];
    const allowed = [
      ...GUIDE_STEPS[this.audience$()],
      ...PAGE_GUIDE_STEPS,
    ].filter((step) => this.session.menus$().includes(step.permission));
    const exact = allowed.filter((step) => step.path === cleanPath);
    const parents = allowed.filter(
      (step) =>
        cleanPath.startsWith(step.path + '/') ||
        (step.path.endsWith('/') && cleanPath.startsWith(step.path)),
    );
    const longest = Math.max(0, ...parents.map((step) => step.path.length));
    const steps = exact.length
      ? exact
      : parents.filter((step) => step.path.length === longest);
    const fallback = allowed[0];
    if (!steps.length && !fallback) return;
    this.setPageSteps(
      (steps.length
        ? steps
        : [
            {
              ...fallback!,
              title: 'Trợ giúp màn hình',
              target: 'main ui-page-header',
              text: 'Dùng tiêu đề và các bộ lọc để xác định phạm vi đang xem. Các thao tác được mở theo quyền của bạn. Mở toàn bộ hướng dẫn để xem quy trình theo vai trò; lưu nháp trước khi rời form đang soạn.',
            },
          ]
      ).map((step) => ({ ...step, path: cleanPath })),
    );
    this.setMode('page');
    this.setIndex(0);
    this.setError('');
    this.setStage('tour');
  }
  chooseAudience(value: GuideAudience): void {
    if (!this.audiences$().includes(value)) return;
    this.setAudience(value);
    this.setIndex(0);
  }
  async next(): Promise<void> {
    if (this.busy$()) return;
    if (this.stage$() === 'tour' && this.index$() + 1 >= this.total$()) {
      if (this.mode$() !== 'page') this.remember('complete');
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
    if (this.mode$() !== 'page') this.remember('skipped');
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
        this.router.url.split(/[?#]/)[0] === step.path ||
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
