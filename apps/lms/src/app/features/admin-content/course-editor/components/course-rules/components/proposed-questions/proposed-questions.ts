import { Component, inject } from '@angular/core';
import {
  Alert,
  AlertAction,
  Button,
  Card,
  SectionCard,
  Spinner,
} from '@lms/ui';
import { ProposedQuestionsStore } from './data-access/proposed-questions.store';

const DIFFICULTY: Readonly<Record<string, string>> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
};

/**
 * The questions the AI proposed, by lesson, at the top of step 3. "Chấp nhận" adds a question to
 * the question bank at once; "Từ chối" drops the proposal. Nothing shows for a course the AI did
 * not start. The store owns the state; the server keeps every decision.
 */
@Component({
  selector: 'app-proposed-questions',
  imports: [Alert, AlertAction, Button, Card, SectionCard, Spinner],
  providers: [ProposedQuestionsStore],
  templateUrl: './proposed-questions.html',
  styleUrl: './proposed-questions.scss',
})
export class ProposedQuestions {
  protected readonly store = inject(ProposedQuestionsStore);

  protected readonly difficulty = (value: string): string =>
    DIFFICULTY[value] ?? value;
}
