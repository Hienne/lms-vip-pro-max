import { TestBed } from '@angular/core/testing';
import type { StudyPhase } from '../../data-access/study-channel';
import { SessionAlert } from './session-alert';

function render(phase: StudyPhase, message?: string) {
  const fixture = TestBed.createComponent(SessionAlert);
  fixture.componentRef.setInput('phase', phase);
  if (message) fixture.componentRef.setInput('message', message);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const events: string[] = [];
  fixture.componentInstance.takeOver.subscribe(() => events.push('takeOver'));
  fixture.componentInstance.reload.subscribe(() => events.push('reload'));
  fixture.componentInstance.retry.subscribe(() => events.push('retry'));
  return { el, events, button: el.querySelector('button') };
}

describe('SessionAlert', () => {
  it.each<[StudyPhase, string, string, string]>([
    [
      'takeover',
      'Bài học đang mở ở nơi khác',
      'Học trên thiết bị này',
      'takeOver',
    ],
    [
      'moved',
      'Bài học đã chuyển sang thiết bị khác.',
      'Học trên thiết bị này',
      'takeOver',
    ],
    ['media-changed', 'Nội dung bài đã thay đổi.', 'Tải lại bài', 'reload'],
    ['failed', 'Chưa kết nối được phiên học.', 'Thử lại', 'retry'],
  ])('%s says so and offers one button', (phase, heading, label, event) => {
    const { el, events, button } = render(phase);
    expect(el.textContent).toContain(heading);
    expect(button?.textContent?.trim()).toBe(label);
    expect(el.querySelectorAll('button').length).toBe(1);
    button!.click();
    expect(events).toEqual([event]);
  });

  it("shows the server's message instead of the default", () => {
    expect(
      render('takeover', 'Đang học trên Chrome, 10:02').el.textContent,
    ).toContain('Đang học trên Chrome, 10:02');
  });

  it.each<StudyPhase>([
    'idle',
    'claiming',
    'ready',
    'block-error',
    'page-error',
  ])('shows nothing for %s', (phase) => {
    expect(render(phase).el.querySelector('ui-alert')).toBeNull();
  });
});
