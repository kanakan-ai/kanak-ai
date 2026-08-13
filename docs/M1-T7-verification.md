# M1-T7 Human Verification — First-run experience

**Task**: M1-T7 — First-run experience (Web UI)
**Status**: Ready for verification

---

## Preconditions

- Stack running: `docker compose up` (or `docker-compose up`) from workspace root
- `AUTH_MODE=mock` (OTP `000000`)
- Web: http://localhost:3000

Journey mapping: Journey A, step A1 (`onboarding_completed`), immediately after sign-in (A0).

---

## Design note (revised after initial review)

The first-run explainer is **not** a separate one-time gate you pass through before reaching the Vault. It **is** the Vault's empty state — the same rich content shows every time an account has zero documents (first sign-in, or later if every document is deleted), not just on the very first visit. There is no "Skip" action: since you're never blocked from anything, there's nothing to skip. The only thing that stays one-time is the underlying `onboarding_completed` analytics event, so the Journey A funnel metric isn't inflated by repeat views.

---

## Steps

1. Open http://localhost:3000 and sign in with a **brand-new email** (mock code `000000`).
2. **Verify**: You land on a **"Get started"** screen — inside the same dark Kanak AI sidebar/shell as the rest of the app (sidebar, sign-out, etc. all present), not a disconnected full-screen page.
3. **Verify** the screen shows:
   - A short value-proposition line about what Kanak AI does
   - A "How upload works" explainer with 3 numbered steps (choose type → upload PDF → fields extracted)
   - A single teal **"Choose type & upload"** button (no second/duplicate upload button anywhere on screen)
   - An "Email auto-scan" card marked **"Coming later"** (not clickable / informational only)
   - A privacy note
4. Click **"Choose type & upload"**, then click **"Back to Vault"** without uploading anything.
5. **Verify**: You see the exact same "Get started" explainer again — the vault is still empty, so it reappears (this is expected, not a bug).
6. This time, click **"Choose type & upload"**, pick a document type, and upload a PDF.
7. **Verify**: Once the document appears, the Vault switches to its normal view — "Vault" header, "Upload document" button top-right, document list. The "Get started" explainer is gone for good (vault is no longer empty).
8. Refresh the page (F5).
9. **Verify**: You land on the normal populated Vault, not the explainer.

**Expected result**: The explainer shows for every empty-vault view, and stops appearing once the account has at least one document — no separate dismiss action needed.

---

## Success Criteria Checklist

- New sign-ins with zero documents land on "Get started", not a bare/blank vault
- The screen renders inside the authenticated shell (sidebar/header/sign-out all present)
- Exactly one upload CTA is visible in the empty state (no duplicate button)
- The explainer reappears on every visit while the vault stays empty
- Once a document exists, the normal Vault view (header + list) replaces the explainer permanently
- "Choose type & upload" leads into the existing Upload flow

---

## Fail If

- A returning account with existing documents is shown the explainer instead of its vault
- The empty vault ever shows two upload buttons at once
- The screen breaks the authenticated shell (no sidebar, no sign-out, looks like a separate app)
- The explainer permanently disappears without the account having any documents (e.g. after only viewing it once)

---

## Technical Notes

- **No backend changes.** The explainer is content inside `Vault.tsx`'s empty-state branch — rendered whenever `documents.length === 0` after a successful load, every time, not gated by a one-time flag.
- The **funnel event** is what stays one-time: `Onboarding.tsx` writes `kanak_onboarding_seen:<userId>` to `localStorage` and fires `onboarding_completed` via `POST /v1/events` (M1-T6) only the first time it ever mounts for that user id — matching `metrics.md`'s Journey A step A1. Verified server-side (event accepted) in `tests/integration/m1-t7-onboarding.test.ts`, and end-to-end (fires exactly once across multiple empty-vault views) via manual verification.
- This flag lives in `localStorage`, not on the server, because `PATCH /v1/me` remains unimplemented (`501`, same limitation noted in `docs/M1-T4-verification.md`) — the one-time guarantee is per-browser, not per-account across devices.
- Content and layout follow `sample_mockups/02-onboarding.jpg`; Pricing/Plans (mockup screen 03) is intentionally out of scope.
- This design was revised after initial delivery: the first cut used a separate blocking gate with a "Skip for now" link before the Vault. That was replaced because (a) `ux_spec.md` §4 calls for a **single** strong CTA on the empty vault, and having both the gate and the Vault's own empty-state CTA nearby was redundant, and (b) a user who skipped never saw the explainer again even if their vault stayed empty indefinitely, which is a worse experience than the current one.

---

## Mock Reference

- `kanak-ai-specs/sample_mockups/02-onboarding.jpg`

---

## Related Files

- Frontend: `services/web/src/components/Onboarding.tsx`, `services/web/src/components/Vault.tsx`, `services/web/src/App.tsx`, `services/web/src/index.css`
- Tests: `tests/integration/m1-t7-onboarding.test.ts`

---

**Once all steps pass, mark M1-T7 as complete in m1_tasks.md.**
