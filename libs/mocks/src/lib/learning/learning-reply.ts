import { backendRefusal, type BackendResponseKey } from '../backend-responses';
import { envelopeOk } from '../envelope';
import type { FakeReply } from '../backend/fake-backend';

/** Thrown inside a learning handler to answer with a refusal instead of data. */
export class LearningRefused extends Error {
  constructor(readonly reply: FakeReply) {
    super(reply.body.messageCode);
  }
}

export const refuse = (key: BackendResponseKey): never => {
  throw new LearningRefused(backendRefusal(key));
};

export const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});
