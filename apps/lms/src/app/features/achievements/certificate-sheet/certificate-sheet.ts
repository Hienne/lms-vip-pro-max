import { Component, input } from '@angular/core';
import { FmtDatePipe, FmtPctPipe, Icon, Mai } from '@lms/ui';

/** The issued information printed in both the gallery and the full certificate. */
export interface CertificateDocument {
  readonly fullName: string;
  readonly title: string;
  readonly code: string | null;
  readonly completedAt: string;
  readonly score: number | null;
  readonly verificationCode: string;
}

@Component({
  selector: 'app-certificate-sheet',
  imports: [FmtDatePipe, FmtPctPipe, Icon, Mai],
  templateUrl: './certificate-sheet.html',
  styleUrl: './certificate-sheet.scss',
})
export class CertificateSheet {
  readonly document = input.required<CertificateDocument>();
  readonly preview = input(false);
}
