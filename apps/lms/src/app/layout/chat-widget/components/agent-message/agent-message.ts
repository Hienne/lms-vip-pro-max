import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon, IconButton, LinkButton, Spinner, Toaster } from '@lms/ui';
import type { AgentTurn } from '../../../../core/assistant/agent-chat.model';
import { toolStatusText } from '../../../../core/assistant/agent-status';
import { ActionCard } from '../action-card/action-card';
import { AgentSources, agentSourceId } from '../agent-sources/agent-sources';
import { AssistantMarkdown } from '../../../../shared/assistant/assistant-markdown/assistant-markdown';

const COMPOSING = 'Đang soạn câu trả lời…';

/** One question of the quick assistant and its reply, in whatever state the reply is. */
@Component({
  selector: 'app-agent-message',
  imports: [
    ActionCard,
    AgentSources,
    AssistantMarkdown,
    Icon,
    IconButton,
    LinkButton,
    RouterLink,
    Spinner,
  ],
  templateUrl: './agent-message.html',
  styleUrl: './agent-message.scss',
})
export class AgentMessage {
  private readonly document = inject(DOCUMENT);
  private readonly toaster = inject(Toaster);

  readonly turn = input.required<AgentTurn>();
  /** A card is being confirmed somewhere in the conversation: one at a time. */
  readonly busy = input(false);
  readonly confirmed = output<number>();
  readonly cancelled = output<number>();
  /** Another reply is streaming, so "Thử lại" waits. */
  readonly answering = input(false);
  readonly retried = output<number>();

  /** Every source of a finished reply is listed under it, whether or not the text marks it. */
  protected readonly sourcesShown = computed(() => {
    const { status, citations } = this.turn().reply;
    return (
      citations.length > 0 &&
      status !== 'waiting' &&
      status !== 'working' &&
      status !== 'composing'
    );
  });

  /**
   * The status line until the first text arrives: the tool that is running, then the answer being
   * written. The text takes its place, on the same line.
   */
  protected readonly status = computed(() => {
    const { status, text, toolName } = this.turn().reply;
    if (text) return null;
    if (status === 'composing') return COMPOSING;
    return status === 'waiting' || status === 'working'
      ? toolStatusText(toolName)
      : null;
  });

  /** Puts the answer text, without its source list, on the clipboard. */
  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.turn().reply.text);
      this.toaster.success('Đã sao chép');
    } catch {
      this.toaster.error('Không sao chép được câu trả lời');
    }
  }

  /** A number in the answer moves focus to its line in the source list, which scrolls it into view. */
  protected showSource(n: number): void {
    this.document.getElementById(agentSourceId(this.turn().id, n))?.focus();
  }

  /**
   * The page the assistant opened, as a link: in the sentence where the text names it, else on a
   * line of its own under the text.
   */
  protected readonly opened = computed(() => {
    const { navigatedTo, text } = this.turn().reply;
    if (!navigatedTo) return null;
    const at = text.indexOf(navigatedTo.title);
    return {
      path: navigatedTo.path,
      title: navigatedTo.title,
      inline: at >= 0,
      before: at >= 0 ? text.slice(0, at) : text,
      after: at >= 0 ? text.slice(at + navigatedTo.title.length) : '',
    };
  });
}
