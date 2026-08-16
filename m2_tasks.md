# Kanak AI - M2 Task Tracker

**Milestone**: M2 — Real intake, parse, explainability & ops (web only)

**Goal**: Upgrade M1's mock paths to real ones (auth delivery, type validation, parsing) while staying local-first, plus browser camera intake and admin dashboards for the new telemetry.

**Specs**: `design/m2-capabilities.md`, `design/parse-provider.md`, `design/hybrid-parse-engine.md`, `design/explainability-grounding.md`, `design/document-type-modules.md`, `design/prompts/parse-prompts.md`, `design/schemas/*`, `mvp-scope-and-milestones.md` (M2), OpenAPI, `schema.sql`

**Approach**: One vertical slice per task, human-gated, per `agent-workflow.md`. M2-T5 was split from the spec's single suggested task into T5a–d since it bundles four separable pieces (provider abstraction, live adapter, review UI, explainability) that are each already M1-task-sized on their own.

---

## Task Status

### ✅ M2-T1: Real email OTP (AWS SES)

**Status**: Complete
**Completed**: 2026-08-15
**Depends on**: M1-T2

**Backend deliverables**:
- ✅ `EmailProvider` interface (`services/api/src/email/types.ts`) — mirrors `ParseProvider`'s pluggable-adapter pattern
- ✅ `console` adapter (unchanged M1 behavior — logs instead of sending)
- ✅ `ses` adapter (AWS SES `SendEmail` via `@aws-sdk/client-ses`; credentials via standard AWS SDK env resolution — env vars, assumed-role session tokens, or an IAM role with zero code change)
- ✅ Provider registry/factory: `AUTH_MODE=mock` always uses `console` regardless of `EMAIL_PROVIDER` (never a real-delivery side effect in CI/local mock runs); `AUTH_MODE=live` uses `EMAIL_PROVIDER` (`console` default, `ses` for real delivery)
- ✅ `config.auth.mode` renamed `'mock' | 'real'` → `'mock' | 'live'` to match `design/TECH_STACK.md`'s `AUTH_MODE` contract (pure rename — nothing branched on the literal `'real'`)
- ✅ `services/auth.ts` refactored to send through the provider instead of an inline console-only function
- ✅ `EmailDeliveryError` — provider-agnostic failure classification (`recipient_rejected`, `credentials_invalid`, `unknown`) so vendor-specific error shapes stay inside the SES adapter; the route surfaces a generic, safe message to all callers plus a reason-specific dev-only hint outside `NODE_ENV=production`

**Exit criteria**:
- ✅ Mock-mode email OTP behavior unchanged (regression-verified: full M1 integration suite, 56/56, still passing)
- ✅ Unit tests prove the SES adapter builds the correct request, classifies errors correctly, and the factory picks the right provider (14 tests, mocked AWS SDK — no real network/cost)
- ✅ **Live delivery verified end-to-end with real AWS SES**: real email received with a working code, sign-in completed
- ✅ New opt-in `tests/integration/m2-t1-email-live.test.ts` (2 tests) — skips cleanly without live credentials (CI/other-contributor safe), passes against real SES when `LIVE_EMAIL_TEST_RECIPIENT` is set
- ✅ Error messaging hardened against two real failures hit during verification (not hypothetical): SES-sandbox/unverified-recipient rejection, and expired assumed-role credentials — each now gets a distinct, accurate dev-only hint instead of a generic 500

**Verification**: [docs/M2-T1-verification.md](docs/M2-T1-verification.md)

---

### 🟡 M2-T2: Real phone OTP (AWS SNS)

**Status**: Code complete, mock regression verified — live SMS delivery pending your AWS account + phone number
**Depends on**: M1-T5

