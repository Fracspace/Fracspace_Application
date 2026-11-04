# Stays payment & hold — break cases (2026-11-03)

Every way a stay booking can go wrong between **Reserve** and **Success**, how to test it, what happens today,
and what should happen after the fix. Re-run this list after each round of fixes; tick **Pass** per platform.

- Flow: Stay Detail → Reserve (`POST /holds`) → Review (`PATCH`, `release`) → Proceed to pay (`POST /pay`) →
  PayU CheckoutPro → `POST /payment-result` → poll `/payment-status` → Success.
- Server rules seen so far: hold expires on its own; after `/pay` the booking is `pending_payment` for **15 min**
  (`holdExpiresAt`); the wallet share is taken at `/pay` and returned when that expires (seen on
  `sbkg_h9qlOutVWVc7`: taken 14:54:26, returned 15:10:00 IST).
- **Owner**: App = this repo · Server = backend · Both. Fix ids (S1–S7, A1–A6) are listed at the bottom.
- **Today**: ✅ works · ⚠️ works but poorly · ❌ breaks · ❔ not tested yet.
- Use ₹1 rooms on apitest for real-money cases. Never test with someone else's card or UPI.

## 1. Holds (rooms)

| ID | Case | How to test | Today | After fix | Owner | iOS | Android |
|---|---|---|---|---|---|---|---|
| H1 | App killed on the ROOM HELD sheet | Reserve, swipe the app away from the app switcher | ❌ room stays held until it expires | Next launch releases it (A2); a new Reserve replaces the old hold (S2) | Both | ☐ | ☐ |
| H2 | App killed on Review | Open Review, kill the app | ❌ same as H1 | Same as H1 | Both | ☐ | ☐ |
| H3 | Re-reserve the last room after a kill | Inventory 1: H2, reopen, Reserve the same room and dates | ❌ "Sold out" against your own hold | Old hold replaced, new hold created (S2) | Server | ☐ | ☐ |
| H4 | Leave Review while offline | Airplane mode, go back from Review | ❌ release fails silently, room held until expiry | Release queued and retried when online (A3) | App | ☐ | ☐ |
| H5 | Hold runs out while idle on Review | Wait out the countdown | ❔ "Your hold expired", back to Stay Detail | Same | App | ☐ | ☐ |
| H6 | App in background past the hold | Review → home screen for longer than the hold → return | ❔ countdown jumps to 0 / expired | Re-checks the server on foreground (A4) | App | ☐ | ☐ |
| H7 | Wrong phone clock | Set the clock 10 min ahead, Reserve | ❌ countdown wrong (expires early or late) | Countdown uses server time (S7, A4) | Both | ☐ | ☐ |
| H8 | Change dates / guests to sold-out ones | On Review pick sold-out dates | ❔ 409 message, old hold kept | Same | Server | ☐ | ☐ |
| H9 | Double-tap Reserve | Tap Reserve twice fast | ❔ one hold (idempotency key) | Same | Both | ☐ | ☐ |
| H10 | Back out and Reserve again at once | Review → back → Reserve immediately | ❔ waits for the release, then holds | Same | App | ☐ | ☐ |
| H11 | Pick another suite on Stay Detail after Reserve | Reserve suite A, pick suite B | ❔ A released | Same | App | ☐ | ☐ |

## 2. Wallet

| ID | Case | How to test | Today | After fix | Owner | iOS | Android |
|---|---|---|---|---|---|---|---|
| W1 | Wallet on, close the app inside PayU | Wallet on → Proceed → kill the app in PayU | ⚠️ wallet locked 15 min, then returned | Returned as soon as PayU says unpaid (S3) | Server | ☐ | ☐ |
| W2 | Wallet on, cancel PayU | Wallet on → Proceed → close PayU | ⚠️ locked until expiry or retry with wallet off | Returned on cancel (S3) | Server | ☐ | ☐ |
| W3 | Wallet covers the whole amount | Room cheaper than the balance | ✅ confirmed without PayU (`sbkg_x1lLfFK9mFpj`) | Same | Both | ☐ | ☐ |
| W4 | Balance changes between Review and Pay | Spend the wallet elsewhere, then Proceed | ❔ 409 `errors.useWallet`, amount redrawn | Same | Both | ☐ | ☐ |
| W5 | Two open bookings, one balance | Two devices, both wallet on, Proceed on both | ❔ second gets 409 | Same | Server | ☐ | ☐ |
| W6 | Wallet history wording | Check history after W1 | ⚠️ shows a "success" withdrawal, then a deposit | One "on hold" entry, completed or released | Server | ☐ | ☐ |
| W7 | Status after an unpaid expiry | Check the booking after W1 | ⚠️ `payment_failed` | `expired` | Server | ☐ | ☐ |
| W8 | Retry with wallet turned off | Fail once with wallet on, retry with it off | ❔ share returned | Same | Server | ☐ | ☐ |

## 3. PayU checkout

