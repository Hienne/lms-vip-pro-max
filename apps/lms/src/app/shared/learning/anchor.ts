import type { Anchor } from '@lms/contracts';

/** A video position in whole seconds as `m:ss`, the way the server writes a bookmark's label. */
export function clock(second: number): string {
  const total = Math.max(0, Math.floor(second));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Where a note or bookmark sits, in words: "Trang 3", "Video 1:15" or "Cả bài". */
export function anchorText(anchor: Anchor): string {
  if (anchor.type === 'pdf') return `Trang ${anchor.page}`;
  if (anchor.type === 'video') return `Video ${clock(anchor.second ?? 0)}`;
  return 'Cả bài';
}
