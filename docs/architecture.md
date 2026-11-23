# Architecture
```
React client ──/api──> Express (auth, validation, ownership) ──> LangGraph workflow ──> MongoDB Atlas
                                                      ├─ Gemini (planner, analyst, verifier, report)
                                                      └─ Tavily (search)
```
Graph state: runId, userId, question, scope, searchQueries, sources, themes, disagreements, claims, report, insufficient, errors, currentStage.
Runs execute in the background; the client polls `GET /api/research/:id`. On server start, runs left in a non-terminal state are marked failed so they can be retried.
Collections: users, researchruns, sources, claims, reports, agentevents.
