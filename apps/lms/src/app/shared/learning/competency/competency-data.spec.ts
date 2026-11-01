import type { MyCompetency } from '@lms/contracts';
import { toRadarData, withData } from './competency-data';

const row = (name: string, percent: number | null): MyCompetency => ({
  competencyId: 1,
  code: name,
  name,
  totalQuestions: percent === null ? 0 : 7,
  correctCount: 1,
  maxScore: percent === null ? 0 : 9,
  score: 1,
  percent,
});

describe('competency data', () => {
  it('maps each row to its name and the server percent, keeping null', () => {
    expect(toRadarData([row('Vận hành', 11.11), row('Rủi ro', null)])).toEqual([
      { name: 'Vận hành', value: 11.11 },
      { name: 'Rủi ro', value: null },
    ]);
  });

  it('leaves a row with no data out of withData, and keeps the rest in order', () => {
    const rows = [row('A', 0), row('B', null), row('C', 33.33)];
    expect(withData(rows).map((r) => r.name)).toEqual(['A', 'C']);
    expect(withData([row('B', null)])).toEqual([]);
  });

  it('keeps zero as data', () => {
    expect(withData([row('A', 0)])).toHaveLength(1);
  });
});
