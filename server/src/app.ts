import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { researchRouter } from "./routes/research";
import { workspaceRouter } from "./routes/workspaces";
import { errorHandler } from "./middleware/error";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl)
        if (!origin) return callback(null, true);
        // Allow any localhost
        if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
        // Allow all vercel.app domains (including preview & production URLs)
        if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return callback(null, true);
        // Allow configured CLIENT_ORIGIN
        if (origin === env.CLIENT_ORIGIN) return callback(null, true);
        return callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "50kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use("/api", rateLimit({ windowMs: 15 * 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  app.use("/api/auth", rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }), authRouter);
  app.use("/api/research", researchRouter);
  app.use("/api/workspaces", workspaceRouter);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);
  return app;
}
