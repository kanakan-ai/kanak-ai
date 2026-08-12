# M1-T4 Human Verification — Vault View (API + Web UI + Stub Parse)

**Task**: M1-T4 — Vault view (API + Web UI + Stub Parse)  
**Date**: 2026-08-11  
**Status**: Ready for verification

---

## Preconditions

- Stack running: `docker compose up` from workspace root
- Environment: `AUTH_MODE=mock` (configured in `.env`)
- API: http://localhost:8080
- Web: http://localhost:3000
- Browser: Chrome, Firefox, or Safari

---

## Journey Mapping

- **Journey A (Intake → Parse → Vault)**: Complete flow from upload to viewing extracted fields
- **Journey B (Alert → Action)**: Preview (renewal dates visible in vault, alerts in M3)
- Screens: Sign-in → Vault list → Upload → Vault list → Document detail

---

## Verification Steps

### Part 1: Empty Vault State

1. Open http://localhost:3000 in browser
2. Sign in:
   - Enter any email (e.g., `test@example.com`)
   - Click "Send code" → should show OTP input
   - Enter code `000000` (mock mode)
   - Click "Verify" → should authenticate successfully
3. **Verify**: You land on the Vault screen after sign-in.
4. **Verify**: Empty state shows:
   - Large document icon (📄)
   - "No documents yet" text
   - "Upload your first document to get started" subtext
   - Teal "Upload a document" button
5. **Verify**: The default appearance is dark, with a clear Kanak AI brand and **Vault** as the page title.
6. **Desktop check (browser width ≥900px)**: A persistent left navigation is visible with Kanak AI, Vault, unavailable Ask/Settings items, and the signed-in email plus **Sign out**. The content is a desktop-width layout, not a stretched phone screen.
7. **Narrow-screen check (browser width <760px)**: The compact bottom navigation is visible and usable; the desktop sidebar is not shown.

**Expected result**: Clean empty state with clear CTA to upload first document

---

### Part 2: Upload and Parse Flow

8. Click "Upload document" button
9. **Verify**: Upload screen appears inside the same Kanak AI application shell with:
   - Document type dropdown (required, pre-select needed)
   - File picker
10. Select document type: **Auto Insurance Policy**
11. Choose any PDF file (create a test PDF if needed)
12. Click "Upload document"
13. **Verify**: The upload action shows a loading state, then returns to Vault

**Expected result**: Document appears in vault list within 2-3 seconds with "Processing..." status

---

### Part 3: Vault List Display

14. Wait 2-3 seconds for stub parse to complete
15. **Verify**: Document card shows:
    - 🚗 icon with green checkmark (ready status)
    - Title: "Auto Insurance • State Farm" (or similar)
    - Subtitle: "$1,245/yr" (or similar premium)
    - A readable renewal line and countdown badge (for example, "Renews on Oct 3, 2026" and "52 days")
16. **Verify**: Document appears in **"ALL DOCUMENTS"** section
17. **Verify**: If renewal date is within 30 days, document ALSO appears in **"UPCOMING"** section above

**Expected result**: Document cards match UX mock 04 with proper icons, titles, amounts, and countdown badges

---

### Part 4: Upload Multiple Document Types

18. Click "Upload" button again
19. Upload a **Home Insurance Policy** PDF
20. Wait for parsing
21. **Verify**: Home policy shows 🏠 icon, carrier name, premium
22. Upload a **Life Insurance Policy** PDF
23. **Verify**: Life insurance shows 🛡️ icon, carrier name, death benefit
24. Upload a **Warranty** PDF
25. **Verify**: Warranty shows 📋 icon, issuer name
26. Upload a **Receipt** PDF
27. **Verify**: Receipt shows 🧾 icon, merchant name

**Expected result**: All 5 documents appear in vault list with correct icons and extracted party names

---

### Part 5: Document Detail View

28. Click on the **Auto Insurance** card
29. **Verify**: Document detail appears inside the same Kanak AI shell with:
    - Back button (← Back)
    - Header: "Auto Insurance • State Farm"
    - Status badge: "Ready" (green)
30. **Verify**: Extracted fields appear as cards with:
    - Icon on left (e.g., 🏢 for carrier, 🔢 for policy number, 💰 for premium, 📅 for dates)
    - Field label (uppercase, gray, small)
    - Field value (bold, larger)
    - Attribution text: "from document" (gray, italic)
31. **Verify**: Fields include (at minimum):
    - Carrier
    - Policy number
    - Named insured
    - Annual premium
    - Renewal date
    - Effective date
    - Vehicle year/make/model
    - Deductibles
    - Liability coverages
32. **Verify**: "Open original PDF" button at bottom
33. Click "Open original PDF"
34. **Verify**: PDF downloads successfully

**Expected result**: Detail screen matches UX mock 07 with field cards, icons, and attribution

---

### Part 6: Compare Rates CTA (Insurance Only)

35. On Auto Insurance detail screen (or Home Insurance)
36. **Verify**: Green "Compare rates" button appears below "Open original PDF"
37. Click "Compare rates"
38. **Expected**: Button is present (actual comparison flow is M3)

