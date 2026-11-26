import { Router } from "express";
import bcrypt from "bcryptjs";
import { AgentEvent, Claim, Report, ResearchRun, Source, SourceSnapshot, User, Workspace } from "../models";
import { COOKIE, requireAuth, signToken } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { loginSchema, registerSchema, googleAuthSchema } from "../validators/schemas";
import { env } from "../config/env";
import { verifyFirebaseIdToken } from "../services/auth/firebase";

export const authRouter = Router();

const isProd = env.NODE_ENV === "production" || !env.CLIENT_ORIGIN.includes("localhost");
const cookieOpts = {
  httpOnly: true,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  secure: isProd,
  maxAge: 7 * 864e5,
};
const pub = (u: { _id: unknown; email: string; displayName: string }, token?: string) => ({
  id: String(u._id),
  email: u.email,
  displayName: u.displayName,
  ...(token ? { token } : {}),
});

authRouter.post("/register", async (req, res) => {
  const body = registerSchema.parse(req.body);
  if (await User.exists({ email: body.email.toLowerCase() })) throw new HttpError(409, "An account with this email already exists");
  const user = await User.create({ email: body.email, displayName: body.displayName, passwordHash: await bcrypt.hash(body.password, 12) });
  const token = signToken(String(user._id));
  res.cookie(COOKIE, token, cookieOpts).status(201).json(pub(user, token));
});

authRouter.post("/login", async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await User.findOne({ email: body.email.toLowerCase() });
  if (!user || !user.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new HttpError(401, "Email or password is incorrect");
  }
  const token = signToken(String(user._id));
  res.cookie(COOKIE, token, cookieOpts).json(pub(user, token));
});

authRouter.post("/google", async (req, res) => {
  const body = googleAuthSchema.parse(req.body);
  const gUser = await verifyFirebaseIdToken(body.idToken);

  let user = await User.findOne({ email: gUser.email });
  if (!user) {
    user = await User.create({
      email: gUser.email,
      displayName: gUser.displayName,
      authProvider: "google",
      googleUid: gUser.uid,
    });
  } else if (!user.googleUid) {
    user.googleUid = gUser.uid;
    await user.save();
  }

  const token = signToken(String(user._id));
  res.cookie(COOKIE, token, cookieOpts).json(pub(user, token));
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE, cookieOpts).json({ ok: true });
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
    SourceSnapshot.deleteMany({ userId: req.userId }),
    Claim.deleteMany({ runId: { $in: ids } }),
    Report.deleteMany({ runId: { $in: ids } }),
    AgentEvent.deleteMany({ runId: { $in: ids } }),
    Workspace.deleteMany({ userId: req.userId }),
  ]);
  await ResearchRun.deleteMany({ userId: req.userId });
  await User.deleteOne({ _id: req.userId });
  res.clearCookie(COOKIE).json({ ok: true });
});
