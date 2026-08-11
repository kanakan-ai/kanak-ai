# M1-T2 Verification Script: Sign-in Flow

**Task**: Email authentication (OTP/magic link) with API + Web UI integration

**Duration**: ~10 minutes

---

## Prerequisites

1. All Docker services running:
   ```bash
   docker-compose up -d
   docker-compose ps  # All should be "healthy"
   ```

2. Confirm API and Web ports are accessible:
   - API: http://localhost:8080
   - Web: http://localhost:3000

---

## Part 1: API Backend Testing (curl)

### Test 1.1: Start Email OTP Challenge

```bash
curl -X POST http://localhost:8080/v1/auth/email/start \
  -H 'Content-Type: application/json' \
  -d '{"email": "verify@example.com"}'
```

**Expected Response** (200 OK):
```json
{
  "status": "mock",
  "channel": "email",
  "expiresInSeconds": 300,
  "devHint": "Use code 000000"
}
```

**Check Docker Logs** for mock email:
```bash
docker-compose logs api --tail 20 | grep -E "(To:|Subject:|Code:)"
```

You should see:
```
To: verify@example.com
Subject: Your Kanak AI verification code
```

✅ **Pass Criteria**: 200 response + mock email logged

---

### Test 1.2: Verify OTP Code

```bash
curl -X POST http://localhost:8080/v1/auth/email/verify \
  -H 'Content-Type: application/json' \
  -d '{"email": "verify@example.com", "code": "000000"}'
```

**Expected Response** (200 OK):
```json
{
  "accessToken": "random-base64url-token",
  "tokenType": "Bearer",
  "expiresInSeconds": 86400,
  "user": {
    "id": "uuid-here",
    "email": "verify@example.com",
    "appleLinked": false,
    "plan": "free",
    "role": "customer",
    "darkMode": true,
    "pushEnabled": true,
    "weeklyDigest": false,
    "createdAt": "2026-08-11T..."
  }
}
```

**Save the accessToken** for next tests:
```bash
TOKEN="paste-token-here"
```

✅ **Pass Criteria**: 200 response + valid session token + user profile

---

### Test 1.3: Get User Profile

```bash
curl -X GET http://localhost:8080/v1/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (200 OK): Same user object as above

✅ **Pass Criteria**: Returns authenticated user profile

---

### Test 1.4: Invalid Token Rejection

```bash
curl -X GET http://localhost:8080/v1/me \
  -H "Authorization: Bearer invalid-token"
```

**Expected Response** (401 Unauthorized):
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired session token"
}
```

✅ **Pass Criteria**: 401 rejection

---

### Test 1.5: Logout (Revoke Session)

```bash
curl -X POST http://localhost:8080/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**: 204 No Content (empty body)

**Verify token no longer works**:
```bash
curl -X GET http://localhost:8080/v1/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**: 401 Unauthorized

✅ **Pass Criteria**: 204 on logout + 401 on subsequent request

---

### Test 1.6: Wrong OTP Code

```bash
# Start new challenge
curl -X POST http://localhost:8080/v1/auth/email/start \
  -H 'Content-Type: application/json' \
  -d '{"email": "wrong@example.com"}'

# Try wrong code
curl -X POST http://localhost:8080/v1/auth/email/verify \
  -H 'Content-Type: application/json' \
  -d '{"email": "wrong@example.com", "code": "999999"}'
```

