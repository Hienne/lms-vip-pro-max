import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Citation } from '@lms/contracts';
import { knowledgeAnswerFixture } from '@lms/mocks';
import { AgentSources } from './agent-sources';

@Component({
  selector: 'app-host',
  imports: [AgentSources],
  template: `<app-agent-sources [turnId]="7" [citations]="citations()" />`,
})
class Host {
  readonly citations = signal<readonly Citation[]>(
    knowledgeAnswerFixture.citations,
  );
}

describe('AgentSources', () => {
  async function render(citations?: readonly Citation[]) {
    const fixture = TestBed.createComponent(Host);
    if (citations) fixture.componentInstance.citations.set(citations);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const lines = () => [
      ...el.querySelectorAll<HTMLButtonElement>('.sources__item'),
    ];
    return { fixture, el, lines };
  }

  it('shows one line per source: number, file and place, with an id per turn and number', async () => {
    const { lines } = await render();
    expect(lines()).toHaveLength(2);
    expect(lines()[0].id).toBe('agent-source-7-1');
    expect(lines()[0].querySelector('.sources__n')?.textContent).toBe('1');
    expect(lines()[0].querySelector('.sources__file')?.textContent).toBe(
      'Quy-trinh-EOD.pdf · trang 1 · dòng 3–9',
    );
    expect(lines()[1].getAttribute('aria-label')).toBe(
      'Nguồn 2: Checklist-van-hanh.md, dòng 12–15',
    );
  });

  it('lists a number once, in number order', async () => {
    const [first, second] = knowledgeAnswerFixture.citations;
    const { lines } = await render([second, first, second]);
    expect(lines().map((line) => line.id)).toEqual([
      'agent-source-7-1',
      'agent-source-7-2',
    ]);
  });

  it('opens the quoted passage from a line', async () => {
    const { fixture, lines } = await render();
    lines()[0].click();
    await fixture.whenStable();
    expect(document.body.textContent).toContain(
      knowledgeAnswerFixture.citations[0].snippet,
    );
  });
});
