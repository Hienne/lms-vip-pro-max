import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DuplicateGroup, KnowledgeDocument } from '@lms/contracts';
import { knowledgeDocumentFixtures } from '@lms/mocks';
import { DuplicateDocuments } from './duplicate-documents';

@Component({
  imports: [DuplicateDocuments],
  template: `<app-duplicate-documents
    [groups]="groups()"
    (remove)="removed.push($event.id)"
  />`,
})
class Host {
  readonly groups = signal<readonly DuplicateGroup[]>([]);
  readonly removed: number[] = [];
}

const copy = (id: number): KnowledgeDocument => ({
  ...knowledgeDocumentFixtures[2],
  id,
  title: `Bản ${id}`,
});

describe('DuplicateDocuments', () => {
  let host: Host;
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<Host>>;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('shows nothing when no document is repeated', () => {
    expect(el.textContent?.trim()).toBe('');
  });

  it('lists each group with a delete on every copy, and deletes nothing by itself', () => {
    host.groups.set([
      { checksum: 'a', documents: [copy(3), copy(2)] },
      { checksum: 'b', documents: [copy(9), copy(8), copy(7)] },
    ]);
    fixture.detectChanges();
    expect(el.querySelector('summary')?.textContent).toContain(
      'Tài liệu trùng',
    );
    expect(el.querySelector('summary')?.textContent).toContain('5 bản');
    expect(el.querySelectorAll('ul')).toHaveLength(2);
    expect(el.querySelectorAll('li')).toHaveLength(5);
    expect(host.removed).toEqual([]);
    el.querySelector<HTMLButtonElement>(
      '[aria-label="Xoá bản trùng Bản 2"]',
    )?.click();
    expect(host.removed).toEqual([2]);
  });
});
