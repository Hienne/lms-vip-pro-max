import { Component, computed, input, output } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { BusinessModule, TrainingProgram } from '@lms/contracts';
import {
  Field,
  Icon,
  IconButton,
  Input,
  LinkButton,
  OptionCard,
  Select,
  Textarea,
} from '@lms/ui';
import {
  CourseCard,
  type CourseCardView,
} from '../../../../../shared/course/course-card';
import { LEVEL_LABEL } from '../../../../../shared/course/course-labels';
import { draftTotals, type CourseDraftValue } from '../../course-draft';

/**
 * Step 1 of the editor: the course's name, place in the catalogue, level, kind, summary and
 * learning objectives, beside a preview of the card learners will see. It edits the page's form
 * through the field tree it is given.
 */
@Component({
  selector: 'app-course-info',
  imports: [
    CourseCard,
    Field,
    FormField,
    Icon,
    IconButton,
    Input,
    LinkButton,
    OptionCard,
    Select,
    Textarea,
  ],
  templateUrl: './course-info.html',
  styleUrl: './course-info.scss',
})
export class CourseInfo {
  readonly draft = input.required<FieldTree<CourseDraftValue>>();
  /** A course being created: its code is typed here, and the owner is shown beside it. */
  readonly create = input(false);
  /** False on a published revision: the objectives cannot be added or removed. */
  readonly editable = input(true);
  readonly ownerName = input('');
  readonly programs = input.required<readonly TrainingProgram[]>();
  readonly modules = input.required<readonly BusinessModule[]>();
  /** The chosen program, so the page lists the modules of its field. */
  readonly programPicked = output<string>();

  protected readonly levels = Object.entries(LEVEL_LABEL);

  protected readonly preview = computed((): CourseCardView => {
    const value = this.draft()().value();
    const totals = draftTotals(value);
    const program = this.programs().find(
      (p) => String(p.id) === value.programId,
    );
    const module = this.modules().find((m) => String(m.id) === value.moduleId);
    return {
      id: 'preview',
      title: value.title.trim() || 'Tên khóa học',
      required: value.defaultRequirement === 'mandatory',
      domain: program?.name ?? 'Chương trình',
      module: module?.name ?? value.code,
      minutes: totals.minutes,
      lessons: totals.lessons,
      level: value.level ? LEVEL_LABEL[value.level] : '',
      pct: 0,
      status: 'not_started',
      statusLabel: 'Chưa bắt đầu',
      link: '.',
    };
  });

  protected addObjective(): void {
    this.draft()
      .objectives()
      .value.update((list) => [...list, '']);
  }

  protected removeObjective(index: number): void {
    this.draft()
      .objectives()
      .value.update((list) => list.filter((_, i) => i !== index));
  }
}
