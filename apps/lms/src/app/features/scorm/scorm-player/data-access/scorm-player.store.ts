import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { scormEndpoints, type ScormLaunch } from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';

@Injectable()
export class ScormPlayerStore {
  private readonly client = inject(EndpointClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly id$ = computed(() => Number(this.params().get('id')));
  readonly preview$ = computed(() => this.query().get('preview') === 'true');
  private readonly state = {
    url: signal<SafeResourceUrl | null>(null),
    origin: signal(''),
    saveState: signal('saved'),
    expires: signal(''),
  };
  private readonly packageData = serverData(
    (id) => this.client.call(scormEndpoints.get, { params: { id } }),
    { params: this.id$ },
  );
  private readonly progressData = serverData(
    (input) =>
      this.client.call(scormEndpoints.progress, {
        params: { id: input.id },
        query: { preview: input.preview },
      }),
    { params: () => ({ id: this.id$(), preview: this.preview$() }) },
  );
  private readonly launchMutation = serverMutation(
    (input: { id: number; preview: boolean }) =>
      this.client.call(scormEndpoints.launch, {
        params: { id: input.id },
        body: { preview: input.preview },
      }),
    { errors: 'alert', onSuccess: (result) => this.acceptLaunch(result) },
  );
  readonly package$ = this.packageData.value;
  readonly packageError$ = this.packageData.error;
  readonly progress$ = this.progressData.value;
  readonly progressError$ = this.progressData.error;
  readonly launching$ = this.launchMutation.isPending;
  readonly launchError$ = this.launchMutation.error;
  readonly url$ = this.state.url.asReadonly();
  readonly expires$ = this.state.expires.asReadonly();
  readonly saveState$ = this.state.saveState.asReadonly();
  readonly backLink$ = computed(() =>
    this.preview$() ? '/admin/lessons' : '/scorm',
  );
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  constructor() {
    effect(() => {
      const id = this.id$(),
        preview = this.preview$();
      this.open(id, preview);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.expiryTimer));
  }
  open(id = this.id$(), preview = this.preview$()): void {
    this.state.url.set(null);
    this.state.saveState.set('saved');
    this.launchMutation.run({ id, preview });
  }
  receive(event: MessageEvent, frame: Window | null): void {
    if (
      !frame ||
      event.source !== frame ||
      event.origin !== this.state.origin()
    )
      return;
    const data = event.data as unknown;
    if (
      !data ||
      typeof data !== 'object' ||
      !('type' in data) ||
      data.type !== 'scorm:state' ||
      !('state' in data)
    )
      return;
    if (!['saved', 'saving', 'error'].includes(String(data.state))) return;
    this.state.saveState.set(String(data.state));
    if (data.state === 'saved') this.progressData.reload();
  }
  retryProgress(): void {
    this.progressData.reload();
  }
  private acceptLaunch(launch: ScormLaunch): void {
    const url = new URL(launch.launchUrl);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.origin === window.location.origin ||
      url.username ||
      url.password ||
      !/^\/scorm-player\/[A-Za-z0-9_-]{43}\/launch$/.test(url.pathname)
    ) {
      throw new Error(
        'Player SCORM cần một origin HTTP(S) riêng với LMS. Kiểm tra SCORM_PLAYER_ORIGIN.',
      );
    }
    this.state.origin.set(url.origin);
    this.state.expires.set(launch.expiresAt);
    this.state.url.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(url.toString()),
    );
    clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(
      () => this.state.saveState.set('expired'),
      Math.max(0, new Date(launch.expiresAt).getTime() - Date.now()),
    );
  }
}
