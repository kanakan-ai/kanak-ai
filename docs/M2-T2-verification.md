# M2-T2 Human Verification — Real phone OTP (AWS SNS)

**Task**: M2-T2 — Real phone OTP via AWS SNS
**Status**: Part 1 (regression) verified automatically. Part 2 (live SMS) needs your AWS account and a real phone — I cannot receive an SMS myself.

---

## Preconditions

- Stack running: `docker-compose up -d --build`
- Web: http://localhost:3000 · API: http://localhost:8080

This task has **two** parts: a regression check (no AWS needed) and a live-delivery check (needs your own AWS account).

---

## Part 1 — Regression: mock mode is unchanged (no AWS needed)

1. Confirm `.env` has `AUTH_MODE=mock` (the default).
2. Sign in on http://localhost:3000 with any phone number, code `000000`, as before.
3. **Verify**: sign-in still works exactly as it did before this task.
4. `docker-compose logs api --tail 20` — **verify** you see a `📱 CONSOLE SMS PROVIDER` block with the code, in the same place the old `MOCK SMS (AUTH_MODE=mock)` log line used to appear.

**Fail if**: mock sign-in breaks, or a real AWS call is attempted while `AUTH_MODE=mock` (it must not be — enforced in code, same rule as the email provider).

Automated: the full mock-mode integration suite (`cd tests/integration && npm test`) passed 56/56, including `m1-t5-auth.test.ts` (phone OTP flow) unchanged.

---

## Part 2 — Live delivery via AWS SNS (needs your AWS account)

5. Your IAM identity needs `sns:Publish` permission (the same credentials from M2-T1 work if their policy also allows this action — SNS Publish for SMS doesn't need a separate verified "sender identity" the way SES does, but new AWS accounts start in an **SMS sandbox** in most regions: you can only send to phone numbers you've verified in the SNS console under "Text messaging (SMS)" → "Sandbox destination phone numbers," until you request production access).
6. In `.env`, set:
   ```bash
   AUTH_MODE=live
   SMS_PROVIDER=sns
   AWS_REGION=us-east-1                 # wherever you want the SNS Publish call to originate
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_SESSION_TOKEN=...                # only if using assume-role temporary credentials
   ```
7. `docker-compose up -d --build api` to pick up the new env.
8. On http://localhost:3000, sign in with the phone number you verified in step 5 (E.164 format, e.g. `+15551234567`).
9. **Verify**: the response no longer includes a `devHint` (no more "use code 000000") — a real 6-digit code was generated.
10. **Verify**: a real SMS arrives at that number containing the same code.
11. Enter that code on the sign-in screen. **Verify**: you're signed in.

**Fail if**: no SMS arrives and no clear SNS error appears in `docker-compose logs api`; the code in the SMS doesn't match what unlocks sign-in; a `devHint` still appears in live mode.

**Known non-bug failure modes** (both surface as a generic message to the API caller, plus a specific dev-only hint appended outside `NODE_ENV=production` — check `docker-compose logs api` for the full underlying AWS error either way):
- **Recipient rejected** (`AuthorizationErrorException` or `OptedOutException` from SNS) — your account is still in the SMS sandbox and this number isn't verified there, or the number has opted out of SMS from your account. Not a code defect.
- **Credentials invalid** (`ExpiredToken`, `InvalidClientTokenId`, etc.) — same classification as M2-T1's SES adapter; your AWS credentials have expired or are malformed. Generate fresh ones and update `.env`. Not a code defect.
- **Silent non-delivery with a successful API response** (hit for real during verification, 2026-08-15) — `PublishCommand` returned `200`/a real `MessageId` (~378ms round-trip, confirming the live path was taken, not console mock), but no SMS arrived. Root cause: the AWS account was still on the Free/unactivated plan (payment + identity verification incomplete), which blocks registering a 10DLC origination identity — required for reliable SNS SMS delivery to US numbers. AWS accepts the `Publish` call regardless and the carrier silently drops the message; **SNS does not surface this as an API error**, so `SmsDeliveryError` cannot classify it — this failure mode is invisible to the code by design. Confirmed via the AWS "Complete your account setup" banner when attempting to register an origination identity. Resolution is entirely account-side: complete AWS account activation, then register an origination number/campaign (10DLC), and retest. Not a code defect.

---

## Success criteria checklist

- [x] Mock-mode sign-in unaffected (Part 1 — automated, 56/56 passing)
- [x] `AUTH_MODE=mock` never calls AWS, regardless of `SMS_PROVIDER` (unit-tested)
- [ ] `AUTH_MODE=live` + `SMS_PROVIDER=sns` delivers a real SMS with a real, working code (Part 2 — needs your AWS account + phone)
- [ ] No `devHint` leaks in live mode (Part 2)

---

## Technical notes

- New files: `services/api/src/sms/{types,console-provider,sns-provider,index}.ts` — exact structural mirror of `services/api/src/email/` from M2-T1
- `services/auth.ts`'s `startPhoneOtp` now sends through `getSmsProvider()` instead of an inline `console.log`; code-generation logic (mock → fixed `000000`, everything else → random) is unchanged
- New `config.sms.provider` (`'console' | 'sns'`, from `SMS_PROVIDER` env var), alongside the existing `config.email.provider`
- `SmsDeliveryError` (`recipient_rejected` | `credentials_invalid` | `unknown`) keeps vendor-specific error shapes inside the SNS adapter — `routes/auth.ts` never inspects AWS-specific error names directly, only the generic reason (same boundary rule as `EmailDeliveryError`)
- Unit tests (`services/api/src/sms/__tests__/`, run via `cd services/api && npm test`) mock the AWS SDK client: 13 tests covering SNS request shape, both error classifications, and the mock-always-wins provider-selection rule — no real AWS calls, no cost, runs in CI
- `tests/integration/m2-t2-sms-live.test.ts` is opt-in only (`LIVE_PHONE_TEST_RECIPIENT=+15551234567 npm test -- m2-t2-sms-live` against a stack with `AUTH_MODE=live`): skips cleanly with zero side effects when not set
- Reuses the same `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_SESSION_TOKEN`/`AWS_REGION` env vars as M2-T1's SES adapter — one AWS credential set for both providers, per `m2_tasks.md`'s scope note ("reusing the AWS credentials from M2-T1")

---

## Related files

- `services/api/src/sms/`
- `services/api/src/services/auth.ts`, `services/api/src/config.ts`, `services/api/src/routes/auth.ts`
- `.env.example`, `docker-compose.yml`
- Tests: `services/api/src/sms/__tests__/*.test.ts` (new, unit); `tests/integration/m2-t2-sms-live.test.ts` (new, opt-in live); `tests/integration/m1-t5-auth.test.ts` (regression, unchanged)

---

**Once Part 1 passes (already verified above) and Part 2 when you have a real phone number to test with, mark M2-T2 complete in m2_tasks.md.**
