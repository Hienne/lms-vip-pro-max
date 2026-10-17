import { isEmptyPatch, toPatch } from './patch';

const user = {
  userId: '000004',
  fullName: 'Học viên',
  email: 'a@b.vn' as string | null,
  orgId: 1 as number | null,
  teamId: 7 as number | null,
};

describe('toPatch', () => {
  it('keeps only the listed fields whose value changed', () => {
    const patch = toPatch(user, { ...user, fullName: 'Học viên mới' }, [
      'fullName',
      'email',
    ]);
    expect(patch).toEqual({ fullName: 'Học viên mới' });
  });

  it('sends null to clear a field and 0-like values as they are', () => {
    expect(
      toPatch(user, { ...user, email: null, teamId: null }, [
        'email',
        'teamId',
      ]),
    ).toEqual({ email: null, teamId: null });
  });

  it('is empty when nothing changed, which the caller must not send', () => {
    const patch = toPatch(user, { ...user }, ['fullName', 'email', 'orgId']);
    expect(isEmptyPatch(patch)).toBe(true);
    expect(isEmptyPatch({ email: null })).toBe(false);
  });
});
