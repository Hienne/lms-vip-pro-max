import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Card,
  CardBody,
  DrawerOutlet,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtPctPipe,
  Icon,
  Progress,
  Skeleton,
  TabPanel,
  Tabs,
} from '@lms/ui';
import { QuizCard } from '../../../shared/quiz/quiz-card/quiz-card';
import { AttachmentBlock } from './components/attachment-block/attachment-block';
import { BlockList } from './components/block-list/block-list';
import { ImageBlock } from './components/image-block/image-block';
import { LessonFeedback } from './components/lesson-feedback/lesson-feedback';
import { LessonNotes } from './components/lesson-notes/lesson-notes';
import { LessonOutline } from './components/lesson-outline/lesson-outline';
import { PdfBlock } from './components/pdf-block/pdf-block';
import { ProcessBlock } from './components/process-block/process-block';
import { SessionAlert } from './components/session-alert/session-alert';
import { TextBlock } from './components/text-block/text-block';
import { VideoBlock } from './components/video-block/video-block';
import { LessonStore } from './data-access/lesson.store';

/** The lesson player (the mockup's `lesson` page): one active block at a time, saved as it is studied. */
@Component({
  selector: 'app-lesson',
  imports: [
    AttachmentBlock,
    BlockList,
    Button,
    Card,
    CardBody,
    DrawerOutlet,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtPctPipe,
    Icon,
    ImageBlock,
    LessonFeedback,
    LessonNotes,
    LessonOutline,
    NgTemplateOutlet,
    PdfBlock,
    ProcessBlock,
    Progress,
    QuizCard,
    RouterLink,
    SessionAlert,
    Skeleton,
    TabPanel,
    Tabs,
    TextBlock,
    VideoBlock,
  ],
  providers: [LessonStore],
  templateUrl: './lesson.html',
  styleUrl: './lesson.scss',
})
export class Lesson {
  protected readonly store = inject(LessonStore);

  private readonly video = viewChild(VideoBlock);

  /** Hands the store the player on screen, so leaving the block closes the range being watched. */
  private readonly watchVideo = effect(() => {
    const video = this.video();
    this.store.watchVideo(video ? () => video.currentPosition() : undefined);
  });

  /** The page the focus bar and every dead end lead back to. */
  protected readonly courseLink = computed(() => {
    const id = this.store.courseId$();
    return id === undefined ? '/catalog' : `/course/${id}`;
  });

  /** The side panel's tabs; the notes carry their count once read. */
  protected readonly sideTabs = computed(() => [
    { id: 'outline', label: 'Mục lục' },
    { id: 'notes', label: 'Ghi chú', count: this.store.noteCount$() },
  ]);

  protected readonly minutes = computed(() =>
    Math.round(
      (this.store.lesson$()?.lesson.estimatedDurationSeconds ?? 0) / 60,
    ),
  );
}
