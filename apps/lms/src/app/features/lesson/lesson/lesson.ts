import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, viewChild } from '@angular/core';
import { OPEN_PAGE_GUIDE } from '../../../core/routing/page-guide-action';
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
  IconButton,
  Menu,
  type MenuEntry,
  Progress,
  Skeleton,
  Stat,
  StatStrip,
  TabPanel,
  Tabs,
  PageHeader,
  SectionCard,
} from '@lms/ui';
import { QuizCard } from '../../../shared/quiz/quiz-card/quiz-card';
import { AttachmentBlock } from './components/attachment-block/attachment-block';
import { BlockList } from './components/block-list/block-list';
import { ImageBlock } from './components/image-block/image-block';
import { LessonCheckpoint } from './components/lesson-checkpoint/lesson-checkpoint';
import { SelfExplain } from './components/self-explain/self-explain';
import { LessonFeedback } from './components/lesson-feedback/lesson-feedback';
import { LessonNotes } from './components/lesson-notes/lesson-notes';
import { LessonOutline } from './components/lesson-outline/lesson-outline';
import { PdfBlock } from './components/pdf-block/pdf-block';
import { ProcessBlock } from './components/process-block/process-block';
import { SessionAlert } from './components/session-alert/session-alert';
import { TextBlock } from './components/text-block/text-block';
import { VideoBlock } from './components/video-block/video-block';
import { AgentChatStore } from '../../../core/assistant/agent-chat.store';
import { LessonStore } from './data-access/lesson.store';
import { ScormBlock } from './components/scorm-block/scorm-block';

/** The lesson player (the mockup's `lesson` page): one active block at a time, saved as it is studied. */
@Component({
  selector: 'app-lesson',
  imports: [
    ScormBlock,
    SectionCard,
    PageHeader,
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
    IconButton,
    ImageBlock,
    LessonCheckpoint,
    SelfExplain,
    LessonFeedback,
    LessonNotes,
    LessonOutline,
    Menu,
    NgTemplateOutlet,
    PdfBlock,
    ProcessBlock,
    Progress,
    QuizCard,
    RouterLink,
    SessionAlert,
    Skeleton,
    Stat,
    StatStrip,
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
  protected readonly openPageGuide = inject(OPEN_PAGE_GUIDE, {
    optional: true,
  });

  protected readonly agent = inject(AgentChatStore);

  private readonly video = viewChild(VideoBlock);
  private readonly scorm = viewChild(ScormBlock);

  hasUnsavedChanges(): boolean {
    return this.scorm()?.hasUnsavedChanges() ?? false;
  }

  leaveMessage(): string | undefined {
    return this.hasUnsavedChanges()
      ? 'Tiến độ SCORM chưa được lưu xong. Bạn có muốn rời bài học?'
      : undefined;
  }

  /** The lesson as the assistant is told about it; null until the lesson and its revision are read. */
  private readonly assistContext = computed(() => {
    const lesson = this.store.lesson$()?.lesson;
    const courseId = this.store.courseId$();
    const revisionId = this.store.detail$()?.content.revision.id;
    if (!lesson || courseId === undefined || revisionId === undefined) {
      return null;
    }
    const course = this.store.card$()?.title;
    return {
      courseId,
      revisionId,
      lessonId: lesson.id,
      label: course ? `${course} › ${lesson.title}` : lesson.title,
    };
  });

  /** The assistant shortcuts show once the lesson is read and the user has the assistant. */
  protected readonly canAsk = computed(
    () => this.agent.available$() && this.assistContext() !== null,
  );

  /** The assistant menu in the bar: one trigger for both shortcuts, so the bar fits a phone. */
  protected readonly assistEntries: readonly MenuEntry<'ask' | 'summarise'>[] =
    [
      { kind: 'item', value: 'ask', label: 'Hỏi về bài này', icon: 'sparkles' },
      {
        kind: 'item',
        value: 'summarise',
        label: 'Tóm tắt bài này',
        icon: 'file-text',
      },
    ];

  protected assist(choice: 'ask' | 'summarise'): void {
    if (choice === 'ask') this.askAssistant();
    else this.summarise();
  }

  /** Opens the quick chat on this lesson; the server checks the user may read it. */
  protected askAssistant(): void {
    const context = this.assistContext();
    if (context) this.agent.askAboutLesson(context, 'Bài này nói gì?');
  }

  /** Same path, with the summarise skill. */
  protected summarise(): void {
    const context = this.assistContext();
    if (context) {
      this.agent.askAboutLesson(context, 'Tóm tắt bài này', 'tom_tat_bai');
    }
  }

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
    { id: 'review', label: 'Tự kiểm tra' },
  ]);

  protected readonly minutes = computed(() =>
    Math.round(
      (this.store.lesson$()?.lesson.estimatedDurationSeconds ?? 0) / 60,
    ),
  );
}
