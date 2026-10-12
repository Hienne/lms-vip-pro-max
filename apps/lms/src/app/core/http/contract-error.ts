import type { z } from 'zod';

/** A response body did not match its endpoint schema: a contract bug, not a user error. */
export class ContractError extends Error {
  constructor(readonly issues: readonly z.core.$ZodIssue[]) {
    super(
      `Response does not match the contract: ${issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
    this.name = 'ContractError';
  }
}
