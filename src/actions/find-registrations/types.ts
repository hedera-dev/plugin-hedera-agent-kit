import { z } from "zod";
import { findRegistrationsParamsSchema } from "./schema";

export type FindRegistrationsParams = z.infer<
  typeof findRegistrationsParamsSchema
>;
