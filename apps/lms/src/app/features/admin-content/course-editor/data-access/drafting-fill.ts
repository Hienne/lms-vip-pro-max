import type { BasicsProposal, DraftingStep } from '@lms/contracts';
import type { CourseDraftValue } from '../course-draft';

/** The pause between two fields the assistant writes, so the author watches the step fill. */
export const DRAFTING_FIELD_DELAY_MS = 120;

/** A field of the form the assistant writes, the key its "AI đề xuất" marker goes by. */
export type FillField = keyof CourseDraftValue;

/** One write into the form: a whole field, or one more item of a list. */
export interface FillPatch {
  readonly field: FillField;
  readonly apply: (value: CourseDraftValue) => CourseDraftValue;
}

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
 * The writes that put a step's proposal into the editor's form, one per field (lists one item per
 * write). A step without a proposal, or one the page does not fill yet, writes nothing.
 */
export function fillSteps(step: DraftingStep): readonly FillPatch[] {
  if (step.step === 1 && step.proposal) return basicsPatches(step.proposal);
  return [];
}
