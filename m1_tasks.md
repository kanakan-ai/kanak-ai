# Kanak AI - M1 Task Tracker

**Milestone**: M1 — Foundation & Intake Skeleton (web-first, local containers)

**Goal**: Deliver a working web application where users can sign in, upload PDFs, and view vault items with stub parse results.

**Approach**: Each task delivers a complete vertical slice (backend API + web UI) that users can actually try.

---

## Task Status

### ✅ M1-T1: Repository setup & Docker Compose foundation

**Status**: Complete  
**Completed**: 2026-08-10

**Delivered**:
- Containerized local stack (API, DB, Redis, MinIO, Web)
- PostgreSQL 16 with complete Phase 1 schema
- Redis 7 for job queue
- MinIO S3-compatible object storage
- API health endpoint (Node.js + TypeScript + Fastify)
- Web health check page (React + Vite)
- Docker Compose orchestration
- Development documentation

**Verification**: [docs/M1-T1-verification.md](docs/M1-T1-verification.md)

---

### ✅ M1-T2: Sign-in flow (API + Web UI)

**Status**: Complete  
**Completed**: 2026-08-11

**Backend deliverables**:
- ✅ `POST /v1/auth/email/start` - Initiate email OTP or magic link
- ✅ `POST /v1/auth/email/verify` - Verify OTP code or magic link token
- ✅ `GET /v1/me` - Get current user profile
- ✅ `POST /v1/auth/logout` - Invalidate session
- ✅ Session management (token generation, validation, expiry)
- ✅ User creation on first auth
- ✅ AUTH_MODE=mock support (accepts OTP `000000`)
- ✅ Email delivery mock (console log)

**Frontend deliverables**:
- ✅ Sign-in screen with email input
- ✅ OTP entry form
- ✅ Magic link option (UI shows preference, backend accepts flag)
- ✅ Session storage (localStorage)
- ✅ Mock mode dev hint display
- ✅ Error handling and validation
- ✅ Loading states
- ✅ Dashboard with user profile
- ✅ Sign-out functionality

**Technical implementation**:
- bcrypt password hashing (10 rounds) for OTP and session tokens
- Crypto-secure random token generation (32 bytes base64url)
- 24-hour session expiry
- 5-minute OTP expiry, 15-minute magic link expiry
- React context for auth state management
- TypeScript strict mode compliance

**Exit criteria**:
- ✅ User can sign in via email OTP on web UI
- ✅ Session persists across page refreshes
- ✅ Integration tests written
- ✅ Human verification script complete
- ✅ Backend API tested with curl
- ✅ All Docker services healthy

**Verification**: [docs/M1-T2-verification.md](docs/M1-T2-verification.md)

---

### ✅ M1-T3: Upload flow (API + Web UI)

**Status**: Complete  
**Depends on**: M1-T2

**Backend deliverables**:
- ✅ `POST /v1/documents` - Multipart PDF upload
- ✅ `GET /v1/documents` - List user's documents
- ✅ `GET /v1/documents/:id` - Document detail with presigned URL
- ✅ `GET /v1/documents/:id/download` - Download proxy endpoint
- ✅ `DELETE /v1/documents/:id` - Delete document
- ✅ Store PDF in MinIO (kanak-documents bucket)
- ✅ Create document record in DB (status: pending → parsing)
- ✅ Document type validation (7 types: auto_policy, home_policy, life_insurance, warranty, tax, receipt, other)
- ✅ File type and size validation (PDF only, 25MB max)
- ✅ SHA-256 file hashing and integrity checks
- ✅ Authenticated endpoints (requires session)

**Frontend deliverables**:
- ✅ Upload screen with file picker
- ✅ Document type selection dropdown (7 types)
- ✅ Upload progress indicator (0-100%)
- ✅ Success confirmation with auto-navigation
- ✅ Error handling (file too large, wrong type, missing type, etc.)
- ✅ Dashboard navigation button
- ✅ Back button navigation
- ✅ Authenticated route (redirect to sign-in if not logged in)

**Exit criteria**:
- ✅ User can upload PDF via web UI
- ✅ File stored in MinIO
- ✅ Document record in database
- ✅ Integration tests pass (13 tests, 31 total)
- ✅ Human verification script complete
- ✅ Download endpoint accessible from host machine

**Verification**: [docs/M1-T3-verification.md](docs/M1-T3-verification.md)

---

### ⬜ M1-T4: Vault view (API + Web UI + Stub Parse)

**Status**: Not started  
**Depends on**: M1-T3

