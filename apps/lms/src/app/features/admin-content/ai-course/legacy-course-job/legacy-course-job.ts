import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Button, ErrorState, PageHeader, Skeleton } from '@lms/ui';
import { LegacyCourseJobStore } from './data-access/legacy-course-job.store';

/**
 * `/admin/courses/ai-drafts/:jobId`, kept for the links that notices and chats already carry:
 * it sends the author to the course editor, where the job is followed now.
 */
@Component({
  selector: 'app-legacy-course-job',
  imports: [Button, ErrorState, PageHeader, RouterLink, Skeleton],
  providers: [LegacyCourseJobStore],
  templateUrl: './legacy-course-job.html',
})
export class LegacyCourseJob {
  protected readonly store = inject(LegacyCourseJobStore);
  private readonly router = inject(Router);

  private readonly redirect = effect(() => {
    const path = this.store.editorPath$();
    if (path) void this.router.navigateByUrl(path, { replaceUrl: true });
  });
}
