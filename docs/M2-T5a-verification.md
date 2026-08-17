# M2-T5a Human Verification — ParseProvider abstraction + document-type modules

**Task**: M2-T5a — `ParseProvider` interface + registry, `mock` adapter, document-type module registry for all 9 spec'd types, writes `parse_runs`
**Status**: Reopened scope complete — automated. Not yet manually verified by you — see steps below.

---

## Reopened scope (2026-08-16)

After the first pass below shipped, the 9 schemas were replaced end-to-end with comprehensive, nested/array field shapes (`design/schemas/*.v1.json`, via Grok) — full policy detail instead of a flat ~10-field summary per type, plus a new scalar/array/`group` field-shape convention (`design/schemas/README.md`, `design/document-type-modules.md` rule 6). This section covers re-landing that on the app side; the original section below it is unchanged history.

### What changed

1. **Schemas re-synced** — all 9 `services/api/src/document-types/schemas/*.v1.json` re-copied from the spec repo (byte-identical, verified via diff before this pass started).
2. **`SchemaField` is now a discriminated union** (`document-types/types.ts`): `ScalarSchemaField` (requires `group`) vs `ArraySchemaField` (`type: 'array'`, `items: {type:'string'}` or `{type:'object', properties: [...]}`, one level deep, no `group`). `isArrayField()` type guard added.
3. **`ParseField.value` / `FieldValue.value` widened** (`parse/types.ts`, `services/extracted-record.ts`) from scalar-only to scalar-or-array-of-(scalar|flat object) — matches `openapi.yaml`'s `FieldValue.value` `oneOf`.
4. **`mock-provider.ts` reworked** for array stubs: required arrays get 2 synthetic items, optional arrays get 1; object-array items populate every declared property. New tests (`parse/__tests__/mock-provider.test.ts`) specifically exercise this — the prior 94 tests all passed against the new schemas without modification (they assert structural invariants, not literal old field counts), which meant they proved nothing about the new array code path until these were added.
5. **`determineStatus()` empty-array gap fixed** — a required array field left empty (`[]`) now correctly triggers `needs_review`, the same as a missing scalar. This pure logic was pulled out of `parse-worker.ts` into a new dependency-free `workers/parse-status.ts` (`determineStatus`, `isMissingValue`) specifically so it unit-tests without needing `DATABASE_URL` — `parse-worker.ts` imports `lib/db.js` at module scope, which throws at import time without it. New `workers/__tests__/parse-status.test.ts` (9 tests) covers empty-array, missing-scalar, per-field-flag, and low-overall-confidence paths.
6. **New accordion review UI** (`services/web/src/components/DocumentDetail.tsx`) — one collapsible `<details>` section per distinct scalar `group`, plus one per array field (label + item-count badge), built generically from field metadata with **no per-document-type UI code**, per rule 6. Sections auto-expand when they contain a field needing review. Array-of-object items render as mini key/value cards with humanized property labels (raw keys aren't shipped with per-property labels, only the top-level array field has a `label`).
7. **`group` added to the `FieldValue` API payload** (`extracted-record.ts`, populated in `parse-worker.ts`'s `toFieldValues()` from the field spec) — needed for the UI to build sections at all, since `extracted_records.fields` previously carried no section metadata. **Not yet reflected in `openapi.yaml`** (additive optional property, not currently forbidden by the schema, but worth a small follow-up spec change via your Grok flow, same as the `FieldValue.value` `oneOf` update earlier — this is real spec drift, just non-breaking.)
8. **Test field-key renames** — `home_policy`'s `dwelling_coverage` → `dwelling_coverage_a_limit`; `landlord_policy`'s `property_address` → `property_address_street1` (now split into street1/city/state/postal_code); `renters_policy`'s `personal_property_coverage`/`loss_of_use_coverage` → `*_limit`; `landlord_policy`'s `loss_of_rents_coverage` → `loss_of_rents_coverage_limit`. Fixed in `m1-t4-vault.test.ts` and `m2-t5a-parse.test.ts`.

### Verification performed

- `services/api`: `npm run typecheck` clean, `npm test` → **106/106** (94 prior + 3 new array-stub tests + 9 new `determineStatus` tests).
- `services/web`: `npm run typecheck` clean, `npm run build` succeeds.
- Live end-to-end via rebuilt Docker containers (`docker-compose build api web && docker-compose up -d api web`, `AUTH_MODE` temporarily flipped to `mock` for the run and restored to `live` after): uploaded a real `auto_policy` document through the HTTP API, confirmed `named_insureds` (required object array) returned 2 fully-populated items with no `group`, confirmed scalar fields each carry the correct `group`, confirmed the served web bundle contains the new accordion markup/classes. Document deleted after.
- Integration regression (`AUTH_MODE=mock` temporarily): **66/66** across `m1-t1`, `m1-t2-auth`, `m1-t3-upload`, `m1-t4-vault`, `m1-t5-auth`, `m1-t6-events`, `m1-t7-onboarding`, `m2-t5a-parse` (`m2-t1-email-live`/`m2-t2-sms-live` intentionally excluded — separate parked live-delivery tasks, not part of this scope).
- **Not verified**: the accordion UI has not been visually inspected in an actual browser (no headless-browser tool available in this session) — confirmed via API response shape, fresh JS bundle content, and TypeScript/build correctness only. Worth a manual look before calling this fully done.

### Updated checklist

- [x] All 9 schemas comprehensive (nested/array), re-synced from spec repo
- [x] Scalar/array/`group` field-shape convention implemented in types + mock adapter
- [x] Empty required array correctly triggers `needs_review`
- [x] Accordion review UI renders generically from schema metadata, no per-type UI code
- [x] Field-key-rename test drift fixed
- [x] Full regression green (106 unit + 66 integration)
- [ ] **You visually confirm the accordion UI** in a browser — see step 6 below
- [ ] **Manually verified by you** — original steps 1–3 below, re-run against the new comprehensive schemas

---

## What changed

1. **Schema resync** — `database/schema.sql` was missing `parse_runs` (needed for this task) and your 4 new document types entirely; both were also applied live to the running local Postgres (non-destructive `ALTER TYPE ADD VALUE` + `CREATE TABLE IF NOT EXISTS`, since the volume already existed and `schema.sql` only runs on first `initdb`). The broader drift in `erasure_jobs`/`data_export_jobs`/`audit_events` between the app repo and spec was **not** touched — nothing currently depends on either version, and it's unrelated to this task; worth a dedicated cleanup later.
2. **`ParseProvider` interface + registry** (`services/api/src/parse/`) — matches `design/parse-provider.md`'s `ParseInput`/`ParseOutput` contract exactly. `getParseProvider()` reads `PARSE_PROVIDER` (default `mock`), same registry pattern as `email`/`sms`.
3. **`mock` adapter** — deterministic, schema-shaped stub output driven entirely by each type's real field list (`design/schemas/*.v1.json`, copied into `services/api/src/document-types/schemas/`). It never reads `input.fileBuffer` — real extraction is M2-T5b.
4. **Document-type module registry** (`services/api/src/document-types/`) — one module per type: the real schema JSON + a keyword list (used by M2-T4's type-match heuristic, which now delegates here instead of keeping its own copy) + a fully generic `mapDenormalized()` that works off each schema's own `denormalized_columns` mapping — no per-type code required. Covers all **9** types: the original 5 + your 4 new ones (`umbrella_policy`, `landlord_policy`, `renters_policy`, `long_term_care`). `tax`/`other` share a generic 2-field (`title`, `date`) fallback, per `parse-prompts.md` §4.10.
5. **New parse worker** (`services/api/src/workers/parse-worker.ts`) replaces the M1-T4 stub — dispatches through the registry, calls the configured provider, writes `extracted_records` **and** a `parse_runs` row, and applies `document-type-modules.md`'s low-confidence rule (required field missing, any field flagged, or overall confidence < 0.7 → `needs_review`, else `ready`).
6. `ALLOWED_DOCUMENT_TYPES`, the `DocumentType` TS union, and the web upload/vault type-label maps all extended to the 4 new types.

---

## A real bug found and fixed along the way

Two categories of pre-existing test/schema drift surfaced once real schema-driven data replaced the old hardcoded stub:

- **Field key mismatches**: the old stub worker used field names that never actually matched the real schemas — `life_insurance` used `death_benefit` (real key: `coverage_amount`), `warranty` used `issuer`/`warranty_number` (real keys: `provider`/`contract_number`), `receipt` used `order_number` (real key: `receipt_number`). Fixed in `m1-t4-vault.test.ts` to assert the real keys.
- **A design bug in my own mock adapter**: for the generic `tax`/`other` fallback (no schema), passing an empty field list made the mock adapter compute `overallConfidence: 0`, incorrectly forcing `needs_review` instead of `ready`. Fixed by giving the generic fallback a small real field spec (`title`, `date` — matching what `document-type-modules.md` actually describes for this case) instead of nothing.

Both were caught by the existing M1-T4 test suite failing for real reasons, not flakiness — full regression is green after both fixes.

---

## Preconditions

- Stack running: `docker-compose up -d --build`
- Web: http://localhost:3000 · API: http://localhost:8080
- `PARSE_PROVIDER=mock` (the default) — no AWS/Ollama/live credentials needed for this task.

---

## Verification steps

1. Upload a real PDF under each of the 4 new types (`umbrella_policy`, `landlord_policy`, `renters_policy`, `long_term_care`). **Verify**: each reaches `ready` and the detail page shows fields matching that type's real field list (e.g. `long_term_care` shows "Daily benefit amount," "Benefit period (years)," etc. — not generic auto-policy-style fields).
2. Upload one of the original 5 types (e.g. `auto_policy`). **Verify**: still works as before, though the specific stub *values* differ from what you saw pre-T5a (e.g. "Sample Carrier" instead of "State Farm") — this is expected; it's now driven by the real schema, not hand-picked demo data.
3. Upload a `tax` document. **Verify**: still reaches `ready` (not `needs_review`) with a sparse field list (title, date).
4. **Verify** (automated): `cd services/api && npm test` — `document-types/__tests__/registry.test.ts` (23 tests, all 9 modules + generic fallback), `parse/__tests__/` (10 tests, mock adapter + provider selection).
5. **Verify** (automated): `cd tests/integration && npm test` — `m2-t5a-parse.test.ts` (5 tests, the 4 new types + generic fallback through the real HTTP/parse pipeline), plus `m1-t4-vault.test.ts` (12 tests, fixed field-key assertions for the original 5 types).
6. **(Reopened scope, new)** Open a document's detail page in the browser. **Verify**: fields render as collapsible sections (one per `group` — e.g. "Policy," "Agent," "Premium," "Coverage" for `auto_policy` — plus one per array field like "Vehicles insured," "Named insureds," "Discounts applied," each showing an item-count badge). Sections containing a needs-review field should be expanded by default; others collapsed. Expand an array section (e.g. "Named insureds") and confirm each item renders as its own card with humanized property labels (e.g. "First Name," "Is Primary Named Insured").
7. **(Reopened scope, new)** Confirm a required array left empty forces `needs_review` — not currently reachable via the mock adapter (it always populates required arrays), but covered by `workers/__tests__/parse-status.test.ts`; will become directly observable once M2-T5b's real adapter can return a genuinely empty required array.

Full regression: **106/106 API unit tests, 66/66 integration tests** (mock mode).

---

## Success criteria checklist

- [x] `ParseProvider` interface matches `design/parse-provider.md`'s documented contract
- [x] `mock` adapter produces schema-correct output for all 9 types + generic fallback
- [x] Document-type registry covers all 9 spec'd types; adding a type going forward = one JSON file + one keyword-list entry, no core-service edits
- [x] `parse_runs` written on every parse attempt (verified directly against Postgres — no HTTP endpoint exposes this table yet)
- [x] `needs_review` correctly triggered by missing required fields / low confidence; generic fallback does **not** spuriously trigger it
- [x] M2-T4's type-match heuristic now sources its keywords from the same registry (single source of truth) instead of a separate hardcoded list
- [x] Full regression green, including two real pre-existing bugs found and fixed (stale field-key assertions, generic-fallback confidence bug)
- [ ] **Manually verified by you** — steps 1–3 above, plus steps 6–7 for the reopened scope

---

## Technical notes

- Schema JSON files are read via `fs.readFileSync` at module load (not a JS `import ... from '*.json'`) to avoid depending on Node's ESM JSON-import-attribute syntax, which varies by Node minor version.
- `tsc` alone doesn't copy non-`.ts` files into `dist/` — added a `copy-assets` step to `services/api/package.json`'s `build` script so the schema JSON ships in the production image (`node dist/index.js` would otherwise 404 on them).
- `PARSE_PROVIDER` config falls back to `mock` for any unrecognized value (not just when unset) — no adapter exists to fail over to until M2-T5b, so failing loudly here would just break local dev for no benefit yet.
- `services/document-validation.ts`'s M2-T4 heuristic keeps one small exception: `tax` has no dedicated document-type module (no `design/schemas/tax.v1.json`), so its keyword list stays local to that file rather than living in the registry.

---

## Related files

- `services/api/src/parse/`, `services/api/src/document-types/`, `services/api/src/workers/parse-worker.ts`, `services/api/src/services/parse-run.ts`
- `services/api/src/config.ts`, `services/api/src/index.ts`, `services/api/src/services/document.ts`, `services/api/src/routes/documents.ts`, `services/api/src/services/document-validation.ts`
- `database/schema.sql` (resynced: `parse_runs` table, 4 new enum values)
- `services/web/src/components/{Upload,Vault,DocumentDetail}.tsx` (new type labels)
- `.env.example`, `docker-compose.yml` (`PARSE_PROVIDER`)
- Tests: `services/api/src/document-types/__tests__/`, `services/api/src/parse/__tests__/` (unit); `tests/integration/m2-t5a-parse.test.ts` (new), `tests/integration/m1-t4-vault.test.ts` (fixed pre-existing drift)
- **Reopened scope**: `services/api/src/document-types/types.ts`, `services/api/src/document-types/registry.ts` (`GENERIC_FIELD_SPEC` group fix), `services/api/src/parse/types.ts`, `services/api/src/parse/mock-provider.ts`, `services/api/src/workers/parse-status.ts` (new), `services/api/src/services/extracted-record.ts`, `services/web/src/components/DocumentDetail.tsx`, `services/web/src/index.css` (accordion styles); tests: `services/api/src/parse/__tests__/mock-provider.test.ts` (array cases added), `services/api/src/workers/__tests__/parse-status.test.ts` (new)

---

**Code complete — awaiting your manual verification (steps 1–3, 6–7) before this is marked done. Next: M2-T5b (real Ollama/Qwen2.5-VL adapter behind this same interface).**
