import { z } from "zod";
import { castToNull } from "../../shared/utils.ts";

export const hederaGetTopicMessagesParamsSchema = z.object({
  topicId: z.string(),
  lowerThreshold: z.string().nullable().transform(castToNull),
  upperThreshold: z.string().nullable().transform(castToNull),
});
