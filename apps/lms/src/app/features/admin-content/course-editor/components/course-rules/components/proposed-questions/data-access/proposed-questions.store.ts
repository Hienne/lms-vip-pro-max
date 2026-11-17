import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import {
  courseContentEndpoints,
  type ProposedQuestion,
  type QuestionDecision,
} from '@lms/contracts';
import { invalidation } from '../../../../../../../../core/data-access/invalidation';
import { serverData } from '../../../../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../../../../../core/http/endpoint-client';
import { CourseAiJobStore } from '../../../../../data-access/course-ai-job.store';

/** One proposed question and where it sits in its lesson's list (the server's key for it). */
export interface Proposal {
  readonly index: number;
  readonly question: ProposedQuestion;
  /** The question is in the course's question bank. */
  readonly added: boolean;
}

/** The questions the job proposed for one lesson. */
export interface LessonProposals {
  readonly key: string;
  readonly heading: string;
  readonly proposals: readonly Proposal[];
}

/** `c2l3` is lesson 3 of chapter 2. */
const headingOf = (key: string, title: string | null | undefined): string => {
  const match = /^c(\d+)l(\d+)$/.exec(key);
  const place = match ? `Bài ${match[1]}.${match[2]}` : key;
  return title ? `${place}: ${title}` : place;
};

/**
 * The questions the AI proposed for the open course (step 3). The server keeps every decision:
 * accepting writes the question to the question bank at once, rejecting keeps it out, and both
 * come back when the job is read again, so a reload shows the same list. The store reads the
 * job's content whenever the job moved (the AI is still proposing) and after each decision.
 */
@Injectable()
export class ProposedQuestionsStore {
  private readonly client = inject(EndpointClient);
  private readonly ai = inject(CourseAiJobStore);

  private readonly reads = invalidation();

  private readonly data = serverData(
    (jobId: number) =>
      this.client.call(courseContentEndpoints.content, { params: { jobId } }),
    { params: () => this.ai.job$()?.jobId, reloadOn: this.reads },
  );

  /** What the job did last time the questions were read for it. */
  private seen: string | undefined;

  private readonly followJob = effect(() => {
    const job = this.ai.job$();
    if (!job) return;
    const signature = [job.status, job.step, job.progress, job.updateTime].join(
      '|',
    );
    untracked(() => {
      if (signature === this.seen) return;
      // The first read is the data resource's own.
      if (this.seen !== undefined) this.reads.bump();
      this.seen = signature;
    });
  });

  readonly error$ = this.data.error;
  readonly isLoading$ = this.data.isLoading;

  /** Lessons with at least one proposal still on offer; rejected ones are gone from the list. */
  readonly lessons$ = computed((): readonly LessonProposals[] => {
    const content = this.data.value();
    if (!content) return [];
    return content.questions.flatMap((entry) => {
      const title = content.lessons.find(
        (lesson) => lesson.key === entry.lessonKey,
      )?.title;
      const proposals = (entry.questions ?? [])
        .map(
          (question, index): Proposal => ({
            index,
            question,
            added: question.decision === 'added',
          }),
        )
        .filter(({ question }) => question.decision !== 'rejected');
      return proposals.length === 0
        ? []
        : [
            {
              key: entry.lessonKey,
              heading: headingOf(entry.lessonKey, title),
              proposals,
            },
          ];
    });
  });

  /** The AI is still writing proposals, so the list may grow. */
  readonly proposing$ = computed(() => this.ai.phase$() === 'writing');

  /** The question step failed: said here, where the questions are, with the job's retry. */
  readonly failure$ = computed(() => {
    const job = this.ai.job$();
    return this.ai.phase$() === 'failed' && job?.step === 'questions'
      ? (job.error ?? 'Hãy thử lại sau ít phút.')
      : null;
  });

  readonly hasJob$ = computed(() => !!this.ai.job$());

  private readonly decideMutation = serverMutation(
    (input: { key: string; index: number; decision: QuestionDecision }) =>
      this.client.call(courseContentEndpoints.decideQuestion, {
        params: {
          jobId: this.ai.job$()?.jobId ?? 0,
          key: input.key,
          index: input.index,
        },
        body: { decision: input.decision },
      }),
    { errors: 'toast', invalidates: this.reads },
  );

  readonly isDeciding$ = this.decideMutation.isPending;

  accept(key: string, index: number): void {
    this.decideMutation.run({ key, index, decision: 'accepted' });
  }

  reject(key: string, index: number): void {
    this.decideMutation.run({ key, index, decision: 'rejected' });
  }

  retry(): void {
    this.ai.retry();
  }

  readonly isBusy$ = computed(() => this.isDeciding$() || this.ai.isBusy$());
}