| ID | Case | How to test | Today | After fix | Owner | iOS | Android |
|---|---|---|---|---|---|---|---|
| P1 | A hash PayU asks for isn't signed | Type a UPI ID; type a card number | ⚠️ was "Payment could not start" (`validateVPA`, `getBinBasedDetails`) | Every CheckoutPro hash name signed | Server | ☐ | ☐ |
| P2 | Close PayU without paying | Proceed → close | ❔ "Payment cancelled", retry works | Same, wallet returned (W2) | Both | ☐ | ☐ |
| P3 | Card declined / wrong OTP | Use a failing card or wrong OTP | ❔ "Payment didn't go through", retry | Same + "Try another way" if offered | Both | ☐ | ☐ |
| P4 | UPI app, pay and return | Pick GPay/PhonePe, pay, come back | ✅ (iPhone) | Same | Both | ☐ | ☐ |
| P5 | UPI app, decline in the UPI app | Pick GPay, decline | ❔ failed | Same | Both | ☐ | ☐ |
| P6 | UPI app, app killed while in GPay, then pay | Pick GPay, kill Fracspace, pay in GPay | ❌ app shows nothing on reopen; relies on the server | Server confirms from PayU (S3); app shows the result on launch (A2) | Both | ☐ | ☐ |
| P7 | Pay, then kill the app before it reports | Pay, kill the app on PayU's success page | ❌ same as P6 | Same as P6 | Both | ☐ | ☐ |
| P8 | UPI ID (collect) approved late | Approve after 2+ minutes | ⚠️ "We'll notify you"; no push handling | Push opens the booking (A5) | Both | ☐ | ☐ |
| P9 | Payment lands after the hold expired | Approve a collect request after 15 min | ❌ not defined | Confirm if the room is free, else auto-refund (S4) | Server | ☐ | ☐ |
| P10 | Two attempts both succeed | Fail/cancel, retry and pay, then approve the old collect request | ❌ double charge possible | Extra payment refunded (S4) | Server | ☐ | ☐ |
| P11 | Double tap / network retry on Proceed | Tap Proceed twice on a slow network | ⚠️ app blocks taps; no server key | Idempotency key on `/pay` (S5) | Both | ☐ | ☐ |
| P12 | Change the booking while paying | `PATCH` while `pending_payment` (second device) | ❌ amount can change under an open attempt | 409 (S6) | Server | ☐ | ☐ |
| P13 | Network drops after PayU closes | Pay, airplane mode before `/payment-result` | ❔ treated as pending, keeps polling | Same; resolves on reconnect | App | ☐ | ☐ |
| P14 | Bank OTP / 3-D Secure page | Card with OTP, switch to Messages for the OTP | ❔ | Returns to PayU and completes | Both | ☐ | ☐ |
| P15 | Netbanking redirect | Pay by netbanking | ❔ | Completes or fails cleanly | Both | ☐ | ☐ |
| P16 | Offers / quick-pay errors in PayU | Open the checkout, watch for "Something went wrong" | ⚠️ PayU shows errors (V2 signature / not enabled) | No error, or features turned off | Server | ☐ | ☐ |
| P17 | Device with no UPI apps (iPad) | Pay on the iPad | ⚠️ cards / netbanking only | Same (QR parked) | — | ☐ | ☐ |
| P18 | Back during payment | Android back / iOS swipe while "Processing…" | ❔ blocked | Same | App | ☐ | ☐ |
| P19 | Production keys and URLs | Check `sdk.environment`, surl/furl on apitest | ⚠️ surl/furl to be pointed at apitest on deploy | Live keys, surl/furl reachable | Server | ☐ | ☐ |

## 4. After the payment

| ID | Case | How to test | Today | After fix | Owner | iOS | Android |
|---|---|---|---|---|---|---|---|
| R1 | Reopen after a kill mid-payment | P6 / P7, then reopen the app | ❌ nothing shown | Pending booking shown: success, confirming, or retry (A2) | App | ☐ | ☐ |
| R2 | Reserve again while one is pending | R1, then Reserve the same stay and pay | ⚠️ allowed (by choice); both payments can go through | Guest can book; if both succeed the extra one is refunded (S4) | Server | ☐ | ☐ |
| R3 | Push `booking.confirmed` tapped | Pay, wait for the push | ❔ | Opens My bookings → that booking (A5) | App | ☐ | ☐ |
| R4 | Push `payment.failed` / `hold.expiring` tapped | Trigger each | ❌ not handled | Opens Review Booking (A5) | App | ☐ | ☐ |
| R5 | My bookings after each case | Check tabs after H1–P19 | ❔ held / expired bookings not listed | Each booking in the right tab and status | Both | ☐ | ☐ |

## Server re-check (2026-11-04, apitest, wallet not touched)

