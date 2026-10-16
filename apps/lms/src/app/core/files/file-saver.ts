import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';

/**
 * Saves a downloaded `Blob` as a file under a name the caller chooses (the store names it;
 * `Content-Disposition` is not read). Call it from a mutation's `onSuccess`.
 */
@Service()
export class FileSaver {
  private readonly document = inject(DOCUMENT);

  save(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = filename;
    this.document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
