# API
All `/api/workspaces` and `/api/research` routes require authentication (cookie or `Authorization: Bearer <token>`) and return `404` for resources owned by other users.

- Auth: `POST /api/auth/{register,login,logout}`, `GET /api/auth/me`, `DELETE /api/auth/me`
- Workspaces & Watchlists:
  - `GET /api/workspaces`, `POST /api/workspaces`, `GET /api/workspaces/:id`, `DELETE /api/workspaces/:id`
  - `POST /api/workspaces/:id/competitors`, `DELETE /api/workspaces/:id/competitors/:compId`
  - `POST /api/workspaces/:id/sources`, `DELETE /api/workspaces/:id/sources/:srcId`
  - `PATCH /api/workspaces/:id/schedule`, `GET /api/workspaces/:id/changes`, `POST /api/workspaces/:id/run`
- Research & Review:
  - `POST/GET /api/research`, `GET /api/research/:id[/events|/sources|/claims|/report|/report.pdf|/report.md]`
  - `PATCH /api/research/:id/claims/:claimId/review`
  - `POST /api/research/:id/{retry,cancel,chat}`, `DELETE /api/research/:id`
