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

### 🟡 M2-T5a: ParseProvider abstraction + mock adapter + document-type modules

**Status**: ✅ **Reopened scope complete — automated** (2026-08-17). Comprehensive schema rework landed on top of the already-complete first pass. Awaiting your manual verification (steps 1–3, 6–7 in the verification doc).
**Depends on**: M1-T4

Replaces the M1 stub worker: `ParseProvider` interface + registry, atomic per-type modules per `design/schemas/*` and `document-type-modules.md`, `mock` adapter, writes `parse_runs`.

**All 9 document types have dedicated modules**: `auto_policy`, `home_policy`, `life_insurance`, `warranty`, `receipt` (original 5) + `umbrella_policy`, `landlord_policy`, `renters_policy`, `long_term_care` (added 2026-08-16). `tax`/`other` share a generic 2-field (`title`, `date`) fallback, per `parse-prompts.md` §4.10.

**First-pass deliverables** (done, not undone by the reopen):
- ✅ `database/schema.sql` resynced from spec — was missing `parse_runs` entirely and the 4 new enum values; also applied live (non-destructive `ALTER TYPE`/`CREATE TABLE IF NOT EXISTS`) to the running local Postgres, since the volume predates this change and `schema.sql` only runs on first `initdb`. Broader drift in `erasure_jobs`/`data_export_jobs`/`audit_events` left untouched — unused by any app code, unrelated to this task.
- ✅ `services/api/src/parse/` — `ParseProvider` interface (matches `design/parse-provider.md`), `mock` adapter (schema-driven, not hardcoded), registry keyed by `PARSE_PROVIDER` (default `mock`; unrecognized values also fall back to mock until M2-T5b adds a real adapter)
- ✅ `services/api/src/document-types/` — registry of all 9 modules (schema JSON copied from spec + type-match keywords + generic `mapDenormalized()`); M2-T4's keyword heuristic now sources from here instead of its own local copy (one exception: `tax` has no module, keeps a small local keyword list)
- ✅ `services/api/src/workers/parse-worker.ts` replaces the M1-T4 stub worker; writes `extracted_records` **and** `parse_runs`; applies the low-confidence → `needs_review` rule from `document-type-modules.md`
- ✅ `ALLOWED_DOCUMENT_TYPES`, `DocumentType` union, web type-label maps extended to the 4 new types
- ✅ Unit tests (33) + integration tests (`m2-t5a-parse.test.ts`, `m1-t4-vault.test.ts` fixed) — 94/94 unit, 66/66 integration, all still passing as of the first pass

**Why reopened**: after review, the 9 schemas were substantially enriched — comprehensive real-world declarations-page depth (22–53 fields each) with **arrays for repeating entities** (`vehicles[]`, `drivers[]`, `named_insureds[]`, etc. — `auto_policy` alone has 8) and a `group` tag on every scalar field for the review UI. Spec changes are applied and verified byte-for-byte against the proposal (`docs/proposed-comprehensive-schemas.md`): `openapi.yaml`'s `FieldValue.value` now allows arrays, all 9 `design/schemas/*.v1.json` replaced, `document-type-modules.md`/`ux_spec.md`/`parse-prompts.md`/`schemas/README.md` updated with the array/group convention and a new rule (6) that the review UI must render sections generically from schema metadata, never hardcoded per type. **None of this is live in the app yet** — `services/api/src/document-types/schemas/*.json` are manual copies, still the old simple versions; nothing broke, nothing regressed, this is purely additional scope.

