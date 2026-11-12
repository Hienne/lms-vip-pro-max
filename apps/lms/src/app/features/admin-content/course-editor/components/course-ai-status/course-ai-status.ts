import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, inject, input } from '@angular/core';
import { Alert, AlertAction, Button, confirm, Icon, Spinner } from '@lms/ui';
import { firstValueFrom } from 'rxjs';
import { CourseAiJobStore } from '../../data-access/course-ai-job.store';

const FAILED_AT: Readonly<Record<string, string>> = {
  summarise_sections: 'AI không đọc được tài liệu nguồn',
  outline: 'AI không tạo được dàn ý',
  lesson: 'AI không viết được một số bài học',
};

/**
 * What the AI is doing for the open course, at the top of step 2: the status line from the job,
 * "Duyệt dàn ý và viết bài" once the outline is ready, "Dừng tạo bằng AI" while it runs, and the
 * failure with "Thử lại" at the step that failed. The job and its state belong to the store.
 */
@Component({
  selector: 'app-course-ai-status',
  imports: [Alert, AlertAction, Button, Icon, Spinner],
  templateUrl: './course-ai-status.html',
  styleUrl: './course-ai-status.scss',
})
export class CourseAiStatus {
  protected readonly ai = inject(CourseAiJobStore);
  private readonly dialog = inject(Dialog);

  /** The draft has changes not saved yet: the server approves the saved outline, not the form. */
  readonly unsaved = input(false);

  protected readonly failure = computed(() => {
    const job = this.ai.job$();
    // A failed question step is shown where the questions are (step 3).
    if (this.ai.phase$() !== 'failed' || job?.step === 'questions') return null;
    return {
      heading:
        FAILED_AT[job?.step ?? ''] ?? 'AI không hoàn thành việc tạo khóa học',
      message: job?.error ?? 'Hãy thử lại sau ít phút.',
    };
  });

  protected readonly approveBlocked = computed(
    () => this.ai.isBusy$() || this.unsaved(),
  );

  protected async stop(): Promise<void> {
    const confirmed = await firstValueFrom(
      confirm(this.dialog, {
        title: 'Dừng tạo bằng AI?',
        message:
          'Các bài AI đã viết được giữ lại. Bài chưa viết trở thành bài trống để bạn tự điền.',
        confirmLabel: 'Dừng tạo',
        tone: 'danger',
      }),
    );
    if (confirmed) this.ai.stop();
  }
}
