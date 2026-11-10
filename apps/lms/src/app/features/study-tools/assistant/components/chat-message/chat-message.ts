import { Component, computed, input, output } from '@angular/core';
import type { StoredActionStatus } from '@lms/contracts';
import { LinkButton, Spinner } from '@lms/ui';
import type { Turn } from '../../data-access/assistant.model';
import { answerParts } from '../../../../../shared/assistant/answer-parts';
import { AssistantMarkdown } from '../../../../../shared/assistant/assistant-markdown/assistant-markdown';
import { SourceBadge } from '../../../../../shared/assistant/source-badge/source-badge';

/** Where a change the quick assistant proposed ended, in words. */
const ACTION_STATUS: Record<StoredActionStatus, string> = {
  pending: 'đang chờ xác nhận trong Trợ lý nhanh',
  confirmed: 'đã xác nhận',
  cancelled: 'đã huỷ',
  expired: 'đã hết hạn',
  failed: 'không thực hiện được',
};

/** One question and the answer to it, in whatever state the answer is. */
@Component({
  selector: 'app-chat-message',
  imports: [AssistantMarkdown, LinkButton, SourceBadge, Spinner],
  templateUrl: './chat-message.html',
  styleUrl: './chat-message.scss',
})
export class ChatMessage {
  readonly turn = input.required<Turn>();
  readonly retry = output<number>();

  protected readonly actionStatus = ACTION_STATUS;

  /** The answer's text with its markers as source badges, and the sources no marker points at. */
  protected readonly content = computed(() => {
    const { text, citations } = this.turn().answer;
    return answerParts(text, citations);
  });
}
