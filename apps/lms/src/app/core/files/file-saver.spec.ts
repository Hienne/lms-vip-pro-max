import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FileSaver } from './file-saver';

describe('FileSaver', () => {
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const calls: string[] = [];
  const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
  const append = vi.fn();

  beforeEach(() => {
    calls.length = 0;
    anchor.href = '';
    anchor.download = '';
    anchor.click.mockImplementation(() => calls.push('click'));
    anchor.remove.mockImplementation(() => calls.push('remove'));
    URL.createObjectURL = vi.fn(() => {
      calls.push('create');
      return 'blob:lms/1';
    });
    URL.revokeObjectURL = vi.fn(() => calls.push('revoke'));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DOCUMENT,
          useValue: { createElement: () => anchor, body: { append } },
        },
      ],
    });
  });
  afterEach(() => {
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  });

  it('clicks a temporary link to the object URL under the given name, then revokes the URL', () => {
    const blob = new Blob(['x'], { type: 'text/csv' });
    TestBed.inject(FileSaver).save(blob, 'users.csv');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchor.href).toBe('blob:lms/1');
    expect(anchor.download).toBe('users.csv');
    expect(append).toHaveBeenCalledWith(anchor);
    expect(calls).toEqual(['create', 'click', 'remove', 'revoke']);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:lms/1');
  });
});
