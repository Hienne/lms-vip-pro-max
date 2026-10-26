import {
  adminOrgEndpoints,
  AgentCommandSchema,
  agentEndpoints,
  authV1Endpoints,
  identityEndpoints,
  knowledgeEndpoints,
  organizationEndpoints,
  passwordByteLength,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  shellEndpoints,
  USER_LIMITS,
  type AnyEndpoint,
  type Envelope,
  type PendingAction,
  type ProfileChange,
  type FunctionInfo,
  type GrantScope,
  type KnowledgeDocument,
  type Me,
  type ManagedRoleGrant,
  type OrganizationInfo,
  type Role,
  type RoleOption,
  type SaveRoleCommand,
  type ScopeType,
  type TeamInfo,
  type UserDetail,
  type UserInfo,
  type UserSummary,
} from '@lms/contracts';
import {
  BACKEND_RESPONSES,
  backendRefusal,
  type BackendResponseKey,
} from '../backend-responses';
import {
  deleteRoleNotPermitted,
  deleteRoleRejected,
  roleFixtures,
  roleMissing,
  saveRoleRejected,
  systemRoleLocked,
  userAttemptFixtures,
  userAuditFixtures,
  userCourseFixtures,
} from '../admin-org/admin-org.fixtures';
import {
  AGENT_PROFILE_CARD_TITLE,
  AGENT_PROFILE_INVALID,
  AGENT_PROFILE_NOT_OFFERED,
  AGENT_PROFILE_UNCHANGED,
  AGENT_SCREEN_REFUSED,
  agentActionEvents,
  agentAiErrorEvents,
  agentDocumentEvents,
  agentNavigateEvents,
  agentNotFoundEvents,
  agentRefusedEvents,
} from '../assistant-agent/agent.fixtures';
import { envelopeError, envelopeOk } from '../envelope';
import { LearningBackend } from '../learning/learning.backend';
import {
  knowledgeAnswerFixture,
  knowledgeDocumentFixtures,
  knowledgeNotFoundFixture,
  knowledgeNotFoundStreamFixture,
  knowledgeStreamFixture,
} from '../knowledge/knowledge.fixtures';
import { navCountsFixtures } from '../shell/shell.fixtures';
import {
  SEED_FUNCTIONS,
  SEED_GRANTS,
  SEED_ORGS,
  SEED_PASSWORD,
  SEED_ROLES,
  SEED_TEAMS,
  SEED_TIME,
  SEED_USERS,
  type SeedGrant,
  type SeedOrg,
  type SeedTeam,
  type SeedUser,
} from './seed';

/** What the mock API hands the backend about one call: the endpoint's inputs and the bearer token. */
export interface FakeRequest {
  /** The token of the `Authorization` header, or `null` for an anonymous call. */
  readonly token: string | null;
  /** Path segments by name, as strings (`userId`, `orgId`, `grantId`, `teamId`). */
  readonly params: Readonly<Record<string, string>>;
  /** Query values by name, as strings. */
  readonly query: Readonly<Record<string, string>>;
  readonly body: unknown;
}

/**
 * The HTTP status and the envelope the backend would answer with. A streamed endpoint answers
 * `events` (one NDJSON line each) instead of an envelope's data; its refusals stay envelopes.
 */
