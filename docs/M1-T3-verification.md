# M1-T3: Document Upload Flow — Manual Verification Script

**Task**: M1-T3 upload flow implementation with API backend + Web UI  
**Status**: Integration tests passing (13/13) ✅  
**Date**: 2025-01-10

---

## Prerequisites

Ensure all services are running:
```bash
docker-compose ps
# All services should show "healthy"
```

---

## Part 1: API Backend Tests (curl)

### 1.1 Create test user and get access token

```bash
# Request auth code
curl -X POST http://localhost:8080/v1/auth/email/start \
  -H "Content-Type: application/json" \
  -d '{"email": "upload-test@example.com"}'

# Verify with mock code (use code "000000" from response devHint)
curl -X POST http://localhost:8080/v1/auth/email/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "upload-test@example.com", "code": "000000"}'

# Save the accessToken from response
export TOKEN="<your-access-token>"
```

### 1.2 Upload a PDF document

```bash
# STEP 1: Create a test PDF file first
cat > test-auto-policy.pdf << 'EOF'
%PDF-1.4
1 0 obj
<</Type /Catalog /Pages 2 0 R>>
endobj
2 0 obj
<</Type /Pages /Kids [3 0 R] /Count 1>>
endobj
3 0 obj
<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<</Size 4 /Root 1 0 R>>
startxref
190
%%EOF
EOF

# Verify the file was created
ls -lh test-auto-policy.pdf
# Should show ~300 bytes

# STEP 2: Upload with document type
curl -X POST http://localhost:8080/v1/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-auto-policy.pdf" \
  -F "documentType=auto_policy" \
  -F "source=upload"

# Expected: 202 status, response with documentId and status='accepted'
# Save the documentId from response
export DOC_ID="<your-document-id>"
```

✅ **Verify**:
- Response status 202
- JSON contains `documentId`, `status: 'accepted'`, and `message`

### 1.3 List user documents

```bash
curl -X GET http://localhost:8080/v1/documents \
  -H "Authorization: Bearer $TOKEN"
```

✅ **Verify**:
- Response status 200
- JSON contains `documents` array with at least 1 document
- Document has `id`, `document_type: 'auto_policy'`, `status: 'parsing'`, `storage_key`, `byte_size`, `checksum_sha256`

### 1.4 Get document detail with presigned URL

```bash
curl -X GET http://localhost:8080/v1/documents/$DOC_ID \
  -H "Authorization: Bearer $TOKEN"
```

✅ **Verify**:
- Response status 200
- JSON contains all document fields
- `download_url` field present (MinIO presigned URL)

### 1.5 Download document (manual testing)

```bash
# Download file via API proxy endpoint
curl -X GET http://localhost:8080/v1/documents/$DOC_ID/download \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded-document.pdf

# Verify it's a valid PDF
file downloaded-document.pdf
# Expected: "PDF document, version 1.4"

# Check file size matches
ls -lh downloaded-document.pdf
```

✅ **Verify**:
- File downloads successfully from host machine
- File is a valid PDF
- File size matches original upload

**Technical Note**: This endpoint proxies downloads through the API, which works from any network location. Presigned URLs (from step 1.4) use internal Docker hostname and are primarily for internal service-to-service communication.

### 1.6 Test validation errors

```bash
# Missing auth
curl -X POST http://localhost:8080/v1/documents \
  -F "file=@test-auto-policy.pdf" \
  -F "documentType=auto_policy"
# Expected: 401 Unauthorized

# Missing documentType
curl -X POST http://localhost:8080/v1/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-auto-policy.pdf"
# Expected: 400 with message "documentType is required"

# Invalid documentType
curl -X POST http://localhost:8080/v1/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-auto-policy.pdf" \
  -F "documentType=invalid_type"
# Expected: 400 with message "Invalid documentType"

# Non-PDF file
echo "This is text" > test.txt
curl -X POST http://localhost:8080/v1/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.txt" \
  -F "documentType=auto_policy"
# Expected: 400 with message "Only PDF files are supported"
```

### 1.7 Delete document

```bash
# Delete the document (with status code display)
curl -X DELETE http://localhost:8080/v1/documents/$DOC_ID \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
# Expected: HTTP Status: 204

# Verify deletion - document should no longer exist
curl -X GET http://localhost:8080/v1/documents/$DOC_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: 404 Not Found with error message
```

✅ **Verify**:
- DELETE returns HTTP 204 (no response body is normal for 204)
- GET after delete returns 404 Not Found

### 1.8 Check MinIO storage

```bash
# Access MinIO Console at http://localhost:9001
# Credentials: minioadmin / minioadmin
# Navigate to "kanak-documents" bucket
# Should see uploaded PDF at path: {userId}/{documentId}.pdf
```

---

## Part 2: Web UI Tests (Browser)

### 2.1 Sign in

1. Open http://localhost:3000 in browser
2. Enter email: `web-upload-test@example.com`
3. Click "Send Code"
4. Enter code: `000000`
5. Click "Verify & Sign In"

✅ **Verify**: Dashboard loads with user profile

### 2.2 Navigate to Upload

1. On Dashboard, find "Coming Soon" section
2. Click "Upload Document" button (gradient purple)

✅ **Verify**: Upload screen loads

### 2.3 Upload a document

1. **Select Document Type**: Choose "Auto Insurance Policy" from dropdown
2. **Choose File**: Click "Choose file" button, select a PDF (< 25MB)
3. **Review file details**: See filename, size, and type displayed
4. **Upload**: Click "Upload Document" button

