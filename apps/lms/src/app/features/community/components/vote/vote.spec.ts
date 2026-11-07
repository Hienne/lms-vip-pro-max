import { TestBed } from '@angular/core/testing';
import { Vote, type VoteValue } from './vote';

function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(Vote);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  const sent: VoteValue[] = [];
  fixture.componentInstance.voted.subscribe((value) => sent.push(value));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const [up, down] = Array.from(el.querySelectorAll('button'));
  return { el, up, down, sent };
}

describe('Vote', () => {
  it('sends +1 and -1', () => {
    const { up, down, sent } = render({ score: 4, myVote: 0 });
    up.click();
    down.click();
    expect(sent).toEqual([1, -1]);
  });

  it('withdraws the vote when the current one is pressed again', () => {
    const { up, sent } = render({ score: 4, myVote: 1 });
    expect(up.getAttribute('aria-pressed')).toBe('true');
    up.click();
    expect(sent).toEqual([0]);
  });

  it('is disabled with the reason as its name when the server forbids voting', () => {
    const { up, down, sent } = render({ score: 0, canVote: false });
    expect(up.disabled).toBe(true);
    expect(up.getAttribute('aria-label')).toBe(
      'Bạn không thể bình chọn cho nội dung của chính mình',
    );
    down.click();
    expect(sent).toEqual([]);
  });

  it('shows the score', () => {
    expect(
      render({ score: 12 }).el.querySelector('.vote__score')?.textContent,
    ).toContain('12');
  });

  it('shows the selected helpful label and can switch away from a downvote', () => {
    const selected = render({ score: 4, myVote: 1 });
    expect(selected.up.textContent).toContain('Đã thấy hữu ích');
    const downvoted = render({ score: -2, myVote: -1 });
    expect(downvoted.down.getAttribute('aria-pressed')).toBe('true');
    downvoted.up.click();
    expect(downvoted.sent).toEqual([1]);
  });

  it('blocks both controls while the server is processing a vote', () => {
    const { up, down, sent } = render({ score: 12, busy: true });
    up.click();
    down.click();
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(true);
    expect(sent).toEqual([]);
  });
});
