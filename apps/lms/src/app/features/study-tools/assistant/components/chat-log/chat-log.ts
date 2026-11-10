import {
  afterRenderEffect,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { RateAnswerCommand } from '@lms/contracts';
import type { Turn } from '../../data-access/assistant.model';
import { ChatMessage } from '../chat-message/chat-message';

/** The conversation so far, starting with the assistant's opening line; it follows the newest text. */
@Component({
  selector: 'app-chat-log',
  imports: [ChatMessage],
  templateUrl: './chat-log.html',
  styleUrl: './chat-log.scss',
})
export class ChatLog {
  readonly turns = input.required<readonly Turn[]>();
  readonly retry = output<number>();
  /** The turn whose rating is on its way, and the one whose last rating did not save. */
  readonly ratingId = input<number | null>(null);
  readonly ratingFailedId = input<number | null>(null);
  readonly rated = output<{
    readonly turnId: number;
    readonly command: RateAnswerCommand;
  }>();

  private readonly end = viewChild.required<ElementRef<HTMLElement>>('end');

  constructor() {
    afterRenderEffect(() => {
      // Read on every change of the turns, so streamed text keeps the newest line in view.
      if (this.turns().length === 0) return;
      this.end().nativeElement.scrollIntoView?.({ block: 'nearest' });
    });
  }
}
