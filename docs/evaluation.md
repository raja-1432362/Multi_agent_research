# Evaluation & Testing Plan

Evidence Desk aligns with the NIST AI Risk Management Framework (measurement, documentation of limitations, and human oversight) by separating deterministic code checks from AI-assisted reasoning and running automated repeatable tests (`npm test`).

## Repeatable Test Cases (`server/tests/evaluation.test.ts` & `collector_and_diff.test.ts`)
1. **Claim clearly supported**: Verified verbatim quote match (`excerptInSource`) + official source linkage.
2. **Claim contradicted by another source**: Conflicting sources remain visible in `disagreements` and Contradiction Radar.
3. **Claim with insufficient evidence**: Fabricated or non-matching quotes fail `excerptInSource` and downgrade claim status to `insufficient` (`Not enough evidence`).
4. **Outdated page vs newer snapshot**: `diffSnapshots` detects pricing/text additions and removals and sets `changeStatus: "changed"`.
5. **Duplicate & near-duplicate URLs**: `canonicalUrl` strips tracking parameters (`utm_*`, `fbclid`, `gclid`), `www.`, hashes, and trailing slashes.
6. **Malicious prompt-injection source**: `sanitizeUntrustedText` strips zero-width/control characters and flags injection phrases; `stripInvalidCitations` drops unknown `[S#]` IDs.
7. **Unfetchable / blocked source**: Mocked `403`, `504`, CAPTCHA gates, and `robots.txt` disallows record `fetchStatus: "blocked" | "failed" | "robots_disallowed"` and mark prior snapshots stale rather than hiding failures.
8. **Workspace & user isolation**: Supertest checks confirm cross-user workspace/run access returns `404`, unauthenticated requests return `401`, and SSRF URLs are rejected with `400`.

## Tracked Run Metrics (`ResearchRun.metrics`)
- `durationMs` (run latency)
- `sourcesAttempted` vs `sourcesFailed`
- `snapshotsChanged`
- `quoteMatchRate` (fraction of model-quoted excerpts verified verbatim in saved snapshots)
- `humanCorrectionsCount` (updated whenever a user corrects or flags a claim)
