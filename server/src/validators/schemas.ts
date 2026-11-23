import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  displayName: z.string().trim().min(1).max(60),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(100) });

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional().or(z.literal("").transform(() => undefined));

export const createRunSchema = z.object({
  question: z.string().trim().min(10, "Ask a more specific question (10+ characters)").max(500),
  depth: z.enum(["quick", "standard", "deep"]).default("standard"),
  maxSources: z.coerce.number().int().min(3).max(30).default(10),
  dateFrom: date,
  dateTo: date,
});
