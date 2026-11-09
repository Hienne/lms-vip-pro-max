import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import type { ImpactAssigned, ImpactSource } from '@lms/contracts';
import {
  BarChart,
  Button,
  Card,
  Empty,
  ErrorState,
  Field,
  FmtDatePipe,
  FmtDatetimePipe,
  Icon,
  PageHeader,
  Select,
  Spinner,
  Table,
  TablePrimary,
  TableWrap,
  type BarDatum,
  DateInput,
} from '@lms/ui';
import { z } from 'zod';
import { GamificationImpactStore } from './data-access/gamification-impact.store';

const SOURCE_LABEL: Record<ImpactSource['source'], string> = {
  LESSON: 'Hoàn thành bài học',
  QUIZ_PASS: 'Đạt bài kiểm tra',
  QUIZ_FIRST_TRY_BONUS: 'Thưởng đạt ngay lần đầu',
  COURSE: 'Hoàn thành khóa học',
  COMMUNITY: 'Đóng góp cộng đồng',
  ADJUSTMENT: 'Điều chỉnh của quản trị',
};

interface FilterValue {
  from: string;
  to: string;
  orgId: string;
}

const filterSchema = z
  .object({ from: z.string(), to: z.string(), orgId: z.string() })
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
      });
    }
  });

/**
 * The gamification impact report, read-only: aggregates for the learners in the caller's scope over a period.
 * Every figure is the server's and the CSV holds the same figures; nothing here is per person.
 */
@Component({
  selector: 'app-gamification-impact',
  imports: [
    DateInput,
    BarChart,
    Button,
    Card,
    Empty,
    ErrorState,
    Field,
    FmtDatePipe,
    FmtDatetimePipe,
    FormField,
    FormRoot,
    Icon,
    PageHeader,
    Select,
    Spinner,
    Table,
    TablePrimary,
    TableWrap,
  ],
  providers: [GamificationImpactStore],
  templateUrl: './gamification-impact.html',
  styleUrl: './gamification-impact.scss',
})
export class GamificationImpact {
  protected readonly store = inject(GamificationImpactStore);
  protected readonly sourceLabel = SOURCE_LABEL;

  private readonly model = signal<FilterValue>({
    from: '',
    to: '',
    orgId: '',
  });
  protected readonly filterForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, () => filterSchema);
    },
    {
      submission: {
        action: async () => {
          const { from, to, orgId } = this.model();
          this.store.apply({
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(Number(orgId) > 0 ? { orgId: Number(orgId) } : {}),
          });
        },
      },
    },
  );

  /** The weekly active learners as bars labelled with the Monday of each week (day/month). */
  protected weeks(
    weeks: readonly { weekStart: string; learners: number }[],
  ): BarDatum[] {
    return weeks.map((week) => ({
      label: `${week.weekStart.slice(8, 10)}/${week.weekStart.slice(5, 7)}`,
      value: week.learners,
    }));
  }

  protected rate(value: number | null): string {
    return value === null ? '—' : `${value}%`;
  }

  protected rates(assigned: ImpactAssigned): string {
    return `${assigned.completed}/${assigned.assigned}`;
  }
}
