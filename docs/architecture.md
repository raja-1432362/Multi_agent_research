# Architecture
```
React client ──/api──> Express (auth, validation, ownership) ──> LangGraph workflow ──> MongoDB Atlas
                                                      ├─ Controlled Collector (approved URLs, RSS, uploads, RFC 9309 robots check)
                                                      ├─ Snapshot Diff Checker (SHA-256 + line diffs vs earlier snapshots)
                                                      ├─ Gemini (planner, analyst, verifier, report writer)
                                                      └─ Tavily (domain-scoped or open search) + arXiv (open research)
```
Graph state: `runId`, `userId`, `workspaceId`, `collectionMode`, `question`, `scope`, `searchQueries`, `sources`, `themes`, `disagreements`, `changesSummary`, `collectionWarnings`, `claims`, `report`, `insufficient`, `sourcesAttempted`, `sourcesFailed`, `snapshotsChanged`, `quoteMatchRate`, `errors`, `currentStage`.

Collections: `users`, `workspaces`, `sourcesnapshots`, `researchruns`, `sources`, `claims`, `reports`, `agentevents`.
