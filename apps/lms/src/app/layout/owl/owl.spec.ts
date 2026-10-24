import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { KnowledgeDocument } from '@lms/contracts';
import { knowledgeDocumentFixtures } from '@lms/mocks';
import {
  type FinishedDocument,
  DocumentTrackerStore,
  type OwlState,
} from '../../core/knowledge/document-tracker.store';
import { AgentChatStore } from '../../core/assistant/agent-chat.store';
import { AGENT_LAUNCHER_ID } from '../../core/assistant/agent-launcher';
import { Owl } from './owl';

const base = knowledgeDocumentFixtures[0];
const ready: KnowledgeDocument = {
  ...base,
  fileName: 'quy-trinh-eod.pdf',
  status: 'ready',
};
const failed: KnowledgeDocument = {
  ...base,
  fileName: 'hong.docx',
  status: 'failed',
  errorMessage: 'Tài liệu không có nội dung văn bản.',
};

/** The tracker's selectors as plain signals, so a test sets the state the owl reads. */
class FakeTracker {
  readonly pending$ = signal<readonly KnowledgeDocument[]>([]);
  readonly lastFinished$ = signal<FinishedDocument | null>(null);
  readonly owlState$ = signal<OwlState>('idle');
  readonly dismiss = vi.fn(() => this.lastFinished$.set(null));
}

/** The chat store's launcher side as plain signals; a user without the assistant keeps the old owl. */
class FakeChat {
  readonly available$ = signal(false);
  readonly isOpen$ = signal(false);
  readonly toggle = vi.fn(() => this.isOpen$.update((open) => !open));
}

@Component({
  imports: [Owl],
  template: `<app-owl [besideToolbar]="besideToolbar()" [quiet]="quiet()" />`,
})
class Host {
  readonly besideToolbar = signal(false);
  readonly quiet = signal(false);
}