**Backend deliverables**:
- ✅ `SmsProvider` interface (`services/api/src/sms/types.ts`) — exact structural mirror of `EmailProvider` from M2-T1
- ✅ `console` adapter (unchanged M1 behavior — logs instead of sending)
- ✅ `sns` adapter (AWS SNS `Publish` via `@aws-sdk/client-sns`; reuses the same AWS credential env vars as M2-T1's SES adapter)
- ✅ Provider registry/factory: `AUTH_MODE=mock` always uses `console` regardless of `SMS_PROVIDER`; `AUTH_MODE=live` uses `SMS_PROVIDER` (`console` default, `sns` for real delivery)
- ✅ `config.sms.provider` added, mirroring `config.email.provider`
- ✅ `services/auth.ts`'s `startPhoneOtp` refactored to send through the provider instead of an inline `console.log`
- ✅ `SmsDeliveryError` — provider-agnostic failure classification (`recipient_rejected`, `credentials_invalid`, `unknown`), same pattern as `EmailDeliveryError`; route surfaces a generic message plus a reason-specific dev-only hint outside `NODE_ENV=production`

**Exit criteria**:
- ✅ Mock-mode phone OTP behavior unchanged (regression-verified: full M1 integration suite, 56/56, still passing, including `m1-t5-auth.test.ts`)
- ✅ Unit tests prove the SNS adapter builds the correct request, classifies errors correctly, and the factory picks the right provider (13 tests, mocked AWS SDK — no real network/cost)
- ⬜ **Live delivery verified end-to-end with real AWS SNS**: real SMS received with a working code, sign-in completed — needs your AWS account + a real phone number
- ✅ New opt-in `tests/integration/m2-t2-sms-live.test.ts` (2 tests) — skips cleanly without live credentials

**Verification**: [docs/M2-T2-verification.md](docs/M2-T2-verification.md)

---

### ⬜ M2-T3: Sign in with Apple (real, web) — deferred

**Status**: Deferred (no Apple Services ID/key available yet)
**Depends on**: M1-T5

M1's mock Apple sign-in stays in place. Revisit when Apple Developer credentials exist; does not block later M2 tasks.

---

### 🟡 M2-T4: PDF/type validation

**Status**: Code complete, full regression passing — awaiting your manual verification
**Depends on**: M1-T3

Structural (magic-bytes) PDF validation, independent of client-supplied Content-Type, **plus** a bare-minimum content-vs-type keyword heuristic (per-type keyword list matched against extracted PDF text — any single hit counts as a match; inconclusive cases always pass, never reject); `document_validation_passed`/`document_validation_failed` events. The full semantic check (real understanding of whether content matches type) stays deferred to M2-T5a's document-type module registry (`registry.get(documentType).validate()`) — this heuristic only catches obvious, unambiguous mismatches as a stopgap, and adds no type-specific conditionals to the shared route (the keyword list is data, dispatched through one generic function).

**Redesigned twice after review feedback**:
1. (storage cost + UX) a content mismatch no longer silently stores the file and flags it `needs_review` for later discovery — it blocks *before* any storage/DB write, returns `requiresConfirmation`, and the upload screen shows an inline "Upload anyway / choose a different type" prompt.
2. (confirmed overrides still need review) a confirmed override no longer proceeds as clean `pending` data — it stays `needs_review` (visibly flagged, with a retention countdown), and is skipped by the parse worker so it never shows fabricated stub fields. Clearing the flag via actual field correction is explicitly deferred to **M2-T5c**; for now it clears only via manual delete or automatic retention.

**Deliverables**:
- ✅ `services/api/src/services/document-validation.ts` — `validatePdfStructure()` (magic bytes + non-empty), `extractPdfText()` (via `pdfjs-dist`), `checkDocumentTypeMatch()` (keyword heuristic)
- ✅ `routes/documents.ts` — structural check hard-rejects (`400`, no row created) before storage; unconfirmed content mismatch also blocks before storage (`400 { requiresConfirmation: true, documentType, message }`, no row created); confirmed override (`confirmTypeOverride=true`) proceeds but as `status: 'needs_review'`; a match/inconclusive result proceeds as `pending`
- ✅ Web UI (`Upload.tsx`) — inline warning + "Upload anyway"/"choose a different type" actions
- ✅ Web UI (`DocumentDetail.tsx`, `Vault.tsx`) — `needs_review` badge/pill + live retention countdown ("Auto-removed in N days if unresolved")
- ✅ Web UI (`DocumentDetail.tsx`) — "Remove document" delete action with inline confirm (backend `DELETE /v1/documents/:id` already existed, just had no UI trigger)
- ✅ `services/api/src/services/document-retention.ts` (pure, unit-tested boundary math) + `services/api/src/workers/document-retention-worker.ts` (hourly sweep) — removes `needs_review`/`failed` documents past `config.documents.retentionDays` (`DOCUMENT_RETENTION_DAYS`, default 14); `services/document.ts` gained system-level `listStaleUnresolvedDocuments()`/`deleteDocumentById()` (unscoped by user — worker-only, never call from an HTTP route)
- ✅ `document_validation_passed` (alongside existing `document_upload_accepted`) / `document_validation_failed` (structural failure, unconfirmed mismatch, **or** confirmed override) events, `document_type` property only

**Exit criteria**:
- ✅ Spoofed-`Content-Type` non-PDF upload rejected
- ✅ Unconfirmed content mismatch blocks with a confirmable prompt — zero storage cost
- ✅ Confirmed override still uploads but stays flagged `needs_review` — no fake stub data, visible warning + countdown
- ✅ Match/inconclusive proceeds to `pending` as before
- ✅ `needs_review`/`failed` documents past the retention window are automatically removed (storage + DB)
- ✅ Unit tests (10 `document-validation.test.ts` + 7 `document-retention.test.ts`) + integration test cases in `m1-t3-upload.test.ts`
- ✅ Full mock-mode regression: 60/60 passing
- ⬜ **Your manual verification** — steps in the verification doc

**Verification**: [docs/M2-T4-verification.md](docs/M2-T4-verification.md)

---

### ⬜ M2-T5a: ParseProvider abstraction + mock adapter + document-type modules

**Status**: Not started
**Depends on**: M1-T4

Replaces the M1 stub worker: `ParseProvider` interface + registry, atomic per-type modules (auto/home/life/warranty/receipt) per `design/schemas/*` and `document-type-modules.md`, `mock` adapter, writes `parse_runs`.

---

### ⬜ M2-T5b: Live local parse adapter (Ollama + Qwen2.5-VL, PDF-text fallback)

**Status**: Not started
**Depends on**: M2-T5a

Connects to the already-running host Ollama (`qwen2.5vl:7b`) via `OLLAMA_HOST`; digital-PDF fallback path using whichever of `pdf-parse` / `pdfjs-dist` proves more accurate on fixtures (decided during this task).

---

### ⬜ M2-T5c: Low-confidence review UI + corrections

**Status**: Not started
**Depends on**: M2-T5a

`PATCH /documents/{id}/fields`, `field_corrections` persistence, review UI (mock 06).

---

### ⬜ M2-T5d: Explainability UI

**Status**: Not started
**Depends on**: M2-T5b, M2-T5c

Snippet/confidence display; bounding-box highlight when the provider supplies coordinates (progressive enhancement per `explainability-grounding.md`).

---

### ⬜ M2-T6: Browser camera capture

**Status**: Not started
**Depends on**: M1-T3, M2-T4

`getUserMedia`/`capture="environment"`, full permission-state handling per `m2-capabilities.md` §5.1, `source=camera`, `intake_source` events.

---

### ⬜ M2-T7: Admin dashboards (Ops health, Activation, Parse quality + Intake)

**Status**: Not started
**Depends on**: M1-T6, M2-T1–T6

Extends the M1-T6 admin dashboard with parse queue/provider errors, sign-ins by method, parse success/fail by type + confidence buckets, upload-vs-camera breakdown.

---

### ⬜ M2-T8: M2 telemetry audit + docs

**Status**: Not started
**Depends on**: all above

Integration tests asserting every required M2 event lands in `analytics_events` (spec: exit-critical — missing telemetry fails the milestone), M2 human verification script, README/docs updates.

---

## M2 Exit Criteria

Per `design/m2-capabilities.md` §9:

- [ ] Sign in with real email OTP on local stack (code complete; **your AWS credentials needed to verify real delivery**)
- [ ] Sign in with real phone OTP on local stack (M2-T2)
- [ ] Sign in with Apple on web — **deferred**, not blocking other M2 exit items
- [ ] Upload PDF with selected type; mismatch surfaces validation feedback (M2-T4 code complete — structural + bare-minimum keyword check; awaiting your manual verification; full semantic check lands with M2-T5a's document-type module registry)
- [ ] Parse writes structured fields per schema; detail + review UI works (M2-T5a–d)
- [ ] Camera capture → upload → parse path works on web (M2-T6)
- [ ] Full M2 event set in `analytics_events` after happy-path runs (M2-T8)
- [ ] Admin dashboards (Ops health, Activation, Parse quality + intake) usable locally (M2-T7)
- [ ] Non-admin users cannot open admin routes (already true since M1-T6; re-verified in M2-T8)
- [ ] `compose up` + `.env.example` document live auth/AI keys (in progress — M2-T1 done, more per task)

---

**Last updated**: 2026-08-16
**Current task**: M2-T4 (code complete, 59/59 regression passing — awaiting your manual verification) | M2-T2 live SMS delivery still pending your AWS account activation (parked, not blocking)