**Backend deliverables**:
- `GET /v1/documents` - List user's documents
- `GET /v1/documents/:id` - Document detail with extracted fields
- Stub parse worker (returns fixed mock fields based on document_type)
- Update document status to `ready` after stub parse
- Extracted records table CRUD
- Pre-signed URLs for PDF download

**Frontend deliverables**:
- Vault list screen (empty state + documents)
- Document cards showing title, type, date
- Document detail screen
- Display extracted fields in readable format
- Link to view original PDF
- Loading states and error handling

**Exit criteria**:
- User sees uploaded documents in vault list
- Document detail shows stub extracted fields
- Can view original PDF
- Integration tests pass
- Human verification script complete

**Verification**: `docs/M1-T4-verification.md` (to be created)

---

### ⬜ M1-T5: Phone OTP & Apple auth (API + Web UI)

**Status**: Not started  
**Depends on**: M1-T2

**Backend deliverables**:
- `POST /v1/auth/phone/start` - Initiate phone OTP
- `POST /v1/auth/phone/verify` - Verify phone OTP
- `POST /v1/auth/apple` - Sign in with Apple
- Phone OTP mock mode (accepts `000000`)
- SMS delivery mock (console log)
- Apple identity token validation (mock in M1)

**Frontend deliverables**:
- Phone number input with validation
- Phone OTP entry form
- Sign in with Apple button (conditional rendering)
- Tab/toggle between email/phone sign-in options

**Exit criteria**:
- User can sign in via phone OTP on web
- Apple sign-in available (mock OK for M1)
- Integration tests pass
- Human verification script complete

**Verification**: `docs/M1-T5-verification.md` (to be created)

---

### ⬜ M1-T6: Analytics events + Ops dashboard

**Status**: Not started  
**Depends on**: M1-T2, M1-T3

**Backend deliverables**:
- `POST /v1/events` - Event ingestion endpoint
- Server-side events: auth success, upload accepted
- Analytics events table queries
- Event validation and schema enforcement

**Frontend deliverables** (Admin UI):
- Admin dashboard route (role=admin only)
- API health/latency metrics
- Recent auth events table
- Recent upload events table
- Event count charts
- Time-series visualizations

**Exit criteria**:
- Auth and upload events tracked
- Admin can view ops dashboard
- Events persisted to analytics_events table
- Integration tests pass
- Human verification script complete

**Verification**: `docs/M1-T6-verification.md` (to be created)

---

### ⬜ M1-T7: First-run experience (Web UI)

**Status**: Not started  
**Depends on**: M1-T2, M1-T3, M1-T4

**Frontend deliverables**:
- Welcome/onboarding screen for new users
- Product value proposition
- Key features explainer
- "Get started" CTA flow
- Skip/dismiss option with preference storage

**Exit criteria**:
- New users see first-run explainer
- Returning users skip to main app
- Integration tests pass
- Human verification script complete

**Verification**: `docs/M1-T7-verification.md` (to be created)

---

### ⬜ M1-T8: Documentation & E2E verification

**Status**: Not started  
**Depends on**: M1-T2, M1-T3, M1-T4, M1-T5, M1-T6, M1-T7

**Deliverables**:
- Update README with complete M1 user journey
- End-to-end human verification script
- Integration test coverage review
- Portability verification (fresh machine test)
- Architecture documentation updates
- API documentation review

**Exit criteria**:
- M1 fully documented
- E2E verification passes
- Another developer can run stack in < 15 minutes
- All integration tests pass
- M1 exit criteria met

**Verification**: `docs/M1-E2E-verification.md` (to be created)

---

## M1 Exit Criteria

Per `mvp-scope-and-milestones.md`:

✅ **On web against local containers:**
- [ ] User can sign in via passwordless methods (email OTP/magic link, phone OTP, Apple)
- [ ] User can upload a PDF
- [ ] User can see a placeholder vault item with stub extracted fields
- [ ] Auth/upload events land in the event store
- [ ] Basic ops dashboard shows API health and events
- [ ] README explains how to bring stack up locally with no cloud account

**Not required in M1:**
- Mobile (React Native) project
- Real AI parse (stub is OK)
- Cloud deployment
- Real email/SMS providers (mock/console is OK)

---

## Notes

- **Web-first approach**: Each task delivers working backend + frontend together
- **Mock-friendly**: AUTH_MODE=mock, stub parse, console email for M1
- **Portable**: Everything runs in Docker Compose on any machine
- **Human-gated**: Complete one task, get approval, move to next
- **Test-driven**: Integration tests + human verification for each task

---

**Last updated**: 2026-08-11  
**Current task**: M1-T4 (Vault view)
