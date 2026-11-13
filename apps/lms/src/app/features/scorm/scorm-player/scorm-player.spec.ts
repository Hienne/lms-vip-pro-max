import { TestBed } from '@angular/core/testing';
import {
  scormEndpoints,
  type ScormPackage,
  type ScormProgress,
} from '@lms/contracts';
import { envelopeOk, FakeBackend } from '@lms/mocks';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';

describe('SCORM player integration boundary', () => {
  const screen = setUpAdminScreen();
  const empty: ScormProgress = {
    lessonStatus: 'incomplete',
    scoreRaw: null,
    scoreMin: null,
    scoreMax: null,
    lessonLocation: 'page-2',
    resumable: true,
    updateTime: '2026-11-12T10:00:00Z',
  };
  const lecture: ScormPackage = {
    id: 1,
    ownerOrgId: 1,
    title: 'Bài giảng SCORM',
    originalName: 'course.zip',
    sizeBytes: 1024,
    fileCount: 3,
    scormVersion: '1.2',
    published: true,
    canManage: true,
    rowVersion: 1,
    createTime: '2026-11-12T10:00:00Z',
    warnings: [],
    progress: empty,
  };
  let url: string, progress: ScormProgress;
  beforeEach(() => {
    url =
      'https://scorm.example.test/scorm-player/' + 'a'.repeat(43) + '/launch';
    progress = { ...empty };
    const backend = TestBed.inject(MockBackend),
      delegate = FakeBackend.prototype.handle;
    screen.calls.mockImplementation((endpoint, request) => {
      const reply = (value: unknown) => ({
        status: 200,
        body: envelopeOk(value),
      });
      if (
        endpoint === scormEndpoints.get ||
        endpoint === scormEndpoints.coursePackage
      )
        return reply(lecture);
      if (endpoint === scormEndpoints.progress) return reply(progress);
      if (endpoint === scormEndpoints.launch)
        return reply({
          launchUrl: url,
          preview: true,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          progress,
        });
      return delegate.call(backend, endpoint, request);
    });
  });
  it('launches a course lesson with its exact enrollment and returns to that course', async () => {
    await screen.open('/scorm/1?enrollmentId=120&lessonId=8&courseId=25');
    const call = screen.calls.mock.calls.find(
      ([endpoint]) => endpoint === scormEndpoints.launch,
    );
    expect(call?.[1]).toMatchObject({
      body: { preview: false, enrollmentId: 120, lessonId: 8 },
    });
    expect(screen.callsTo(scormEndpoints.coursePackage)).toBe(1);
    expect(screen.el.querySelector('a[href="/course/25"]')).not.toBeNull();
    expect(screen.el.querySelector('iframe')?.getAttribute('src')).toBe(url);
  });
  it('launches once and does not recreate the iframe while loading server progress', async () => {
    await screen.open('/scorm/1?preview=true');
    expect(screen.callsTo(scormEndpoints.launch)).toBe(1);
    const iframe = screen.el.querySelector('iframe')!;
    expect(iframe.getAttribute('src')).toBe(url);
    await screen.settle();
    expect(screen.callsTo(scormEndpoints.launch)).toBe(1);
    expect(screen.el.querySelector('iframe')).toBe(iframe);
  });
  it('rejects forged messages and reloads authoritative scores instead of trusting posted scores', async () => {
    await screen.open('/scorm/1?preview=true');
    const iframe = screen.el.querySelector('iframe')!;
    const before = screen.callsTo(scormEndpoints.progress);
    const send = (origin: string, source: Window | null) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          origin,
          source,
          data: {
            type: 'scorm:state',
            state: 'saved',
            progress: { scoreRaw: 999 },
          },
        }),
      );
    send('https://attacker.test', iframe.contentWindow);
    send('https://scorm.example.test', window);
    await screen.settle();
    expect(screen.callsTo(scormEndpoints.progress)).toBe(before);
    progress = {
      ...empty,
      lessonStatus: 'passed',
      scoreRaw: 85,
      scoreMax: 100,
    };
    send('https://scorm.example.test', iframe.contentWindow);
    await screen.settle();
    expect(screen.callsTo(scormEndpoints.progress)).toBe(before + 1);
    expect(screen.text()).toContain('85');
    expect(screen.text()).not.toContain('999');
    expect(screen.callsTo(scormEndpoints.launch)).toBe(1);
  });
  it('does not embed executable SCORM content on the LMS origin', async () => {
    url =
      window.location.origin + '/scorm-player/' + 'a'.repeat(43) + '/launch';
    await screen.open('/scorm/1?preview=true');
    expect(screen.el.querySelector('iframe')).toBeNull();
    expect(screen.callsTo(scormEndpoints.launch)).toBe(1);
  });
});
