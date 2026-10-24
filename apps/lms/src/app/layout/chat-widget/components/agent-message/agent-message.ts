import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Spinner } from '@lms/ui';
import type { AgentTurn } from '../../../../core/assistant/agent-chat.model';
import { toolStatusText } from '../../../../core/assistant/agent-status';
import { ActionCard } from '../action-card/action-card';
import { AgentSources, agentSourceId } from '../agent-sources/agent-sources';
import { answerParts } from '../../../../shared/assistant/answer-parts';
import { citationName } from '../../../../shared/assistant/citation-label';

const COMPOSING = 'Đang soạn câu trả lời…';

/** One question of the quick assistant and its reply, in whatever state the reply is. */
@Component({
  selector: 'app-agent-message',
  imports: [ActionCard, AgentSources, RouterLink, Spinner],
  templateUrl: './agent-message.html',
  styleUrl: './agent-message.scss',
})
export class AgentMessage {
  private readonly document = inject(DOCUMENT);

  readonly turn = input.required<AgentTurn>();
  /** A card is being confirmed somewhere in the conversation: one at a time. */
  readonly busy = input(false);
  readonly confirmed = output<number>();
  readonly cancelled = output<number>();

  /** The reply's text with each marker as a source number, named for a screen reader. */
  protected readonly parts = computed(() => {
    const { text, citations } = this.turn().reply;
    return answerParts(text, citations).parts.map((part) =>
      part.kind === 'text'
        ? part
        : { ...part, name: citationName(part.citation) },
    );
  });

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
