import type {
  BasicsProposal,
  DraftingStep,
  OutlineProposal,
  RulesProposal,
} from '@lms/contracts';
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

/** One write into the form: a whole field, or one more item of a list. */
export interface FillPatch {
  readonly field: FillField;
  readonly apply: (value: CourseDraftValue) => CourseDraftValue;
}

/** A field of step 3 that lives beside the form until the step is confirmed. */
export type RulesField = keyof DraftRulesValue;

/** One write into step 3's draft questions or their competency. */
export interface RulesPatch {
  readonly field: RulesField;
  readonly rules: (value: DraftRulesValue) => DraftRulesValue;
}

export type DraftingPatch = FillPatch | RulesPatch;

const set = <K extends FillField>(
  field: K,
  next: CourseDraftValue[K],
): FillPatch => ({
  field,
  apply: (value) => ({ ...value, [field]: next }),
});

/**
 * Step 1 in the order the page shows its fields. A value the server left empty (a programme or
 * module it could not pick, no level, no kind) is not written, so the form keeps it empty. The
 * objectives come one item at a time, replacing what the list held.
 */
function basicsPatches(proposal: BasicsProposal): FillPatch[] {
  const patches: FillPatch[] = [set('title', proposal.title)];
  if (proposal.programId !== null)
    patches.push(set('programId', String(proposal.programId)));
  if (proposal.moduleId !== null)
    patches.push(set('moduleId', String(proposal.moduleId)));
  patches.push(set('code', proposal.code));
  if (proposal.level !== null) patches.push(set('level', proposal.level));
  if (proposal.defaultRequirement !== null)
    patches.push(set('defaultRequirement', proposal.defaultRequirement));
  patches.push(set('summary', proposal.summary));
  proposal.objectives.forEach((_, index) =>
    patches.push(set('objectives', proposal.objectives.slice(0, index + 1))),
  );
  return patches;
}

/**
 * Step 2: each chapter, then its lessons one at a time, replacing what the outline held. Lessons
 * are new content lessons with no blocks: the assistant never writes lesson content. Rows are made
 * once, so a chapter or lesson keeps its key from one write to the next.
 */
function outlinePatches(proposal: OutlineProposal): FillPatch[] {
  const chapters: ChapterValue[] = proposal.chapters.map((chapter, ci) => ({
    ...newChapter(ci + 1),
    title: chapter.title,
    lessons: chapter.lessons.map((lesson, li) => ({
      ...newLesson(li + 1),
      title: lesson.title,
    })),
  }));
  const patches: FillPatch[] = [];
  chapters.forEach((chapter, ci) => {
    const before = chapters.slice(0, ci);
    for (let count = 0; count <= chapter.lessons.length; count++) {
      patches.push(
        set('chapters', [
          ...before,
          { ...chapter, lessons: chapter.lessons.slice(0, count) },
        ]),
      );
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
 * The writes that put a step's proposal into the editor's form, one per field (lists one item per
 * write). A step without a proposal, or one the page does not fill yet, writes nothing.
 */
export function fillSteps(step: DraftingStep): readonly DraftingPatch[] {
  if (step.step === 1 && step.proposal) return basicsPatches(step.proposal);
  if (step.step === 2 && step.proposal) return outlinePatches(step.proposal);
  if (step.step === 3 && step.proposal) return rulesPatches(step.proposal);
  return [];
}
