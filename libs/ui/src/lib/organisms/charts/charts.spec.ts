import { TestBed } from '@angular/core/testing';
import { RadarChart } from './radar-chart';
import { BarChart } from './bar-chart';
import { DonutChart } from './donut-chart';
describe('data charts', () => {
  it('keeps missing radar values explicit in the accessible data table', async () => {
    const f = TestBed.createComponent(RadarChart);
    f.componentRef.setInput('data', [
      { name: 'CIF', value: 80 },
      { name: 'Tiền gửi', value: null },
      { name: 'EOD', value: 40 },
    ]);
    await f.whenStable();
    const e = f.nativeElement as HTMLElement;
    expect(e.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Biểu đồ năng lực',
    );
    expect(e.querySelector('tbody')?.textContent).toContain('Chưa có dữ liệu');
    expect(e.innerHTML).not.toContain('NaN');
  });
  it('shows radar percents in the app format, with the server decimals', async () => {
    const f = TestBed.createComponent(RadarChart);
    f.componentRef.setInput('data', [
      { name: 'CIF', value: 14.29 },
      { name: 'Tiền gửi', value: null },
      { name: 'EOD', value: 100 },
    ]);
    await f.whenStable();
    const e = f.nativeElement as HTMLElement;
    const cells = Array.from(e.querySelectorAll('tbody td:nth-child(2)')).map(
      (td) => td.textContent?.trim(),
    );
    expect(cells).toEqual(['14,29%', 'Chưa có dữ liệu', '100%']);
    const labels = Array.from(e.querySelectorAll('.chart-view__value')).map(
      (v) => v.textContent?.trim(),
    );
    expect(labels).toEqual(['14,29%', '—', '100%']);
    const titles = Array.from(e.querySelectorAll('circle title')).map((t) =>
      t.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(titles).toEqual([
      'CIF: 14,29%',
      'Tiền gửi: Chưa có dữ liệu',
      'EOD: 100%',
    ]);
    expect(e.innerHTML).not.toContain('14.29');
  });
  it('renders an empty radar without invalid SVG coordinates', async () => {
    const f = TestBed.createComponent(RadarChart);
    f.componentRef.setInput('data', []);
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).innerHTML).not.toMatch(
      /NaN|Infinity/,
    );
  });
  it('handles a zero-only bar series without dividing by zero', async () => {
    const f = TestBed.createComponent(BarChart);
    f.componentRef.setInput('data', [{ label: 'Tuần 1', value: 0 }]);
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).innerHTML).not.toMatch(
      /NaN|Infinity/,
    );
  });
  it('labels zero-count donut categories explicitly', async () => {
    const f = TestBed.createComponent(DonutChart);
    f.componentRef.setInput('data', [
      { label: 'Đang học', value: 0, tone: 'primary' },
    ]);
    await f.whenStable();
    const e = f.nativeElement as HTMLElement;
    expect(e.textContent).toContain('(0%)');
    expect(e.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});
