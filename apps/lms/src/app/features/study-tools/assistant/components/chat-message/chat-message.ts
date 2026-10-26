import { Component, computed, input, output } from '@angular/core';
import { LinkButton, Spinner } from '@lms/ui';
import type { Turn } from '../../data-access/assistant.model';
import { answerParts } from '../../../../../shared/assistant/answer-parts';
import { SourceBadge } from '../../../../../shared/assistant/source-badge/source-badge';

/** One question and the answer to it, in whatever state the answer is. */
@Component({
  selector: 'app-chat-message',
  imports: [LinkButton, SourceBadge, Spinner],
  templateUrl: './chat-message.html',
  styleUrl: './chat-message.scss',
})
export class ChatMessage {
  readonly turn = input.required<Turn>();
  readonly retry = output<number>();

  /** The answer's text with its markers as source badges, and the sources no marker points at. */
  protected readonly content = computed(() => {
    const { text, citations } = this.turn().answer;
    return answerParts(text, citations);
  });
}
