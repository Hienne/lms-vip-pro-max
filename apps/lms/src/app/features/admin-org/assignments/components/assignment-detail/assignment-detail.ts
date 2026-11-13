import { Component, computed, inject, linkedSignal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  required,
  validate,
} from '@angular/forms/signals';
import {
  ASSIGNMENT_LIMITS,
  type AssignmentDetail as Detail,
} from '@lms/contracts';
import {
  Alert,
  Input,
  Select,
  SectionCard,
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
    Alert,
    Input,
    Select,
    SectionCard,
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

  private readonly revisionModel = linkedSignal(() => ({
    enrollmentId: this.store.revisionPreview$()?.enrollmentId,
    mode: this.store.revisionPreview$()?.canTransfer
      ? ('transfer_unstarted' as const)
      : ('relearn' as const),
    reason: '',
    dueAt: '',
  }));
  protected readonly revisionForm = form(
    this.revisionModel,
    (path) => {
      required(path.reason, { message: 'Nhập lý do thay đổi lần học.' });
      maxLength(path.reason, 2000, { message: 'Lý do tối đa 2.000 ký tự.' });
      validate(path.dueAt, ({ value }) =>
        value() && Number.isNaN(Date.parse(value()))
          ? { kind: 'date', message: 'Hạn hoàn thành không hợp lệ.' }
          : undefined,
      );
    },
    {
      submission: {
        action: async () => {
          const value = this.revisionModel();
          this.store.changeRevision(
            value.mode,
            value.reason.trim(),
            value.mode === 'relearn' && value.dueAt
              ? new Date(value.dueAt).toISOString()
              : null,
          );
        },
      },
    },
  );

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
