# M1 End-to-End Human Verification

**Milestone**: M1 — Foundation & Intake Skeleton
**Status**: Ready for verification
**Covers**: M1-T1 through M1-T7 as one continuous walkthrough

---

## Preconditions

- Clean clone: `git clone <repo-url> && cd kanak-ai`
- `cp .env.example .env` (default `AUTH_MODE=mock`, `ADMIN_EMAILS=admin@example.com`)
- `docker-compose up -d --build`
- Wait for all five containers healthy: `docker-compose ps`
- Web: http://localhost:3000 · API: http://localhost:8080

---

## Part 1 — Sign in (Journey A0, all three passwordless channels)

1. Open http://localhost:3000. **Verify**: dark-themed sign-in page, Kanak AI branding, no password field anywhere.
2. Choose **Email**, enter any address, click **Send code**, enter `000000`, click **Verify and continue**. **Verify**: you're signed in.
3. Sign out. Choose **Phone**, enter `+15551234567` (E.164 format), send + verify `000000`. **Verify**: signed in. Try an invalid format (e.g. `555-123-4567`) first — **verify** it's rejected client-side before a code is requested.
4. Sign out. Click **Continue with Apple** (local mock). **Verify**: signed in.

**Fail if**: any password field appears; an invalid phone format successfully sends a code; any channel leaves you on a blank page.

---

## Part 2 — First-run explainer / empty vault (Journey A1)

5. On this brand-new account, **verify** you land on **"Get started"** — inside the full app shell (sidebar, sign-out), not a standalone page — with a value-prop line, "How upload works" (3 steps), a single **"Choose type & upload"** CTA, and an "Email auto-scan — Coming later" note.
6. Navigate to Upload and back to Vault without uploading. **Verify**: "Get started" reappears (this is expected — it shows for every empty vault, not just the very first visit).

---

## Part 3 — Upload → parse → vault (Journey A2–A6)

7. Click **Choose type & upload**, pick **Auto policy**, upload any PDF. **Verify**: 202-style acceptance, returns to Vault.
8. **Verify**: within ~2–3s the document shows **Processing…** then **Ready**, with a type icon, party name, premium, and a readable **"Renews on {date}"** line plus a countdown badge.
9. Repeat for **Home policy**, **Life insurance**, **Warranty**, **Receipt** (5 documents total). **Verify**: each gets type-correct icon and fields; the Vault header now shows a single **"Upload document"** button (the explainer is gone — vault is no longer empty).
10. **Verify**: documents with a renewal/key date within 30 days appear under **Upcoming** *and* under **All documents**; countdown badges color-shift with urgency.
11. Click into the Auto policy card. **Verify**: document detail (same shell), field cards with "from document" attribution, **Open original PDF** downloads successfully, and **Compare rates** appears (insurance types only — confirm it's absent on the Warranty/Receipt detail views).

**Fail if**: a document never leaves "Processing"; fields/icons don't match the chosen type; the PDF fails to download; Compare rates shows for non-insurance types.

---

## Part 4 — Sign out and session integrity

12. From the Vault, Upload, and a Document Detail screen, **verify** **Sign out** is reachable every time (sidebar on desktop, header on narrow).
13. Click **Sign out**. **Verify**: returns to sign-in.
14. Refresh. **Verify**: still on sign-in — the session was not restored.
15. Sign back in with the *same* email. **Verify**: your 5 documents are still there (vault persisted), and "Get started" does **not** reappear (only shows while the vault is empty).

---

## Part 5 — Desktop and narrow layout

16. At ≥900px width: **verify** a persistent branded sidebar (Kanak AI, Vault/Ask/Settings, account + Sign out), content in a sensible max-width column — not a stretched phone screen.
17. Narrow the window to <760px: **verify** a compact header + bottom nav, Sign out still reachable, no phone-frame chrome, everything usable.

---

## Part 6 — Admin ops dashboard (internal, role-gated)

18. Sign out. Sign in as `admin@example.com` (seeded by the default `.env`). Navigate to **http://localhost:3000/admin** (there is no link to this anywhere in the customer UI — that's intentional).
19. **Verify**: a distinct "Kanak AI Admin" shell, **Ops health** page with API/DB status, p50/p95/avg latency, a 7-day chart for sign-ins and uploads, and recent-events tables for both.
20. Sign out, sign in as a non-admin account, and try **http://localhost:3000/admin** again. **Verify**: you're sent straight back to your own Vault — no error, no indication the route exists.

**Fail if**: any customer-facing screen links to `/admin`; a non-admin can view dashboard data.

---

## Success criteria (M1 exit criteria, `mvp-scope-and-milestones.md`)

- [x] Sign in via all three passwordless methods
- [x] Upload a PDF with a required document type
- [x] See a vault item with stub-extracted fields
- [x] Auth/upload events land in `analytics_events` (server-emitted, verifiable via the admin dashboard)
- [x] Basic ops dashboard shows API health + latency + events
- [x] README explains how to bring the stack up with no cloud account

---

## Integration test coverage review

7 files, 56 automated tests, all against the real containerized stack (not mocks):

| File | Covers |
|------|--------|
| `m1-t1.test.ts` | Infra health: API `/health`, `/v1` root, web reachability, MinIO health, CORS |
| `m1-t2-auth.test.ts` | Email OTP start/verify, session validation, `/me`, logout, invalid-code/expired-session paths |
| `m1-t3-upload.test.ts` | Multipart PDF upload, document type validation, file-type/size limits, list/detail/download/delete |
| `m1-t4-vault.test.ts` | Stub parse worker transitions, extracted-record shape per document type, vault list + detail payloads |
| `m1-t5-auth.test.ts` | Phone OTP start/verify (incl. E.164 rejection), Apple mock sign-in |
| `m1-t6-events.test.ts` | `POST /v1/events` validation + happy path, `/admin/ops-summary` access control (401/403/200), server-emitted event visibility |
| `m1-t7-onboarding.test.ts` | `onboarding_completed` accepted by the events pipeline |

**Known gaps, intentionally deferred (not M1 exit-criteria blockers):**
- Apple sign-in only exercises the local mock path — no real Apple JWT verification exists yet (correctly out of scope; `services/api/src/routes/auth.ts` rejects anything but the mock token shape when `AUTH_MODE=mock`).
- No automated test exercises `PATCH /v1/me` — it's intentionally a `501` stub in M1; dark-mode/onboarding preference persistence is client-side (`localStorage`) until it ships.
- Dashboards 2–7 (`metrics.md` §8.2) have no tests because they don't exist yet — correctly gated on M2 (real parse) and M3 (alerts/quotes/Ask/retention) features.
- No automated visual/responsive test — desktop/narrow layout and dark-theme checks in Parts 5–6 above are manual only.

---

## Portability verification (fresh-machine test)

Performed as part of M1-T8: cloned the pushed `main` branch into an **isolated directory with renamed containers and non-default ports** (`API_PORT=8180`, `WEB_PORT=3100`, `POSTGRES_PORT=5533`, `REDIS_PORT=6480`, `MINIO_PORT=9100/9101`) so it ran fully alongside the existing dev stack without touching it, then torn down afterward.

**Two real bugs found and fixed as part of this task:**

1. **`docker-compose.yml`** — the API container's `PORT` env var was set to `${API_PORT:-8080}`, so changing `API_PORT` (as the README's own "Port conflicts" troubleshooting section suggests) made the app listen on a port nothing forwards to internally, failing its own healthcheck and blocking the whole stack (`web` depends on `api` being healthy). Fixed to a fixed internal `PORT: 8080` — `API_PORT` now only remaps the **host** side, which is what it was always meant to do.
2. **`tests/integration/m1-t1.test.ts`** — used a different `API_BASE_URL` convention (bare origin, no `/v1`) than every other test file (origin **with** `/v1`), so no single `API_BASE_URL` override could point the whole suite at a custom-port stack. Standardized to the same convention as the rest of the suite.