**Reopened scope**:
- ✅ Re-copy all 9 schema JSON files from `kanak-ai-specs/design/schemas/` into `services/api/src/document-types/schemas/`
- ✅ Extend `SchemaField`/`TypeSchema` types (`document-types/types.ts`) for `group` (required on scalars) and `type: 'array'` (`items`: scalar or flat-object-with-properties)
- ✅ Widen `ParseField.value` (`parse/types.ts`) and `FieldValue.value` (`services/extracted-record.ts`) from scalar-only to scalar-or-array, matching the `openapi.yaml` change
- ✅ Rework `mock-provider.ts`'s stub generation to handle array fields — 1–2 synthetic items per array, respecting each item's required properties and enums (meaningfully more work than the scalar-only stub generator)
- ✅ Fixed a real gap found during review: `parse-worker.ts`'s `determineStatus()` checks a required field for `null`/`undefined`/`''` but not an empty array (`[]`) — a required array field (e.g. `vehicles`) with zero items would incorrectly pass as `ready`. Pulled into a dependency-free `workers/parse-status.ts` so it's unit-testable without `DATABASE_URL`.
- ✅ New accordion review UI (`DocumentDetail.tsx`) — collapsible sections driven entirely by schema `group`/array metadata (no per-type UI code), one card per array item. Sections auto-expand when they contain a needs-review field. Required adding `group` to the `FieldValue` API payload (not yet reflected in `openapi.yaml` — additive/non-breaking, worth a small spec follow-up).
- ✅ Update test assertions for field-key renames from the enrichment: `dwelling_coverage`→`dwelling_coverage_a_limit`, `property_address`→split into `property_address_street1/city/state/postal_code`, `personal_property_coverage`/`loss_of_use_coverage`/`loss_of_rents_coverage`→`*_limit`
- ✅ Full regression + updated verification doc — 106/106 API unit tests, 66/66 integration tests, plus a live end-to-end check against rebuilt Docker containers

**Exit criteria** (first pass, still holding):
- ✅ All 9 types parse to `ready` with real, schema-correct field keys (not hardcoded per-type stub data)
- ✅ `tax`/`other` generic fallback still reaches `ready`, not spuriously `needs_review`
- ✅ `parse_runs` written per attempt (verified directly against Postgres — no HTTP endpoint yet)

**Exit criteria** (reopened scope, new):
- ✅ Mock adapter produces valid array data for all 9 types' array fields
- ✅ A required array field left empty correctly triggers `needs_review`
- ✅ Accordion UI renders any of the 9 types' full data (scalars grouped, arrays as sectioned cards) with zero type-specific UI code
- ✅ Full regression green with updated field-key assertions
- ⬜ **Your manual verification** — steps in the (updated) verification doc, including a visual check of the accordion UI in a browser (not yet done in this pass — no headless-browser tool available)

**Verification**: [docs/M2-T5a-verification.md](docs/M2-T5a-verification.md)

---

### ⬜ M2-T5b: Live local parse adapter (Ollama + Qwen2.5-VL, PDF-text fallback)

**Status**: Not started
**Depends on**: M2-T5a

Connects to the already-running host Ollama (`qwen2.5vl:7b`) via `OLLAMA_HOST`; digital-PDF fallback path using whichever of `pdf-parse` / `pdfjs-dist` proves more accurate on fixtures (decided during this task).

---

### ✅ M2-T5c: Low-confidence review UI + corrections

**Status**: ✅ Complete — automated and manually verified by you (2026-08-19).
**Depends on**: M2-T5a

`PATCH /documents/{id}/fields`, `field_corrections` persistence, inline correction UI in the accordion review screen.

**Scope decision (2026-08-19)**: chose the fuller option — edit **and** add/remove array items, not just editing values inside existing items. Implemented as whole-field replacement: the client already holds the current array from the last `GET`, so an edit/add/remove all become "send back the new array for this key," the same `{key, value}` shape as a scalar correction — no item-level operation codes needed in the API.

