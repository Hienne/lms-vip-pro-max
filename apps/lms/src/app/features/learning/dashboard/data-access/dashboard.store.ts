import { computed, inject, Injectable, signal } from '@angular/core';
import { learningDashboardEndpoints } from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import type { CourseCardView } from '../../../../shared/course/course-card';

@Injectable()
export class DashboardStore {
  private readonly client = inject(EndpointClient);
  private readonly changes = inject(LearningChanges);
  private readonly state = { tab: signal('inProgress') };
  private readonly data = serverData(
    () => this.client.call(learningDashboardEndpoints.dashboard),
    { reloadOn: this.changes.results },
  );
  readonly dashboard$ = this.data.value;
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;
  readonly tab$ = this.state.tab.asReadonly();
  readonly courses$ = computed(() => {
    const items = this.dashboard$()?.cards ?? [];
    const tab = this.tab$();
    if (tab === 'required') return items.filter((item) => item.required);
    if (tab === 'assigned') return items.filter((item) => item.assigned);
    if (tab === 'notStarted')
      return items.filter((item) => item.status === 'not_started');
    if (tab === 'completed')
      return items.filter((item) => item.status === 'completed');
    return items.filter(
      (item) => item.status === 'in_progress' || item.status === 'failed',
    );
  });
  readonly firstName$ = computed(
    () => this.dashboard$()?.user.name.split(' ').at(-1) ?? 'bạn',
  );
  readonly today$ = computed(() => {
    const data = this.dashboard$();
    return data
      ? new Date(data.serverNow).toLocaleDateString('vi-VN', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';
  });
  readonly greeting$ = computed(() => {
    const data = this.dashboard$();
    return data?.counts.overdue
      ? `Bạn có ${data.counts.overdue} khóa đã quá hạn — ưu tiên hoàn thành sớm nhé.`
      : data?.deadlines.length
        ? `Khóa gần hạn nhất: “${data.deadlines[0].title}”.`
        : 'Bạn đã theo kịp toàn bộ lộ trình được giao.';
  });
  readonly tabs$ = computed(() => {
    const counts = this.dashboard$()?.counts;
    return [
      { id: 'inProgress', label: 'Đang học', count: counts?.inProgress },
      { id: 'notStarted', label: 'Chưa bắt đầu', count: counts?.notStarted },
      { id: 'completed', label: 'Đã hoàn thành', count: counts?.completed },
      { id: 'required', label: 'Bắt buộc', count: counts?.required },
      { id: 'assigned', label: 'Được giao', count: counts?.assigned },
    ];
  });
  readonly hasCompetency$ = computed(
    () => this.dashboard$()?.competency.some((x) => x.answered > 0) ?? false,
  );
  readonly cards$ = computed((): readonly CourseCardView[] =>
    this.courses$().map((course) => ({
      id: course.id,
      title: course.title,
      required: course.required,
      cover: 'layers',
      domain: course.domainName,
      module: course.code,
      lessons: course.total,
      pct: course.pct,
      status: course.status,
      statusLabel: {
        not_started: 'Chưa bắt đầu',
        in_progress: 'Đang học',
        completed: 'Đã hoàn thành',
        failed: 'Chưa đạt',
      }[course.status],
      overdue: course.overdue,
      dueAt: course.dueAt,
      link: `/course/${course.id}`,
    })),
  );
  setTab(tab: string): void {
    this.state.tab.set(tab);
  }
  retry(): void {
    this.data.reload();
  }
}