**After both fixes**, measured on this machine (Docker layer cache warm from a prior attempt, so treat as directional, not a cold-cache worst case):
- Clone: ~1s
- `docker-compose up -d --build` (all 5 services, first time in that directory): ~72s
- `docker-compose up -d --build` (re-run, cached layers): ~17s
- Full integration suite (56 tests) against the custom-port stack, one consistent `API_BASE_URL`: ~41s

Total well under the 15-minute exit-criteria bar even generously padding for a slower connection pulling base images cold.

---

## Architecture / API documentation review

- `kanak-ai-specs/high-level-architecture.md` §11.5 and §14 (M1 milestone wiring) match the actual M1 implementation closely: `analytics_events` table, `POST /v1/events`, server-emitted auth/upload events, and a "basic Ops dashboard (API up, latency)" — no drift found there.
- `kanak-ai-specs/design/api/openapi.yaml` does **not** yet include `GET /v1/admin/ops-summary` (added in M1-T6). Per `agents.md`, this repo's agents write code only in `kanak-ai`, not `kanak-ai-specs`, so the contract is documented in code (`services/api/src/routes/admin.ts`) instead. Whether to add this endpoint to the OpenAPI spec is a decision for whoever owns `kanak-ai-specs` — flagging again here so it isn't lost.
- No other endpoint drift found: phone/email/Apple auth, documents, and events all match their existing OpenAPI definitions.

---

## Mock reference

- Full flow: `sample_mockups/01-signin-auth.jpg`, `02-onboarding.jpg`, `04-home-vault-list.jpg`, `05-upload-parsing.jpg`, `07-document-detail.jpg`
- Admin: `sample_mockups/admin/01-ops-health.jpg` (M1 ships a simplified single-dashboard subset — see `docs/M1-T6-verification.md`)

---

**Once all parts pass, mark M1-T8 complete in `m1_tasks.md` and M1 is fully exited.**
