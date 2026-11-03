import { Component, computed, inject, linkedSignal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  required,
} from '@angular/forms/signals';
import {
  ASSIGNMENT_LIMITS,
  type AssignmentDetail as Detail,
} from '@lms/contracts';
import {
  Badge,
  Button,
  ErrorState,
  Field,
  FmtDatePipe,
  FmtDatetimePipe,
  Spinner,
  Textarea,
} from '@lms/ui';
import { DueDate } from '../../../../../shared/course/due-date';
import { REQUIREMENT_LABEL } from '../../../../../shared/course/course-labels';
import { TARGET_TYPE_LABEL } from '../../../../../shared/assignment-target/target-labels';
import {
  assignmentStatusView,
  ENROLLMENT_MODE_LABEL,
} from '../../assignment-labels';
import { AssignmentsStore } from '../../data-access/assignments.store';

/**
 * One assignment: its terms, the targets it was made for and the learners they resolved to. A
 * learner's obligation can be revoked with a reason; enrolment, progress and scores stay.
 */
@Component({
  selector: 'app-assignment-detail',
  imports: [
    Badge,
    Button,
    DueDate,
    ErrorState,
    Field,
    FmtDatePipe,
    FmtDatetimePipe,
    FormField,
    FormRoot,
    Spinner,
    Textarea,
  ],
  templateUrl: './assignment-detail.html',
  styleUrl: './assignment-detail.scss',
})
export class AssignmentDetail {
  protected readonly store = inject(AssignmentsStore);

  protected readonly requirementLabel = REQUIREMENT_LABEL;
  protected readonly modeLabel = ENROLLMENT_MODE_LABEL;
  protected readonly typeLabel = TARGET_TYPE_LABEL;
  protected readonly statusView = assignmentStatusView;

  protected readonly courseTitle = computed(() => {
    const detail = this.store.detail$();
    const course = this.store
      .courses$()
      .find((c) => c.courseId === detail?.assignment.courseId);
    return course ? `${course.code} · ${course.title}` : '';
  });

  /** Active learners first, then by name. */
  protected readonly recipients = computed(() => {
    const names = this.store.names$();
    return [...(this.store.detail$()?.recipients ?? [])]
      .map((recipient) => ({
        recipient,
        name: names.get(recipient.userId) ?? recipient.userId,
        active: recipient.status.toLowerCase() === 'active',
      }))
      .sort(
        (a, b) =>
          Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
      );
  });

  protected readonly assignedBy = computed(() => {
    const id = this.store.detail$()?.assignment.assignedBy;
    return id ? (this.store.names$().get(id) ?? id) : '—';
  });

  private readonly model = linkedSignal(() => ({
    recipientId: this.store.revokingId$(),
    reason: '',
  }));
  protected readonly revokeForm = form(
    this.model,
    (path) => {
      required(path.reason, { message: 'Nhập lý do thu hồi.' });
      maxLength(path.reason, ASSIGNMENT_LIMITS.revokeReason, {
        message: `Lý do tối đa ${ASSIGNMENT_LIMITS.revokeReason} ký tự.`,
      });
    },
    {
      submission: {
        action: async () => {
          const { recipientId, reason } = this.model();
          if (recipientId !== null)
            this.store.revoke(recipientId, reason.trim());
        },
      },
    },
  );

  protected targetCount(detail: Detail, targetId: number): number {
    return detail.sources.filter((s) => s.targetId === targetId).length;
  }
}
