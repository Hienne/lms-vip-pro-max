import type { Certificate } from '@lms/contracts';
export const certificateFixtures: Certificate[] = [
  {
    id: 'cert1',
    courseId: 'c1',
    courseCode: 'CIF',
    courseTitle: 'Nghiệp vụ CIF',
    userName: 'Nguyễn An (dữ liệu mẫu)',
    completedAt: '2026-10-18T08:00:00Z',
    score: 90,
    verificationCode: 'DEMO-CBA-CIF',
    issuedAt: '2026-10-18T08:00:10Z',
    fileName: 'DEMO-chung-nhan-CIF.pdf',
  },
];
/** Small, structurally valid PDF fixture; never represents a real certificate. */
export function demoCertificatePdf(): Blob {
  const stream =
    'BT /F1 20 Tf 60 760 Td (DEMO - NOT A VALID CERTIFICATE) Tj 0 -40 Td /F1 12 Tf (Core Banking Academy - FE integration fixture) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const start = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new Blob([pdf], { type: 'application/pdf' });
}
