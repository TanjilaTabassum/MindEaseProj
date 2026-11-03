# QA note: BL-17 Workshop payment (SSLCommerz sandbox)

Task: T17.13 (manual sandbox payment test)
Tester: Roshni
Date tested: 3 Nov 2026
Branch / commit tested: main (qa/bl17-payment)
Environment: backend http://localhost:5000, frontend http://localhost:5173, SSLCommerz sandbox, MongoDB Atlas

## Setup
- `server/.env` has SSLC_STORE_ID, SSLC_STORE_PASSWD, BACKEND_URL, FRONTEND_URL (values not recorded here).
- Accounts: one approved facilitator and the test seeker.
- Workshops: free workshops and one paid workshop ("Peace", 500 BDT).
- Payment status values: pending, success, failed, cancelled.
- Test card details were taken from the SSLCommerz sandbox payment page.

## Test results

| # | Scenario | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| 1 | Free workshop | Seeker clicks Enroll on a free workshop | Enrolled at once, no payment page | Pass | Browser |
| 2 | Facilitator sets a price | Facilitator creates a workshop with a price; another with no price | Price shown on the card; no price = Free | Pass | "Peace" shows 500 BDT, others show Free |
| 3 | Paid workshop, success | Pay & Enroll, Success on the OTP page | /payment/success; enrolled; seats reduced; Payment status success | Pass | Browser: success page, enrolled state, seats left updated. Compass not checked |
| 4 | Paid workshop, fail | Pay & Enroll, Failed on the OTP page | /payment/fail; not enrolled; Try again works | Pass | Browser: fail page, card still shows Pay 500 BDT & Enroll. Compass not checked |
| 5 | Paid workshop, cancel | Pay & Enroll, cancel (X) at the gateway | /payment/cancel; not enrolled | Pass | Gateway asked to confirm the cancel; clicked Yes |
| 6 | Direct enroll bypass | Thunder Client: enroll route on the paid workshop with a seeker token | Refused; no enrollment | Pass | 400 "This is a paid workshop. Use Pay & Enroll."; card unchanged |
| 7 | Already enrolled | Pay again for a workshop already enrolled in | Refused | Not run | |
| 8 | Full workshop | Pay for a full workshop | Refused as full | Not run | |
| 9 | Cancelled workshop | Pay for a cancelled workshop | Refused | Not run | |
| 10 | Wrong role / no token | Pay call with a facilitator token, then with no token | 403, then 401 | Not run | |
| 11 | Forged callback | curl POST /api/payments/success with val_id=fake123, tran_id=fake123, status=VALID, amount=500, no token | Rejected; no enrollment | Pass | 303, Location /payment/fail?reason=invalid |
| 12 | Repeat success callback | Call the success callback twice | No duplicate enrollment | Not run | |
| 13 | Cancel enrollment (free and paid) | Cancel an enrollment on a free and a paid workshop | Seat released; no-refund note on paid | Pass | Seats went from 19 to 20 on both; note "Cancelling does not refund the fee" shown |
| 14 | Re-pay after cancelling | Pay again after cancelling | Enrolled again | Pass | Browser: success page, enrolled. Compass not checked |
| 15 | Success with risk (sandbox) | Click Success with risk on the OTP page | Treated as success; enrolled | Pass | Risk level is not checked; accepted for the sandbox demo |

## Unit tests
Payment unit tests (T17.5): 41 passed.

## Defects found
None found in the tests run.

## Summary
- Passed: 10 of 15
- Failed: 0
- Not run: 5 (tests 7 to 10 and 12)
- Known limits: no refunds, no receipts; the gateway's server callback (IPN) cannot reach localhost, so only the redirect callbacks are tested. Payment records were not inspected in Compass.

Signed off by: Roshni  Date: 3 Nov 2026