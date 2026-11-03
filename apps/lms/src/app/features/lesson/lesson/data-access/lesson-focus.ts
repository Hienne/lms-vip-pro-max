import type { PreferenceStorage } from '../../../../core/storage/local-storage';

/** Remembers per browser that the lesson page hides its side panel. */
export const LESSON_FOCUS_KEY = 'lms.lesson.focus';

/** Whether this browser remembers focus mode; blocked storage counts as off. */
export function readFocus(storage: PreferenceStorage | null): boolean {
  try {
    return storage?.getItem(LESSON_FOCUS_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Remembers the choice; storage that is blocked or full leaves it applying to this page view only. */
export function writeFocus(
  storage: PreferenceStorage | null,
  focus: boolean,
): void {
  try {
    storage?.setItem(LESSON_FOCUS_KEY, String(focus));
  } catch {
    // The choice still applies until the page is reloaded.
  }
}
