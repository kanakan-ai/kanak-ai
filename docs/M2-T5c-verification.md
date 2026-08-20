# M2-T5c Human Verification — Low-confidence review UI + corrections

**Task**: M2-T5c — `PATCH /documents/{id}/fields`, `field_corrections` persistence, inline correction UI in the accordion review screen.
**Status**: ✅ Complete — automated and manually verified by you (2026-08-19).

---

## Scope decision

You chose **edit + add/remove array items** (not just editing values inside existing items) when this task was scoped. Array corrections are implemented as **whole-field replacements**: the client already holds the current array from the last `GET`, so editing a value, adding a row, or removing a row are all just "compute the new array locally, send it back as the value for that key" — the same `{key, value}` shape as a scalar correction. No item-level operation codes in the API.

## What changed

1. **`field_corrections` table** — added to `database/schema.sql` (existed in the specs but not yet in the app) and applied live to the running Postgres. Audit row per changed field key: `previous_value`/`new_value` (JSONB — supports whole-array values), `previous_confidence`, `source: 'user_detail_edit'`.
2. **`PATCH /v1/documents/{id}/fields`** (`routes/documents.ts`) — accepts `{ fields: [{key, value}] }`. Validates each key exists on the document type's schema and that the value's array-vs-scalar shape matches (rejects with 400 otherwise, listing the bad keys). No-op corrections (identical value) are silently skipped — no audit row, no field mutation. Ownership-checked (404 for another user's document or a nonexistent one), same pattern as the existing document routes.
3. **`applyCorrections()`** (`services/field-correction-logic.ts`) — pure diff/apply function: given current fields + a correction batch + the schema, returns the updated fields, which keys actually changed (for the audit trail), and which were unknown/malformed. Kept dependency-free (no `db.js` import) so it unit-tests without `DATABASE_URL` — same reasoning as `workers/parse-status.ts`.
4. **`determineStatusAfterCorrection()`** (`workers/parse-status.ts`) — recomputes `ready`/`needs_review` after a correction, reusing the same missing-required/flagged-field logic as the original parse-time `determineStatus()`, but **deliberately ignoring the document's stored `overall_confidence`** — that's a parse-time-only signal; once every field is individually clean, a corrected document should graduate to `ready` regardless of the original (now-stale) confidence number.
5. **Denormalized columns recompute on correction** — if you correct a field that feeds a denormalized column (e.g. `auto_policy`'s `party_name` comes from `carrier`), `extracted_records.party_name` updates too, via the same `mapDenormalized()` used at parse time (registry-driven, no new per-type code).
6. **`itemSchema` added to array `FieldValue`s** (`extracted-record.ts`, populated in `parse-worker.ts`'s `toFieldValues()`) — object-array fields now carry their item property shape (`{key, label, type}[]`) in the API response. Needed so the UI can build a blank "add item" form even when the array currently has **zero** items (e.g. an optional array like `discounts` with nothing extracted) — without this, the frontend would have no way to know what properties a new item should have.
7. **Inline correction UI** (`DocumentDetail.tsx`) — every scalar field row and every array-item property is now a click-to-edit cell (text/number input, or a checkbox for booleans); array item cards get a "✕ Remove" button; each array section gets a "+ Add item" button (uses `itemSchema` for object arrays, or a blank string for scalar arrays like `covered_components`). Edits accumulate in local draft state; a sticky "N fields changed" bar appears with **Save changes** / **Discard**, batching everything into one `PATCH` call. A small orange dot next to a field's label surfaces `needsReview: true` at the individual-field level (previously only shown at the section level).

## A real gap found and fixed along the way

The mock `ParseProvider` (M2-T5a) always produces clean, fully-populated output — no field is ever `needsReview: true`, no required field is ever missing. That means **a document reaching `needs_review` with real correctable fields isn't reachable end-to-end today** — that state only becomes possible once M2-T5b's real adapter can produce a genuinely uncertain extraction. `determineStatusAfterCorrection`'s actual `needs_review → ready` transition is proven correct at the unit level (`workers/__tests__/parse-status.test.ts`) rather than via a live upload; the integration suite instead verifies the PATCH endpoint's real HTTP contract and persistence against a normally-parsed `ready` document. This is the same category of gap as M2-T5a's empty-required-array case — both will become directly observable once M2-T5b lands.

---

## Preconditions

- Stack running: `docker-compose up -d --build`
- Web: http://localhost:3000 · API: http://localhost:8080
- `PARSE_PROVIDER=mock` (the default)

---

## Verification steps

1. Open a `ready` document's detail page. **Verify**: hovering a field value shows a small pencil icon; clicking it turns the value into an editable input; pressing Enter (or clicking away) commits the change locally and a "1 field changed" bar appears at the bottom with **Save changes** / **Discard**.
2. Edit two or three fields across different sections. **Verify**: the changed-count bar updates live; **Discard** reverts everything back to the last-saved values with no API call.
3. Click **Save changes**. **Verify**: the bar disappears, the page reflects the saved values, and if the corrected field feeds a denormalized column (e.g. `carrier` on an `auto_policy`), the page title (which shows `party_name`) updates too.
4. Expand an array section (e.g. "Vehicles insured"). **Verify**: each property inside an item card is independently editable the same way; each card has a "✕ Remove" button; a "+ Add item" button appears at the bottom of the section and, when clicked, adds a blank editable card with all the expected properties (even for an array that currently has 0 items, e.g. an optional one like discounts).
5. Remove an item, add a different one, save. **Verify**: the item count badge in the section header updates to match.
6. **Verify** (automated): `cd services/api && npm test` — `services/__tests__/field-correction-logic.test.ts` (9 tests, pure diff/apply logic), `workers/__tests__/parse-status.test.ts` (13 tests, includes `determineStatusAfterCorrection`).
7. **Verify** (automated): `cd tests/integration && npm test` — `m2-t5c-corrections.test.ts` (11 tests: scalar correction + denormalized recompute, array edit/add/remove, unknown-key rejection, shape-mismatch rejection, no-op correction, cross-user 404, nonexistent-document 404, empty-batch rejection, `itemSchema` presence).

Full regression: **120/120 API unit tests, 77/77 integration tests** (mock mode; 4 live-delivery tests intentionally skipped — see M2-T1/M2-T2 verification docs).

---

## Success criteria checklist

- [x] `PATCH /documents/{id}/fields` validates against the document type's real schema (unknown keys and array/scalar shape mismatches rejected with 400, not silently accepted)
- [x] Array corrections (edit/add/remove) work as whole-field replacements — no item-level API surface needed
- [x] `field_corrections` audit row written per actually-changed key (no-op corrections produce nothing)
- [x] Denormalized columns (`party_name`, `amount`, etc.) stay in sync when their source field is corrected
- [x] A document graduates from `needs_review` to `ready` once every missing/flagged field is corrected, independent of the original parse-time confidence number
- [x] Inline edit UI covers both scalar fields and array item properties, with a batched save (not one request per keystroke)
- [x] Full regression green
- [x] **Manually verified by you** — steps 1–5 above, including array add/remove/edit and the schema-repair fix for the pre-existing corrupted `discounts` field

---

## Known gaps / follow-ups

- **Spec drift (non-blocking, additive)**: `openapi.yaml`'s `FieldPatchRequest.fields[].value` is still typed scalar-only (`[string, number, "null"]`) — doesn't yet reflect that array fields are valid PATCH values, or the new `itemSchema` property on `FieldValue`. Same category as `FieldValue.value`'s array `oneOf` and the `group` property added during M2-T5a's reopened scope — worth a follow-up pass through your Grok flow.
- **`needs_review → ready` transition** isn't exercisable end-to-end with the mock provider (see above) — will become directly testable once M2-T5b's real adapter can produce genuinely low-confidence output.
- Per-array-item `needsReview` doesn't exist yet (the flag is per top-level array field, not per item/property) — a real live adapter that can flag "this specific vehicle's VIN is uncertain" would need a schema/data-shape addition beyond what M2-T5c scoped.

---

## Related files

- `database/schema.sql` (`field_corrections` table)
- `services/api/src/routes/documents.ts` (`PATCH /documents/:id/fields`)
- `services/api/src/services/field-correction-logic.ts` (new, pure), `services/api/src/services/field-correction.ts` (new, DB), `services/api/src/services/extracted-record.ts` (`updateExtractedRecordFields`, `itemSchema`)
- `services/api/src/workers/parse-status.ts` (`determineStatusAfterCorrection`), `services/api/src/workers/parse-worker.ts` (`itemSchema` population)
- `services/web/src/components/DocumentDetail.tsx`, `services/web/src/index.css` (inline edit, add/remove, save bar)
- Tests: `services/api/src/services/__tests__/field-correction-logic.test.ts` (new), `services/api/src/workers/__tests__/parse-status.test.ts` (extended), `tests/integration/m2-t5c-corrections.test.ts` (new)

---

**Done — code complete and manually verified. Next: M2-T5b (real Ollama/Qwen2.5-VL adapter) or M2-T5d (explainability UI), your call.**
