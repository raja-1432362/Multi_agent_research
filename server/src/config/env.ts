import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(5000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z.string().min(1, "GEMINI_MODEL is required (a model shown as free in AI Studio)"),
  TAVILY_API_KEY: z.string().min(1, "TAVILY_API_KEY is required"),
  MAX_RUNS_PER_DAY: z.coerce.number().default(5),
  MAX_SOURCES_CAP: z.coerce.number().default(15),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(` - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}
export const env = parsed.data;
