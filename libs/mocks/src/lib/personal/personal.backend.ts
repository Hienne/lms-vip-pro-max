import {
  AddNoteCommandSchema,
  BookmarkCommandSchema,
  personalEndpoints,
  type AnyEndpoint,
  type PersonalNotification,
  type SavedItem,
} from '@lms/contracts';
import { envelopeError, envelopeOk } from '../envelope';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import {
  achievementFixture,
  certificateFixtures,
  demoCertificatePdf,
  notificationFixtures,
  savedFixtures,
} from './personal.fixtures';

/** Stateful development fixture, isolated per authenticated caller. No achievement rules are calculated here. */
export class PersonalFakeBackend {
  private readonly users = new Map<
    string,
    { saved: SavedItem[]; notifications: PersonalNotification[] }
  >();
  private state(userId: string) {
    let state = this.users.get(userId);
    if (!state) {
      state = {
        saved: structuredClone(savedFixtures),
        notifications: structuredClone(notificationFixtures),
      };
      this.users.set(userId, state);
    }
    return state;
  }
  navCounts(userId: string) {
    return {
      notifications: this.state(userId).notifications.filter((x) => !x.readAt)
        .length,
      inbox: 0,
    };
  }
  answers(endpoint: AnyEndpoint) {
    return Object.values(personalEndpoints).some((e) => e === endpoint);
  }
  handle(
    endpoint: AnyEndpoint,
    request: FakeRequest,
    userId: string,
  ): (FakeReply & { binary?: Blob }) | undefined {
    if (!this.answers(endpoint)) return undefined;
    const state = this.state(userId),
      p = personalEndpoints;
    const ok = (data: unknown, status = 200): FakeReply => ({
      status,
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
    const invalid = (): FakeReply => ({
      status: 200,
      body: envelopeError(
        'MOCK_INVALID',
        'Dữ liệu chưa hợp lệ',
        'Vui lòng kiểm tra vị trí và nội dung.',
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
    if (endpoint === p.saved)
      return ok({
        ...page(
          state.saved.filter((x) =>
            request.query['type'] === 'bookmarks'
              ? x.text === null
              : x.text !== null,
          ),
        ),
        counts: {
          notes: state.saved.filter((x) => x.text !== null).length,
          bookmarks: state.saved.filter((x) => x.text === null).length,
        },
      });
    if (endpoint === p.addNote || endpoint === p.toggleBookmark) {
      const parsed =
        endpoint === p.addNote
          ? AddNoteCommandSchema.safeParse(request.body)
          : BookmarkCommandSchema.safeParse(request.body);
      if (!parsed.success) return invalid();
      const body = parsed.data;
      // This fixture knows only these two lessons; arbitrary IDs are refused.
      if (!['ls2', 'ls3'].includes(body.lessonId)) return missing();
      const old = state.saved.find(
        (x) =>
          x.text === null &&
          x.lessonId === body.lessonId &&
          JSON.stringify(x.anchor) === JSON.stringify(body.anchor),
      );
      if (endpoint === p.toggleBookmark && old)
        return ok({ saved: true, item: old });
      const item: SavedItem = {
        id: crypto.randomUUID(),
        courseId: 'c1',
        courseTitle: 'Nghiệp vụ CIF',
        lessonId: body.lessonId,
        lessonTitle:
          body.lessonId === 'ls2' ? 'Thay đổi CCCD' : 'Kiểm soát giao dịch',
        anchor: body.anchor,
        label: 'label' in body ? body.label : null,
        text: 'text' in body ? body.text : null,
        createdAt: new Date().toISOString(),
      };
      state.saved.unshift(item);
      return ok(endpoint === p.addNote ? item : { saved: true, item }, 201);
    }
    if (endpoint === p.deleteNote || endpoint === p.deleteBookmark) {
      const id =
        request.params[endpoint === p.deleteNote ? 'noteId' : 'bookmarkId'];
      const index = state.saved.findIndex(
        (x) =>
          x.id === id &&
          (endpoint === p.deleteNote ? x.text !== null : x.text === null),
      );
      if (index < 0) return missing();
      state.saved.splice(index, 1);
      return ok(
        endpoint === p.deleteNote ? { deleted: true } : { saved: false, id },
      );
    }
    if (endpoint === p.certificates) return ok(page(certificateFixtures));
    if (endpoint === p.certificate || endpoint === p.downloadCertificate) {
      const certificate = certificateFixtures.find(
        (x) => x.id === request.params['certificateId'],
      );
      if (!certificate) return missing();
      return endpoint === p.certificate
        ? ok(certificate)
        : { ...ok(null), binary: demoCertificatePdf() };
    }
    if (endpoint === p.progress) return ok(achievementFixture);
    if (endpoint === p.notifications)
      return ok(
        page(
          state.notifications.filter(
            (x) =>
              (!request.query['kind'] || x.kind === request.query['kind']) &&
              (request.query['unreadOnly'] !== 'true' || !x.readAt),
          ),
        ),
      );
    if (endpoint === p.markRead) {
      const item = state.notifications.find(
        (x) => x.id === request.params['notificationId'],
      );
      if (!item) return missing();
      item.readAt ??= new Date().toISOString();
      return ok({ id: item.id, readAt: item.readAt });
    }
    if (endpoint === p.markAllRead) {
      let updated = 0;
      for (const item of state.notifications)
        if (!item.readAt) {
          item.readAt = new Date().toISOString();
          updated++;
        }
      return ok({ updated, unreadCount: 0 });
    }
    return undefined;
  }
}
