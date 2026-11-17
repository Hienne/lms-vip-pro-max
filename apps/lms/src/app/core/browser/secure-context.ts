/**
 * Helpers for pages served over plain HTTP, where `isSecureContext` is false and
 * `crypto.randomUUID` and `navigator.clipboard` do not exist. App code uses these two instead of
 * the native calls (ESLint forbids the native ones).
 */

/**
 * A fresh random id: 1 to 64 characters, starting with a letter or digit, then letters, digits,
 * dots, underscores or hyphens. `crypto.randomUUID` only exists in secure contexts, so a
 * plain-HTTP page falls back to random hex.
 */
export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

/** Copies text to the clipboard; resolves `false` when no way worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Blocked or unavailable: try the textarea route below.
  }
  return copyWithTextarea(text);
}

function copyWithTextarea(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  try {
    area.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
