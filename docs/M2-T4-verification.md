# M2-T4 Human Verification — PDF/type validation

**Task**: M2-T4 — Structural PDF validation + two-step content-vs-type confirmation + retention for unresolved uploads + `document_validation_passed`/`document_validation_failed` events
**Status**: Complete — automated, no live/AWS dependency. Not yet manually verified by you — see steps below.

---

## Design history (why this looks the way it does)

Three iterations, each based on your feedback:

1. **First cut**: a content-vs-type mismatch still stored the file and created the document as `needs_review`, discoverable later in the vault. You pointed out this pays storage cost even for the common case (wrong type picked by mistake), and leaves the user discovering a flagged item after the fact instead of deciding up front.
2. **Second cut**: the check moved *before* any storage/DB write. On a clear mismatch, nothing is persisted — the upload blocks with a `requiresConfirmation` response, and the web UI shows an inline prompt on the *upload screen*: "Upload anyway, or choose a different type?" A confirmed override then proceeded as an ordinary `pending` upload, same as a match.
3. **Current design**: after trying the override flow, you found two problems with treating a confirmed override as "clean": (a) it showed no lingering indication it needed review, and (b) it got picked up by the M1-T4 stub parse worker, which fabricates canned fake fields per document type regardless of actual content — so a confirmed-mismatch document ended up showing unrelated fake data with no warning. Fix: **a confirmed override now creates the document as `needs_review`**, not `pending` — it stays visibly flagged, and since the parse worker only polls `status = 'pending'`, it never gets the fake stub fields. A new **retention worker** removes `needs_review`/`failed` documents left unresolved past a configurable window (default 14 days), and the UI shows a live countdown.

