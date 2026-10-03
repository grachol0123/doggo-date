import { z } from "zod";

export const messageBounds = {
  body: {
    min: 1,
    max: 2000,
  },
} as const;

export const sendMessageSchema = z.object({
  matchId: z.uuid(),
  body: z.string().trim().min(messageBounds.body.min).max(messageBounds.body.max),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