✅ **Verify**:
- Progress bar animates (0-100%)
- Success message appears: "Document uploaded successfully!"
- After 2 seconds, automatically navigates back to Dashboard

### 2.4 Test validation (client-side)

1. Go to Upload screen
2. Try selecting a non-PDF file (e.g., .jpg, .txt)
   - ✅ Error: "Only PDF files are supported"
3. Try uploading without selecting document type
   - ✅ Error: "Please select a document type"
4. Try uploading a file > 25MB
   - ✅ Error: "File size exceeds 25MB limit"

### 2.5 Back navigation

1. On Upload screen, click "← Back" button at top-left

✅ **Verify**: Returns to Dashboard without uploading

---

## Part 3: Network Inspection (Browser DevTools)

### 3.1 Upload request inspection

1. Open DevTools (F12) → Network tab
2. Perform upload from UI
3. Find POST request to `/v1/documents`

✅ **Verify**:
- Request Method: POST
- Content-Type: multipart/form-data
- Request Headers include `Authorization: Bearer ...`
- Form Data includes:
  - `file`: PDF binary
  - `documentType`: selected type
  - `source`: 'upload'
- Response status: 202
- Response body: `{ documentId, status: 'accepted', message }`

### 3.2 List request inspection

1. While on Dashboard (after upload), manually trigger:
   ```javascript
   fetch('http://localhost:8080/v1/documents', {
     headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
   }).then(r => r.json()).then(console.log)
   ```

✅ **Verify**:
- Response status: 200
- `documents` array contains uploaded document
- Each document has: `id`, `document_type`, `status`, `storage_key`, `byte_size`, `created_at`

---

## Part 4: Edge Cases

### 4.1 Concurrent uploads

1. Open two browser tabs with same user
2. Upload different PDFs simultaneously
3. Check `/v1/documents` list

✅ **Verify**: Both documents appear in list with unique IDs

### 4.2 Auth expiration

1. Sign in, go to Upload screen
2. Wait for session to expire (or manually delete token from localStorage)
3. Try uploading

✅ **Verify**: 401 error, user redirected to sign-in

### 4.3 Large file rejection

1. Try uploading a PDF > 25MB

✅ **Verify**:
- Client-side: Error before upload
- Server-side (if bypassed): 413 Payload Too Large

---

## Part 5: Data Persistence

### 5.1 Database inspection

```bash
docker-compose exec postgres psql -U kanak -d kanak -c "SELECT id, user_id, document_type, status, storage_key, byte_size FROM documents ORDER BY created_at DESC LIMIT 5;"
```

✅ **Verify**:
- Uploaded documents present
- `status` changed from 'pending' to 'parsing'
- `storage_key` format: `{userId}/{documentId}.pdf`
- `checksum_sha256` populated

### 5.2 MinIO bucket inspection

```bash
# List objects in bucket
docker-compose exec minio mc ls local/kanak-documents --recursive
```

✅ **Verify**:
- PDFs stored at correct paths matching `storage_key`
- File sizes match `byte_size` in database

---

## Summary Checklist

### API Backend ✅
- [ ] Upload endpoint returns 202
- [ ] Document created in database with correct fields
- [ ] PDF uploaded to MinIO storage
- [ ] List endpoint returns user's documents
- [ ] Get detail endpoint returns presigned URL
- [ ] Delete endpoint removes document and storage
- [ ] All validation errors handled correctly (401, 400, 413)

### Web UI ✅
- [ ] Sign-in flow works
- [ ] Dashboard shows "Upload Document" button
- [ ] Upload screen loads with document type dropdown
- [ ] File picker validates PDF and size
- [ ] Upload progress bar displays
- [ ] Success message and auto-navigation work
- [ ] Back button returns to Dashboard
- [ ] Client-side validation shows errors

### Integration ✅
- [ ] Authorization headers sent correctly
- [ ] Multipart form-data formatted properly
- [ ] All 31 integration tests pass
- [ ] MinIO bucket contains uploaded files
- [ ] Database records match uploaded documents

---

## Troubleshooting

### "Route POST:/v1/documents not found"
- **Cause**: Document routes not registered
- **Fix**: Check `index.ts` route registration order
- **Verify**: `curl http://localhost:8080/v1/` shows documents endpoint

### "Column 'original_filename' does not exist"
- **Cause**: Service using wrong schema column names
- **Fix**: Use `storage_key`, `byte_size`, `checksum_sha256` from schema.sql
- **Verify**: Check `services/document.ts` interface matches schema

### "MinIO bucket not found"
- **Cause**: initMinIO() not called or failed
- **Fix**: Check API startup logs for "✓ MinIO initialized"
- **Verify**: `docker-compose logs minio` shows bucket created

### Upload returns 500 error
- **Cause**: Runtime error in route handler
- **Fix**: Check `docker-compose logs api | grep -i error`
- **Common issues**: Schema mismatches, MinIO connection, auth middleware

### Web UI shows "Failed to upload"
- **Cause**: Network error or API down
- **Fix**: Check DevTools Network tab for actual error
- **Verify**: API health check `curl http://localhost:8080/health`

---

## Next Steps After Verification

Once all manual tests pass:

1. Update `m1_tasks.md` to mark M1-T3 as complete
2. Commit changes with message: `M1-T3: Implement document upload flow (API + Web UI)`
3. Push to GitHub
4. Proceed to M1-T4: Vault view
