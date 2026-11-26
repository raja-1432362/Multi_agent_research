# Security Checklist
- HTTPS in production, Helmet headers, strict CORS allowlist (localhost, configured `CLIENT_ORIGIN`, Vercel deployment origins)
- Rate limits on `/api` and `/api/auth`, Zod input validation on all bodies
- Ownership checks (`userId`) on every `/api/workspaces/*` and `/api/research/*` endpoint
- Server-only secrets (`GEMINI_API_KEY`, `TAVILY_API_KEY`, `JWT_SECRET`, `MONGODB_URI` never exposed in `VITE_*` or client code)
- SSRF prevention (`isSafePublicUrl` blocks localhost, private IPv4/IPv6, cloud metadata endpoints, non-HTTP schemes)
- Controlled collection respecting RFC 9309 `robots.txt` and HTTP access/rate-limit signals (no login/CAPTCHA/paywall bypassing)
- OWASP Prompt-Injection defenses: retrieved text sanitized of obfuscating control chars, isolated inside untrusted `DATA` blocks, no model tool execution, all source/claim IDs and quotes verified in TypeScript code
- Full data deletion via `DELETE /api/auth/me`, `DELETE /api/workspaces/:id`, and `DELETE /api/research/:id`
