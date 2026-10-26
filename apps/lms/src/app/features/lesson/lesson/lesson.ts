import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  DrawerOutlet,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtPctPipe,
  Icon,
  Progress,
  Skeleton,
} from '@lms/ui';
import {
  BlockList,
  BLOCK_TYPE_LABEL,
} from './components/block-list/block-list';
import { LessonOutline } from './components/lesson-outline/lesson-outline';
import { ProcessBlock } from './components/process-block/process-block';
import { SessionAlert } from './components/session-alert/session-alert';
import { TextBlock } from './components/text-block/text-block';
import { LessonStore } from './data-access/lesson.store';

/** The lesson player (the mockup's `lesson` page): one active block at a time, saved as it is studied. */
@Component({
  selector: 'app-lesson',
  imports: [
    BlockList,
    Button,
    DrawerOutlet,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtPctPipe,
    Icon,
    LessonOutline,
    ProcessBlock,
    Progress,
    RouterLink,
    SessionAlert,
    Skeleton,
    TextBlock,
  ],
  providers: [LessonStore],
  templateUrl: './lesson.html',
  styleUrl: './lesson.scss',
})
export class Lesson {
  protected readonly store = inject(LessonStore);
  protected readonly typeLabel = BLOCK_TYPE_LABEL;

  /** The page the focus bar and every dead end lead back to. */
  protected readonly courseLink = computed(() => {
    const id = this.store.courseId$();
    return id === undefined ? '/catalog' : `/course/${id}`;
  });

  protected readonly minutes = computed(() =>
    Math.round(
      (this.store.lesson$()?.lesson.estimatedDurationSeconds ?? 0) / 60,
    ),
  );

  /** A file the player loads needs this tab to hold the session (the media cookie). */
  protected readonly mediaWaiting = computed(
    () => this.store.phase$() !== 'ready',
  );
}
