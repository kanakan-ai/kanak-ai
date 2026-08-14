# Kanak AI

**Phase 1 MVP — Life-admin vault + action engine**

A consumer life-administration product that turns passive high-value documents (insurance policies, tax bills, warranties, major receipts) into structured vault records, deadline/renewal alerts, and savings actions.

> **Product name**: Kanak AI (from _Kanakkan_ = trusted account-keeper)
> **Milestone**: M1 — Foundation & Intake Skeleton — **complete** (M1-T1 through M1-T8)
> **Next**: M2 — Real Parse & Structured Vault

---

## Architecture Overview

### Services

- **API** (`services/api/`) — Node.js (TypeScript) + Fastify REST API
- **Web** (`services/web/`) — React + TypeScript + Vite customer app **and** role-gated admin console
- **PostgreSQL 16** — Primary database (schema in `database/schema.sql`)
- **Redis** — Queue for async workers (parse jobs, alerts)
- **MinIO** — S3-compatible object storage for PDFs

### Phase 1 Client Strategy

- **M1–M3**: Backend + **web app** (customer flows + admin dashboards) to validate intake → parse → vault → alerts → compare → Q&A
- **M4**: React Native **iOS + Android** (share-in, push notifications, platform secure storage)

All services run locally via Docker Compose. No cloud account required for M1–M3 development.

---

## Quick Start

### Prerequisites

- **Docker** and **Docker Compose** (v2+)
- **Node.js 20+** (for local development outside containers)

### 1. Clone and Setup

```bash
git clone <repo-url>
cd kanak-ai
cp .env.example .env
```

