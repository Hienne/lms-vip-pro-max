import { z } from 'zod';

/**
 * A timestamp as the backend sends it: ISO 8601, with or without an offset (a Java
 * `LocalDateTime` has none). Formatting is the app's job.
 */
export const BackendDateTimeSchema = z.iso.datetime({
  offset: true,
  local: true,
});
