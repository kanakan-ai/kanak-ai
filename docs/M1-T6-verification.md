# M1-T6 Human Verification — Analytics events + Ops dashboard

**Task**: M1-T6 — Analytics events + Ops dashboard
**Status**: Ready for verification

---

## Preconditions

- Stack running: `docker compose up` (or `docker-compose up`) from workspace root
- `.env` copied from `.env.example` — the default `ADMIN_EMAILS=admin@example.com` seeds one local admin account
- `AUTH_MODE=mock` (OTP `000000`)
- Web: http://localhost:3000
- API: http://localhost:8080

Journey mapping: internal/ops — supports Journey A instrumentation, not a customer-facing screen.

---

## Part 1: Customer activity is tracked silently

1. Open http://localhost:3000 and sign in with a fresh email (mock code `000000`).
2. Upload any PDF with a document type selected, and let it reach the Vault.
3. **Verify**: Nothing in the customer experience changes — no visible "analytics" UI, no admin link anywhere in the sidebar, header, or Settings.

**Expected result**: Sign-in and upload work exactly as before; tracking is invisible to the customer.

---

## Part 2: Admin ops dashboard

4. In the same browser, go to **http://localhost:3000/admin**.
5. Sign in with `admin@example.com` (mock code `000000`) if not already signed in.
6. **Verify**: You land on a distinct dark **"Kanak AI Admin"** shell (not the customer Vault) titled **Ops health**, with an "ADMIN ONLY" badge and a "Sign out" control.
7. **Verify** the page shows:
   - API status and Database status tiles (both "Healthy")
   - p50 / p95 latency tiles with a sample count
   - A "Events, last 7 days" section with a bar per day for **Sign-ins** and **Uploads accepted**
   - A **"Recent sign-ins"** table with timestamp, user email, and channel
   - A **"Recent uploads"** table with timestamp, user email, and document type
8. Click **Refresh** — the page reloads the same data without a full page navigation.
9. Open a second browser tab, sign in as a **non-admin** customer (any other email), then navigate that tab to **http://localhost:3000/admin**.
10. **Verify**: You are sent straight back to the customer Vault — no admin page, no error message revealing that an admin route exists.

**Expected result**: Only accounts on `ADMIN_EMAILS` can reach `/admin`; everyone else is bounced to their own Vault.

---

## Part 3: New activity shows up

11. Back in the admin tab, in a different tab sign in as a new customer and upload a document.
12. Return to the admin tab and click **Refresh**.
13. **Verify**: The new sign-in appears in "Recent sign-ins" and the new upload appears in "Recent uploads" with the correct document type; the "last 7 days" bar for today increases.

**Expected result**: Trust-path events (sign-in, upload) are recorded server-side in near real time, independent of whether the client also calls the events API.

---

## Success Criteria Checklist

- Sign-in and upload succeed exactly as before M1-T6 (no regression)
- No admin link is reachable from the customer sidebar, header, or Settings
- `/admin` shows a real ops dashboard only to `role=admin` accounts
- Non-admin accounts visiting `/admin` are redirected to the customer Vault with no indication the route exists
- API/DB health, latency (p50/p95/avg + sample count), 7-day event charts, and recent sign-in/upload tables are all populated
- New sign-ins and uploads appear in the dashboard after a refresh

---

## Fail If

- Any admin link or hint is visible to a signed-in customer
- A non-admin account can view `/admin` data
- The ops dashboard 500s, or shows no data after real activity has occurred
- Sign-in or upload behavior changed for customers

---

## Technical Notes

- Server-emitted events (not client-dependent): `auth_sign_in_success` (email/phone/Apple verify) and `document_upload_accepted` (successful PDF upload), written directly to `analytics_events` per metrics.md §7 ("prefer server-emitted events for trust paths").
- `POST /v1/events` accepts client-side batches (1–50 events) per the existing OpenAPI `EventBatchRequest` contract; used here for future client-side journey events, not required for the M1 exit criteria.
- Latency (p50/p95/avg) is sampled in-process via a request-duration ring buffer — Prometheus/Grafana remain optional per `design/TECH_STACK.md` and are not required for M1.
- `GET /v1/admin/ops-summary` is a new admin-only endpoint. **Note:** `kanak-ai-specs/design/api/openapi.yaml` was not updated for this endpoint — `agents.md` restricts this repo's agents to writing code only in `kanak-ai`, not `kanak-ai-specs`. The response shape is documented in code at `services/api/src/routes/admin.ts`. Whether to add this endpoint to the OpenAPI contract is a decision for whoever owns `kanak-ai-specs`.
- Admin bootstrap is env-based (`ADMIN_EMAILS`, comma-separated) — an email on that list gets `role=admin` on first sign-in. Empty by default outside local dev; never customer-facing (STEERING.md rule 7).

---

## Mock Reference

- Ops health layout (visual direction only — M1 is a simplified subset): `kanak-ai-specs/sample_mockups/admin/01-ops-health.jpg`

---

## Related Files

- Backend: `services/api/src/services/analytics.ts`, `services/api/src/lib/latency.ts`, `services/api/src/routes/events.ts`, `services/api/src/routes/admin.ts`
- Frontend: `services/web/src/components/AdminDashboard.tsx`, `services/web/src/App.tsx`
- Tests: `tests/integration/m1-t6-events.test.ts`

---

**Once all steps pass, mark M1-T6 as complete in m1_tasks.md.**
