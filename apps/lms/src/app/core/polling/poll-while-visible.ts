/**
 * Calls `tick` every `intervalMs` while the page is visible, and once more when it becomes visible again.
 * A hidden tab does not poll. Returns the function that stops it.
 */
export function pollWhileVisible(
  intervalMs: number,
  tick: () => void,
): () => void {
  const isHidden = (): boolean => document.visibilityState === 'hidden';
  const timer = setInterval(() => {
    if (!isHidden()) tick();
  }, intervalMs);
  const onVisibility = (): void => {
    if (!isHidden()) tick();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
