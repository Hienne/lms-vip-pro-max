import { MAX_UPLOAD_BYTES, uploadProblem } from './upload-rules';

const file = (name: string, size: number) => ({ name, size }) as File;

describe('uploadProblem', () => {
  it.each(['a.pdf', 'b.MD', 'c.docx'])('accepts %s', (name) => {
    expect(uploadProblem(file(name, 10))).toBeNull();
  });

  it('refuses other types', () => {
    expect(uploadProblem(file('a.png', 10))).toBe(
      'Chỉ hỗ trợ tệp .pdf, .md hoặc .docx.',
    );
  });

  it('refuses an empty file', () => {
    expect(uploadProblem(file('a.pdf', 0))).toContain('rỗng');
  });

  it('accepts exactly the limit and refuses one byte more', () => {
    expect(uploadProblem(file('a.pdf', MAX_UPLOAD_BYTES))).toBeNull();
    expect(uploadProblem(file('a.pdf', MAX_UPLOAD_BYTES + 1))).toContain(
      '20 MB',
    );
  });
});