export interface FakeReply {
  readonly status: number;
  readonly body: Envelope;
  readonly events?: readonly unknown[];
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type DbUser = Mutable<SeedUser> & { password: string; createSeq: number };
type DbGrant = Mutable<SeedGrant>;

/** Thrown inside a handler to answer with a refusal instead of data. */
class Refused extends Error {
  constructor(readonly reply: FakeReply) {
    super(reply.body.messageCode);
  }
}

const refuse = (key: BackendResponseKey): never => {
  throw new Refused(backendRefusal(key));
};

/** HTTP 200 with `CORE-VALIDATION_FAILED`: the backend's answer to a field it rejects. */
const invalid = (message: string): never => {
  const { code, title } = BACKEND_RESPONSES.validationFailed;
  throw new Refused({ status: 200, body: envelopeError(code, title, message) });
};

const ok = (data: unknown, status = 200): FakeReply => ({
  status,
  body: envelopeOk(data),
});

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

/** A user with several roles gets the nav counts of the most powerful one. */
const ROLE_PRIORITY = [
  'SUPER_ADMIN',
  'ADMIN',
  'INSTRUCTOR',
  'REPORT_VIEWER',
  'LEARNER',
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Handler = (request: FakeRequest) => FakeReply;

/** How long the backend keeps a proposed action waiting for its confirmation. */
const ACTION_TTL_MS = 10 * 60_000;

interface PendingProposal {
  readonly userId: string;
  readonly action: Extract<PendingAction, { tool: 'update_profile' }>;
  readonly expiresAt: number;
}

/** Lower case without accents, so a scripted marker matches however the question is typed. */
const fold = (text: string): string =>
  Array.from(text.normalize('NFC'))
    .map((char) => char.normalize('NFD').replace(/\p{M}/gu, ''))
    .join('')
    .replace(/đ/g, 'd')
    .toLowerCase();

const PROFILE_FIELDS = [
  { marker: 'chuc danh', field: 'positionName', label: 'Chức danh' },
  { marker: 'email', field: 'email', label: 'Email' },
  { marker: 'ho ten', field: 'fullName', label: 'Họ tên' },
] as const;

/**
 * The backend's identity and organisation services, in memory, on the demo seed: the same
 * statuses, codes, scoping and PATCH semantics as corebanking-academy, minus what no screen
 * needs (audit, locking, token expiry). It also answers the endpoints the backend lacks
 * (`served: 'mock'`: role CRUD, a user's courses, attempts and activity, the shell's nav counts)
 * so the app has one mock to talk to; those never check the caller, since a dev build can send
 * them with a token this database did not issue. One instance is one database; reload the page to reset
 * it. The mock API in the app and the specs both call `handle`.
 */
export class FakeBackend {
  private orgs: Mutable<SeedOrg>[] = SEED_ORGS.map((o) => ({ ...o }));
  private teams: Mutable<SeedTeam>[] = SEED_TEAMS.map((t) => ({ ...t }));
  private users: DbUser[] = SEED_USERS.map((u, index) => ({
    ...u,
    password: SEED_PASSWORD,
    createSeq: index,
  }));
  private grants: DbGrant[] = SEED_GRANTS.map((g) => ({ ...g }));
  private tokens = new Map<string, string>();
  private tokenSeq = 0;
  private nextOrgId = Math.max(...SEED_ORGS.map((o) => o.id)) + 1;
  private nextTeamId = Math.max(...SEED_TEAMS.map((t) => t.id)) + 1;
  private nextGrantId = Math.max(...SEED_GRANTS.map((g) => g.grantId)) + 1;
  private nextUserSeq = SEED_USERS.length;
  private roles: Mutable<Role>[] = roleFixtures.map((r) => ({
    ...r,
    menus: [...r.menus],
  }));
  private nextRoleSeq = 1;
  private documents: Mutable<KnowledgeDocument>[] =
    knowledgeDocumentFixtures.map((d) => ({ ...d }));
  /** Uploaded documents still moving to `ready`: one step per read, like the worker over time. */
  private pendingDocuments = new Set<number>();
  private nextDocumentId =
    Math.max(...knowledgeDocumentFixtures.map((d) => d.id)) + 1;

  /** Changes the assistant proposed and nobody has confirmed, by action id (the backend keeps them in memory too). */
  private pendingActions = new Map<string, PendingProposal>();
  private nextActionSeq = 1;

  /** The learning services, which ask this one who calls and who belongs where. */
  private readonly learning = new LearningBackend({
    callerId: (request) => this.caller(request).userId,
    people: () =>
      this.users
        .filter((u) => u.status === 'active')
        .map((u) => ({ userId: u.userId, orgId: u.orgId, teamId: u.teamId })),
    nameOf: (type, id) => {
      switch (type) {
        case 'user':
          return this.users.find((u) => u.userId === id)?.fullName;
        case 'team':
          return this.teams.find((t) => t.id === id)?.name;
        case 'org':
          return this.orgs.find((o) => o.id === id)?.name;
      }
    },
  });

  private readonly handlers = new Map<AnyEndpoint, Handler>([
    ...this.learning.entries(),
    [authV1Endpoints.login, (r) => this.login(r)],
    [authV1Endpoints.logout, (r) => this.logout(r)],
    [authV1Endpoints.me, (r) => this.me(r)],
    [authV1Endpoints.updateMe, (r) => this.updateMe(r)],
    [authV1Endpoints.changePassword, (r) => this.changePassword(r)],
    [identityEndpoints.listUsers, (r) => this.listUsers(r)],
    [identityEndpoints.createUser, (r) => this.createUser(r)],
    [identityEndpoints.getUser, (r) => this.getUser(r)],
    [identityEndpoints.updateUser, (r) => this.updateUser(r)],
    [identityEndpoints.setUserStatus, (r) => this.setUserStatus(r)],
    [identityEndpoints.grantRole, (r) => this.grantRole(r)],
    [identityEndpoints.revokeRole, (r) => this.revokeRole(r)],
    [identityEndpoints.listRoles, (r) => this.listRoles(r)],
    [organizationEndpoints.listOrgs, (r) => this.listOrgs(r)],
    [organizationEndpoints.createOrg, (r) => this.createOrg(r)],
    [organizationEndpoints.getOrg, (r) => this.getOrg(r)],
    [organizationEndpoints.updateOrg, (r) => this.updateOrg(r)],
    [organizationEndpoints.listTeams, (r) => this.listTeams(r)],
    [organizationEndpoints.createTeam, (r) => this.createTeam(r)],
    [organizationEndpoints.updateTeam, (r) => this.updateTeam(r)],
    [organizationEndpoints.deleteTeam, (r) => this.deleteTeam(r)],
    [adminOrgEndpoints.userCourses, () => ok(userCourseFixtures)],
    [adminOrgEndpoints.userAttempts, () => ok(userAttemptFixtures)],
    [adminOrgEndpoints.userAudit, () => ok(userAuditFixtures)],
    [adminOrgEndpoints.roles, () => this.listMockRoles()],
    [adminOrgEndpoints.saveRole, (r) => this.saveMockRole(r)],
    [adminOrgEndpoints.deleteRole, (r) => this.deleteMockRole(r)],
    [shellEndpoints.navCounts, (r) => this.navCounts(r)],
    [knowledgeEndpoints.documents, (r) => this.listDocuments(r)],
    [knowledgeEndpoints.document, (r) => this.getDocument(r)],
    [knowledgeEndpoints.uploadDocument, (r) => this.uploadDocument(r)],
    [knowledgeEndpoints.ask, (r) => this.ask(r)],
    [knowledgeEndpoints.askStream, (r) => this.askStream(r)],
    [agentEndpoints.stream, (r) => this.agentStream(r)],
    [agentEndpoints.confirmAction, (r) => this.confirmAction(r)],
    [agentEndpoints.cancelAction, (r) => this.cancelAction(r)],
  ]);

  /** True for the endpoints this backend answers; the others are not the backend's. */
  answers(endpoint: AnyEndpoint): boolean {
    return this.handlers.has(endpoint);
  }

  /** Answers one call, or `undefined` when `endpoint` is not the backend's. */
  handle(endpoint: AnyEndpoint, request: FakeRequest): FakeReply | undefined {
    const handler = this.handlers.get(endpoint);
    if (!handler) return undefined;
    try {
      return handler(request);
    } catch (error) {
      if (error instanceof Refused) return error.reply;
      throw error;
    }
  }

  // ---- mock-only endpoints: role CRUD, learning tabs, nav counts ----------------------------

  /** A mock refusal: HTTP 200 with the `ERROR` envelope, as the backend answers a business rule. */
  private refuseMock(body: Envelope): never {
    throw new Refused({ status: 200, body });
  }

  /** A role with how many users hold it: counted live for a system role, kept for a custom one. */
  private withUserCount(role: Mutable<Role>): Role {
    if (!role.system) return { ...role, menus: [...role.menus] };
    const roleId = SEED_ROLES.find(
      (r) => r.code.toLowerCase() === role.id,
    )?.roleId;
    const holders = new Set(
      this.grants
        .filter((g) => g.active && g.roleId === roleId)
        .map((g) => g.userId),
    );
    return { ...role, menus: [...role.menus], userCount: holders.size };
  }

  private listMockRoles(): FakeReply {
    return ok(this.roles.map((r) => this.withUserCount(r)));
  }

  private saveMockRole(request: FakeRequest): FakeReply {
    const command = request.body as SaveRoleCommand;
    const name = command.name.trim();
    if (!name) invalid('Tên vai trò không được để trống.');
    const existing = command.id
      ? this.roles.find((r) => r.id === command.id)
      : undefined;
    if (command.id && !existing) this.refuseMock(roleMissing);
    if (existing?.locked) this.refuseMock(systemRoleLocked);
    if (
      this.roles.some(
        (r) => r !== existing && r.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      this.refuseMock(saveRoleRejected);
    }
    const fields = {
      name,
      description: command.description.trim(),
      menus: [...command.menus],
    };
    if (existing) {
      Object.assign(existing, fields);
      return ok(this.withUserCount(existing));
    }
    const created: Mutable<Role> = {
      id: `custom-${this.nextRoleSeq++}`,
      ...fields,
      system: false,
      locked: false,
      userCount: 0,
    };
    this.roles.push(created);
    return ok(this.withUserCount(created));
  }

  private deleteMockRole(request: FakeRequest): FakeReply {
    const role = this.roles.find((r) => r.id === request.params['roleId']);
    if (!role) this.refuseMock(roleMissing);
    if (role.system) this.refuseMock(deleteRoleNotPermitted);
    if (this.withUserCount(role).userCount > 0) {
      this.refuseMock(deleteRoleRejected);
    }
    this.roles = this.roles.filter((r) => r !== role);
    return ok(true);
  }

  /** The caller's nav counts by their most powerful role; the learner's for an unknown token. */
  private navCounts(request: FakeRequest): FakeReply {
    const userId = request.token ? this.tokens.get(request.token) : undefined;
    const held = userId
      ? this.activeGrants(userId).map((g) => this.roleOf(g).code)
      : [];
    const role = ROLE_PRIORITY.find((code) => held.includes(code));
    return ok(navCountsFixtures[role ?? 'LEARNER']);
  }

  // ---- knowledge: shared documents and the chat -----------------------------------------------

  /** Every read moves each uploaded document one step: queued, processing, ready. */
  private advanceDocuments(): void {
    for (const id of [...this.pendingDocuments]) {
      const document = this.documents.find((d) => d.id === id);
      if (!document) continue;
      if (document.status === 'queued') {
        document.status = 'processing';
      } else {
        document.status = 'ready';
        document.chunkCount = 1;
        document.processedAt = new Date().toISOString();
        this.pendingDocuments.delete(id);
      }
    }
  }

  private listDocuments(request: FakeRequest): FakeReply {
    const actor = this.actor(request);
    const query = this.pageQuery(request, ['createTime'], 'createTime,desc');
    const statuses = (request.query['status'] ?? '').split(',').filter(Boolean);
    if (
      statuses.some(
        (s) => !['queued', 'processing', 'ready', 'failed'].includes(s),
      )
    ) {
      return invalid('status không hợp lệ.');
    }
    this.advanceDocuments();
    const rows = this.documents.filter(
      (d) =>
        (request.query['mine'] !== 'true' ||
          d.uploadedBy.userId === actor.userId) &&
        (statuses.length === 0 || statuses.includes(d.status)),
    );
    return ok(this.paged(rows, query, (d) => d.id));
  }

  private getDocument(request: FakeRequest): FakeReply {
    this.actor(request);
    this.advanceDocuments();
    const document = this.documents.find(
      (d) => d.id === Number(request.params['documentId']),
    );
    return document ? ok({ ...document }) : refuse('resourceNotFound');
  }

  private uploadDocument(request: FakeRequest): FakeReply {
    const actor = this.actor(request);
    const body = request.body;
    const file =
      body instanceof FormData
        ? body.get('file')
        : (body as { file?: unknown } | null)?.file;
    if (!(file instanceof Blob) || !(file as File).name) {
      return invalid('Cần chọn một tệp.');
    }
    const upload = file as File;
    if (!/\.(pdf|md|docx)$/i.test(upload.name)) {
      return refuse('fileTypeUnsupported');
    }
    if (upload.size === 0) return refuse('fileInvalid');
    if (upload.size > 20 * 1024 * 1024) return refuse('fileTooLarge');
    const document: Mutable<KnowledgeDocument> = {
      id: this.nextDocumentId++,
      fileName: upload.name,
      mimeType: upload.type || 'application/octet-stream',
      sizeBytes: upload.size,
      status: 'queued',
      errorMessage: null,
      pageCount: null,
      chunkCount: 0,
      uploadedBy: { userId: actor.userId, fullName: actor.fullName },
      createdAt: new Date().toISOString(),
      processedAt: null,
    };
    this.documents.unshift(document);
    this.pendingDocuments.add(document.id);
    return ok({ ...document }, 201);
  }

  private questionOf(request: FakeRequest): string {
    const question = (request.body as { question?: unknown } | null)?.question;
    if (typeof question !== 'string' || !question.trim()) {
      return invalid('Câu hỏi không được để trống.');
    }
    if (question.trim().length > 300) {
      return invalid('Câu hỏi tối đa 300 ký tự.');
    }
    return question.trim();
  }

  /** The mock finds nothing when the question says "không có"; every other question is answered. */
  private ask(request: FakeRequest): FakeReply {
    this.actor(request);
    const found = !this.questionOf(request).toLowerCase().includes('không có');
    return ok(found ? knowledgeAnswerFixture : knowledgeNotFoundFixture);
  }

  private askStream(request: FakeRequest): FakeReply {
    this.actor(request);
    const found = !this.questionOf(request).toLowerCase().includes('không có');
    return {
      status: 200,
      body: envelopeOk(null),
      events: found ? knowledgeStreamFixture : knowledgeNotFoundStreamFixture,
    };
  }

  // ---- quick assistant: scripted turns and confirmed actions ---------------------------------

  private agentStream(request: FakeRequest): FakeReply {
    const user = this.caller(request);
    const parsed = AgentCommandSchema.safeParse(request.body);
    const last = parsed.success ? parsed.data.messages.at(-1) : undefined;
    const text = last?.content.trim() ?? '';
    if (!last || text.length < 1 || text.length > 500) {
      return invalid('Tin nhắn phải từ 1 đến 500 ký tự.');
    }

    return {
      status: 200,
      body: envelopeOk(null),
      events: this.scriptedTurn(user, text),
    };
  }

  /** First match wins; see `agent.fixtures.ts` for what each reply says. */
  private scriptedTurn(user: DbUser, text: string) {
    const folded = fold(text);
    if (folded.includes('mo trang') || folded.includes('mo man hinh')) {
      const screen = this.functionsOf(user.userId)
        .filter((f) => f.routePattern && !f.routePattern.includes(':'))
        .filter((f) => folded.includes(fold(f.name)))
        .sort((a, b) => b.name.length - a.name.length)[0];
      return screen
        ? agentNavigateEvents(screen.routePattern as string, screen.name)
        : agentRefusedEvents('open_screen', AGENT_SCREEN_REFUSED);
    }
    const profile = this.profileTurn(user, text, folded);
    if (profile) return profile;
    if (folded.includes('loi ai')) return agentAiErrorEvents;
    if (folded.includes('khong co trong tai lieu')) return agentNotFoundEvents;
    return agentDocumentEvents;
  }

  /** "đổi chức danh … thành <giá trị>": a card, or the words the tool would give back. */
  private profileTurn(user: DbUser, text: string, folded: string) {
    const field = PROFILE_FIELDS.find((f) => folded.includes(f.marker));
    const at = folded.lastIndexOf(' thanh ');
    if (!field || at < 0) return undefined;
    const to = text
      .slice(at + ' thanh '.length)
      .trim()
      .replace(/[.!]+$/, '');
    if (!to) return undefined;
    if (user.authProvider !== 'LOCAL') {
      return agentRefusedEvents('update_profile', AGENT_PROFILE_NOT_OFFERED);
    }
    const valid =
      field.field === 'email'
        ? EMAIL.test(to) && to.length <= USER_LIMITS.email
        : to.length <= USER_LIMITS[field.field];
    if (!valid) {
      return agentRefusedEvents(
        'update_profile',
        AGENT_PROFILE_INVALID[field.field],
      );
    }
    const from = user[field.field] ?? null;
    if (from === to) {
      return agentRefusedEvents('update_profile', AGENT_PROFILE_UNCHANGED);
    }

    const change: ProfileChange = {
      field: field.field,
      label: field.label,
      from,
      to,
    };
    const expiresAt = Date.now() + ACTION_TTL_MS;
    const action: PendingProposal['action'] = {
      id: `agent-action-${this.nextActionSeq++}`,
      tool: 'update_profile',
      title: AGENT_PROFILE_CARD_TITLE,
      changes: [change],
      expiresAt: new Date(expiresAt).toISOString(),
    };
    this.pendingActions.set(action.id, {
      userId: user.userId,
      action,
      expiresAt,
    });
    return agentActionEvents(action);
  }

  /** The action when it is the caller's and has not expired, else the one not-found refusal. */
  private pendingOf(request: FakeRequest, user: DbUser): PendingProposal {
    const id = request.params['actionId'] ?? '';
    const pending = this.pendingActions.get(id);
    if (pending && pending.expiresAt <= Date.now())
      this.pendingActions.delete(id);
    if (
      !pending ||
      pending.userId !== user.userId ||
      pending.expiresAt <= Date.now()
    ) {
      return refuse('assistantActionNotFound');
    }
    return pending;
  }

  private confirmAction(request: FakeRequest): FakeReply {
    const user = this.caller(request);
    const pending = this.pendingOf(request, user);
    this.pendingActions.delete(pending.action.id);
    const changes = pending.action.changes;
    if (changes.some((c) => (user[c.field] ?? null) !== c.from)) {
      return refuse('assistantActionStale');
    }
    for (const c of changes) user[c.field] = c.to as string;
    return ok({
      actionId: pending.action.id,
      tool: pending.action.tool,
      message: 'Đã cập nhật hồ sơ.',
      data: this.meOf(user),
    });
  }

  private cancelAction(request: FakeRequest): FakeReply {
    const user = this.caller(request);
    this.pendingActions.delete(this.pendingOf(request, user).action.id);
    return ok(null);
  }

  // ---- identity: who is calling -------------------------------------------------------------

  private user(userId: string): DbUser | undefined {
    return this.users.find((u) => u.userId === userId);
  }

  private activeGrants(userId: string): DbGrant[] {
    return this.grants.filter((g) => g.userId === userId && g.active);
  }

  private roleOf(grant: SeedGrant) {
    const role = SEED_ROLES.find((r) => r.roleId === grant.roleId);
    if (!role) throw new Error(`Seed role ${grant.roleId} missing`);
    return role;
  }

  private functionsOf(userId: string): FunctionInfo[] {
    const ids = new Set(
      this.activeGrants(userId).flatMap((g) => this.roleOf(g).functionIds),
    );
    return SEED_FUNCTIONS.filter((f) => ids.has(f.id)).sort(
      (a, b) => a.sortNo - b.sortNo || a.id - b.id,
    );
  }

  /** The signed-in user; a missing or revoked token is HTTP 401. */
  private actor(request: FakeRequest): DbUser {
    const userId = request.token ? this.tokens.get(request.token) : undefined;
    const user = userId ? this.user(userId) : undefined;
    if (!user || user.status !== 'active') return refuse('unauthenticated');
    return user;
  }

  /** The signed-in user, who must have finished the forced password change. */
  private caller(request: FakeRequest): DbUser {
    const user = this.actor(request);
    if (user.mustChangePassword) return refuse('passwordChangeRequired');
    return user;
  }

  /** The caller, who must hold the screen `code` (a guard the real services also apply). */
  private caller_(request: FakeRequest, code: string): DbUser {
    const user = this.caller(request);
    if (!this.functionsOf(user.userId).some((f) => f.code === code)) {
      return refuse('accessDenied');
    }
    return user;
  }

  private hasRole(userId: string, roleCodes: string[], scope?: ScopeType) {
    return this.activeGrants(userId).some(
      (g) =>
        roleCodes.includes(this.roleOf(g).code) &&
        (scope === undefined || g.scope === scope),
    );
  }

  private isSuperAdmin(user: DbUser): boolean {
    return this.hasRole(user.userId, ['SUPER_ADMIN'], 'GLOBAL');
  }

  private isGlobalAdmin(user: DbUser): boolean {
    return this.hasRole(user.userId, ADMIN_ROLES, 'GLOBAL');
  }

  /** The org ids an `ADMIN` with ORG grants manages: each granted node and its active subtree. */
  private managedOrgIds(user: DbUser): Set<number> {
    const ids = new Set<number>();
    for (const grant of this.activeGrants(user.userId)) {
      if (
        grant.scope !== 'ORG' ||
        !ADMIN_ROLES.includes(this.roleOf(grant).code)
      ) {
        continue;
      }
      if (grant.orgId !== null) {
        for (const id of this.subtree(grant.orgId)) ids.add(id);
      }
    }
    return ids;
  }

  /** `orgId` and every active descendant (an inactive node cuts its branch off). */
  private subtree(orgId: number): number[] {
    const root = this.orgs.find((o) => o.id === orgId);
    if (!root || root.status !== 'active') return [];
    const ids = [orgId];
    for (const child of this.orgs.filter((o) => o.parentId === orgId)) {
      ids.push(...this.subtree(child.id));
    }
    return ids;
  }

  private canSeeOrg(actor: DbUser, orgId: number | null | undefined): boolean {
    if (this.isGlobalAdmin(actor)) return true;
    return orgId != null && this.managedOrgIds(actor).has(orgId);
  }

  private holdsAdminRole(userId: string): boolean {
    return this.hasRole(userId, ADMIN_ROLES);
  }

  /** May the actor change `target`? Not themselves, only inside their scope, and only a super admin touches an admin. */
  private canManage(actor: DbUser, target: DbUser): boolean {
    if (actor.userId === target.userId) return false;
    if (!this.canSeeOrg(actor, target.orgId)) return false;
    return !this.holdsAdminRole(target.userId) || this.isSuperAdmin(actor);
  }

  private manageable(request: FakeRequest, userId: string): [DbUser, DbUser] {
    const actor = this.caller_(request, 'USER_MANAGEMENT');
    const target = this.user(userId);
    if (!target || !this.canSeeOrg(actor, target.orgId)) {
      return refuse('resourceNotFound');
    }
    return [actor, target];
  }

  private revokeTokensOf(userId: string): void {
    for (const [token, owner] of this.tokens) {
      if (owner === userId) this.tokens.delete(token);
    }
  }

  // ---- views ------------------------------------------------------------------------------

  private orgOf(id: number | null | undefined) {
    return id == null ? undefined : this.orgs.find((o) => o.id === id);
  }

  private teamOf(id: number | null | undefined) {
    return id == null ? undefined : this.teams.find((t) => t.id === id);
  }

  private userInfo(user: DbUser): UserInfo {
    const org = this.orgOf(user.orgId);
    const team = this.teamOf(user.teamId);
    return {
      userId: user.userId,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      authProvider: user.authProvider,
      mustChangePassword: user.mustChangePassword,
      orgId: org?.id ?? null,
      orgCode: org?.code ?? null,
      orgName: org?.name ?? null,
      orgType: org?.orgType ?? null,
      teamId: team?.id ?? null,
      teamCode: team?.code ?? null,
      teamName: team?.name ?? null,
      positionName: user.positionName,
      lastSyncTime: null,
    };
  }

  private scopeOf(grant: SeedGrant): GrantScope {
    return { type: grant.scope, orgId: grant.orgId, teamId: grant.teamId };
  }

  private meOf(user: DbUser): Me {
    const grants = this.activeGrants(user.userId);
    const functions = this.functionsOf(user.userId);
    const functionScopes: Record<string, GrantScope[]> = {};
    for (const fn of functions) {
      functionScopes[fn.code] = grants
        .filter((g) => this.roleOf(g).functionIds.includes(fn.id))
        .map((g) => this.scopeOf(g));
    }
    return {
      user: this.userInfo(user),
      roles: [...new Set(grants.map((g) => this.roleOf(g).code))].sort(),
      functions: functions.map((f) => f.code),
      roleGrants: grants.map((g) => ({
        roleCode: this.roleOf(g).code,
        roleName: this.roleOf(g).name,
        scope: this.scopeOf(g),
      })),
      functionDetails: functions,
      functionScopes,
    };
  }

  private summary(actor: DbUser, user: DbUser): UserSummary {
    const info = this.userInfo(user);
    return {
      userId: user.userId,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      authProvider: user.authProvider,
      mustChangePassword: user.mustChangePassword,
      orgId: info.orgId,
      orgName: info.orgName,
      orgType: info.orgType,
      teamId: info.teamId,
      teamName: info.teamName,
      positionName: user.positionName,
      roleCodes: [
        ...new Set(
          this.activeGrants(user.userId).map((g) => this.roleOf(g).code),
        ),
      ].sort(),
      editable: this.canManage(actor, user),
    };
  }

  private managedGrant(actor: DbUser, grant: DbGrant): ManagedRoleGrant {
    const role = this.roleOf(grant);
    return {
      grantId: grant.grantId,
      roleId: role.roleId,
      roleCode: role.code,
      roleName: role.name,
      scope: this.scopeOf(grant),
      orgName: this.orgOf(grant.orgId)?.name ?? null,
      teamName: this.teamOf(grant.teamId)?.name ?? null,
      grantedBy: grant.grantedBy,
      grantedAt: grant.grantedAt,
      revocable:
        grant.userId !== actor.userId &&
        (!ADMIN_ROLES.includes(role.code) || this.isSuperAdmin(actor)),
    };
  }

  private detail(actor: DbUser, user: DbUser): UserDetail {
    return {
      user: this.userInfo(user),
      roleGrants: this.activeGrants(user.userId).map((g) =>
        this.managedGrant(actor, g),
      ),
      editable: this.canManage(actor, user),
    };
  }

  private orgInfo(org: SeedOrg): OrganizationInfo {
    return {
      id: org.id,
      parentId: org.parentId,
      orgType: org.orgType,
      code: org.code,
      name: org.name,
      status: org.status,
      sortNo: org.sortNo,
      memberCount: this.users.filter((u) => u.orgId === org.id).length,
      teamCount: this.teams.filter((t) => t.orgId === org.id).length,
    };
  }

  private teamInfo(team: SeedTeam): TeamInfo {
    const members = this.users
      .filter((u) => u.teamId === team.id)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
    return {
      id: team.id,
      orgId: team.orgId,
      code: team.code,
      name: team.name,
      description: team.description,
      status: team.status,
      memberCount: members.length,
      memberPreview: members
        .slice(0, 5)
        .map((u) => ({ userId: u.userId, fullName: u.fullName })),
    };
  }

  // ---- request reading ---------------------------------------------------------------------

  private bodyOf(request: FakeRequest, allowed: readonly string[]) {
    // Through JSON, as on the wire: a field set to `undefined` is not sent.
    const body: unknown =
      request.body === undefined
        ? undefined
        : JSON.parse(JSON.stringify(request.body));
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return refuse('malformedRequest');
    }
    for (const key of Object.keys(body)) {
      if (!allowed.includes(key)) {
        return invalid(`Trường ${key} không được hỗ trợ.`);
      }
    }
    return body as Record<string, unknown>;
  }

  /** A PATCH body: known fields only, and at least one. */
  private patchOf(request: FakeRequest, allowed: readonly string[]) {
    const body = this.bodyOf(request, allowed);
    if (Object.keys(body).length === 0) {
      return invalid('Vui lòng cung cấp thông tin cần cập nhật.');
    }
    return body;
  }

  private numberParam(request: FakeRequest, name: string): number {
    const value = Number(request.params[name]);
    return Number.isInteger(value) && value > 0
      ? value
      : refuse('malformedRequest');
  }

  private text(
    body: Record<string, unknown>,
    field: string,
    label: string,
    options: { max: number; required?: boolean; nullable?: boolean },
  ): string | null | undefined {
    if (!(field in body)) {
      if (options.required) invalid(`${label} là bắt buộc.`);
      return undefined;
    }
    const value = body[field];
    if (value === null) {
      if (options.nullable) return null;
      return invalid(`${label} không được để trống.`);
    }
    if (typeof value !== 'string') return invalid(`${label} không hợp lệ.`);
    if (options.required || !options.nullable) {
      if (value.trim() === '') return invalid(`${label} không được để trống.`);
    }
    if (value.length > options.max) {
      return invalid(`${label} tối đa ${options.max} ký tự.`);
    }
    return value;
  }

  private email(
    body: Record<string, unknown>,
    nullable: boolean,
  ): string | null | undefined {
    const value = this.text(body, 'email', 'Email', {
      max: USER_LIMITS.email,
      nullable,
    });
    if (typeof value === 'string' && !EMAIL.test(value)) {
      return invalid('Email không đúng định dạng.');
    }
    return value;
  }

  private password(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
      return invalid(`${label} là bắt buộc.`);
    }
    if (
      value.length < PASSWORD_MIN_LENGTH ||
      passwordByteLength(value) > PASSWORD_MAX_BYTES
    ) {
      return invalid(
        `${label} phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự và tối đa ${PASSWORD_MAX_BYTES} byte.`,
      );
    }
    return value;
  }

  private pageQuery(
    request: FakeRequest,
    sortFields: readonly string[],
    defaultSort: string,
  ) {
    const page = Number(request.query['page'] ?? 0);
    const size = Number(request.query['size'] ?? 20);
    if (!Number.isInteger(page) || page < 0)
      return invalid('page không hợp lệ.');
    if (!Number.isInteger(size) || size < 1 || size > 100) {
      return invalid('size phải từ 1 đến 100.');
    }
    const [field, direction = 'asc'] = (
      request.query['sort'] ?? defaultSort
    ).split(',');
    if (!sortFields.includes(field) || !['asc', 'desc'].includes(direction)) {
      return invalid(`sort chỉ nhận ${sortFields.join(', ')}.`);
    }
    return { page, size, field, descending: direction === 'desc' };
  }

  private paged<T>(
    rows: T[],
    query: { page: number; size: number; field: string; descending: boolean },
    key: (row: T, field: string) => string | number,
  ) {
    const sorted = [...rows].sort((a, b) => {
      const x = key(a, query.field);
      const y = key(b, query.field);
      const order =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y), 'vi');
      return query.descending ? -order : order;
    });
    const start = query.page * query.size;
    return {
      items: sorted.slice(start, start + query.size),
      page: query.page,
      size: query.size,
      totalElements: rows.length,
      totalPages: Math.ceil(rows.length / query.size),
    };
  }

  // ---- auth -----------------------------------------------------------------------------------

  private login(request: FakeRequest): FakeReply {
    const body = this.bodyOf(request, ['username', 'password']);
    if (
      typeof body['username'] !== 'string' ||
      body['username'].trim() === '' ||
      typeof body['password'] !== 'string' ||
      body['password'] === ''
    ) {
      return invalid('Tên đăng nhập và mật khẩu là bắt buộc.');
    }
    const name = body['username'].trim().toLowerCase();
    const user = this.users.find(
      (u) => u.username.toLowerCase() === name || u.userId === name,
    );
    if (
      !user ||
      user.password !== body['password'] ||
      user.status !== 'active'
    ) {
      return refuse('credentialsInvalid');
    }
    const token = `mock.${user.userId}.${++this.tokenSeq}`;
    this.tokens.set(token, user.userId);
    return ok({
      accessToken: token,
      tokenType: 'Bearer',
      expiresInSeconds: 1800,
    });
  }

  private logout(request: FakeRequest): FakeReply {
    this.revokeTokensOf(this.actor(request).userId);
    return ok(null);
  }

  private me(request: FakeRequest): FakeReply {
    return ok(this.meOf(this.actor(request)));
  }

  private updateMe(request: FakeRequest): FakeReply {
    const user = this.caller(request);
    const body = this.patchOf(request, ['fullName', 'email', 'positionName']);
    const fullName = this.text(body, 'fullName', 'Họ tên', {
      max: USER_LIMITS.fullName,
    });
    const email = this.email(body, true);
    const position = this.text(body, 'positionName', 'Chức danh', {
      max: USER_LIMITS.positionName,
      nullable: true,
    });
    if (fullName !== undefined) user.fullName = fullName as string;
    if (email !== undefined) user.email = email;
    if (position !== undefined) user.positionName = position;
    return ok(this.meOf(user));
  }

  private changePassword(request: FakeRequest): FakeReply {
    const user = this.actor(request);
    const body = this.bodyOf(request, ['currentPassword', 'newPassword']);
    if (
      typeof body['currentPassword'] !== 'string' ||
      body['currentPassword'] === ''
    ) {
      return invalid('Mật khẩu hiện tại là bắt buộc.');
    }
    const next = this.password(body['newPassword'], 'Mật khẩu mới');
    if (body['currentPassword'] !== user.password) {
      return refuse('currentPasswordIncorrect');
    }
    if (next === user.password) {
      return invalid('Mật khẩu mới phải khác mật khẩu hiện tại.');
    }
    user.password = next;
    user.mustChangePassword = false;
    this.revokeTokensOf(user.userId);
    return ok(null);
  }

  // ---- users ------------------------------------------------------------------------------------

  private listUsers(request: FakeRequest): FakeReply {
    const actor = this.caller_(request, 'USER_MANAGEMENT');
    const query = this.pageQuery(
      request,
      ['id', 'username', 'fullName', 'createTime'],
      'fullName,asc',
    );
    const q = (request.query['q'] ?? '').trim().toLowerCase();
    if (q.length > 100) return invalid('q tối đa 100 ký tự.');
    const status = request.query['status'];
    if (status && !['active', 'inactive', 'locked'].includes(status)) {
      return invalid('status không hợp lệ.');
    }
    const orgIds = request.query['orgId']
      ? new Set(this.subtree(Number(request.query['orgId'])))
      : null;
    const teamId = request.query['teamId']
      ? Number(request.query['teamId'])
      : null;
    const roleCode = request.query['roleCode'];
    const rows = this.users.filter(
      (u) =>
        this.canSeeOrg(actor, u.orgId) &&
        (!q ||
          [u.userId, u.username, u.fullName, u.email ?? '']
            .join('\n')
            .toLowerCase()
            .includes(q)) &&
        (!status || u.status === status) &&
        (!orgIds || (u.orgId !== null && orgIds.has(u.orgId))) &&
        (teamId === null || u.teamId === teamId) &&
        (!roleCode ||
          this.activeGrants(u.userId).some(
            (g) => this.roleOf(g).code === roleCode,
          )),
    );
    const page = this.paged(rows, query, (u, field) =>
      field === 'createTime'
        ? u.createSeq
        : field === 'id'
          ? u.userId
          : u[field as 'username' | 'fullName'],
    );
    return ok({
      ...page,
      items: page.items.map((u) => this.summary(actor, u)),
    });
  }

  private createUser(request: FakeRequest): FakeReply {
    const actor = this.caller_(request, 'USER_MANAGEMENT');
    const body = this.bodyOf(request, [
      'userId',
      'username',
      'fullName',
      'email',
      'positionName',
      'orgId',
      'teamId',
      'initialPassword',
      'initialRoleGrants',
    ]);
    const userId = this.text(body, 'userId', 'Mã cán bộ', {
      max: 20,
      required: true,
    }) as string;
    if (!USER_LIMITS.userIdPattern.test(userId)) {
      return invalid(
        'Mã cán bộ chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang.',
      );
    }
    const username = this.text(body, 'username', 'Tên đăng nhập', {
      max: 100,
      required: true,
    }) as string;
    if (!USER_LIMITS.usernamePattern.test(username)) {
      return invalid(
        'Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang.',
      );
    }
    const fullName = this.text(body, 'fullName', 'Họ tên', {
      max: USER_LIMITS.fullName,
      required: true,
    }) as string;
    const email = this.email(body, false) ?? null;
    const position =
      this.text(body, 'positionName', 'Chức danh', {
        max: USER_LIMITS.positionName,
      }) ?? null;
    const password = this.password(body['initialPassword'], 'Mật khẩu tạm');
    const grants = body['initialRoleGrants'];
    if (
      grants !== undefined &&
      (!Array.isArray(grants) || grants.length > 20)
    ) {
      return invalid('Tối đa 20 phân quyền ban đầu.');
    }
    const orgId = this.optionalId(body, 'orgId');
    const teamId = this.optionalId(body, 'teamId');
    this.checkMembership(actor, orgId, teamId);
    if (
      this.users.some(
        (u) =>
          u.userId.toLowerCase() === userId.toLowerCase() ||
          u.username.toLowerCase() === username.toLowerCase() ||
          u.userId.toLowerCase() === username.toLowerCase() ||
          u.username.toLowerCase() === userId.toLowerCase(),
      )
    ) {
      return refuse('identifierExists');
    }
    const created: DbUser = {
      userId,
      username: username.toLowerCase(),
      fullName,
      email,
      positionName: position,
      orgId,
      teamId,
      status: 'active',
      authProvider: 'LOCAL',
      mustChangePassword: true,
      password,
      createSeq: this.nextUserSeq++,
    };
    // Validate every grant before anything is stored, so a bad one leaves no half-made user.
    const staged = (grants ?? []) as unknown[];
    this.users.push(created);
    try {
      for (const grant of staged) this.addGrant(actor, created, grant);
    } catch (error) {
      this.users.pop();
      this.nextUserSeq--;
      this.grants = this.grants.filter((g) => g.userId !== userId);
      throw error;
    }
    return ok(this.detail(actor, created), 201);
  }

  private optionalId(
    body: Record<string, unknown>,
    field: string,
  ): number | null {
    const value = body[field];
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return invalid(`${field} phải là số nguyên dương.`);
    }
    return value;
  }

  /** The org must be active and in the actor's scope, and the team must belong to it. */
  private checkMembership(
    actor: DbUser,
    orgId: number | null,
    teamId: number | null,
  ): void {
    if (teamId !== null && orgId === null) refuse('membershipInvalid');
    if (orgId !== null) {
      const org = this.orgOf(orgId);
      if (!org || org.status !== 'active') refuse('membershipInvalid');
      if (!this.canSeeOrg(actor, orgId)) refuse('accessDenied');
    }
    if (teamId !== null) {
      const team = this.teamOf(teamId);
      if (!team || team.status !== 'active' || team.orgId !== orgId) {
        refuse('membershipInvalid');
      }
    }
  }

  private getUser(request: FakeRequest): FakeReply {
    const userId = request.params['userId'] ?? '';
    const [actor, target] = this.manageable(request, userId);
    return ok(this.detail(actor, target));
  }

  private updateUser(request: FakeRequest): FakeReply {
    const [actor, target] = this.manageable(
      request,
      request.params['userId'] ?? '',
    );
    if (!this.canManage(actor, target)) return refuse('accessDenied');
    const body = this.patchOf(request, [
      'fullName',
      'email',
      'positionName',
      'orgId',
      'teamId',
    ]);
    const fullName = this.text(body, 'fullName', 'Họ tên', {
      max: USER_LIMITS.fullName,
    });
    const email = this.email(body, true);
    const position = this.text(body, 'positionName', 'Chức danh', {
      max: USER_LIMITS.positionName,
      nullable: true,
    });
    const orgSupplied = 'orgId' in body;
    const teamSupplied = 'teamId' in body;
    const orgId = orgSupplied ? this.optionalId(body, 'orgId') : target.orgId;
    // Changing the org without naming a team drops the team, which belonged to the old org.
    const teamId = teamSupplied
      ? this.optionalId(body, 'teamId')
      : orgSupplied && orgId !== target.orgId
        ? null
        : target.teamId;
    if (orgSupplied || teamSupplied) this.checkMembership(actor, orgId, teamId);
    const moved = orgId !== target.orgId || teamId !== target.teamId;
    if (fullName !== undefined) target.fullName = fullName as string;
    if (email !== undefined) target.email = email;
    if (position !== undefined) target.positionName = position;
    target.orgId = orgId;
    target.teamId = teamId;
    if (moved) {
      // Grants scoped to the old org or team no longer make sense: revoke them.
      for (const grant of this.activeGrants(target.userId)) {
        if (grant.scope === 'ORG' || grant.scope === 'TEAM')
          grant.active = false;
      }
      this.revokeTokensOf(target.userId);
    }
    return ok(this.detail(actor, target));
  }

  private setUserStatus(request: FakeRequest): FakeReply {
    const [actor, target] = this.manageable(
      request,
      request.params['userId'] ?? '',
    );
    if (!this.canManage(actor, target)) return refuse('accessDenied');
    const body = this.bodyOf(request, ['status']);
    const status = body['status'];
    if (status !== 'active' && status !== 'inactive' && status !== 'locked') {
      return invalid('Trạng thái chỉ nhận active, inactive hoặc locked.');
    }
    if (status !== 'active') this.guardLastSuperAdmin(target, null);
    target.status = status;
    if (status !== 'active') this.revokeTokensOf(target.userId);
    return ok(this.detail(actor, target));
  }

  /** The last active SUPER_ADMIN GLOBAL stays: neither its status nor its grant may go. */
  private guardLastSuperAdmin(target: DbUser, grant: DbGrant | null): void {
    const supers = this.grants.filter(
      (g) =>
        g.active &&
        g.scope === 'GLOBAL' &&
        this.roleOf(g).code === 'SUPER_ADMIN' &&
        this.user(g.userId)?.status === 'active',
    );
    const touched = grant
      ? supers.filter((g) => g.grantId === grant.grantId)
      : supers.filter((g) => g.userId === target.userId);
    if (touched.length > 0 && supers.length - touched.length < 1) {
      refuse('lastSuperAdmin');
    }
  }

  // ---- roles and grants ---------------------------------------------------------------------------

  private assignableScopes(actor: DbUser, roleCode: string): ScopeType[] {
    const global = this.isGlobalAdmin(actor);
    const orgAdmin = this.managedOrgIds(actor).size > 0;
    if (!global && !orgAdmin) return [];
    switch (roleCode) {
      case 'LEARNER':
        return ['OWN'];
      case 'INSTRUCTOR':
        return global
          ? ['OWN', 'TEAM', 'ORG', 'GLOBAL']
          : ['OWN', 'TEAM', 'ORG'];
      case 'REPORT_VIEWER':
        return global ? ['TEAM', 'ORG', 'GLOBAL'] : ['TEAM', 'ORG'];
      case 'ADMIN':
        return this.isSuperAdmin(actor) ? ['ORG', 'GLOBAL'] : [];
      case 'SUPER_ADMIN':
        return this.isSuperAdmin(actor) ? ['GLOBAL'] : [];
      default:
        return [];
    }
  }

  private listRoles(request: FakeRequest): FakeReply {
    const actor = this.caller_(request, 'USER_MANAGEMENT');
    const roles: RoleOption[] = [...SEED_ROLES]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((role) => ({
        roleId: role.roleId,
        code: role.code,
        name: role.name,
        description: role.description,
        assignableScopes: this.assignableScopes(actor, role.code),
        capabilities: this.capabilities(role.code),
        functions: SEED_FUNCTIONS.filter((f) =>
          role.functionIds.includes(f.id),
        ),
      }));
    return ok(roles);
  }

  private capabilities(roleCode: string): string[] {
    if (!ADMIN_ROLES.includes(roleCode)) return [];
    const actions = [
      'USER_READ',
      'USER_CREATE',
      'USER_UPDATE',
      'USER_STATUS_UPDATE',
      'ROLE_GRANT',
      'ORG_READ',
      'ORG_CREATE',
      'ORG_UPDATE',
      'ORG_STATUS_UPDATE',
      'TEAM_READ',
      'TEAM_CREATE',
      'TEAM_UPDATE',
      'TEAM_DELETE',
    ];
    return roleCode === 'SUPER_ADMIN'
      ? [...actions, 'ADMIN_ROLE_GRANT']
      : actions;
  }

  private addGrant(actor: DbUser, target: DbUser, raw: unknown): DbGrant {
    const body =
      typeof raw === 'object' && raw !== null
        ? (raw as Record<string, unknown>)
        : refuse('malformedRequest');
    for (const key of Object.keys(body)) {
      if (!['roleId', 'scope', 'orgId', 'teamId'].includes(key)) {
        invalid(`Trường ${key} không được hỗ trợ.`);
      }
    }
    if (actor.userId === target.userId) refuse('accessDenied');
    const roleId = body['roleId'];
    const role = SEED_ROLES.find((r) => r.roleId === roleId);
    if (typeof roleId !== 'number' || !role) return refuse('scopeInvalid');
    const scope = body['scope'] as ScopeType;
    if (!this.assignableScopes(actor, role.code).includes(scope)) {
      return refuse('scopeInvalid');
    }
    let orgId = this.optionalId(body, 'orgId');
    let teamId = this.optionalId(body, 'teamId');
    switch (scope) {
      case 'GLOBAL':
      case 'OWN':
        if (orgId !== null || teamId !== null) refuse('scopeInvalid');
        break;
      case 'ORG':
        if (orgId === null || teamId !== null) refuse('scopeInvalid');
        if (!this.orgOf(orgId) || !this.canSeeOrg(actor, orgId)) {
          refuse('scopeInvalid');
        }
        break;
      case 'TEAM': {
        const team = this.teamOf(teamId);
        if (!team || (orgId !== null && orgId !== team.orgId)) {
          refuse('scopeInvalid');
        }
        orgId = team?.orgId ?? null;
        teamId = team?.id ?? null;
        if (!this.canSeeOrg(actor, orgId)) refuse('scopeInvalid');
        break;
      }
      default:
        refuse('scopeInvalid');
    }
    const duplicate = this.activeGrants(target.userId).some(
      (g) =>
        g.roleId === role.roleId &&
        g.scope === scope &&
        g.orgId === (scope === 'GLOBAL' || scope === 'OWN' ? null : orgId) &&
        g.teamId === (scope === 'TEAM' ? teamId : null),
    );
    if (duplicate) refuse('roleGrantExists');
    const grant: DbGrant = {
      grantId: this.nextGrantId++,
      userId: target.userId,
      roleId: role.roleId,
      scope,
      orgId: scope === 'GLOBAL' || scope === 'OWN' ? null : orgId,
      teamId: scope === 'TEAM' ? teamId : null,
      grantedBy: actor.userId,
      grantedAt: SEED_TIME,
      active: true,
    };
    this.grants.push(grant);
    this.revokeTokensOf(target.userId);
    return grant;
  }

  private grantRole(request: FakeRequest): FakeReply {
    const [actor, target] = this.manageable(
      request,
      request.params['userId'] ?? '',
    );
    const grant = this.addGrant(actor, target, request.body);
    return ok({ grantId: grant.grantId }, 201);
  }

  private revokeRole(request: FakeRequest): FakeReply {
    const [actor, target] = this.manageable(
      request,
      request.params['userId'] ?? '',
    );
    const grantId = this.numberParam(request, 'grantId');
    const grant = this.activeGrants(target.userId).find(
      (g) => g.grantId === grantId,
    );
    if (!grant) return refuse('resourceNotFound');
    if (actor.userId === target.userId) return refuse('accessDenied');
    if (
      ADMIN_ROLES.includes(this.roleOf(grant).code) &&
      !this.isSuperAdmin(actor)
    ) {
      return refuse('accessDenied');
    }
    this.guardLastSuperAdmin(target, grant);
    grant.active = false;
    this.revokeTokensOf(target.userId);
    return ok(null);
  }

  // ---- organisation ---------------------------------------------------------------------------------

  private listOrgs(request: FakeRequest): FakeReply {
    const actor = this.caller_(request, 'ORGANIZATION_MANAGEMENT');
    const query = this.pageQuery(
      request,
      ['id', 'code', 'name', 'sortNo'],
      'sortNo,asc',
    );
    const q = (request.query['q'] ?? '').trim().toLowerCase();
    if (q.length > 100) return invalid('q tối đa 100 ký tự.');
    const global = this.isGlobalAdmin(actor);
    const managed = this.managedOrgIds(actor);
    const visible = (o: SeedOrg) => global || managed.has(o.id);
    let rows = this.orgs.filter(visible);
    if (request.query['rootOnly'] === 'true') {
      // A root is a node whose parent the caller cannot see: the tree starts where the scope does.
      rows = rows.filter(
        (o) =>
          o.parentId === null || !visible(this.orgOf(o.parentId) as SeedOrg),
      );
    } else if (request.query['parentId']) {
      rows = rows.filter(
        (o) => o.parentId === Number(request.query['parentId']),
      );
    }
    if (request.query['orgType']) {
      rows = rows.filter((o) => o.orgType === request.query['orgType']);
    }
    if (request.query['status']) {
      rows = rows.filter((o) => o.status === request.query['status']);
    }
    if (q) {
      rows = rows.filter((o) =>
        `${o.code}\n${o.name}`.toLowerCase().includes(q),
      );
    }
    const page = this.paged(
      rows,
      query,
      (o, field) => o[field as 'id' | 'code' | 'name' | 'sortNo'],
    );
    return ok({ ...page, items: page.items.map((o) => this.orgInfo(o)) });
  }

  private orgIn(request: FakeRequest, actor: DbUser): Mutable<SeedOrg> {
    const org = this.orgOf(this.numberParam(request, 'orgId'));
    if (!org || !this.canSeeOrg(actor, org.id))
      return refuse('resourceNotFound');
    return org;
  }

  private getOrg(request: FakeRequest): FakeReply {
    const actor = this.caller_(request, 'ORGANIZATION_MANAGEMENT');
    const org = this.orgIn(request, actor);
    const administrators = this.grants
      .filter(
        (g) =>
          g.active &&
          g.scope === 'ORG' &&
          g.orgId === org.id &&
          this.roleOf(g).code === 'ADMIN',
      )
      .slice(0, 20)
      .map((g) => ({
        userId: g.userId,
        fullName: this.user(g.userId)?.fullName ?? g.userId,
        roleCode: this.roleOf(g).code,
        grantOrgId: g.orgId,
      }));
    return ok({ organization: this.orgInfo(org), administrators });
  }

  private checkOrgCode(code: string, exceptId?: number): void {
    const taken = this.orgs.some(
      (o) => o.id !== exceptId && o.code.toLowerCase() === code.toLowerCase(),
    );
    if (taken) refuse('orgCodeExists');
  }

  private createOrg(request: FakeRequest): FakeReply {
    const actor = this.caller_(request, 'ORGANIZATION_MANAGEMENT');
    if (!this.isGlobalAdmin(actor)) return refuse('accessDenied');
    const body = this.bodyOf(request, [
      'orgType',
      'parentId',
      'code',
      'name',
      'sortNo',
    ]);
    const orgType = body['orgType'];
    if (orgType !== 'UNIT' && orgType !== 'DEPARTMENT') {
      return invalid('Loại tổ chức chỉ nhận UNIT hoặc DEPARTMENT.');
    }
    const code = this.text(body, 'code', 'Mã tổ chức', {
      max: 50,
      required: true,
    }) as string;
    const name = this.text(body, 'name', 'Tên tổ chức', {
      max: 255,
      required: true,
    }) as string;
    const sortNo = body['sortNo'] ?? 0;
    if (typeof sortNo !== 'number' || !Number.isInteger(sortNo) || sortNo < 0) {
      return invalid('Thứ tự hiển thị phải là số không âm.');
    }
    const parentId = this.optionalId(body, 'parentId');
    const parent = this.orgOf(parentId);
    if (orgType === 'DEPARTMENT' && !parent) return refuse('hierarchyInvalid');
    if (
      parentId !== null &&
      (!parent || parent.orgType !== 'UNIT' || parent.status !== 'active')
    ) {
      return refuse('hierarchyInvalid');
    }
    this.checkOrgCode(code);
    const org: Mutable<SeedOrg> = {
      id: this.nextOrgId++,
      parentId,
      orgType,
      code,
      name,
      status: 'active',
      sortNo,
    };
    this.orgs.push(org);
    return ok(this.orgInfo(org), 201);
  }

  private updateOrg(request: FakeRequest): FakeReply {
    const actor = this.caller_(request, 'ORGANIZATION_MANAGEMENT');
    const org = this.orgIn(request, actor);
    const body = this.patchOf(request, ['code', 'name', 'sortNo', 'status']);
    if ('status' in body && !this.isGlobalAdmin(actor))
      return refuse('accessDenied');
    const code = this.text(body, 'code', 'Mã tổ chức', { max: 50 });
    const name = this.text(body, 'name', 'Tên tổ chức', { max: 255 });
    if ('sortNo' in body) {
      const sortNo = body['sortNo'];
      if (
        typeof sortNo !== 'number' ||
        !Number.isInteger(sortNo) ||
        sortNo < 0
      ) {
        return invalid('Thứ tự hiển thị phải là số không âm.');
      }
    }
    if (
      'status' in body &&
      body['status'] !== 'active' &&
      body['status'] !== 'inactive'
    ) {
      return invalid('Trạng thái chỉ nhận active hoặc inactive.');
    }
    if (typeof code === 'string') this.checkOrgCode(code, org.id);
    if (typeof code === 'string') org.code = code;
    if (typeof name === 'string') org.name = name;
    if (typeof body['sortNo'] === 'number') org.sortNo = body['sortNo'];
    if (body['status'] === 'active' || body['status'] === 'inactive') {
      org.status = body['status'];
    }
    return ok(this.orgInfo(org));
  }

  private listTeams(request: FakeRequest): FakeReply {
    const actor = this.caller_(request, 'ORGANIZATION_MANAGEMENT');
    const org = this.orgIn(request, actor);
    const query = this.pageQuery(request, ['id', 'code', 'name'], 'name,asc');
    const rows = this.teams.filter((t) => t.orgId === org.id);
    const page = this.paged(rows, query, (t, field) =>
      field === 'code' ? (t.code ?? '') : t[field as 'id' | 'name'],
    );
    return ok({ ...page, items: page.items.map((t) => this.teamInfo(t)) });
  }

  private checkTeamCode(
    orgId: number,
    code: string | null | undefined,
    exceptId?: number,
  ): void {
    if (!code) return;
    const taken = this.teams.some(
      (t) =>
        t.id !== exceptId &&
        t.orgId === orgId &&
        t.code?.toLowerCase() === code.toLowerCase(),
    );
    if (taken) refuse('teamCodeExists');
  }

  private createTeam(request: FakeRequest): FakeReply {
    const actor = this.caller_(request, 'ORGANIZATION_MANAGEMENT');
    const org = this.orgIn(request, actor);
    const body = this.bodyOf(request, ['code', 'name', 'description']);
    const code = this.text(body, 'code', 'Mã nhóm', { max: 50 }) ?? null;
    const name = this.text(body, 'name', 'Tên nhóm', {
      max: 255,
      required: true,
    }) as string;
    const description =
      this.text(body, 'description', 'Mô tả', { max: 4000 }) ?? null;
    this.checkTeamCode(org.id, code);
    const team: Mutable<SeedTeam> = {
      id: this.nextTeamId++,
      orgId: org.id,
      code,
      name,
      description,
      status: 'active',
    };
    this.teams.push(team);
    return ok(this.teamInfo(team), 201);
  }

  private teamIn(request: FakeRequest, actor: DbUser): Mutable<SeedTeam> {
    const team = this.teamOf(this.numberParam(request, 'teamId'));
    if (!team || !this.canSeeOrg(actor, team.orgId))
      return refuse('resourceNotFound');
    return team;
  }

  private updateTeam(request: FakeRequest): FakeReply {
    const actor = this.caller_(request, 'ORGANIZATION_MANAGEMENT');
    const team = this.teamIn(request, actor);
    const body = this.patchOf(request, ['code', 'name', 'description']);
    const code = this.text(body, 'code', 'Mã nhóm', {
      max: 50,
      nullable: true,
    });
    const name = this.text(body, 'name', 'Tên nhóm', { max: 255 });
    const description = this.text(body, 'description', 'Mô tả', {
      max: 4000,
      nullable: true,
    });
    this.checkTeamCode(team.orgId, code, team.id);
    if (code !== undefined) team.code = code;
    if (typeof name === 'string') team.name = name;
    if (description !== undefined) team.description = description;
    return ok(this.teamInfo(team));
  }

  private deleteTeam(request: FakeRequest): FakeReply {
    const actor = this.caller_(request, 'ORGANIZATION_MANAGEMENT');
    const team = this.teamIn(request, actor);
    const referenced =
      this.users.some((u) => u.teamId === team.id) ||
      this.grants.some((g) => g.teamId === team.id);
    if (referenced) return refuse('teamInUse');
    this.teams = this.teams.filter((t) => t.id !== team.id);
    return ok(null);
  }
}
