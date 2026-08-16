# M2-T1 Human Verification — Real email OTP (AWS SES)

**Task**: M2-T1 — Real email OTP via AWS SES
**Status**: Verified — both parts passed, including live delivery with a real AWS account (2026-08-15)

---

## Preconditions

- Stack running: `docker-compose up -d --build`
- Web: http://localhost:3000 · API: http://localhost:8080

This task has **two** parts: a regression check (no AWS needed) and a live-delivery check (needs your own AWS account — I cannot run this part myself).

---

## Part 1 — Regression: mock mode is unchanged (no AWS needed)

1. Confirm `.env` has `AUTH_MODE=mock` (the default).
2. Sign in on http://localhost:3000 with any email, code `000000`, as before.
3. **Verify**: sign-in still works exactly as it did before this task.
4. `docker-compose logs api --tail 20` — **verify** you see a `📧 CONSOLE EMAIL PROVIDER` block with the code, same as the old mock-email log, just from the new provider abstraction.

**Fail if**: mock sign-in breaks, or a real AWS call is attempted while `AUTH_MODE=mock` (it must not be — this is enforced in code, not just by leaving `EMAIL_PROVIDER` unset).

---

## Part 2 — Live delivery via AWS SES (needs your AWS account)

5. In AWS SES (any region), verify a sender email identity you control — this becomes `SES_FROM_EMAIL`. If your account is in **SES sandbox mode** (the default for new accounts), also verify the recipient address you'll sign in with, or request production access first — otherwise SES will reject the send with a clear error, unrelated to this code.
6. In `.env`, set:
   ```bash
   AUTH_MODE=live
   EMAIL_PROVIDER=ses
   SES_FROM_EMAIL=you@yourdomain.com   # your verified SES sender
   AWS_REGION=us-east-1                 # wherever your SES identity lives
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```
7. `docker-compose up -d --build api` to pick up the new env.
8. On http://localhost:3000, sign in with the email you verified in step 5.
9. **Verify**: the response no longer includes a `devHint` (no more "use code 000000") — a real 6-digit code was generated.
10. **Verify**: a real email arrives in that inbox from your `SES_FROM_EMAIL`, subject "Your Kanak AI verification code," containing the same code.
11. Enter that code on the sign-in screen. **Verify**: you're signed in.
12. Try "Continue with email" → magic-link preference if you want to check that path too — subject should read "Sign in to Kanak AI" with a link instead of a code.

**Fail if**: no email arrives and no clear SES error appears in `docker-compose logs api`; the code in the email doesn't match what unlocks sign-in; a `devHint` still appears in live mode.

**Known non-bug failure modes** — both surface as the same generic, customer-safe message to the API caller in *every* environment (never AWS/vendor detail, even locally — check `docker-compose logs api` for the full underlying AWS error, logged server-side via `request.log.error`, never returned in the response):
- **Recipient rejected** (`AccessDenied` or `MessageRejected` from SES) — your SES account is still in sandbox mode and this recipient isn't verified, your IAM policy's `Resource` ARN doesn't match the sender identity (region and address must match exactly — a typo or wrong-region ARN in the policy produces this same error), **or the recipient address itself has a typo** (e.g. `hotmail.con`) — SES reports all three identically. `POST /auth/email/start` now runs a format + common-typo check (`services/api/src/lib/email-validation.ts`) before ever attempting delivery, which catches the typo case immediately with a specific "did you mean...?" message. Not a code defect.
- **Credentials invalid** (`ExpiredToken`, `InvalidClientTokenId`, etc.) — your AWS credentials (especially `assume-role` session tokens) have expired or are malformed. Generate fresh ones and update `.env`. Not a code defect.

Both were hit for real during verification (a policy region/typo mismatch, a token that expired mid-session, and later a typo'd recipient address) — the third is what motivated adding the pre-delivery format/typo check.

**Design note**: an earlier version of this feature exposed a dev-only, vendor-specific hint (e.g. "this usually means SES sandbox mode") outside `NODE_ENV=production`, to save a trip to the logs while testing locally. This was removed — the API now returns the exact same safe message in every environment (`docker-compose logs api` is the only place vendor/error detail ever appears), so local testing sees precisely what a real customer would see.

---

## Success criteria checklist

- Mock-mode sign-in unaffected (Part 1)
- `AUTH_MODE=mock` never calls AWS, regardless of `EMAIL_PROVIDER`
- `AUTH_MODE=live` + `EMAIL_PROVIDER=ses` delivers a real email with a real, working code
- No `devHint` leaks in live mode

---

## Technical notes

- New files: `services/api/src/email/{types,console-provider,ses-provider,index}.ts`
- `services/auth.ts` now sends through `getEmailProvider()` instead of an inline console-only function; code-generation logic (mock → fixed `000000`, everything else → random) is unchanged
- `config.auth.mode` type renamed `'mock' | 'real'` → `'mock' | 'live'` to match `design/TECH_STACK.md`'s `AUTH_MODE` contract — pure rename, nothing in the codebase branched on the literal string `'real'`
- `EmailDeliveryError` (`recipient_rejected` | `credentials_invalid` | `unknown`) keeps vendor-specific error shapes inside the SES adapter (same boundary rule as `design/parse-provider.md`) — `routes/auth.ts` never inspects AWS-specific error names directly, only the generic reason
- Unit tests (`services/api/src/email/__tests__/`, run via `cd services/api && npm test`) mock the AWS SDK client: 14 tests covering SES request shape, both error classifications, and the mock-always-wins provider-selection rule — no real AWS calls, no cost, runs in CI
- `tests/integration/m2-t1-email-live.test.ts` is opt-in only (`LIVE_EMAIL_TEST_RECIPIENT=you@yourdomain.com npm test -- m2-t1-email-live` against a stack with `AUTH_MODE=live`): skips cleanly with zero side effects when not set, so it never breaks the suite for contributors without AWS access
- AWS SES/SNS sandbox limitations (recipient verification, sending quotas) are an AWS account state, not something this code can detect or route around — Part 2 above calls this out explicitly

---

## Related files

- `services/api/src/email/`
- `services/api/src/services/auth.ts`, `services/api/src/config.ts`, `services/api/src/routes/auth.ts`
- `.env.example`, `docker-compose.yml`
- Tests: `services/api/src/email/__tests__/*.test.ts` (new, unit); `tests/integration/m2-t1-email-live.test.ts` (new, opt-in live); `tests/integration/m1-t2-auth.test.ts` (regression, unchanged)

---

**Once Part 1 passes (and Part 2 when you have AWS credentials to test with), mark M2-T1 complete in m2_tasks.md.**