**Expected Response** (401 Unauthorized):
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired OTP code"
}
```

✅ **Pass Criteria**: 401 rejection with error message

---

## Part 2: Web UI Testing (Browser)

### Test 2.1: Access Sign-In Page

1. Open http://localhost:3000 in browser
2. Should see:
   - "Kanak AI" logo (gradient purple)
   - "Your trusted life-admin vault" tagline
   - "Sign In" heading
   - Email input field
   - "Send Code" button
   - Dev hint: "Use code 000000"

✅ **Pass Criteria**: Sign-in page loads with all elements

---

### Test 2.2: Email Submission

1. Enter email: `webtest@example.com`
2. Click "Send Code"
3. Should see:
   - Button text changes to "Sending..."
   - Page transitions to OTP verification screen
   - Shows "We sent a code to webtest@example.com"
   - Large 6-digit code input field
   - "Code expires in 5 minutes" hint
   - "Verify" button
   - "Use Different Email" button
   - Dev hint still visible

✅ **Pass Criteria**: Email submission works + UI switches to OTP screen

---

### Test 2.3: Invalid Email

1. Click "Use Different Email"
2. Try submitting without @ symbol
3. Browser should show validation error (HTML5 validation)

✅ **Pass Criteria**: Browser prevents invalid email submission

---

### Test 2.4: OTP Code Entry (Wrong Code)

1. Enter code: `111111`
2. Click "Verify"
3. Should see:
   - Button text "Verifying..."
   - Then error box appears (red border)
   - Error message: "Invalid or expired OTP code"

✅ **Pass Criteria**: Wrong code rejected with error UI

---

### Test 2.5: OTP Code Entry (Correct Code)

1. Enter code: `000000`
2. Click "Verify"
3. Should see:
   - Button text "Verifying..."
   - Page redirects to Dashboard
   - Green success box: "Sign-in successful! Welcome to your Kanak AI vault"
   - User profile card showing:
     - Email: webtest@example.com
     - User ID: (UUID)
     - Plan: free
     - Role: customer
     - Apple ID: Not linked
     - Member Since: (today's date)
   - "Sign Out" button in top right

✅ **Pass Criteria**: Successful sign-in + dashboard displays user data

---

### Test 2.6: Session Persistence

1. With dashboard still open, refresh the page (Cmd+R / Ctrl+R)
2. Should remain on dashboard (not redirect to sign-in)
3. User profile should still be visible

✅ **Pass Criteria**: Session persists across page refresh

---

### Test 2.7: Sign Out

1. Click "Sign Out" button in dashboard
2. Should redirect back to sign-in page
3. Refresh page - should stay on sign-in page

✅ **Pass Criteria**: Logout works + session cleared

---

### Test 2.8: localStorage Token Storage

**Open Browser DevTools** (F12 / Cmd+Option+I):

1. Go to **Application** tab → **Local Storage** → http://localhost:3000
2. Sign in again (email: `storage@example.com`, code: `000000`)
3. Check localStorage:
   - Key: `kanak_access_token`
   - Value: (long base64url token string)
4. Sign out
5. Check localStorage again:
   - Key `kanak_access_token` should be deleted

✅ **Pass Criteria**: Token stored on sign-in + removed on sign-out

---

## Part 3: Network Inspection (DevTools)

**Open DevTools Network tab** (keep it open during sign-in flow):

### Test 3.1: POST /v1/auth/email/start

1. Enter email and click "Send Code"
2. Check Network tab:
   - **Request**: POST to http://localhost:8080/v1/auth/email/start
   - **Payload**: `{"email":"..."}`
   - **Response**: 200 OK with `{status:"mock", ...}`

✅ **Pass Criteria**: Correct API call + 200 response

---

### Test 3.2: POST /v1/auth/email/verify

1. Enter code `000000` and click "Verify"
2. Check Network tab:
   - **Request**: POST to http://localhost:8080/v1/auth/email/verify
   - **Payload**: `{"email":"...", "code":"000000"}`
   - **Response**: 200 OK with `{accessToken:"...", user:{...}}`

✅ **Pass Criteria**: Correct API call + session response

---

### Test 3.3: GET /v1/me

1. Dashboard should load user profile
2. Check Network tab:
   - **Request**: GET to http://localhost:8080/v1/me
   - **Headers**: `Authorization: Bearer <token>`
   - **Response**: 200 OK with user profile

✅ **Pass Criteria**: Authenticated request with Bearer token

---

### Test 3.4: POST /v1/auth/logout

1. Click "Sign Out"
2. Check Network tab:
   - **Request**: POST to http://localhost:8080/v1/auth/logout
   - **Headers**: `Authorization: Bearer <token>`
   - **Response**: 204 No Content

✅ **Pass Criteria**: Logout API called with token

---

## Part 4: Edge Cases

### Test 4.1: Multiple Sessions

1. Sign in on browser: email `multi@example.com`, code `000000`
2. Copy the token from localStorage
3. In **another browser tab** (or incognito), manually set token:
   ```javascript
   localStorage.setItem('kanak_access_token', 'paste-token-here')
   ```
4. Refresh that tab
5. Both tabs should show dashboard for same user

✅ **Pass Criteria**: Same token works across tabs

---

### Test 4.2: Expired Session (Manual)

1. Sign in normally
2. In database, revoke the session:
   ```bash
   docker exec -it kanak-postgres psql -U kanakuser -d kanakdb \
     -c "UPDATE sessions SET revoked_at = NOW() WHERE revoked_at IS NULL;"
   ```
3. Refresh browser
4. Should redirect to sign-in page (401 → token cleared)

✅ **Pass Criteria**: Revoked session forces re-authentication

---

## Summary Checklist

**Backend (API)**:
- [x] POST /v1/auth/email/start returns 200 + mock status
- [x] POST /v1/auth/email/verify creates session with valid code
- [x] POST /v1/auth/email/verify rejects wrong code (401)
- [x] GET /v1/me returns user profile with valid token
- [x] GET /v1/me rejects invalid token (401)
- [x] POST /v1/auth/logout revokes session (204)
- [x] Mock email logged to Docker console

**Frontend (Web UI)**:
- [x] Sign-in page loads with email input
- [x] Email submission transitions to OTP screen
- [x] Wrong OTP shows error message
- [x] Correct OTP (000000) redirects to dashboard
- [x] Dashboard displays user profile
- [x] Session persists on page refresh
- [x] Sign-out clears token and redirects

**Integration**:
- [x] localStorage stores/clears token
- [x] Network requests use correct endpoints
- [x] Bearer token included in authenticated requests
- [x] Error handling displays user-friendly messages

---

## Pass Criteria

**M1-T2 is complete when**:
- ✅ All 23 tests above pass
- ✅ No TypeScript compilation errors
- ✅ No console errors in browser (check DevTools Console)
- ✅ Integration tests pass (if implemented)

---

## Troubleshooting

**Problem**: API returns 500 Internal Server Error
- Check Docker logs: `docker-compose logs api --tail 50`
- Verify database connection: `curl http://localhost:8080/health`

**Problem**: Web UI shows CORS error
- Verify API has CORS enabled for http://localhost:3000
- Check docker-compose.yaml: `CORS_ORIGIN=http://localhost:3000`

**Problem**: Token stored but still redirects to sign-in
- Check token format in localStorage (should be base64url string)
- Verify GET /v1/me returns 200 (check Network tab)
- Clear localStorage and sign in again

**Problem**: Mock code 000000 doesn't work
- Verify AUTH_MODE=mock in docker-compose.yaml
- Check OTP challenge was created (check database or restart challenge)

---

**Report**: After verification, document any failures or unexpected behavior in GitHub Issue or TASKS.md notes.
