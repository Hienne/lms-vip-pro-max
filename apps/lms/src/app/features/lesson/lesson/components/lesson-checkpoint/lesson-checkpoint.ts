import { Component, inject } from '@angular/core';
import {
  Alert,
  Button,
  ErrorState,
  Icon,
  OptionCard,
  SectionCard,
  Skeleton,
} from '@lms/ui';
import { LessonCheckpointStore } from './data-access/lesson-checkpoint.store';

/**
 * "Câu hỏi nhanh": up to three ungraded recall questions of the lesson, one at a time, with the
 * server's grading after each. It renders the store; skipping never holds the lesson back.
 */
@Component({
  selector: 'app-lesson-checkpoint',
  imports: [Alert, Button, ErrorState, Icon, OptionCard, SectionCard, Skeleton],
  providers: [LessonCheckpointStore],
  templateUrl: './lesson-checkpoint.html',
  styleUrl: './lesson-checkpoint.scss',
})
export class LessonCheckpoint {
  protected readonly store = inject(LessonCheckpointStore);
}