**Expected result**: Insurance policies show "Compare rates" CTA; other doc types do not

---

### Part 7: Navigation and Back Flow

39. Click "← Back" button
40. **Verify**: Returns to Vault list
41. **Verify**: All 5 documents still visible
42. Click on **Home Insurance** card
43. **Verify**: Detail screen shows home policy fields (dwelling coverage, property address, etc.)
44. Click Back → verify return to vault
45. Click on **Warranty** card
46. **Verify**: Warranty fields show (issuer, product name, warranty cost, expiration date)

**Expected result**: Navigation between vault list and detail screens works smoothly

---

### Part 8: Vault Organization (UPCOMING Section)

47. On vault list, check if any documents appear in **"UPCOMING"** section
48. **Verify**: If a document has a renewal/key date within 30 days, it appears in UPCOMING
49. **Verify**: Countdown badge shows days remaining with appropriate color:
    - **Green**: >30 days
    - **Blue**: 8-30 days
    - **Yellow**: 2-7 days
    - **Red**: 0-1 days or "Today"/"Tomorrow"
50. **Verify**: All documents appear in "ALL DOCUMENTS" section regardless of date

**Expected result**: UPCOMING section filters documents intelligently; countdown badges color-coded by urgency

---

### Part 9: Status Indicators

51. Upload another document (any type)
52. Immediately return to vault (before parse completes)
53. **Verify**: Document shows "Processing..." status (no checkmark)
54. **Verify**: Within 2-3 seconds, status updates to "Ready" with green checkmark

**Expected result**: Processing status visible during parse; automatic update to ready without page refresh

---

### Part 10: Sign Out and Persistence

55. Refresh the browser page (F5).
56. **Verify**: You remain signed in and the vault is shown.
57. Click **Sign out** in the account area (desktop sidebar) or mobile header.
58. **Verify**: You return to the Kanak AI sign-in screen.
59. Refresh the browser page again.
60. **Verify**: The app remains on sign-in; it does not restore the prior session.

**Expected result**: Session persists across refresh; sign-out clears session

---

## Success Criteria Checklist

- ✅ Empty vault state with clear CTA
- ✅ Upload redirects to vault after success
- ✅ Documents appear in vault list within 2-3 seconds
- ✅ Document cards show correct icons, party names, amounts, countdown badges
- ✅ UPCOMING section filters documents with dates ≤30 days
- ✅ ALL DOCUMENTS section shows complete list
- ✅ Document detail shows extracted fields with icons and attribution
- ✅ Fields match document type (auto: vehicle info, home: dwelling coverage, etc.)
- ✅ "Open original PDF" downloads the file
- ✅ "Compare rates" button appears for insurance policies only
- ✅ Navigation (vault ↔ detail) works smoothly
- ✅ Sign out is visible and works from the authenticated app shell
- ✅ Desktop uses a Kanak AI sidebar and desktop-width content; narrow screens use compact navigation
- ✅ Processing status visible during parse
- ✅ Status updates to "Ready" automatically
- ✅ Multiple document types supported (auto, home, life, warranty, tax, receipt, other)
- ✅ Visual design matches UX mock 04 (vault) and mock 07 (detail)

---

## Fail If

- Vault screen not the default authenticated screen
- Empty state missing or poorly styled
- Documents don't appear after upload + parse
- Extracted fields missing or incorrect structure
- Icons don't match document types
- Countdown badges missing or wrong colors
- UPCOMING section doesn't filter correctly
- Detail screen fields don't show proper icons/labels
- "from document" attribution missing
- PDF download fails
- Back navigation breaks
- Sign out is missing, fails to return to sign-in, or a refresh restores the signed-out session
- Desktop renders as a stretched mobile screen, or narrow screens have unusable navigation
- Status doesn't update from "Processing" to "Ready"
- Visual design significantly deviates from mocks

---

## Technical Notes

- Stub parse worker polls every 2 seconds for pending documents
- Generated fields include confidence scores (0.85-0.96)
- Renewal dates set to ~2 months in future by default
- Denormalized columns (party_name, amount, key_date) populated for sorting/filtering
- Extracted records stored in JSONB fields array per OpenAPI FieldValue[] spec
- Web UI uses a shared dark-default theme with teal accents. Light-theme preference persistence remains outside this scoped remediation because `PATCH /v1/me` is not implemented.
- Ask and Settings remain unavailable visual placeholders in M1-T4; full implementation is in later milestones.

---

## Mock Reference

- Vault list: `kanak-ai-specs/sample_mockups/04-home-vault-list.jpg`
- Document detail: `kanak-ai-specs/sample_mockups/07-document-detail.jpg`

---

## Related Files

- Backend: `services/api/src/services/extracted-record.ts`, `services/api/src/workers/stub-parse-worker.ts`
- API: `services/api/src/routes/documents.ts`
- Frontend: `services/web/src/components/Vault.tsx`, `services/web/src/components/DocumentDetail.tsx`
- Tests: `tests/integration/m1-t4-vault.test.ts`

---

**Once all steps pass, mark M1-T4 as complete in m1_tasks.md and commit changes.**
