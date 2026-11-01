import { personalEndpoints, type AnyEndpoint } from '@lms/contracts';
import { envelopeError, envelopeOk } from '../envelope';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { certificateFixtures, demoCertificatePdf } from './personal.fixtures';

const p = personalEndpoints;
const certificateEndpoints: readonly AnyEndpoint[] = [
  p.certificates,
  p.certificate,
  p.downloadCertificate,
];

/** The certificates the mockup shows; the backend does not issue them yet. */
export class PersonalFakeBackend {
  answers(endpoint: AnyEndpoint) {
    return certificateEndpoints.includes(endpoint);
  }
  handle(endpoint: AnyEndpoint, request: FakeRequest): FakeReply | undefined {
    if (!this.answers(endpoint)) return undefined;
    const ok = (data: unknown): FakeReply => ({
      status: 200,
      body: envelopeOk(data),
    });
    const missing = (): FakeReply => ({
      status: 404,
      body: envelopeError(
        'MOCK_NOT_FOUND',
        'Không tìm thấy',
        'Không tìm thấy mục hoặc bạn không có quyền truy cập.',
      ),
    });
    const page = <T>(items: T[]) => {
      const page = Math.max(0, Number(request.query['page']) || 0),
        size = Math.min(100, Math.max(1, Number(request.query['size']) || 20));
      return {
        items: items.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: items.length,
        totalPages: Math.ceil(items.length / size),
      };
    };
    if (endpoint === p.certificates) return ok(page(certificateFixtures));
    if (endpoint === p.certificate || endpoint === p.downloadCertificate) {
      const certificate = certificateFixtures.find(
        (x) => x.id === request.params['certificateId'],
      );
      if (!certificate) return missing();
      return endpoint === p.certificate
        ? ok(certificate)
        : { ...ok(null), file: demoCertificatePdf() };
    }
    return undefined;
  }
}
