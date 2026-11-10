import { TestBed } from '@angular/core/testing';
import { HorizontalBarChart } from './horizontal-bar-chart';

describe('HorizontalBarChart', () => {
  it('preserves category names and decimal percentages, with clamped mark widths', async () => {
    const fixture = TestBed.createComponent(HorizontalBarChart);
    fixture.componentRef.setInput('data', [
      { label: 'A long course name', value: 33.3 },
      { label: 'Over ceiling', value: 120 },
    ]);
    fixture.componentRef.setInput('max', 100);
    fixture.componentRef.setInput('unit', '%');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('A long course name');
    expect(root.textContent).toContain('33,3%');
    const marks = root.querySelectorAll<HTMLElement>('.comparison__fill');
    expect(marks[0].style.width).toBe('33.3%');
    expect(marks[1].style.width).toBe('100%');
  });
});
