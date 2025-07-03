import { z } from "zod";

export const findRegistrationsParamsSchema = z.object({
  accountId: z
    .string()
    .optional()
    .describe(
      "Optional: Filter registrations by a specific Hedera account ID (e.g., 0.0.12345)"
    ),
  tags: z
    .array(z.number())
    .optional()
    .describe(
      "Optional: Filter registrations by AIAgentCapability enum values (e.g., 0=TEXT_GENERATION, 1=IMAGE_GENERATION)"
    ),
});
