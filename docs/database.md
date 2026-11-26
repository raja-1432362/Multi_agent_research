# Database Collections
- `users`: registered accounts (`email`, `passwordHash`, `displayName`)
- `workspaces`: isolated competitor watchlists (`userId`, `competitors[]`, `approvedSources[]`, `schedule`, `limits`)
- `sourcesnapshots`: versioned snapshot text, SHA-256 `contentHash`, `fetchStatus`, `changeStatus`, `addedLines`, `removedLines`, `publishedAt` (null when unknown), `retrievedAt`
- `researchruns`: run configuration (`workspaceId`, `triggerType`, `collectionMode`), status, `metrics` (`durationMs`, `sourcesAttempted`, `sourcesFailed`, `snapshotsChanged`, `quoteMatchRate`, `humanCorrectionsCount`)
- `sources`: per-run cited source excerpts (capped, tagged with `sourceType`, `isOfficial`, `changeStatus`, `publishedAt`)
- `claims`: atomic claims with `codeVerified`, `evidence[]`, `status`, and `humanReview`
- `reports`: structured synthesis with `changesSummary`, `collectionWarnings`, `disagreements`, `limitations`
- `agentevents`: timestamped pipeline and human-review audit trail
