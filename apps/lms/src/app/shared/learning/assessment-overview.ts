import type {
  AssessmentOverview,
  LearningProgressOverview,
} from '@lms/contracts';

/** The summary's `assessment` is the overview only while its `availability` says so. */
export function isAssessmentAvailable(
  assessment: LearningProgressOverview['assessment'],
): assessment is AssessmentOverview {
  return assessment.availability === 'available';
}
