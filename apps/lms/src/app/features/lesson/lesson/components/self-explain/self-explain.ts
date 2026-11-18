import { Component, inject } from '@angular/core';
import { Alert, Button, Field, Icon, SectionCard, Textarea } from '@lms/ui';
import { AssistantMarkdown } from '../../../../../shared/assistant/assistant-markdown/assistant-markdown';
import { SelfExplainStore } from './data-access/self-explain.store';

/**
 * "Giải thích lại bằng lời của bạn": a textarea for the learner's own summary, the assistant's
 * three-section feedback as it streams in, and a way to keep the summary as a note. It renders the
 * store; the server writes the feedback.
 */
@Component({
  selector: 'app-self-explain',
  imports: [
    Alert,
    AssistantMarkdown,
    Button,
    Field,
    Icon,
    SectionCard,
    Textarea,
  ],
  providers: [SelfExplainStore],
  templateUrl: './self-explain.html',
  styleUrl: './self-explain.scss',
})
export class SelfExplain {
  protected readonly store = inject(SelfExplainStore);

  protected onInput(event: Event): void {
    this.store.setText((event.target as HTMLTextAreaElement).value);
  }
}
