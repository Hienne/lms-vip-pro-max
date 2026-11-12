import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RateAnswerCommand, StoredActionStatus } from '@lms/contracts';
import {
  Badge,
  Card,
  Icon,
  LinkButton,
  List,
  ListItem,
  Spinner,
} from '@lms/ui';
import { SourceViewerStore } from '../../../../../core/assistant/source-viewer.store';
import type { Turn } from '../../data-access/assistant.model';
import { AnswerFeedback } from '../../../../../shared/assistant/answer-feedback/answer-feedback';
import { AssistantMarkdown } from '../../../../../shared/assistant/assistant-markdown/assistant-markdown';
import {
  citationLocation,
  citationName,
} from '../../../../../shared/assistant/citation-label';

/** Where a change the quick assistant proposed ended, in words. */
const ACTION_STATUS: Record<StoredActionStatus, string> = {
  pending: 'đang chờ xác nhận trong Trợ lý nhanh',
  confirmed: 'đã xác nhận',
  cancelled: 'đã huỷ',
  expired: 'đã hết hạn',
  failed: 'không thực hiện được',
};

/**
 * One question and the answer to it, in whatever state the answer is. A finished answer lists its
 * sources as numbered rows (file and page) that open the cited passage.
 */
@Component({
  selector: 'app-chat-message',
  imports: [
    AnswerFeedback,
    AssistantMarkdown,
    Badge,
    Card,
    Icon,
    LinkButton,
    List,
    ListItem,
    NgTemplateOutlet,
    RouterLink,
    Spinner,
  ],
  templateUrl: './chat-message.html',
  styleUrl: './chat-message.scss',
})
export class ChatMessage {
  readonly turn = input.required<Turn>();
  readonly retry = output<number>();
  /** This turn's rating is on its way, or the last one did not save. */
  readonly ratingBusy = input(false);
  readonly ratingFailed = input(false);
  readonly rated = output<{
    readonly turnId: number;
    readonly command: RateAnswerCommand;
  }>();

  protected readonly actionStatus = ACTION_STATUS;

  /** Opens a source in the page's source pane, or the shell's drawer on a narrow screen. */
  protected readonly viewer = inject(SourceViewerStore);
  protected readonly location = citationLocation;
  protected readonly name = citationName;
}
