import { computed, inject, Injectable, signal } from '@angular/core';
import { externalConnectionEndpoints } from '@lms/contracts';
import { Toaster } from '@lms/ui';
import { copyText } from '../../../../core/browser/secure-context';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/** The name Claude Code lists the server under (`claude mcp list`). */
export const MCP_SERVER_NAME = 'chan-academy';

/** The guide's tabs: one per supported client. */
export type GuideTab = 'claude-app' | 'claude-code';

/**
 * The "Kết nối trợ lý ngoài" guide (ADR 0005): whether the caller may connect at all (the server's
 * flag and their roles, from `status`), the one URL a client needs, and the Claude Code command.
 */
@Injectable()
export class GuideStore {
  private readonly client = inject(EndpointClient);
  private readonly toaster = inject(Toaster);

  // 1. State
  private readonly state = {
    tab: signal<GuideTab>('claude-app'),
  };

  // 2. Resources
  private readonly statusData = serverData(() =>
    this.client.call(externalConnectionEndpoints.status),
  );

  // 3. Selectors
  readonly tab$ = this.state.tab.asReadonly();
  readonly isLoading$ = this.statusData.isLoading;
  readonly loadError$ = this.statusData.error;
  /** The feature is on and the caller may connect now; otherwise the page says they may not. */
  readonly available$ = computed(() => {
    const status = this.statusData.value();
    return !!status?.enabled && status.allowed;
  });

  /** The MCP URL the server names: the one resource its OAuth grants, whatever origin this page is on. */
  readonly mcpUrl$ = computed(() => this.statusData.value()?.mcpUrl ?? '');
  readonly claudeCodeCommand$ = computed(
    () =>
      `claude mcp add --transport http ${MCP_SERVER_NAME} ${this.mcpUrl$()}`,
  );
  readonly removeCommand = `claude mcp remove ${MCP_SERVER_NAME}`;

  // 4. Setters
  setTab(tab: GuideTab): void {
    this.state.tab.set(tab);
  }

  // 5. Commands
  selectTab(tab: string): void {
    if (tab === 'claude-app' || tab === 'claude-code') this.setTab(tab);
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
    this.statusData.reload();
  }
}
