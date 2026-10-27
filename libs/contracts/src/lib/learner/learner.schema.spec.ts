import { LearningReminderSchema } from './learner.schema';

const reminder = {
  id: 1,
  recipientId: 9,
  scheduledAt: '2026-10-26T09:00:00',
  dueAtSnapshot: '2026-10-30T17:00:00',
  status: 'pending',
  rowVersion: 0,
};

describe('LearningReminderSchema', () => {
  it.each(['pending', 'sent', 'cancelled'])(
    'accepts the status %s',
    (status) => {
      expect(LearningReminderSchema.parse({ ...reminder, status }).status).toBe(
        status,
      );
    },
  );

  it('refuses a status the backend does not have', () => {
    expect(() =>
      LearningReminderSchema.parse({ ...reminder, status: 'read' }),
    ).toThrow();
  });
});
