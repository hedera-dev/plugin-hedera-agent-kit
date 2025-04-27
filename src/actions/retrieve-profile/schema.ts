import { z } from "zod";

export const retrieveProfileParamsSchema = z.object({
  accountId: z
    .string()
    .optional(),
  disableCache: z
    .boolean()
    .optional()
}); 