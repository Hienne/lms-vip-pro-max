import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Spinner } from '@lms/ui';
import type { AgentTurn } from '../../../../core/assistant/agent-chat.model';
import { toolStatusText } from '../../../../core/assistant/agent-status';
import { answerParts } from '../../../../shared/assistant/answer-parts';
import { SourceBadge } from '../../../../shared/assistant/source-badge/source-badge';

/** One question of the quick assistant and its reply, in whatever state the reply is. */
@Component({
  selector: 'app-agent-message',
  imports: [RouterLink, SourceBadge, Spinner],
  templateUrl: './agent-message.html',
  styleUrl: './agent-message.scss',
})
export class AgentMessage {
  readonly turn = input.required<AgentTurn>();

  /** The reply's text with its markers as source badges, and the sources no marker points at. */
  protected readonly content = computed(() => {
    const { text, citations } = this.turn().reply;
    return answerParts(text, citations);
  });

  /** The status line while the reply has no text yet: the tool that is running. */
  protected readonly status = computed(() => {
    const { status, text, toolName } = this.turn().reply;
    const busy = status === 'waiting' || status === 'working';
    return busy && !text ? toolStatusText(toolName) : null;
  });

  /** The text around the page title, which links to the page the assistant opened. */
  protected readonly opened = computed(() => {
    const { navigatedTo, text } = this.turn().reply;
    if (!navigatedTo) return null;
    const at = text.indexOf(navigatedTo.title);
    if (at < 0) return null;
    return {
      path: navigatedTo.path,
      title: navigatedTo.title,
      before: text.slice(0, at),
      after: text.slice(at + navigatedTo.title.length),
    };
  });
}
