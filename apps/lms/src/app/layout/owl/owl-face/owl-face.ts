import { Component, input } from '@angular/core';
import type { OwlState } from '../../../core/knowledge/document-tracker.store';

/**
 * The owl's face, drawn in the current text colour and sized by its host: it chews while
 * documents are processing, smiles when one is ready and keeps a plain mouth when one failed.
 * Decorative: whatever shows it names it.
 */
@Component({
  selector: 'app-owl-face',
  templateUrl: './owl-face.html',
  styleUrl: './owl-face.scss',
})
export class OwlFace {
  readonly state = input<OwlState>('idle');
}
