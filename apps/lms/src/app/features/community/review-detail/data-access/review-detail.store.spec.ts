import { Dialog } from '@angular/cdk/dialog';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import {
  type ReviewView,
  type RevisionDetail,
  type ReviewThread,
  type ReviewInvitation,
} from '@lms/contracts';
import { envelopeOk } from '@lms/mocks';
import { of } from 'rxjs';
import {
  provideAppConfig,
  parseAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../../core/http/http.testing';
import { ReviewDetailStore } from './review-detail.store';

const timestamp = '2026-11-07T00:00:00Z';
const revision: RevisionDetail = {
  revisionId: 7,
  contentId: 12,
  revisionNo: 2,
  title: 'Thiết kế thanh toán',
  bodyMarkdown: 'Phương án thiết kế đủ nội dung để review.',
  revisionStatus: 'published',
  revisionVersion: 3,
  contentVersion: 42,
  publishedAt: timestamp,
  assets: [],
  context: {
    review: {
      problem: 'Vấn đề thiết kế cần phản biện đầy đủ.',
      constraints: 'Giữ tương thích',
      decisionsNeeded: ['Thống nhất API'],
    },
  },
};
const detail: ReviewView = {
  contentId: 12,
  kind: 'architecture_review',
  ownerOrgId: 1,
  lifecycleStatus: 'active',
  visibility: 'organization',
  contentVersion: 42,
  publishedRevision: revision,
  capabilities: {
    canEditDraft: true,
    canPublish: true,
    canAnswer: false,
    canComment: true,
    canVote: false,
    canAccept: false,
    canManageAccess: true,
    canReport: true,
    canClose: false,
    canReopen: false,
    canArchive: true,
    canDelete: true,
    canMarkDuplicate: false,
  },
  acceptedRevisionIsCurrent: false,
  answerCount: 0,
  score: 0,
  myVote: 0,
  saved: false,
  isDuplicate: false,
  reviewStatus: 'open',
  openThreadCount: 0,
  reviewCapabilities: ['comment', 'invite', 'conclude', 'close'],
};
const thread: ReviewThread = {
  threadId: 21,
  proposalContentId: 12,
  revisionId: 7,
  anchor: { type: 'section', section: 'API' },
  status: 'open',
  version: 4,
  rootComment: null,
  createTime: timestamp,
  updateTime: timestamp,
  capabilities: ['resolve'],
};
const invitation: ReviewInvitation = {
  invitationId: 30,
  proposalContentId: 12,
  reviewer: { userId: '000004', displayName: 'Học viên' },
  invitedBy: { userId: '000005' },
  status: 'pending',
  version: 8,
  createTime: timestamp,
  updateTime: timestamp,
  capabilities: ['accept', 'decline'],
};
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 20,
  totalElements: items.length,
  totalPages: items.length ? 1 : 0,
});

