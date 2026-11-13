# Documentation

Submission artifacts for the Pharmacy Management System.

| File | Purpose |
|---|---|
| `er-diagram.md` | Mermaid source for the entity-relationship diagram |
| `er-diagram.png` | Exported ER diagram (see `er-diagram.md` for edit source) |
| `openapi.yaml` | OpenAPI 3 spec for the `/api/v1` endpoints (Swagger UI at `http://localhost:4000/docs`). A copy is kept at `backend/openapi.yaml` so a Render deploy with root directory `backend` can serve the same spec. |
| `technical-report.md` | Design rationale: ledger, FEFO, locking, idempotency, RBAC, trade-offs and unfinished work |
| `test-evidence.md` | Captured acceptance/regression output and role/API checkpoints |
| `demo-script.md` | Shot-by-shot 3–5 minute video script with exact demo data and fallbacks |
| `submission-checklist.md` | Final commit, links, deployment fallback, AI disclosure and logged-out checks |

The authoritative requirements are in [`../PRD.md`](../PRD.md). The live task
tracker, decisions and known limitations are in [`../PROGRESS.md`](../PROGRESS.md).

## Regenerating the ER diagram

Edit the Mermaid block in `er-diagram.md`, then export it with any Mermaid
renderer (for example the Mermaid CLI or an online renderer) to
`docs/er-diagram.png`. The schema in `backend/prisma/schema.prisma` remains the
source of truth.
