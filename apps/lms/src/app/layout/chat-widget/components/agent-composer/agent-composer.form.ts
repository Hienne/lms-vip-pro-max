import { AGENT_MESSAGE_MAX_LENGTH } from '@lms/contracts';
import { z } from 'zod';

/** The message box: 1 to 500 characters once trimmed, as the backend requires of the last message. */
export const AgentComposerSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, { error: 'Nhập tin nhắn.' })
    .max(AGENT_MESSAGE_MAX_LENGTH, {
      error: `Tin nhắn tối đa ${AGENT_MESSAGE_MAX_LENGTH} ký tự.`,
    }),
});

export type AgentComposerValue = z.input<typeof AgentComposerSchema>;

/** The counter shows from here, so the limit is no surprise. */
export const COUNTER_FROM = 400;
