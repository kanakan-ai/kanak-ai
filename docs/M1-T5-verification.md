# M1-T5 Human Verification — Phone OTP & Apple Auth

Preconditions:
- Run `docker-compose up --build` from the repository root.
- `AUTH_MODE=mock` is set in `.env`.
- Open http://localhost:3000.

Journey mapping: Sign in / account access

1. On the sign-in page, select **Phone**.
2. Enter a valid number in E.164 format, such as `+15551234567`, and choose **Send code**.
3. Enter `000000` and choose **Verify and continue**.
4. Confirm that the Vault opens and the signed-in phone number is displayed in the account area.
5. Sign out, return to sign-in, and choose **Continue with Apple**.
6. Confirm that the Vault opens and a sign-out action remains available.
7. Sign out again, then choose Phone and enter `555-123-4567`.

Expected result:
- Both phone OTP and the local Apple mock establish a passwordless session.
- The invalid phone format shows a clear error and does not send a code.

Fail if:
- A password field appears.
- Any sign-in route leaves the user on a blank page.
- A session is created with an invalid phone number or an incorrect code.
