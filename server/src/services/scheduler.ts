import { env } from "../config/env";
import { ResearchRun, Workspace } from "../models";
import { runResearch } from "../workflows/research.graph";

let timer: NodeJS.Timeout | null = null;

export async function runDueWorkspaceChecks(): Promise<number> {
  const now = new Date();
  const due = await Workspace.find({
    "schedule.cadence": { $in: ["daily", "weekly"] },
    "schedule.nextRunAt": { $lte: now },
  }).limit(10);

  let triggered = 0;
  for (const ws of due) {
    const enabledCount = ws.approvedSources.filter((s) => s.enabled).length;
    if (enabledCount === 0 && ws.competitors.filter((c) => c.domain).length === 0) continue;

    // Respect daily quota per user
    const since = new Date(Date.now() - 864e5);
    const used = await ResearchRun.countDocuments({ userId: ws.userId, createdAt: { $gte: since } });
    if (used >= env.MAX_RUNS_PER_DAY) continue;

    const nextRunAt = new Date(
      now.getTime() + (ws.schedule?.cadence === "weekly" ? 7 * 864e5 : 864e5)
    );
    await Workspace.updateOne({ _id: ws._id }, { "schedule.nextRunAt": nextRunAt, "schedule.lastRunAt": now });

    const run = await ResearchRun.create({
      userId: ws.userId,
      workspaceId: ws._id,
      triggerType: "scheduled",
      collectionMode: "workspace_watchlist",
      question: ws.schedule?.defaultQuestion || `Scheduled competitor & market check for ${ws.name}`,
      scope: { depth: "standard", maxSources: Math.min(ws.limits?.maxRequestsPerRun ?? 12, env.MAX_SOURCES_CAP) },
    });

    void runResearch(String(run._id));
    triggered++;
  }
  return triggered;
}

export function startWorkspaceScheduler(intervalMs = 15 * 60_000) {
  if (timer) return;
  timer = setInterval(() => {
    void runDueWorkspaceChecks().catch((err) => console.error("Scheduler check failed:", err));
  }, intervalMs);
  timer.unref();
}

export function stopWorkspaceScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
