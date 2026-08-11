# M1-T1 Human Verification Script

## Human verification — M1-T1 Repository setup & Docker Compose foundation

**Journey mapping**: Infrastructure (pre-Journey A)

---

## Preconditions

- Clean machine (or reset Docker volumes if reusing)
- Docker and Docker Compose installed
- No prior Kanak AI setup

---

## Steps

### 1. Clone and Setup

```bash
# Clone repository (or navigate to existing clone)
cd /path/to/kanak-ai

# Copy environment configuration
cp .env.example .env

# Verify .env was created
ls -la .env
```

**Expected**: `.env` file exists

---

### 2. Start Services

```bash
# Start all services
docker-compose up -d
```

**Expected**: All containers start without errors

---

### 3. Verify Container Health

```bash
# Check all services are running
docker-compose ps

# All services should show "Up" and "healthy"
```

**Expected output** (similar to):
```
NAME               STATUS         PORTS
kanak-api          Up (healthy)   0.0.0.0:8080->8080/tcp
kanak-postgres     Up (healthy)   0.0.0.0:5432->5432/tcp
kanak-redis        Up (healthy)   0.0.0.0:6379->6379/tcp
kanak-minio        Up (healthy)   0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
kanak-web          Up (healthy)   0.0.0.0:3000->3000/tcp
```

---

### 4. Test API Health Endpoint

```bash
# Test API health
curl http://localhost:8080/health

# Or visit in browser:
# http://localhost:8080/health
```

**Expected JSON response**:
```json
{
  "status": "ok",
  "service": "kanak-api",
  "version": "0.1.0",
  "env": "development",
  "timestamp": "2026-08-10T..."
}
```

---

### 5. Test Web App

Open browser and navigate to: **http://localhost:3000**

**Expected**:
- Page loads successfully
- Shows "Kanak AI" heading
- Shows "M1-T1: Foundation Status" section
- Green indicator with "All systems operational"
- Service details table showing:
  - Service: kanak-api
  - Version: 0.1.0
  - Environment: development
  - Status: ok

---

### 6. Verify Database Schema

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U kanak -d kanak

# Inside psql, list tables
\dt

# Expected: Multiple tables from schema.sql
# Including: users, auth_identities, sessions, documents, etc.
```

**Expected output** (partial):
```
 Schema |       Name        | Type  | Owner
--------+-------------------+-------+-------
 public | alerts            | table | kanak
 public | analytics_events  | table | kanak
 public | auth_identities   | table | kanak
 public | documents         | table | kanak
 public | users             | table | kanak
 ...
```

Exit psql: `\q`

---

### 7. Verify MinIO Bucket

```bash
# Check MinIO health
curl http://localhost:9000/minio/health/live

# Or open MinIO console in browser:
# http://localhost:9001
# Login: minioadmin / minioadmin
```

**Expected**:
- Health endpoint returns 200 OK
- MinIO console is accessible
- Bucket `kanak-documents` exists (may need to navigate to buckets)

---

### 8. Verify Redis

```bash
# Test Redis connection
docker-compose exec redis redis-cli ping

# Expected: PONG
```

---

### 9. Test CORS

```bash
# Test CORS from web origin
curl -H "Origin: http://localhost:3000" -I http://localhost:8080/health
```

**Expected**: Response includes CORS headers like:
```
access-control-allow-origin: *
access-control-allow-credentials: true
```

---

### 10. Run Integration Tests

```bash
# Run automated integration tests
cd tests/integration
npm install
npm test
```

**Expected**:
- All tests pass (green ✓)
- No test failures or errors
- Tests verify: API health, Web access, DB connectivity, MinIO, CORS

---

### 11. Check Logs (Optional)

```bash
# View all logs
docker-compose logs -f

# Or specific services
docker-compose logs api
docker-compose logs web
docker-compose logs postgres
```

**Expected**: No critical errors; normal startup messages

---

### 12. Clean Shutdown

```bash
# Stop services
docker-compose down
```

**Expected**: All containers stop cleanly

---

## Success Criteria

✅ All services start and report healthy status  
✅ API responds to `/health` with status "ok"  
✅ Web app loads and displays health check  
✅ Database schema tables exist  
✅ MinIO bucket `kanak-documents` is created  
✅ Redis responds to PING  
✅ CORS headers present in API responses  
✅ Integration tests pass  
✅ Another developer can follow README and bring up stack in < 15 minutes  

---

## Fail Criteria

❌ Any container fails to start  
❌ Health checks return errors  
❌ Database schema not applied  
❌ MinIO bucket missing  
❌ Integration tests fail  
❌ CORS not configured  
❌ README instructions incomplete or broken  

---

## M1-T1 Exit Criteria Met

Per `mvp-scope-and-milestones.md` M1:

- ✅ **Containerized local stack** (Compose): API, DB, object store, queue stub, web test app
- ✅ **Backend API skeleton** with health check
- ✅ **Web test shell** with health indicator
- ✅ **README**: How to bring stack up locally with no cloud account
- ✅ **Metrics foundation prep**: Schema includes `analytics_events` table

Not required in M1-T1 (coming in T2+):
- ❌ Passwordless auth (M1-T2, T3)
- ❌ PDF upload (M1-T4)
- ❌ Parse worker (M1-T5)
- ❌ Analytics endpoint (M1-T6)
- ❌ Full web UI (M1-T7)

---

## Next Steps

After M1-T1 verification passes and human approves:

**→ Proceed to M1-T2**: API skeleton & passwordless auth (email OTP/magic link)
