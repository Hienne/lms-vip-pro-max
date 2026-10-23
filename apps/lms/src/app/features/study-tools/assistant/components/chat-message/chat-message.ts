import { Component, input, output } from '@angular/core';
import { LinkButton, Spinner } from '@lms/ui';
import type { Turn } from '../../data-access/assistant.model';
import { CitationList } from '../citation-list/citation-list';

/** One question and the answer to it, in whatever state the answer is. */
@Component({
  selector: 'app-chat-message',
  imports: [CitationList, LinkButton, Spinner],
  templateUrl: './chat-message.html',
  styleUrl: './chat-message.scss',
})
export class ChatMessage {
  readonly turn = input.required<Turn>();
  readonly retry = output<number>();
}
