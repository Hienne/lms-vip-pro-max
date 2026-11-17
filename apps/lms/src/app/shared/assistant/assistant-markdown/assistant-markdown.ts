import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink, type UrlTree } from '@angular/router';
import type { Citation } from '@lms/contracts';
import { answerParts } from '../answer-parts';
import { citationName } from '../citation-label';
import { parseMarkdown, type InlineRun } from '../markdown';
import { SourceBadge } from '../source-badge/source-badge';

/** A run of an answer ready to draw: styled text, code, an in-app link or a numbered source. */
type Piece =
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly strong: boolean;
      readonly emphasis: boolean;
    }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'link'; readonly text: string; readonly href: string }
  | {
      readonly kind: 'source';
      readonly citation: Citation;
      readonly name: string;
    };

type View =
  | { readonly kind: 'paragraph'; readonly pieces: readonly Piece[] }
  | {
      readonly kind: 'list';
      readonly ordered: boolean;
      readonly items: readonly (readonly Piece[])[];
    }
  | { readonly kind: 'code'; readonly text: string }
  | {
      readonly kind: 'table';
      readonly head: readonly (readonly Piece[])[];
      readonly rows: readonly (readonly (readonly Piece[])[])[];
    };

/**
 * An assistant's answer as formatted text: paragraphs, emphasis, lists, code, tables and links to
 * pages of the app. The parser returns data and this template builds every element, so an answer can
 * not bring in HTML, a script or a link to another site. `[n]` markers become sources, as badges
 * with a popover (`badges`) or as plain numbers that report a click (`sourceSelected`).
 */
@Component({
  selector: 'app-assistant-markdown',
  imports: [NgTemplateOutlet, RouterLink, SourceBadge],
  templateUrl: './assistant-markdown.html',
  styleUrl: './assistant-markdown.scss',
})
export class AssistantMarkdown {
  readonly text = input.required<string>();
  readonly citations = input<readonly Citation[]>([]);
  /** Draw each source as a badge with a popover instead of a number button. */
  readonly badges = input(false);
  readonly sourceSelected = output<number>();
  private readonly router = inject(Router);

  /** A link with a query string is a `UrlTree`: a string would encode `?` and `=` into the path. */
  protected linkTree(href: string): UrlTree {
    return this.router.parseUrl(href);
  }

  protected readonly blocks = computed<View[]>(() => {
    const citations = this.citations();
    const pieces = (runs: readonly InlineRun[]) => toPieces(runs, citations);
    return parseMarkdown(this.text()).map((block): View => {
      switch (block.kind) {
        case 'paragraph':
          return { kind: 'paragraph', pieces: pieces(block.runs) };
        case 'list':
          return {
            kind: 'list',
            ordered: block.ordered,
            items: block.items.map(pieces),
          };
        case 'code':
          return block;
        case 'table':
          return {
            kind: 'table',
            head: block.head.map(pieces),
            rows: block.rows.map((row) => row.map(pieces)),
          };
      }
    });
  });

  protected readonly pieceContext = (pieces: readonly Piece[]) => ({
    $implicit: pieces,
  });
}

function toPieces(
  runs: readonly InlineRun[],
  citations: readonly Citation[],
): Piece[] {
  return runs.flatMap((run): Piece[] => {
    if (run.kind === 'code') return [{ kind: 'code', text: run.text }];
    if (run.kind === 'link' && run.href)
      return [{ kind: 'link', text: run.text, href: run.href }];
    return answerParts(run.text, citations).parts.map(
      (part): Piece =>
        part.kind === 'text'
          ? {
              kind: 'text',
              text: part.text,
              strong: run.strong,
              emphasis: run.emphasis,
            }
          : {
              kind: 'source',
              citation: part.citation,
              name: citationName(part.citation),
            },
    );
  });
}
