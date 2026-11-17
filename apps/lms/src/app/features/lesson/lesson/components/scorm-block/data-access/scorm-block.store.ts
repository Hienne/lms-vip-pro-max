import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { Dialog } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { confirm } from '@lms/ui';
import { filter, map } from 'rxjs';
import { scormEndpoints, type ScormLaunch } from '@lms/contracts';
import { EndpointClient } from '../../../../../../core/http/endpoint-client';
import { serverData } from '../../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../../core/data-access/server-mutation';
import { LessonStore } from '../../../data-access/lesson.store';

interface CourseLaunch {
  id: number;
  enrollmentId: number;
  lessonId: number;
}

/** The iframe is keyed only by the lesson identity; progress refreshes never create a new launch. */
@Injectable()
export class ScormBlockStore {
  private readonly client = inject(EndpointClient);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lesson = inject(LessonStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly state = {
    url: signal<SafeResourceUrl | null>(null),
    origin: signal(''),
    saveState: signal('loading'),
    configurationError: signal(''),
  };
  private readonly context = computed<CourseLaunch | undefined>(
    () => {
      const id = this.lesson.scormPackageId$();
      const { enrollmentId, lessonId } = this.lesson.scormContext$();
      return id && enrollmentId && lessonId
        ? { id, enrollmentId, lessonId }
        : undefined;
    },
    {
      equal: (a, b) =>
        a?.id === b?.id &&
        a?.enrollmentId === b?.enrollmentId &&
        a?.lessonId === b?.lessonId,
    },
  );
  private readonly progressData = serverData(
    (context: CourseLaunch) =>
      this.client.call(scormEndpoints.progress, {
        params: { id: context.id },
        query: {
          preview: false,
          enrollmentId: context.enrollmentId,
          lessonId: context.lessonId,
        },
      }),
    { params: this.context },
  );
  private readonly launch = serverMutation(
    (context: CourseLaunch & { restart: boolean }) =>
      this.client
        .call(scormEndpoints.launch, {
          params: { id: context.id },
          body: {
            preview: false,
            restart: context.restart,
            enrollmentId: context.enrollmentId,
            lessonId: context.lessonId,
          },
        })
        .pipe(map((result) => ({ result, restart: context.restart }))),
    {
      errors: 'alert',
      onSuccess: ({ result, restart }) => {
        if (restart && result.progress.lessonStatus !== 'not attempted') {
          this.setConfigurationError(
            'Máy chủ chưa hỗ trợ đặt lại lượt SCORM. Vui lòng cập nhật BE rồi thử lại.',
          );
          return;
        }
        this.accept(result);
        if (restart) this.progressData.reload();
      },
    },
  );
  readonly url$ = this.state.url.asReadonly();
  readonly saveState$ = this.state.saveState.asReadonly();
  readonly progress$ = this.progressData.value;
  readonly requiresPass$ = computed(
    () => this.lesson.lesson$()?.lesson.scormCompletionRule === 'passed',
  );
  readonly requirement$ = computed(() =>
    this.requiresPass$()
      ? 'Điều kiện: gói SCORM phải báo Đạt bài đánh giá.'
      : 'Điều kiện: gói SCORM báo Hoàn thành hoặc Đạt bài đánh giá.',
  );
  readonly incompleteAssessment$ = computed(
    () =>
      this.requiresPass$() &&
      ['completed', 'browsed'].includes(this.progress$()?.lessonStatus ?? ''),
  );
  readonly loading$ = this.launch.isPending;
  readonly error$ = computed(
    () =>
      this.state.configurationError() ||
      this.launch.error()?.message ||
      this.progressData.error()?.message ||
      '',
  );
  readonly unsaved$ = computed(() =>
    ['saving', 'error'].includes(this.saveState$()),
  );
  readonly canRestart$ = computed(
    () =>
      (this.progress$()?.lessonStatus === 'failed' ||
        this.incompleteAssessment$()) &&
      !this.loading$() &&
      !this.unsaved$(),
  );
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const context = this.context();
      if (context) untracked(() => this.open());
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.expiryTimer));
  }
  private setUrl(value: SafeResourceUrl | null): void {
    this.state.url.set(value);
  }
  private setOrigin(value: string): void {
    this.state.origin.set(value);
  }
  private setSaveState(value: string): void {
    this.state.saveState.set(value);
  }
  private setConfigurationError(value: string): void {
    this.state.configurationError.set(value);
  }
  open(restart = false): void {
    const context = this.context();
    if (!context) return;
    clearTimeout(this.expiryTimer);
    this.setUrl(null);
    this.setSaveState('loading');
    this.setConfigurationError('');
    this.launch.run({ ...context, restart });
  }
  restart(): void {
    if (!this.canRestart$() || this.dialog.openDialogs.length) return;
    confirm(this.dialog, {
      title: 'Học lại SCORM?',
      message:
        'Bài giảng sẽ bắt đầu từ đầu. Điểm, đáp án và vị trí của lượt hiện tại được đặt lại. Bạn có thể thi lại không giới hạn số lần.',
      confirmLabel: 'Học lại',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.canRestart$()) this.open(true);
      });
  }
  retryProgress(): void {
    this.progressData.reload();
  }
  private accept(result: ScormLaunch): void {
    const url = new URL(result.launchUrl);
    const lms = new URL(window.location.href);
    const loopback = (host: string) =>
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '[::1]' ||
      host.startsWith('127.');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin === lms.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/scorm-player\/[A-Za-z0-9_-]{43}\/launch$/.test(url.pathname) ||
      (lms.protocol === 'https:' && url.protocol !== 'https:') ||
      (loopback(url.hostname) && !loopback(lms.hostname))
    ) {
      this.setConfigurationError(
        'Địa chỉ trình phát chưa phù hợp với trang học. Vui lòng liên hệ quản trị viên.',
      );
      return;
    }
    this.setOrigin(url.origin);
    this.setSaveState('saved');
    this.setUrl(this.sanitizer.bypassSecurityTrustResourceUrl(url.toString()));
    this.expiryTimer = setTimeout(
      () => this.setSaveState('expired'),
      Math.max(0, Date.parse(result.expiresAt) - Date.now()),
    );
  }
  receive(event: MessageEvent, frame: Window | null): void {
    if (this.saveState$() === 'expired') return;
    if (
      !frame ||
      event.source !== frame ||
      event.origin !== this.state.origin()
    )
      return;
    const data: unknown = event.data;
    if (
      !data ||
      typeof data !== 'object' ||
      !('type' in data) ||
      data.type !== 'scorm:state' ||
      !('state' in data) ||
      !['saved', 'saving', 'error'].includes(String(data.state))
    )
      return;
    this.setSaveState(String(data.state));
    if (data.state === 'saved') {
      this.progressData.reload();
      this.lesson.refreshScormProgress();
    }
  }
}
