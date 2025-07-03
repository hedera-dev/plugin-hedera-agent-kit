import { z } from "zod";
import { retrieveProfileParamsSchema } from "./schema";

export type RetrieveProfileParams = z.infer<typeof retrieveProfileParamsSchema>;

export interface ProfileResult {
  displayName?: string;
  alias?: string;
  bio?: string;
  profileImage?: string;
  inboundTopicId?: string;
  outboundTopicId?: string;
  tags?: number[];
  properties?: Record<string, unknown>;
  aiAgent?: {
    type?: number;
    capabilities?: number[];
    model?: string;
    creator?: string;
  };
  [key: string]: unknown;
}
