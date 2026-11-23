import { AgentEvent, ResearchRun, RunStatus } from "../../models";

export class CancelledError extends Error {}

export async function logEvent(runId: string, stage: string, message: string, level: "info" | "warn" | "error" = "info") {
  await AgentEvent.create({ runId, stage, message, level });
}

/** Moves the run to a new stage; aborts the workflow if the user cancelled it. */
export async function enterStage(runId: string, status: RunStatus, message: string) {
  const cur = await ResearchRun.findById(runId).select("status");
  if (!cur || cur.status === "cancelled") throw new CancelledError();
  await ResearchRun.updateOne({ _id: runId }, { status, currentStage: status });
  await logEvent(runId, status, message);
}