**Deliverables**:
- ✅ `field_corrections` table added to `database/schema.sql` (existed in specs, not yet in app) and applied live
- ✅ `PATCH /v1/documents/:id/fields` — validates keys against the real schema, rejects array/scalar shape mismatches, skips no-op corrections, recomputes denormalized columns via the existing `mapDenormalized()`, recomputes document status via a new `determineStatusAfterCorrection()` (ignores the stale parse-time `overall_confidence` once every field is individually clean)
- ✅ `services/field-correction-logic.ts` (pure diff/apply, dependency-free — same reasoning as `parse-status.ts`) + `services/field-correction.ts` (DB write)
- ✅ `itemSchema` added to array `FieldValue`s so the UI can build an "add item" form even when an array has 0 items
- ✅ `DocumentDetail.tsx` — every scalar field and array-item property is click-to-edit; array cards get Remove, sections get "+ Add item"; edits batch into local draft state with a sticky Save/Discard bar (one PATCH per save, not per keystroke); per-field needs-review dot added
- ✅ Unit tests (13 `field-correction-logic.test.ts` + `registry.test.ts` `enrichFieldsWithSchema` cases + `determineStatusAfterCorrection` cases) + integration tests (11 `m2-t5c-corrections.test.ts`)
- ✅ Full mock-mode regression: 124/124 unit, 77/77 integration

**Two real bugs found during your manual verification, both fixed**:
1. **Discoverability**: a freshly-added array item showed all its properties as inert "Not available" text (edit affordance only revealed on hover) — easy to miss as "nothing happened." Fixed: a blank new item now opens every property already in edit mode.
2. **Architectural gap**: `group`/`itemSchema` were being persisted into `extracted_records.fields` at parse/correction time instead of treated as schema metadata. An earlier correction on a test document wiped `discounts`' shape info entirely (stored as bare `{"value": [""]}`), permanently breaking "add item" for that document with no way to recover from stored data alone. Fixed properly, not just papered over: `enrichFieldsWithSchema()` now re-derives `group`/`itemSchema` from the *current* schema on every `GET`/`PATCH` response, overwriting whatever's in storage — any document, however old or corrupted, always reflects the current schema. Verified against a deliberately-corrupted repro document.

**A real gap (not a bug, expected)**: the mock `ParseProvider` always produces clean output (no field ever `needsReview: true`), so a document reaching `needs_review` with real correctable fields isn't reachable end-to-end yet — same class of gap as M2-T5a's empty-required-array case. `determineStatusAfterCorrection`'s actual transition is proven at the unit level instead; will be directly observable once M2-T5b's real adapter lands.

**Exit criteria**:
- ✅ Corrections validate against the real per-type schema (not accepted blindly)
- ✅ Array add/remove/edit all work through the same whole-field-replacement mechanism
- ✅ `field_corrections` audit trail written per changed key only
- ✅ Denormalized columns stay in sync with corrected source fields
- ✅ Schema metadata (`group`/`itemSchema`) always reflects the current schema, independent of what's stored
- ✅ Full regression green
- ✅ **Your manual verification** — array add/remove/edit, scalar edit, discard, batched save all confirmed

**Verification**: [docs/M2-T5c-verification.md](docs/M2-T5c-verification.md)

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
- [x] Parse writes structured fields per schema; detail + review UI works, corrections persist (M2-T5c manually verified — accordion display, scalar/array editing, add/remove all confirmed working end to end; M2-T5a's own checklist — e.g. uploading all 4 newer document types — not separately re-verified, but exercised indirectly through M2-T5c testing)
- [ ] Camera capture → upload → parse path works on web (M2-T6)
- [ ] Full M2 event set in `analytics_events` after happy-path runs (M2-T8)
- [ ] Admin dashboards (Ops health, Activation, Parse quality + intake) usable locally (M2-T7)
- [ ] Non-admin users cannot open admin routes (already true since M1-T6; re-verified in M2-T8)
- [ ] `compose up` + `.env.example` document live auth/AI keys (in progress — M2-T1 done, more per task)

---

**Last updated**: 2026-08-19
**Current task**: M2-T5c **done** (code + your manual verification) | Next up: M2-T5b (real Ollama/Qwen2.5-VL adapter) or M2-T5d (explainability UI) | M2-T5a reopened scope not separately re-verified ([docs/M2-T5a-verification.md](docs/M2-T5a-verification.md)) | M2-T4 code complete, awaiting your manual verification | M2-T1/M2-T2 live delivery verification available now that AWS credentials are refreshed, not yet run
