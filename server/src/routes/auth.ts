import { Router } from "express";
import bcrypt from "bcryptjs";
import { AgentEvent, Claim, Report, ResearchRun, Source, User } from "../models";
import { COOKIE, requireAuth, signToken } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { loginSchema, registerSchema } from "../validators/schemas";
import { env } from "../config/env";

export const authRouter = Router();

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: env.NODE_ENV === "production", maxAge: 7 * 864e5 };
const pub = (u: { _id: unknown; email: string; displayName: string }) => ({ id: String(u._id), email: u.email, displayName: u.displayName });

authRouter.post("/register", async (req, res) => {
  const body = registerSchema.parse(req.body);
  if (await User.exists({ email: body.email.toLowerCase() })) throw new HttpError(409, "An account with this email already exists");
  const user = await User.create({ email: body.email, displayName: body.displayName, passwordHash: await bcrypt.hash(body.password, 12) });
  res.cookie(COOKIE, signToken(String(user._id)), cookieOpts).status(201).json(pub(user));
});

authRouter.post("/login", async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await User.findOne({ email: body.email.toLowerCase() });
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new HttpError(401, "Email or password is incorrect");
  res.cookie(COOKIE, signToken(String(user._id)), cookieOpts).json(pub(user));
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE).json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, "Account not found");
  res.json(pub(user));
});

// Data deletion: removes the account and every run, source, claim and report it owns.
authRouter.delete("/me", requireAuth, async (req, res) => {
  const runs = await ResearchRun.find({ userId: req.userId }).select("_id");
  const ids = runs.map((r) => r._id);
  await Promise.all([
    Source.deleteMany({ runId: { $in: ids } }),
    Claim.deleteMany({ runId: { $in: ids } }),
    Report.deleteMany({ runId: { $in: ids } }),
    AgentEvent.deleteMany({ runId: { $in: ids } }),
  ]);
  await ResearchRun.deleteMany({ userId: req.userId });
  await User.deleteOne({ _id: req.userId });
  res.clearCookie(COOKIE).json({ ok: true });
});