describe('Owl', () => {
  let tracker: FakeTracker;
  let chat: FakeChat;
  let navigate: ReturnType<typeof vi.fn>;
  let fixture: ReturnType<typeof TestBed.createComponent<Host>>;
  let el: HTMLElement;

  beforeEach(() => {
    tracker = new FakeTracker();
    chat = new FakeChat();
    navigate = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        { provide: DocumentTrackerStore, useValue: tracker },
        { provide: AgentChatStore, useValue: chat },
        { provide: Router, useValue: { navigateByUrl: navigate } },
      ],
    });
    fixture = TestBed.createComponent(Host);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const button = () =>
    el.querySelector('button.owl__button') as HTMLButtonElement;
  const bubble = () => el.querySelector('.owl__bubble');
  const live = () => el.querySelector('[aria-live]')?.textContent?.trim();
  const show = (
    state: OwlState,
    pending: KnowledgeDocument[] = [],
    finished: KnowledgeDocument | null = null,
  ) => {
    tracker.pending$.set(pending);
    tracker.lastFinished$.set(finished ? { document: finished, at: 0 } : null);
    tracker.owlState$.set(state);
    fixture.detectChanges();
  };

  it('sits still with no bubble when nothing is going on', () => {
    expect(button().dataset['state']).toBe('idle');
    expect(button().getAttribute('aria-label')).toBe('Trợ lý AI');
    expect(bubble()).toBeNull();
    expect(live()).toBe('');
    expect(el.querySelector('.owl__jaw')).toBeNull();
    expect(button().querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('chews while documents are being processed and names how many', () => {
    show('processing', [base, ready]);
    expect(button().dataset['state']).toBe('processing');
    expect(button().getAttribute('aria-label')).toBe(
      'Trợ lý AI: đang xử lý 2 tài liệu',
    );
    expect(el.querySelector('.owl__jaw')).not.toBeNull();
    expect(bubble()).toBeNull();
    expect(live()).toBe('Đang xử lý tài liệu.');
  });

  it('keeps the live text the same when the count changes, so it speaks once', () => {
    show('processing', [base, ready]);
    const first = live();
    show('processing', [base]);
    expect(live()).toBe(first);
    expect(button().getAttribute('aria-label')).toBe(
      'Trợ lý AI: đang xử lý 1 tài liệu',
    );
  });

  it('smiles and says which document is ready', () => {
    show('done', [], ready);
    expect(button().dataset['state']).toBe('done');
    expect(bubble()?.textContent).toContain('Đã xử lý xong tài liệu');
    expect(bubble()?.textContent).toContain('quy-trinh-eod.pdf');
    expect(live()).toBe('Đã xử lý xong tài liệu quy-trinh-eod.pdf.');
    expect(el.querySelector('.owl__jaw')).toBeNull();
  });

  it('keeps the bubble while it chews on the next document', () => {
    show('processing', [base], ready);
    expect(button().dataset['state']).toBe('processing');
    expect(bubble()?.textContent).toContain('quy-trinh-eod.pdf');
  });

  it('shows a plain face, no alarm, and offers the details for a failure', () => {
    show('failed', [], failed);
    expect(button().dataset['state']).toBe('failed');
    expect(bubble()?.textContent).toContain('Không xử lý được tài liệu');
    expect(bubble()?.textContent).toContain('hong.docx');
    expect(bubble()?.textContent).toContain('Xem chi tiết');
    expect(live()).toBe('Không xử lý được tài liệu hong.docx.');
    expect(el.querySelector('.owl__jaw')).toBeNull();
  });

  it('opens the assistant and clears the notice when the owl is clicked', () => {
    show('done', [], ready);
    button().click();
    expect(navigate).toHaveBeenCalledWith('/assistant');
    expect(tracker.dismiss).toHaveBeenCalled();
    fixture.detectChanges();
    expect(bubble()).toBeNull();
  });

  it('opens the assistant from the bubble link as well', () => {
    show('failed', [], failed);
    (el.querySelector('.owl__link') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith('/assistant');
    expect(tracker.dismiss).toHaveBeenCalled();
  });

  it('closes the bubble with its close button or Escape, without navigating', () => {
    show('failed', [], failed);
    const close = el.querySelector('.owl__close') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBe('Đóng thông báo');
    close.click();
    expect(tracker.dismiss).toHaveBeenCalledTimes(1);

    show('failed', [], failed);
    el.querySelector('app-owl')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape' }),
    );
    expect(tracker.dismiss).toHaveBeenCalledTimes(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('can step aside for the dev toolbar in the same corner', () => {
    expect(el.querySelector('app-owl')?.classList).not.toContain(
      'owl--beside-toolbar',
    );
    fixture.componentInstance.besideToolbar.set(true);
    fixture.detectChanges();
    expect(el.querySelector('app-owl')?.classList).toContain(
      'owl--beside-toolbar',
    );
  });

  it('keeps only the announcement when quiet, out of the way of a workspace page', () => {
    fixture.componentInstance.quiet.set(true);
    show('done', [], ready);
    expect(button()).toBeNull();
    expect(bubble()).toBeNull();
    expect(live()).toBe('Đã xử lý xong tài liệu quy-trinh-eod.pdf.');
  });

  describe('as the launcher of the quick assistant', () => {
    beforeEach(() => {
      chat.available$.set(true);
      fixture.detectChanges();
    });

    it('opens the panel on a click and closes it on the next', () => {
      button().click();
      expect(chat.toggle).toHaveBeenCalledTimes(1);
      expect(navigate).not.toHaveBeenCalled();
      fixture.detectChanges();
      expect(chat.isOpen$()).toBe(true);
      button().click();
      expect(chat.isOpen$()).toBe(false);
    });

    it('carries the open state and the panel it controls for assistive tech', () => {
      expect(button().id).toBe(AGENT_LAUNCHER_ID);
      expect(button().getAttribute('aria-expanded')).toBe('false');
      expect(button().hasAttribute('aria-controls')).toBe(false);
      expect(button().getAttribute('aria-label')).toBe('Mở Trợ lý nhanh');
      chat.isOpen$.set(true);
      fixture.detectChanges();
      expect(button().getAttribute('aria-expanded')).toBe('true');
      expect(button().getAttribute('aria-controls')).toBe('agent-chat-panel');
      expect(button().getAttribute('aria-label')).toBe('Đóng Trợ lý nhanh');
      expect(button().classList).toContain('owl__button--open');
    });

    it('names how many documents are processing in the label', () => {
      show('processing', [base, ready]);
      expect(button().getAttribute('aria-label')).toBe(
        'Mở Trợ lý nhanh, đang xử lý 2 tài liệu',
      );
      chat.isOpen$.set(true);
      fixture.detectChanges();
      expect(button().getAttribute('aria-label')).toBe(
        'Đóng Trợ lý nhanh, đang xử lý 2 tài liệu',
      );
      expect(button().dataset['state']).toBe('processing');
    });

    it('hides the finished notice while the panel is open and brings it back on close', () => {
      show('done', [], ready);
      expect(bubble()).not.toBeNull();
      chat.isOpen$.set(true);
      fixture.detectChanges();
      expect(bubble()).toBeNull();
      expect(live()).toBe('Đã xử lý xong tài liệu quy-trinh-eod.pdf.');
      chat.isOpen$.set(false);
      fixture.detectChanges();
      expect(bubble()?.textContent).toContain('quy-trinh-eod.pdf');
    });

    it('keeps the finished notice when the owl is clicked', () => {
      show('done', [], ready);
      button().click();
      expect(tracker.dismiss).not.toHaveBeenCalled();
      fixture.detectChanges();
      chat.isOpen$.set(false);
      fixture.detectChanges();
      expect(bubble()).not.toBeNull();
    });

    it('still takes the bubble link to the assistant screen and clears the notice', () => {
      show('done', [], ready);
      (el.querySelector('.owl__link') as HTMLButtonElement).click();
      expect(navigate).toHaveBeenCalledWith('/assistant');
      expect(tracker.dismiss).toHaveBeenCalled();
      expect(chat.toggle).not.toHaveBeenCalled();
    });
  });
});
