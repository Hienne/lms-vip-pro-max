import { Dialog } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EXTERNAL_MCP_PATH,
  externalConnectionEndpoints,
  type CreatedExternalConnection,
  type CreateExternalConnectionCommand,
  type ExternalConnection,
} from '@lms/contracts';
import { confirm, Toaster } from '@lms/ui';
import { filter } from 'rxjs';
import { copyText } from '../../../core/browser/secure-context';
import { invalidation } from '../../../core/data-access/invalidation';
import { serverData } from '../../../core/data-access/server-data';
import { serverMutation } from '../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../core/http/endpoint-client';
import { SessionStore } from '../../../core/session/session.store';

/** The name Claude Code lists the server under (`claude mcp list`). */
export const MCP_SERVER_NAME = 'chan-academy';

/**
 * The header's "Kết nối trợ lý ngoài" panel: whether the button shows (the server's flag and the
 * caller's roles, read from `status`), the caller's connections, creating one, and revoking one.
 * A new token lives only in this store until the panel closes: the server never sends it again.
 */
@Injectable()
export class ExternalAssistantStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly toaster = inject(Toaster);
  private readonly destroyRef = inject(DestroyRef);
  private readonly origin = inject(DOCUMENT).location.origin;

  // 1. State
  private readonly state = {
    open: signal(false),
    created: signal<CreatedExternalConnection | null>(null),
  };

  // 2. Resources
  private readonly changes = invalidation();

  /** Asked once per signed-in user who has the assistant at all; the server decides the rest. */
  private readonly statusData = serverData(
    (_userId: string) => this.client.call(externalConnectionEndpoints.status),
    {
      params: () =>
        this.session.menus$().includes('AI_ASSISTANT')
          ? this.session.user$()?.userId
          : undefined,
    },
  );

  private readonly listData = serverData(
    (_: true) => this.client.call(externalConnectionEndpoints.list),
    {
      params: () => (this.state.open() && this.available$() ? true : undefined),
      reloadOn: this.changes,
    },
  );

  private readonly createMutation = serverMutation(
    (command: CreateExternalConnectionCommand) =>
      this.client.call(externalConnectionEndpoints.create, { body: command }),
    {
      errors: 'alert',
      onSuccess: (created) => this.setCreated(created),
      invalidates: this.changes,
    },
  );

  private readonly revokeMutation = serverMutation(
    (connectionId: number) =>
      this.client.call(externalConnectionEndpoints.revoke, {
        params: { connectionId },
      }),
    {
      errors: 'toast',
      success: () => 'Đã thu hồi kết nối',
      invalidates: this.changes,
    },
  );

  // 3. Selectors
  readonly open$ = this.state.open.asReadonly();
  readonly created$ = this.state.created.asReadonly();

  /** The button shows: the feature is on and the caller may draft with the assistant now. */
  readonly available$ = computed(() => {
    const status = this.statusData.value();
    return !!status?.enabled && status.allowed;
  });
  readonly connections$ = computed<readonly ExternalConnection[]>(
    () => this.listData.value() ?? [],
  );
  readonly isLoading$ = this.listData.isLoading;
  readonly loadError$ = this.listData.error;
  readonly isCreating$ = this.createMutation.isPending;
  readonly createError$ = this.createMutation.error;
  readonly isRevoking$ = this.revokeMutation.isPending;

  /** The endpoint the token works on, on this app's own origin (the proxy sends it to the backend). */
  readonly endpointUrl$ = computed(() => `${this.origin}${EXTERNAL_MCP_PATH}`);

  /** What the author pastes in a terminal to add the connection to Claude Code. */
  readonly command$ = computed(() => {
    const created = this.created$();
    return created
      ? `claude mcp add --transport http ${MCP_SERVER_NAME} ${this.endpointUrl$()} --header "Authorization: Bearer ${created.token}"`
      : null;
  });

  // 4. Setters
  setOpen(open: boolean): void {
    this.state.open.set(open);
  }

  setCreated(created: CreatedExternalConnection | null): void {
    this.state.created.set(created);
  }

  // 5. Commands
  openPanel(): void {
    this.createMutation.reset();
    this.setOpen(true);
  }

  /** Closing forgets the new token for good. */
  closePanel(): void {
    this.setCreated(null);
    this.createMutation.reset();
    this.setOpen(false);
  }

  create(command: CreateExternalConnectionCommand): void {
    this.createMutation.run(command);
  }

  /** Back to the list and the form after reading the token. */
  doneWithToken(): void {
    this.setCreated(null);
  }

  revoke(connection: ExternalConnection): void {
    confirm(this.dialog, {
      title: 'Thu hồi kết nối này?',
      message: `Trợ lý ngoài dùng kết nối “${connection.name}” sẽ không gọi được nữa, ngay lập tức. Không hoàn tác được.`,
      confirmLabel: 'Thu hồi',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.revokeMutation.run(connection.id));
  }

  async copy(text: string, what: string): Promise<void> {
    if (await copyText(text)) this.toaster.success(`Đã sao chép ${what}`);
    else
      this.toaster.error(
        'Không sao chép được',
        'Hãy chọn và sao chép thủ công.',
      );
  }

  retryLoad(): void {
    this.listData.reload();
  }
}