**Explicitly deferred to M2-T5c** (not this task): clearing the flag by *correcting* fields. That needs a real field-correction UI and a `PATCH /documents/{id}/fields` endpoint, neither of which exist yet (the M1-T4 worker only ever produces fake placeholder fields — M2-T5a/b haven't been built). Right now, an overridden document can only leave `needs_review` by being deleted (manually, via the "Remove document" button) or by the retention worker removing it automatically.

---

## Scope note

`design/m2-capabilities.md` §3 lists three checks: (1) MIME/magic bytes = PDF, (2) not empty/under size limit, (3) *optional* text/layout heuristics or model "type check". This task implements all three, but (3) stays deliberately **bare-minimum**: a short list of distinctive keywords per document type, matched against text extracted from the PDF. Any single keyword hit counts as a match — no scoring, no comparison against other types' lists. If too little text can be extracted (image-only page, encrypted PDF, or a type with no keyword list, e.g. `other`), the check is skipped and always treated as a pass. The real semantic check is `design/document-type-modules.md`'s per-type `registry.validate()` step, which needs the actual parse pipeline (**M2-T5a**) to do properly.

---

## Preconditions

- Stack running: `docker-compose up -d --build`
- Web: http://localhost:3000 · API: http://localhost:8080
- No AWS/live credentials needed — this task is entirely local.

---

## What changed

1. **Structural check** (unchanged): first 5 bytes must be `%PDF-`, file must be non-empty. Hard `400` rejection, no document row created.
2. **Content-vs-type check**: for a structurally valid PDF, the server extracts text (`pdfjs-dist`) and checks it against the selected `documentType`'s keyword list, before uploading to storage or creating a document row.
   - No match, unconfirmed → **nothing is stored**. `400` with `{ requiresConfirmation: true, documentType, message }`.
   - Match, inconclusive, → proceeds as a normal upload, `status: 'pending'`.
   - No match, **confirmed override** (`confirmTypeOverride=true`) → proceeds, but `status: 'needs_review'` — visibly flagged, skipped by the parse worker, response message explains why and mentions the retention window.
3. **Web UI (`Upload.tsx`)**: on `requiresConfirmation`, an inline warning offers "Choose a different type" or "Upload anyway."
4. **Web UI (`Vault.tsx`/`DocumentDetail.tsx`)**: `needs_review` documents show an orange "Needs review" badge/pill plus a live countdown ("Auto-removed in N days if unresolved").
5. **Retention worker** (`services/api/src/workers/document-retention-worker.ts`): polls hourly, removes any `needs_review`/`failed` document whose `updated_at` is older than `config.documents.retentionDays` (default 14, `DOCUMENT_RETENTION_DAYS` env var) — deletes the MinIO object and the DB row.
6. **Events**: `document_validation_passed` (matched or inconclusive) / `document_validation_failed` (structural failure, unconfirmed mismatch, **or** a confirmed override — still a validation failure, just one the user chose to proceed past), `document_type` property only.

---

## Verification steps

1. Upload a real, correctly-typed PDF. **Verify**: 202, appears in vault as `pending`, no warning.
2. Upload a real PDF under a deliberately wrong type. **Verify**: inline warning appears on the upload screen; nothing appears in your vault yet.
3. Click **"Upload anyway."** **Verify**: upload succeeds, but the document shows an orange **"Needs review"** badge in the vault list *and* on the detail page, with a countdown ("Auto-removed in 14 days if unresolved" on a fresh upload). **Verify it does NOT show fabricated fields** (no "State Farm"/"John Smith"/etc.) — the detail page should show the "needs review" explanation instead of a field list.
4. Click **"Remove document"** on that flagged item (from the earlier delete-flow work) — **verify** it's gone from the vault.
5. Optional, slow: temporarily set `DOCUMENT_RETENTION_DAYS=0` in `.env`, rebuild `api`, upload another mismatched-and-overridden document, wait a few minutes (the worker polls hourly, so for a quick manual check you could instead directly shorten `POLL_INTERVAL_MS` temporarily, or just trust the unit-tested boundary logic) — **verify** it disappears from the vault and from MinIO. Revert `DOCUMENT_RETENTION_DAYS` afterward.
6. **Verify** (automated): `cd services/api && npm test` — `document-validation.test.ts` (10 tests), `document-retention.test.ts` (7 tests, boundary math).
7. **Verify** (automated): `cd tests/integration && npm test` — `m1-t3-upload.test.ts`: spoofed-`Content-Type` rejection, unconfirmed mismatch → blocked/nothing stored, confirmed override → `needs_review`, match → `pending`.

Full regression run (mock mode): **60/60 passing**.

---

## Success criteria checklist

- [x] Spoofed-`Content-Type` non-PDF upload rejected
- [x] Empty-file upload rejected
- [x] Unconfirmed content mismatch blocks with a confirmable prompt — no storage/DB write
- [x] Confirmed override still uploads, but stays flagged `needs_review` — no fake stub data, visible warning + countdown
- [x] Content that matches (or can't be judged) proceeds directly to `pending`
- [x] `needs_review`/`failed` documents older than the retention window are automatically removed (storage + DB)
- [x] `document_validation_passed`/`document_validation_failed` events recorded, `document_type` property only
- [x] No type-specific conditionals added to the shared upload route
- [ ] **Manually verified by you** — steps 1–4 above (step 5 optional/slow)

---

## Technical notes

- Dependency: `pdfjs-dist@^4.10.38` (an older `pdf-parse@1.x` was rejected — it threw an uncaught synchronous exception on a well-formed test PDF).
- `services/api/src/services/document-retention.ts`: pure `daysUntilRemoval`/`isPastRetention` functions, unit-tested with fixed dates (no real-clock waiting needed for the boundary logic itself).
- `services/api/src/services/document.ts`: `listStaleUnresolvedDocuments()` and `deleteDocumentById()` are **system-level, unscoped by user** — intentionally, since the retention worker acts on behalf of the system, not a specific request. Never call these from an HTTP route (the existing `deleteDocument(id, userId)` stays user-scoped for the actual `DELETE /v1/documents/:id` route).
- `services/api/src/workers/document-retention-worker.ts`: same `setInterval` pattern as `stub-parse-worker.ts`, hourly poll (retention is measured in days, so hourly granularity is more than sufficient).
- Web: `VITE_DOCUMENT_RETENTION_DAYS` (build-time, mirrors `VITE_API_BASE_URL`'s pattern) drives the *display* countdown only — the API's `DOCUMENT_RETENTION_DAYS` is what's actually enforced. Keep them in sync (`.env.example` documents this).
- Response shape for the blocked/flagged cases (`requiresConfirmation`, etc.) is additive to the OpenAPI-documented `400`/`Error` schema — not yet reflected in `openapi.yaml`, same pattern as M1-T6's admin ops-summary drift.

---

## Related files

- `services/api/src/services/document-validation.ts`, `services/api/src/services/document.ts`, `services/api/src/services/document-retention.ts`, `services/api/src/workers/document-retention-worker.ts`, `services/api/src/routes/documents.ts`, `services/api/src/config.ts`, `services/api/src/index.ts`
- `services/web/src/components/Upload.tsx`, `services/web/src/components/DocumentDetail.tsx`, `services/web/src/components/Vault.tsx`, `services/web/src/index.css`, `services/web/Dockerfile`
- `.env.example`, `docker-compose.yml`
- Tests: `services/api/src/services/__tests__/document-validation.test.ts`, `services/api/src/services/__tests__/document-retention.test.ts` (unit); `tests/integration/m1-t3-upload.test.ts` (regression + new cases)

---

**Code complete — awaiting your manual verification (steps 1–4) before this is marked done.**