describe('ReviewDetailStore integration', () => {
  let http: HttpTestingController;
  let store: ReviewDetailStore;
  let answer: unknown;
  beforeEach(() => {
    answer = { text: 'Kết luận thống nhất phương án thiết kế.', expiresAt: '' };
    TestBed.configureTestingModule({
      providers: [
        ...provideEnvelopeHttpClient(),
        provideRouter([]),
        provideAppConfig(parseAppConfig(testAppConfig())),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: '12' })) },
        },
        {
          provide: Dialog,
          useValue: { open: vi.fn(() => ({ closed: of(answer) })) },
        },
        ReviewDetailStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ReviewDetailStore);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
  });
  function flushReads(value = detail): void {
    TestBed.tick();
    http
      .match((r) => r.method === 'GET' && r.url.endsWith('/reviews/12'))
      .forEach((r) => r.flush(envelopeOk(value)));
    http
      .match((r) => r.method === 'GET' && r.url.endsWith('/revisions'))
      .forEach((r) => r.flush(envelopeOk(page([revision]))));
    TestBed.tick();
    http
      .match((r) => r.method === 'GET' && /\/revisions\/\d+$/.test(r.url))
      .forEach((r) =>
        r.flush(
          envelopeOk({
            ...revision,
            revisionId: Number(r.request.url.split('/').at(-1)),
          }),
        ),
      );
    http
      .match((r) => r.method === 'GET' && r.url.endsWith('/threads'))
      .forEach((r) => r.flush(envelopeOk(page([]))));
    http
      .match((r) => r.method === 'GET' && r.url.endsWith('/invitations'))
      .forEach((r) => r.flush(envelopeOk(page([invitation]))));
    TestBed.tick();
  }
  it('reloads a direct link and uses server ACL capabilities rather than roles', () => {
    flushReads({
      ...detail,
      reviewCapabilities: [],
      capabilities: { ...detail.capabilities, canComment: false },
    });
    expect(store.title$()).toBe('Thiết kế thanh toán');
    expect(store.canComment$()).toBe(false);
    expect(store.revision$()?.revisionId).toBe(7);
    expect(store.detail$()?.reviewCapabilities).toEqual([]);
  });
  it('pins feedback to the selected historical revision and refreshes after success', () => {
    flushReads();
    store.selectRevision('5');
    TestBed.tick();
    http
      .expectOne((r) => r.url.endsWith('/revisions/5'))
      .flush(envelopeOk({ ...revision, revisionId: 5, revisionNo: 1 }));
    const read = http.expectOne((r) => r.url.endsWith('/threads'));
    expect(read.request.params.get('revisionId')).toBe('5');
    read.flush(envelopeOk(page([])));
    TestBed.tick();
    store.postThread('API', 'Cần làm rõ giới hạn kết nối.');
    TestBed.tick();
    const write = http.expectOne(
      (r) => r.method === 'POST' && r.url.endsWith('/threads'),
    );
    expect(write.request.body).toMatchObject({
      revisionId: 5,
      anchor: { type: 'section', section: 'API' },
      bodyMarkdown: 'Cần làm rõ giới hạn kết nối.',
    });
    write.flush(envelopeOk({ ...thread, revisionId: 5 }));
    flushReads();
    expect(store.posted$()).toBe(1);
  });
  it('echoes thread versions and records the resolution note', () => {
    flushReads();
    answer = { text: 'Đã bổ sung giới hạn kết nối.', expiresAt: '' };
    store.act({ kind: 'thread', thread, action: 'resolve' });
    TestBed.tick();
    const write = http.expectOne((r) => r.url.endsWith('/review-threads/21'));
    expect(write.request.body).toEqual({
      expectedVersion: 4,
      action: 'resolve',
      note: 'Đã bổ sung giới hạn kết nối.',
    });
    write.flush(envelopeOk({ ...thread, status: 'resolved', version: 5 }));
    flushReads();
  });
  it('submits the latest server version and current published revision when concluding', () => {
    flushReads();
    store.act({ kind: 'conclude' });
    TestBed.tick();
    const write = http.expectOne((r) => r.url.endsWith('/conclude'));
    expect(write.request.body).toMatchObject({
      expectedContentVersion: 42,
      concludedRevisionId: 7,
    });
    write.flush(
      envelopeOk({
        ...detail,
        reviewStatus: 'concluded',
        reviewCapabilities: [],
      }),
    );
    flushReads({
      ...detail,
      reviewStatus: 'concluded',
      reviewCapabilities: [],
    });
    expect(store.canComment$()).toBe(false);
  });
  it('keeps staff codes intact, removes duplicate invitees and reloads their server statuses', async () => {
    flushReads();
    answer = { text: '000004, 000004\n000007', expiresAt: '' };
    store.act({ kind: 'invite' });
    TestBed.tick();
    const write = http.expectOne(
      (r) => r.method === 'POST' && r.url.endsWith('/invitations'),
    );
    expect(write.request.body).toEqual({
      reviewerUserIds: ['000004', '000007'],
    });
    write.flush(envelopeOk([invitation]));
    flushReads();
    store.showTab('invitations');
    flushReads();
    expect(store.invitations$()[0].capabilities).toEqual(['accept', 'decline']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    store.act({ kind: 'respond', invitation, action: 'accept' });
    TestBed.tick();
    const response = http.expectOne((r) =>
      r.url.endsWith('/review-invitations/30'),
    );
    expect(response.request.body).toEqual({
      expectedVersion: 8,
      action: 'accept',
    });
    response.flush(envelopeOk({ ...invitation, status: 'accepted' }));
    flushReads();
  });
  it('does not send a write when a review action dialog is cancelled', () => {
    flushReads();
    answer = undefined;
    store.act({ kind: 'conclude' });
    TestBed.tick();
    http.expectNone((r) => r.method === 'POST');
  });
});