The default `.env` seeds `AUTH_MODE=mock` (accepts OTP `000000` on every passwordless channel) and `ADMIN_EMAILS=admin@example.com` (that email gets admin-console access on first sign-in). Both are safe local-only defaults — see [Configuration](#configuration).

### 2. Start Services

```bash
docker-compose up -d --build
```

Services will be available at:
- **Web**: http://localhost:3000
- **API**: http://localhost:8080
- **MinIO Console**: http://localhost:9001 (login: `minioadmin` / `minioadmin`)
- **PostgreSQL**: `localhost:5433` (user: `kanak`, password: `kanak_dev_password`, db: `kanak`)
- **Redis**: `localhost:6380`

> Postgres uses port 5433 and Redis uses port 6380 to avoid conflicts with locally-installed services on standard ports.

### 3. Verify Setup

```bash
docker-compose ps                       # all 5 services should show "healthy"
curl http://localhost:8080/health
curl -o /dev/null -w "%{http_code}\n" http://localhost:3000
```

### 4. Try the full user journey

Open http://localhost:3000, sign in with any email (code `000000`), and walk through sign-in → first-run explainer → upload → vault → document detail → sign out. The complete scripted walkthrough — including the admin dashboard at `/admin` — is in **[docs/M1-E2E-verification.md](docs/M1-E2E-verification.md)**.

### 5. Run Integration Tests

```bash
cd tests/integration
npm install
npm test
```

Runs 56 tests across 7 files against the real containerized stack (not mocks). See `docs/M1-E2E-verification.md` for a per-file coverage summary.

---

## Development Workflow

### API Development

```bash
cd services/api
npm install
npm run dev        # Watch mode with tsx
npm run build      # Compile TypeScript
```

### Web Development

```bash
cd services/web
npm install
npm run dev         # Local dev server with hot reload
npm run typecheck
npm run build
```

### Database

```bash
docker-compose exec postgres psql -U kanak -d kanak
\dt              # List tables
\d users         # Describe a table
```

### Redis

```bash
docker-compose exec redis redis-cli
PING
KEYS *
```

### Logs

```bash
docker-compose logs -f          # all services
docker-compose logs -f api      # one service
```

---

## Configuration

All configuration is in `.env` (copy from `.env.example`).

### Auth Mode

```bash
AUTH_MODE=mock   # accepts OTP 000000 on email, phone, and the Apple mock — local dev default
AUTH_MODE=real   # requires real SMS/email providers (not implemented in M1)
```

### Admin console access

```bash
ADMIN_EMAILS=admin@example.com   # comma-separated; these emails get role=admin on first sign-in
```

The admin console lives at `/admin`, is never linked from the customer UI, and returns non-admins straight to their own Vault with no indication the route exists. Leave `ADMIN_EMAILS` empty outside local development.

### Database / Object Storage

```bash
POSTGRES_DB=kanak
POSTGRES_USER=kanak
POSTGRES_PASSWORD=kanak_dev_password
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=kanak-documents
```

### Ports

Every service port is overridable (`API_PORT`, `WEB_PORT`, `POSTGRES_PORT`, `REDIS_PORT`, `MINIO_PORT`, `MINIO_CONSOLE_PORT`). If you change `API_PORT`, also update `VITE_API_BASE_URL` to match (the web app doesn't infer it); if you change `MINIO_PORT`, also update `MINIO_EXTERNAL_ENDPOINT` (used for the browser-facing presigned PDF download URLs).

---

## Project Structure

```
kanak-ai/
├── docker-compose.yml          # Container orchestration
├── .env.example                # Environment template
├── m1_tasks.md                 # M1 task tracker (per agent-workflow.md)
├── database/
│   └── schema.sql              # PostgreSQL schema (auto-applied on first boot)
├── docs/
│   ├── M1-T*-verification.md   # Per-task human verification scripts
│   └── M1-E2E-verification.md  # Full milestone walkthrough + test/portability review
├── services/
│   ├── api/                    # Backend API (Fastify)
│   │   └── src/
│   │       ├── index.ts                # Server bootstrap, route registration
│   │       ├── config.ts               # Env-driven configuration
│   │       ├── routes/                 # auth, me, documents, events, admin
│   │       ├── services/               # auth, user, session, document, analytics, storage, extracted-record
│   │       ├── middleware/auth.ts       # authenticate / requireAdmin
│   │       ├── lib/                    # db.ts, latency.ts
│   │       └── workers/stub-parse-worker.ts
│   └── web/                    # Frontend (React + Vite)
│       └── src/
│           ├── App.tsx                 # Screen routing + /admin gate
│           ├── contexts/AuthContext.tsx
│           └── components/             # SignIn, Onboarding, Vault, Upload, DocumentDetail, AppShell, AdminDashboard
└── tests/
    └── integration/            # 7 test files, 56 tests — see docs/M1-E2E-verification.md
```

---

## M1 Milestone Scope

**M1: Foundation & Intake Skeleton — complete.** Full per-task detail and status: [m1_tasks.md](m1_tasks.md).

| Task | Delivered |
|------|-----------|
| M1-T1 | Docker Compose foundation (Postgres, Redis, MinIO, API, Web) |
| M1-T2 | Email OTP sign-in, sessions, sign-out |
| M1-T3 | PDF upload (document type required, 25MB/PDF-only validation) |
| M1-T4 | Vault list + document detail, stub parse worker, dark responsive shell |
| M1-T5 | Phone OTP + Sign in with Apple (mock) |
| M1-T6 | `POST /v1/events`, server-emitted trust events, admin ops dashboard |
| M1-T7 | First-run explainer merged into the Vault's empty state |
| M1-T8 | This README, `docs/M1-E2E-verification.md`, portability fixes |

**Not required in M1** (by design): mobile (React Native), real AI parsing (stub is used), cloud deployment, real email/SMS providers.

---

## Testing

### Integration Tests

Run against the **real local containerized stack**, not mocks.

```bash
cd tests/integration
npm install
npm test          # run once
npm run test:watch
```

| File | Covers |
|------|--------|
| `m1-t1.test.ts` | Infra health, CORS |
| `m1-t2-auth.test.ts` | Email OTP, sessions, `/me`, logout |
| `m1-t3-upload.test.ts` | Upload validation, list/detail/download/delete |
| `m1-t4-vault.test.ts` | Stub parse transitions, extracted-record shape |
| `m1-t5-auth.test.ts` | Phone OTP, Apple mock |
| `m1-t6-events.test.ts` | Event ingestion, admin dashboard access control |
| `m1-t7-onboarding.test.ts` | Onboarding funnel event |

Full coverage review (including known, intentional gaps) is in `docs/M1-E2E-verification.md`.

To point the suite at a non-default stack (e.g. custom ports), override `API_BASE_URL` (include the `/v1` suffix, e.g. `http://localhost:8180/v1`) and, if changed, `WEB_BASE_URL` / `MINIO_ENDPOINT`.

---

## Troubleshooting

### Services won't start

```bash
docker ps                               # confirm Docker is running
docker-compose logs
docker-compose down -v --rmi local      # nuke and rebuild
cp .env.example .env
docker-compose up -d --build
```

### Port conflicts

If ports 3000, 5433, 6380, 8080, 9000, or 9001 are in use, edit `.env` and change the relevant `*_PORT` variable, then also update `VITE_API_BASE_URL` (and `MINIO_EXTERNAL_ENDPOINT` if you changed `MINIO_PORT`) to match — see [Configuration](#configuration). Restart with `docker-compose up -d --build`.

### Database schema not applied

```bash
docker-compose logs postgres
cat database/schema.sql | docker-compose exec -T postgres psql -U kanak -d kanak
```

### API can't connect to database

```bash
docker-compose ps postgres
docker-compose logs -f api
```

### MinIO bucket not created

```bash
docker-compose logs minio-setup
docker-compose exec minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker-compose exec minio mc mb local/kanak-documents
```

---

## Portability

Verified as part of M1-T8 by cloning the repo into an isolated directory with non-default ports and confirming the full stack comes up and all 56 integration tests pass — see `docs/M1-E2E-verification.md` for the write-up (including two real portability bugs found and fixed during that pass).

1. Clone repository
2. `cp .env.example .env`
3. `docker-compose up -d --build`
4. `cd tests/integration && npm install && npm test`

No cloud account, external API keys, or paid services required for M1–M3. `AUTH_MODE=mock` accepts fixed OTP `000000` on every channel; real AI parsing (Vertex AI) arrives in M2, using a stub parser until then.

---

## Specs & Design Reference

Product and design specifications live in the sibling **kanak-ai-specs** workspace folder — treated as read-only from this repo (`agents.md`):

- `STEERING.md` — Agent rules and consistency guidelines
- `agent-workflow.md` — Milestone → task → human-approval process
- `mvp-scope-and-milestones.md` — M1–M4 deliverables
- `design/api/openapi.yaml` — HTTP API contract
- `design/data/schema.sql` — Database schema (source of truth)
- `design/TECH_STACK.md` — Technology choices
- `customer-experience.md` — User journeys A–D
- `ux_spec.md`, `sample_mockups/` — UI screens, components, visual canon
- `metrics.md` — Event taxonomy and dashboard definitions

---

## Contributing

### Agent Workflow

Per `agent-workflow.md` and this repo's `agents.md`:
1. Milestones are split into **tasks**, one task at a time
2. **Human approval** required before the next task starts
3. Task done = **automated integration tests pass** + **human verification script** in `docs/`
4. Code changes live in `kanak-ai` only — `kanak-ai-specs` is spec/product truth, not editable by agents here

### Code Style

- TypeScript strict mode
- OpenAPI-first for API routes, schema-first for the database
- Prefer functional/immutable patterns

---

## License

Proprietary — Kanak AI, Inc.

---

## Support

1. Check this README's [Troubleshooting](#troubleshooting) section
2. `docker-compose logs -f`
3. `docker-compose ps`
4. `cd tests/integration && npm test`

---

**Milestone status**: M1 complete (M1-T1 → M1-T8).
**Next milestone**: M2 — Real Parse & Structured Vault (not started; awaiting approval per `agent-workflow.md`).
