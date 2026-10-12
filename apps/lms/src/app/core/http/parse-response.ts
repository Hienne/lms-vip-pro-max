import { map, type OperatorFunction } from 'rxjs';
import type { z } from 'zod';
import { ContractError } from './contract-error';

/** Parses every response body with its endpoint schema; throws `ContractError` on mismatch. */
export function parseResponse<S extends z.ZodType>(
  schema: S,
): OperatorFunction<unknown, z.output<S>> {
  return map((body) => {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new ContractError(result.error.issues);
    }
    return result.data;
  });
}
