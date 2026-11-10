import type {
  AgentStreamEvent,
  ChatStreamEvent,
  ConversationDetail,
  ConversationSummary,
  Feedback,
  RateAnswerCommand,
  StoredAction,
  StoredActionStatus,
  StoredTurn,
  TurnSurface,
} from '@lms/contracts';

/** The default title: the first question, whitespace collapsed, cut to 80 characters. */
const TITLE_MAX = 80;

interface Row {
  readonly id: number;
  readonly ownerId: string;
  title: string;
  lastActivityTime: string;
  readonly createTime: string;
  readonly turns: StoredTurn[];
}

type TurnEvent = AgentStreamEvent | ChatStreamEvent;

/**
 * The saved conversations of both assistants, as the backend keeps them: per owner, newest
 * activity first, turns recorded from the events a stream sent. Another owner's id reads as not
 * found, and a card that nobody answered by `expiresAt` reads `expired`.
 */
export class ConversationBook {
  private rows: Row[] = [];
  private nextId = 1;
  private nextTurnId = 1;

  /** The conversation a stream continues, or a new one; `undefined` when `named` is not the owner's. */
  open(
    ownerId: string,
    named: number | null,
    question: string,
  ): number | undefined {
    if (named !== null) {
      return this.find(ownerId, named)?.id;
    }
    const now = new Date().toISOString();
    const row: Row = {
      id: this.nextId++,
      ownerId,
      title: titleOf(question),
      lastActivityTime: now,
      createTime: now,
      turns: [],
    };
    this.rows.push(row);
    return row.id;
  }

  /** Stores one finished turn, read off the events the stream sent. */
  record(
    ownerId: string,
    conversationId: number,
    surface: TurnSurface,
    question: string,
    events: readonly TurnEvent[],
  ): number | undefined {
    const row = this.find(ownerId, conversationId);
    if (!row) return undefined;
    const now = new Date().toISOString();
    let answer: string | null = null;
    let citations: StoredTurn['citations'] = [];
    let navigation: StoredTurn['navigation'] = null;
    let action: StoredAction | null = null;
    let status: StoredTurn['status'] = 'done';
    const toolNames: string[] = [];
    for (const event of events) {
      switch (event.type) {
        case 'tool':
          toolNames.push(event.name);
          break;
        case 'navigate':
          navigation = { path: event.path, title: event.title };
          break;
        case 'action_required':
          action = {
            ...event.action,
            status: 'pending',
            message: null,
          };
          break;
        case 'done':
          answer = event.answer;
          citations = event.citations;
          break;
        case 'error':
          status = 'error';
          break;
        default:
          break;
      }
    }
    const id = this.nextTurnId++;
    row.turns.push({
      id,
      surface,
      question,
      answer,
      citations,
      toolNames,
      navigation,
      actionId: action?.id ?? null,
      action,
      feedback: null,
      status,
      createTime: now,
    });
    row.lastActivityTime = now;
    return id;
  }

  /** Saves or replaces the owner's thumbs on a turn; `undefined` when it is not the owner's. */
  rate(
    ownerId: string,
    turnId: number,
    command: RateAnswerCommand,
  ): Feedback | undefined {
    const turn = this.rows
      .filter((row) => row.ownerId === ownerId)
      .flatMap((row) => row.turns)
      .find((candidate) => candidate.id === turnId);
    if (!turn) return undefined;
    const helpful = command.helpful;
    turn.feedback = {
      helpful,
      reasonCode: helpful ? null : (command.reasonCode ?? null),
      note: command.note?.trim() || null,
    };
    return turn.feedback;
  }

  /** A confirm or cancel changes the card the turn kept. */
  settle(
    ownerId: string,
    actionId: string,
    status: StoredActionStatus,
    message: string | null,
  ): void {
    for (const row of this.rows) {
      if (row.ownerId !== ownerId) continue;
      for (const turn of row.turns) {
        if (turn.action?.id === actionId) {
          turn.action = { ...turn.action, status, message };
        }
      }
    }
  }

  list(ownerId: string, q: string): ConversationSummary[] {
    const needle = q.trim().toLowerCase();
    return this.rows
      .filter(
        (row) =>
          row.ownerId === ownerId &&
          (!needle || row.title.toLowerCase().includes(needle)),
      )
      .sort(
        (a, b) =>
          b.lastActivityTime.localeCompare(a.lastActivityTime) || b.id - a.id,
      )
      .map(summaryOf);
  }

  get(ownerId: string, id: number): ConversationDetail | undefined {
    const row = this.find(ownerId, id);
    if (!row) return undefined;
    const now = Date.now();
    return {
      ...summaryOf(row),
      turns: row.turns.map((turn) => ({
        ...turn,
        action:
          turn.action &&
          turn.action.status === 'pending' &&
          Date.parse(turn.action.expiresAt) <= now
            ? { ...turn.action, status: 'expired' }
            : turn.action,
      })),
    };
  }

  rename(
    ownerId: string,
    id: number,
    title: string,
  ): ConversationSummary | undefined {
    const row = this.find(ownerId, id);
    if (!row) return undefined;
    row.title = title;
    return summaryOf(row);
  }

  remove(ownerId: string, id: number): boolean {
    const row = this.find(ownerId, id);
    if (!row) return false;
    this.rows = this.rows.filter((r) => r !== row);
    return true;
  }

  removeAll(ownerId: string): void {
    this.rows = this.rows.filter((row) => row.ownerId !== ownerId);
  }

  private find(ownerId: string, id: number): Row | undefined {
    return this.rows.find((row) => row.id === id && row.ownerId === ownerId);
  }
}

function titleOf(question: string): string {
  return question.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
}

function summaryOf(row: Row): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    lastActivityTime: row.lastActivityTime,
    createTime: row.createTime,
  };
}
