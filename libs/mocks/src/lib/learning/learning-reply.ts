import {
  backendRefusal,
  BACKEND_RESPONSES,
  type BackendResponseKey,
} from '../backend-responses';
import { envelopeError, envelopeOk } from '../envelope';
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

/**
 * A `CORE-VALIDATION_FAILED` that names the failing field, as the publish answers for a row
 * (`assignments[i]`, `shareOrgIds[j]`): `code` and `message` are the row's own.
 */
export const refuseField = (
  field: string,
  code: string,
  message: string,
): never => {
  const {
    status,
    code: top,
    title,
    message: summary,
  } = BACKEND_RESPONSES.validationFailed;
  throw new LearningRefused({
    status,
    body: envelopeError(top, title, summary, [{ field, code, message }]),
  });
};

export const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});
