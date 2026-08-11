# Kanak AI

**Phase 1 MVP — Life-admin vault + action engine**

A consumer life-administration product that turns passive high-value documents (insurance policies, tax bills, warranties, major receipts) into structured vault records, deadline/renewal alerts, and savings actions.

> **Product name**: Kanak AI (from _Kanakkan_ = trusted account-keeper)  
> **Current milestone**: M1 — Foundation & Intake Skeleton  
> **Status**: In development

---

## Architecture Overview

### Services

- **API** (`services/api/`) — Node.js (TypeScript) + Fastify REST API
- **Web** (`services/web/`) — React + TypeScript + Vite customer/admin app
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
# Clone the repository
git clone <repo-url>
cd kanak-ai

# Copy environment file
cp .env.example .env
```

### 2. Start Services

```bash
# Start all services
docker-compose up -d
```

Services will be available at:
- **API**: http://localhost:8080
- **Web**: http://localhost:3000
- **MinIO Console**: http://localhost:9001 (login: `minioadmin` / `minioadmin`)
- **PostgreSQL**: `localhost:5433` (user: `kanak`, password: `kanak_dev_password`, db: `kanak`)
- **Redis**: `localhost:6380`

> **Note**: Postgres uses port 5433 and Redis uses port 6380 to avoid conflicts with existing services on standard ports.

### 3. Verify Setup

```bash
# Check all services are healthy
docker-compose ps

# Test API health
curl http://localhost:8080/health

# Test web app
curl http://localhost:3000
```

### 4. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f web
```

### 5. Run Integration Tests

```bash
cd tests/integration
npm install
npm test
```

---

## Development Workflow

### API Development

```bash
# Access API container shell
docker-compose exec api sh

# Inside container (or locally)
cd services/api
npm install
npm run dev        # Watch mode with tsx
npm run build      # Compile TypeScript
npm test           # Run tests
```

### Web Development

```bash
# Local development with hot reload
cd services/web
npm install
npm run dev

# Production build
npm run build
```

### Database

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U kanak -d kanak

# Inside psql
\dt              # List tables
\d users         # Describe users table
SELECT * FROM users;
```

### Redis

```bash
# Access Redis CLI
docker-compose exec redis redis-cli

# Inside redis-cli
PING
KEYS *
```

---

## Configuration

All configuration is in `.env`. Key settings:

### Auth Mode

```bash
# Mock mode (accepts OTP 000000)
AUTH_MODE=mock

# Real mode (requires SMS/email providers)
AUTH_MODE=real
```

### Database

```bash
POSTGRES_DB=kanak
POSTGRES_USER=kanak
POSTGRES_PASSWORD=kanak_dev_password
```

### Object Storage

```bash
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=kanak-documents
```

---

## Project Structure

```
kanak-ai/
├── docker-compose.yml          # Container orchestration
├── .env.example                # Environment template
├── database/
│   └── schema.sql              # PostgreSQL schema (auto-applied)
├── services/
│   ├── api/                    # Backend API service
│   │   ├── src/
│   │   │   ├── index.ts        # Fastify server
│   │   │   └── config.ts       # Configuration loader
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                    # Frontend React app
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   └── index.css
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
└── tests/
    └── integration/            # Integration tests
        ├── m1-t1.test.ts
        └── package.json
```

---

## M1 Milestone Scope

**M1: Foundation & Intake Skeleton** (current)

✅ **Completed in M1-T1**:
- Containerized local stack (Postgres, Redis, MinIO, API, Web)
- Database schema initialization
- API health endpoint
- Web health check page
- Environment configuration
- Integration test framework

🔜 **Coming in M1-T2+**:
- M1-T2: Email OTP/magic link authentication
- M1-T3: Phone OTP + Sign in with Apple
- M1-T4: PDF upload to object storage
- M1-T5: Stub parse worker + structured vault
- M1-T6: Analytics events foundation
- M1-T7: Web UI (auth, upload, vault)
- M1-T8: Documentation & portability verification

---

## Testing

### Integration Tests

Integration tests run against the **real local containerized stack** (not mocks).

```bash
# Run all integration tests
cd tests/integration
npm install
npm test

# Watch mode
npm run test:watch
```

### Test Coverage

- M1-T1: Infrastructure health, service connectivity, CORS
- M1-T2+: Auth flows, upload, parse, vault CRUD, analytics

---

## Troubleshooting

### Services won't start

```bash
# Check Docker is running
docker ps

# Check container logs
docker-compose logs

# Remove everything and start fresh
docker-compose down -v --rmi local
cp .env.example .env
docker-compose up -d
```

### Port conflicts

If ports 3000, 5432, 6379, 8080, 9000, or 9001 are in use:

1. Stop conflicting services
2. Or edit `.env` and change port mappings
3. Restart: `docker-compose restart`

### Database schema not applied

```bash
# Check postgres logs
docker-compose logs postgres

# Manually apply schema
cat database/schema.sql | docker-compose exec -T postgres psql -U kanak -d kanak
```

### API can't connect to database

```bash
# Verify DATABASE_URL in .env
# Ensure postgres is healthy
docker-compose ps postgres

# Check API logs
docker-compose logs -f api
```

### MinIO bucket not created

```bash
# Check minio-setup logs
docker-compose logs minio-setup

# Manually create bucket
docker-compose exec minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker-compose exec minio mc mb local/kanak-documents
```

---

## Portability

This stack is designed to run on **any machine with Docker**:

1. Clone repository
2. Copy `.env.example` to `.env`
3. Run `docker-compose up -d`
4. Verify with integration tests: `cd tests/integration && npm install && npm test`

No cloud account, external API keys, or paid services required for M1–M3 core development.

**Auth mode**: Set `AUTH_MODE=mock` to accept fixed OTP `000000` without SMS/email providers.

**AI parsing**: M2+ will add Vertex AI integration; M1 uses stub parser.

---

## Specs & Design Reference

Product and design specifications are in the **kanak-ai-specs** workspace folder:

- `STEERING.md` — Agent rules and consistency guidelines
- `mvp-scope-and-milestones.md` — M1–M4 deliverables
- `design/api/openapi.yaml` — HTTP API contract
- `design/data/schema.sql` — Database schema (source of truth)
- `design/TECH_STACK.md` — Technology choices
- `customer-experience.md` — User journeys A–D
- `ux_spec.md` — UI screens and components

---

## Contributing

### Agent Workflow

Per `agent-workflow.md`:
1. Milestones are split into **tasks**
2. One task at a time
3. **Human approval** required before next task
4. Task done = **automated tests pass** + **human verification script**

### Code Style

- TypeScript strict mode
- ESLint + Prettier (configs in service directories)
- Prefer functional/immutable patterns
- OpenAPI-first for API routes
- Schema-first for database

---

## License

Proprietary — Kanak AI, Inc.

---

## Support

For questions or issues during M1 development:
1. Check this README's Troubleshooting section
2. Review logs: `docker-compose logs -f`
3. Run health checks: `docker-compose ps`
4. Verify integration tests: `cd tests/integration && npm test`

---

**Current Task**: M1-T1 — Repository setup & Docker Compose foundation  
**Next Task**: M1-T2 — API skeleton & passwordless auth (email OTP/magic link)
