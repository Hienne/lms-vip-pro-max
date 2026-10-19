import { Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Empty,
  ErrorState,
  Input,
  Select,
  PageHeader,
  Spinner,
} from '@lms/ui';
import { AssessmentScreenStore } from './data-access/assessment-screen.store';
import type { SaveQuestion, SaveQuizConfig } from '@lms/contracts';

@Component({
  selector: 'app-assessment-screen',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    Alert,
    Badge,
    Button,
    Card,
    Checkbox,
    Empty,
    ErrorState,
    Input,
    Select,
    PageHeader,
    Spinner,
  ],
  providers: [AssessmentScreenStore],
  templateUrl: './assessment-screen.html',
  styleUrl: './assessment-screen.scss',
})
export class AssessmentScreen {
  protected readonly store = inject(AssessmentScreenStore);
  protected readonly options = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  protected questionSubmit(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const optionText = String(data.get('options') ?? '')
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);
    const opts = optionText.map((text, index) => ({
      id: `o${index + 1}`,
      text,
    }));
    const answers = String(data.get('correct') ?? '')
      .split(',')
      .map((value) => Number(value.trim()) - 1)
      .filter((index) => index >= 0 && index < opts.length)
      .map((index) => opts[index].id);
    const type = String(data.get('type') ?? 'single') as 'single' | 'multiple';
    const draft = this.store.questionDraft$();
    const command: SaveQuestion = {
      code: String(data.get('code') ?? ''),
      text: String(data.get('text') ?? ''),
      type,
      options: opts,
      correctOptionIds: answers,
      explanation: String(data.get('explanation') ?? ''),
      difficulty: String(
        data.get('difficulty') ?? 'medium',
      ) as SaveQuestion['difficulty'],
      domainId: String(data.get('domainId') ?? 'd-cif'),
      lessonId: String(data.get('lessonId') ?? '') || null,
      competency: String(data.get('competency') ?? ''),
      status: draft?.status ?? 'active',
    };
    this.store.saveQuestion(command, draft?.id);
    form.reset();
    this.store.editQuestion(null);
  }
  protected quizSubmit(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const ids = [
      ...form.querySelectorAll<HTMLInputElement>(
        'input[name="questionIds"]:checked',
      ),
    ].map((input) => input.value);
    const command: SaveQuizConfig = {
      title: String(data.get('title') ?? ''),
      courseId: String(data.get('courseId') ?? 'c1'),
      status: 'published',
      source: String(data.get('source') ?? 'manual') as 'manual' | 'random',
      questionIds: ids,
      questionCount: Number(data.get('questionCount') ?? ids.length),
      minutes: Number(data.get('minutes') ?? 15),
      passPct: Number(data.get('passPct') ?? 80),
      maxAttempts: Number(data.get('maxAttempts') ?? 3),
      retakeWaitHours: Number(data.get('retakeWaitHours') ?? 0),
      shuffleQuestions: data.has('shuffleQuestions'),
      shuffleOptions: data.has('shuffleOptions'),
      openAt: new Date(String(data.get('openAt'))).toISOString(),
      closeAt: new Date(String(data.get('closeAt'))).toISOString(),
      reviewPolicy: String(
        data.get('reviewPolicy') ?? 'after_submit',
      ) as SaveQuizConfig['reviewPolicy'],
    };
    this.store.saveQuiz(
      command,
      this.store.routeId$() === 'new' ? undefined : this.store.routeId$(),
    );
  }
  protected toggleOption(
    questionId: string,
    optionId: string,
    checked: boolean,
    multiple: boolean,
  ): void {
    const current = this.store.snapshot$()?.attempt.answers[questionId] ?? [];
    const next = multiple
      ? checked
        ? [...new Set([...current, optionId])]
        : current.filter((id) => id !== optionId)
      : [optionId];
    this.store.selectAnswer(questionId, next);
  }
  protected deleteQuestion(id: string): void {
    if (window.confirm('Xóa câu hỏi này?')) this.store.deleteQuestion(id);
  }
}
