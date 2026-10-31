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
} from '@lms/ui';
import { QuizCard } from '../../../shared/quiz/quiz-card/quiz-card';
import { AttachmentBlock } from './components/attachment-block/attachment-block';
import { BlockList } from './components/block-list/block-list';
import { ImageBlock } from './components/image-block/image-block';
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
    LessonOutline,
    PdfBlock,
    ProcessBlock,
    Progress,
    QuizCard,
    RouterLink,
    SessionAlert,
    Skeleton,
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

  protected readonly minutes = computed(() =>
    Math.round(
      (this.store.lesson$()?.lesson.estimatedDurationSeconds ?? 0) / 60,
    ),
  );
}
