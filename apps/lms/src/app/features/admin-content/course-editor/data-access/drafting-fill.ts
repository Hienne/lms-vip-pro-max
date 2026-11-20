import type {
  AudienceProposal,
  BasicsProposal,
  DraftingStep,
  OutlineProposal,
  RulesProposal,
} from '@lms/contracts';
import type { TargetPick } from '../../../../shared/assignment-target/target-labels';
import {
  newChapter,
  newLesson,
  type ChapterValue,
  type CourseDraftValue,
} from '../course-draft';
import { toQuestionValue, type DraftRulesValue } from './drafting-rules';

/** The pause between two fields the assistant writes, so the author watches the step fill. */
export const DRAFTING_FIELD_DELAY_MS = 120;

/** A field of the form the assistant writes, the key its "AI đề xuất" marker goes by. */
export type FillField = keyof CourseDraftValue;

/**
 * What the outline shows under a lesson the assistant proposed: what it teaches and the part of
 * the document it comes from, and whether it is still a proposal (step 2 not confirmed yet).
 */
export interface LessonNoteView {
  readonly text: string;
  readonly suggested: boolean;
}

/**
 * One write into the form: a whole field (`value`), or one more item of a list. The page applies
 * it to its own form model; the store keeps only what was written, for the "AI đề xuất" marker.
 */
export interface FillPatch<K extends FillField = FillField> {
  readonly field: K;
  readonly value: CourseDraftValue[K];
  readonly apply: (value: CourseDraftValue) => CourseDraftValue;
  /** Step 2: the line under each lesson written so far, by the lesson's row key. */
  readonly notes?: Readonly<Record<string, LessonNoteView>>;
}

/** A field of step 3 that lives beside the form until the step is confirmed. */
export type RulesField = keyof DraftRulesValue;

/** One write into step 3's draft questions or their competency. */
export interface RulesPatch {
  readonly field: RulesField;
  readonly rules: (value: DraftRulesValue) => DraftRulesValue;
}

/**
 * One write into step 4's assign rows: the targets picked so far. The rows are the page's publish
 * targets, saved only when the author publishes.
 */
export interface AudiencePatch {
  readonly field: 'targets';
  readonly picks: readonly TargetPick[];
}

export type DraftingPatch = FillPatch | RulesPatch | AudiencePatch;

/** The write that puts `next` into `field`, replacing what it held. */
export const fieldPatch = <K extends FillField>(
  field: K,
  next: CourseDraftValue[K],
): FillPatch => ({
  field,
  value: next,
  apply: (value) => ({ ...value, [field]: next }),
});
const set = fieldPatch;

/** What a patch wrote into its field, as the "AI đề xuất" marker compares it. */
export const writtenOf = (patch: FillPatch): string =>
  JSON.stringify(patch.value);

/** The fields of `value` that still hold what the assistant wrote (`written`, as JSON by field). */
export function markedFields(
  value: CourseDraftValue,
  written: Partial<Record<FillField, string>>,
): ReadonlySet<FillField> {
  return new Set(
    (Object.entries(written) as [FillField, string][])
      .filter(([field, json]) => JSON.stringify(value[field]) === json)
      .map(([field]) => field),
  );
}

/**
 * Step 1 in the order the page shows its fields. A value the server left empty (a programme or
 * module it could not pick, no level, no kind) is not written, so the form keeps it empty; nor is
 * one the proposal does not hold (a code-only proposal after a taken code writes just the code).
 * The objectives come one item at a time, replacing what the list held.
 */
function basicsPatches(proposal: BasicsProposal): FillPatch[] {
  const patches: FillPatch[] = [];
  if (proposal.title !== undefined) patches.push(set('title', proposal.title));
  if (proposal.programId != null)
    patches.push(set('programId', String(proposal.programId)));
  if (proposal.moduleId != null)
    patches.push(set('moduleId', String(proposal.moduleId)));
  patches.push(set('code', proposal.code));
  if (proposal.level != null) patches.push(set('level', proposal.level));
  if (proposal.defaultRequirement != null)
    patches.push(set('defaultRequirement', proposal.defaultRequirement));
  if (proposal.summary !== undefined)
    patches.push(set('summary', proposal.summary));
  const objectives = proposal.objectives ?? [];
  objectives.forEach((_, index) =>
    patches.push(set('objectives', objectives.slice(0, index + 1))),
  );
  return patches;
}

/**
 * Step 2: each chapter, then its lessons one at a time, replacing what the outline held. Lessons
 * are new content lessons with no blocks: the assistant never writes lesson content. Rows are made
 * once, so a chapter or lesson keeps its key from one write to the next.
 */
function outlinePatches(proposal: OutlineProposal): FillPatch[] {
  const notes: Record<string, LessonNoteView> = {};
  const chapters: ChapterValue[] = proposal.chapters.map((chapter, ci) => ({
    ...newChapter(ci + 1),
    title: chapter.title,
    lessons: chapter.lessons.map((lesson, li) => {
      const row = { ...newLesson(li + 1), title: lesson.title };
      notes[row.key] = {
        text: `${lesson.description} · Nguồn: ${lesson.sourceSection}`,
        suggested: true,
      };
      return row;
    }),
  }));
  const patches: FillPatch[] = [];
  chapters.forEach((chapter, ci) => {
    const before = chapters.slice(0, ci);
    for (let count = 0; count <= chapter.lessons.length; count++) {
      patches.push({
        ...set('chapters', [
          ...before,
          { ...chapter, lessons: chapter.lessons.slice(0, count) },
        ]),
        notes,
      });
    }
  });
  return patches;
}

/**
 * Step 3: the bonus points, the competency when the assistant picked one, then the draft questions
 * one at a time, replacing what the page held. Questions are made once, so each keeps its key.
 */
function rulesPatches(proposal: RulesProposal): DraftingPatch[] {
  const patches: DraftingPatch[] = [set('rewardPoints', proposal.rewardPoints)];
  const competencyId = proposal.competencyId;
  if (competencyId !== null)
    patches.push({
      field: 'competencyId',
      rules: (value) => ({ ...value, competencyId: String(competencyId) }),
    });
  const questions = proposal.questions.map(toQuestionValue);
  questions.forEach((_, index) =>
    patches.push({
      field: 'questions',
      rules: (value) => ({
        ...value,
        questions: questions.slice(0, index + 1),
      }),
    }),
  );
  return patches;
}

/**
 * Step 4: the proposed targets one at a time, as rows of the assign form. Nothing is assigned,
 * shared or published: the rows wait for the author's own "Xuất bản".
 */
function audiencePatches(proposal: AudienceProposal): AudiencePatch[] {
  const picks: TargetPick[] = proposal.targets.map((target) => ({ ...target }));
  return picks.map((_, index) => ({
    field: 'targets',
    picks: picks.slice(0, index + 1),
  }));
}

/**
 * The writes that put a step's proposal into the editor's form, one per field (lists one item per
 * write). A step without a proposal, or one the page does not fill yet, writes nothing.
 */
export function fillSteps(step: DraftingStep): readonly DraftingPatch[] {
  if (step.step === 1 && step.proposal) return basicsPatches(step.proposal);
  if (step.step === 2 && step.proposal) return outlinePatches(step.proposal);
  if (step.step === 3 && step.proposal) return rulesPatches(step.proposal);
  if (step.step === 4 && step.proposal) return audiencePatches(step.proposal);
  return [];
}
