import { z } from 'zod';
import { envelope } from './envelope';

const wrapper = {
  responseId: 'r-1',
  timestamp: '2026-10-17T03:00:00Z',
  status: 'SUCCESS',
  messageCode: 'CORE-0200',
  message: 'OK',
  messageTitle: 'OK',
};

describe('envelope', () => {
  const schema = envelope(z.object({ n: z.number() }));

  it('yields the data of an enveloped body', () => {
    expect(schema.parse({ ...wrapper, data: { n: 1 } })).toEqual({ n: 1 });
  });

  it('rejects a body without the envelope', () => {
    expect(() => schema.parse({ n: 1 })).toThrow();
  });

  it('rejects an envelope whose data does not match', () => {
    expect(() => schema.parse({ ...wrapper, data: { n: 'x' } })).toThrow();
  });
});
