import { END, START, StateGraph } from "@langchain/langgraph";
import { AgentEvent, Claim, Report, ResearchRun, Source } from "../models";
import { CancelledError, logEvent } from "./nodes/helpers";
import { analyseEvidence, normalizeSources, planQueries, saveResult, searchNode, verifyClaims, writeReport } from "./nodes";
import { ResearchState } from "./research.state";

const graph = new StateGraph(ResearchState)
  .addNode("plan_queries", planQueries)
  .addNode("search_web", searchNode)
  .addNode("normalize_sources", normalizeSources)
  .addNode("analyse_evidence", analyseEvidence)
  .addNode("verify_claims", verifyClaims)
  .addNode("write_report", writeReport)
  .addNode("save_result", saveResult)
  .addEdge(START, "plan_queries")
  .addEdge("plan_queries", "search_web")
  .addEdge("search_web", "normalize_sources")
  // Too few sources -> skip straight to saving an "insufficient evidence" result.
  .addConditionalEdges("normalize_sources", (s) => (s.insufficient ? "save_result" : "analyse_evidence"))
  .addConditionalEdges("analyse_evidence", (s) => (s.insufficient ? "save_result" : "verify_claims"))
  .addEdge("verify_claims", "write_report")
  .addEdge("write_report", "save_result")
  .addEdge("save_result", END)
  .compile();

/** Runs the workflow in the background. Never throws: failures are stored on the run. */
export async function runResearch(runId: string): Promise<void> {
  try {
    const run = await ResearchRun.findById(runId);
    if (!run) return;
    await graph.invoke({
      runId,
      userId: String(run.userId),
      question: run.question,
      scope: {
        depth: (run.scope?.depth ?? "standard") as "quick" | "standard" | "deep",
        maxSources: run.scope?.maxSources ?? 10,
        dateFrom: run.scope?.dateFrom ?? undefined,
        dateTo: run.scope?.dateTo ?? undefined,
      },
      searchQueries: [],
      sources: [],
      themes: [],
      disagreements: [],
      claims: [],
      report: null,
      insufficient: false,
      errors: [],
      currentStage: "queued",
    });
  } catch (err) {
    if (err instanceof CancelledError) return;
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Run ${runId} failed:`, message);
    await ResearchRun.updateOne({ _id: runId }, { status: "failed", error: message, completedAt: new Date() });
    await logEvent(runId, "failed", message, "error").catch(() => undefined);
  }
}

export async function resetRun(runId: string) {
  await Promise.all([
    Source.deleteMany({ runId }),
    Claim.deleteMany({ runId }),
    Report.deleteMany({ runId }),
    AgentEvent.deleteMany({ runId }),
  ]);
  await ResearchRun.updateOne(
    { _id: runId },
    { status: "queued", currentStage: "queued", error: null, warnings: [], searchQueries: [], sourceCount: 0, $unset: { completedAt: 1 } }
  );
}