| Fix | Result |
|---|---|
| S1 expiry job | ✅ an unpaid `pending_payment` booking turned `expired` at its expiry |
| S2 one hold per guest | ✅ a second `POST /holds` for the same room and dates expired the first |
| S3 settle unpaid attempts | ❌ `payment-result` for an attempt PayU never saw answers `pending` (also with `onPaymentCancel`) until the 15-min expiry |
| S5 `/pay` idempotency | ❌ the same `idempotencyKey` twice gave two attempts (unless it's read from somewhere else: ask) |
| S6 `PATCH` while paying | ⚠️ `200`; the booking goes back to `held` (the attempt is dropped). Fine if PayU can't still take that attempt |
| S7 server time | ✅ `booking.serverTime` (the app already uses the `Date` header) |
| W7 status after expiry | ✅ `expired`, not `payment_failed` |
| `release` while paying | ✅ allowed (`200`, `expired`); the app never calls it mid-checkout |
| W1/W2, W6 wallet | ❔ not run here: it moves real wallet money. Test in the app with a ₹1 room |
| S4 late / double success | ❔ needs a real payment |

## Fixes

**Server**
- S1 Holds and `pending_payment` bookings expire on a job: room freed, wallet share returned.
- S2 One open hold per guest per room: a new `POST /holds` releases their older `held` ones.
- S3 Ask PayU (`verify_payment`) for every `pending_payment` attempt until final; surl/furl live. Return the wallet
  share as soon as PayU says unpaid.
- S4 Late success after expiry: confirm if free, else auto-refund. A second successful attempt: refund it.
- S5 Idempotency key on `/pay`.
- S6 `PATCH` returns 409 while `pending_payment`.
- S7 Return server time (or seconds left) with holds.
- Also: W6 wallet history wording, W7 `expired` not `payment_failed`, P1 sign every CheckoutPro hash, P16.

**App** (done in the commit that adds this file; the ❌/⚠️ marks above are from before it)
- A1 Save `{bookingId, attemptId, phase}` on Reserve and on `/pay`; clear it when done.
- A2 On launch and on Stays focus: `held` and not paying → release; `pending_payment` → `/payment-result` and show
  success, confirming, or retry.
- A3 Queue failed releases and retry.
- A4 Re-check the server when Review returns to the foreground; countdown from server time.
- A5 Handle `stay_booking` push taps: they open Stays → My bookings. Opening Review from `payment.failed` /
  `hold.expiring` needs the booking's stay and suite, so it waits for a `GET /bookings/:id` that carries them.
- A6 Dropped (2026-11-04): a pending payment must not stop the guest booking. Duplicates are the server's to
  refund (S4).

## Test runs (evidence for the backend)

### T1 · Cancel in PayU, wallet off — 2026-11-04, iOS simulator — ❌ S3 gap
Booking `sbkg_vQjH4MaDb8-p` (Dreamscape, ₹1.02), attempt `ST261104QA7BZ6CW`. App log (IST):
```
10:40:40.458 POST /pay            → status=pending_payment attempt=ST261104QA7BZ6CW holdUntil=05:25:40Z
10:40:40–43  PayU hashes signed   → get_sdk_configuration, get_all_offer_details, fetch_quick_pay_option,
                                    get_checkout_details, eligibleBinsForEMI: all 200
10:40:57.321 PayU event           → onPaymentCancel (guest closed the checkout)
10:40:57.434 POST /payment-result → next=pending status=pending_payment pay=pending
10:41:00 → 10:42:57 GET /payment-status every 3 s → next=pending every time
```
**For the backend:** after the guest cancels in PayU, `/payment-result` answers `pending`, and the booking stays
`pending_payment` (room held) until `holdUntil`, 15 minutes after `/pay`. Expected: `failed` (or `cancelled`) within a
few seconds once PayU confirms there is no payment for the txnid, with the room and any wallet share freed then.
Re-run 11:19 IST, booking `sbkg_1aUeweNmOiPL`, attempt `ST2611042067BUHU`: `onPaymentCancel` 11:19:51.333 →
`/payment-result` 11:19:51.723 `next=pending`, then `pending` on every `/payment-status` for 2 minutes. Same result.
After the first run's booking timed out (10:55:40) it ended as **`payment_failed`, not `expired`** (W7 still open
when a gateway attempt exists).
**App side (before the fix):** showed "Confirming your payment…" for 2 minutes, then "We'll notify you…", which is wrong for a cancel. It
followed the server's `next`. Now the app trusts the SDK's cancel / failure / error for the screen (shows it at
once, still reports to the server; leaving Review releases the room and wallet share), and waits at most 30 s after
a success.

Re-check after the app fix, 12:18 IST, booking `sbkg_oYAuOxz7OFWh` — ✅ app side:
```
12:18:07.844 onPaymentCancel → 12:18:07.923 /payment-result next=pending → "Payment cancelled" shown at once (no polling)
12:18:20.913 Proceed again   → new attempt ST261104VSWP0F2B → 12:18:24.445 onPaymentCancel, shown at once
12:19:12.692 back from Review → POST /release → status=expired (room freed at once, not at 12:33)
```
For the backend: after that release the booking still reports `payment.status=pending`; it should be cancelled/failed.

