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

### T2 · Wallet on, cancel in PayU, leave Review — 2026-11-04 12:29 IST, iOS simulator — ✅
Booking `sbkg_HfwNN3k1DCyB` (Hilltop, ₹4,999), attempt `ST261104XX0SKKXP`:
```
12:29:10.680 POST /pay             → pending_payment wallet=95.98 debited
12:29:18.752 PayU onPaymentCancel  → 12:29:18.827 /payment-result next=pending (app shows "cancelled" at once)
12:29:26.310 back from Review      → POST /release → status=expired, wallet no longer debited
Wallet history: one entry, "withdrawal 95.98 failed · Hold released - stay booking sbkg_HfwNN3k1DCyB"
```
Wallet share back 16 s after the cancel (was 15 min). W6 looks fixed: one entry per hold, and yesterday's
`sbkg_h9qlOutVWVc7` withdrawal now reads `reversed`. Still from the server: `next=pending` after the cancel (S3).

App bug found in the same run: `sbkg_jJU5mlThtZIt` (cancelled twice, then the app restarted) was left held until
its timeout, because the clean-up skipped any booking the server still called `pending_payment`. Fixed: a booking
this phone saw end unpaid is released even if the server still says pending.

### T3 · Wallet on, app killed inside PayU, reopened — 2026-11-04 12:35 IST, iOS simulator — ❌ S3 gap
Booking `sbkg_d12M0Nn6Ne4f` (Hilltop), attempt `ST261104R2SR2QSR`:
```
12:35:32.158 POST /pay            → pending_payment wallet=95.98 debited holdUntil=12:50:32 IST
             (app killed while PayU was open; nothing paid)
12:35:54.835 reopened: clean-up   → GET booking: pending_payment
12:35:55.506 POST /payment-result → next=pending → banner "Checking your payment"
```
**For the backend:** the app reports the attempt as soon as it reopens, but the server answers `pending`, so the room
and the ₹95.98 wallet share stay locked until 12:50:32 (15 min). The app can't release it itself: it doesn't know
whether the guest paid before the kill. Expected: the server asks PayU (`verify_payment` for the txnid) and fails the
attempt (room + wallet freed) when PayU has no successful payment.
Outcome: released by the server at 12:52:00 IST (wallet entry completed `07:22:00.588Z`, "Hold released"), ~90 s after
`holdUntil`. Booking ended `payment_failed` with `payment.status=pending` (should be `expired` + failed/cancelled).
The app only re-checks on launch / foreground, so a guest who stays in the app isn't told the wallet came back.

### Retry gives a new attempt and extends the hold — 2026-11-04 12:45 IST, iOS simulator
Booking `sbkg_0rmllvaaa5wV`, PayU opened, closed, opened again:
```
12:45:52.156 POST /pay → attempt ST2611043GGC6KAQ holdUntil 07:30:52Z   12:45:58.720 onPaymentCancel → next=pending
12:46:09.378 POST /pay → attempt ST261104F5KWHT3E holdUntil 07:31:09Z   12:46:12.924 onPaymentCancel → next=pending
```
**For the backend:** the "pending so the guest can continue the same payment" design isn't what happens: the retry gets
a new attempt (new txnid) and the first stays open. To resume, `/pay` should return the open attempt. Each `/pay` also
moves `holdUntil` 15 min on, so opening and closing PayU can hold a room indefinitely; keep the first `holdUntil` or cap
attempts per booking (429).


### Timed re-check while the app stays open — 2026-11-04, iOS simulator — ✅ app
Booking `sbkg_TICfV9uxnw6o` (₹1.02, wallet off, attempt `ST261104TNFEWBZU` never sent to PayU), app left open:
```
13:03:26.692 /payment-result next=pending → "next check in 1012s" (holdUntil 07:48:18Z + 2 min sweep)
13:20:18.526 timer fires, no tap needed → GET booking: payment_failed → banner "Payment didn't go through"
```
Server again ended an unpaid attempt as `payment_failed` with `payment.status=pending` (W7).

### T5c · Card payment, app killed after the OTP, reopened — 2026-11-04 14:12 IST, iOS simulator — ✅
Booking `sbkg_tHeTyNGnk5pe` (Dreamscape, ₹1.02, debit card), attempt `ST2611045GH5X2E9`:
```
14:12:34.562 POST /pay → pending_payment
             OTP submitted, app killed before PayU reported back
14:14:48.572 server marks it paid (payment.paidAt; PayU's callback, the app was closed)
14:15:19.608 reopened: clean-up → GET booking: status=confirmed pay=success → banner "Booking confirmed"
```
Booking is in My bookings → Upcoming. The server learned of the payment without the app (surl/webhook works), and
the app picked it up on reopen. (P7 / R1 pass on the success path.)

### T6c · Card declined (3 wrong OTPs), then PayU closed — 2026-11-04 14:17 IST, iOS simulator — ✅
Booking `sbkg_5cke6b-d4VAV`, attempt `ST261104L230GND2`:
```
14:17:51.373 POST /pay → pending_payment
14:18:03.079 PayU asks for hash send_sign_in_otp → 400 "Hash send_sign_in_otp cannot be signed"
             3 wrong OTPs → bank fails it → PayU returns to its own payment page (retry inside the checkout;
             nothing reported to the app yet)
14:18:31.633 getBinBasedDetails signed (PayU's retry screen)
14:21:40.134 guest closes PayU → onPaymentCancel
14:21:40.303 POST /payment-result → next=failed pay=failure   ← server answers at once here
14:21:55.548 back from Review → POST /release → status=expired (room freed)
```
**What this shows about S3:** when PayU has a transaction for the txnid (here a failed one) the server answers
`failed` at once. When the guest closes PayU before any transaction exists (T1, T3) it answers `pending` until the
hold ends. For the backend: sign `send_sign_in_otp` (PayU's saved-card / quick-pay sign-in).

### Android · PayU stuck on "Processing…" — 2026-11-04 15:27 IST, OnePlus CPH2643 (debug) — ❌ blocks Android
Booking `sbkg_Ac0r9PwJ7TsF`, attempt `ST261104VP9D5JNH`. logcat (ReactNativeJS):
```
15:27:29.170 POST /pay → pending_payment
15:27:30.110–.129 generateHash get_checkout_details, get_sdk_configuration, get_all_offer_details
15:27:30.297 generateHash quickPayEvent
15:27:30.383 POST /payments/payu/hash → 400 "Hash quickPayEvent cannot be signed"
```
The Android SDK (unlike iOS) asks for `quickPayEvent` and waits for it, so the checkout never gets past "Processing…"
and the app shows "Payment could not start". There is no app-side switch for quick pay in the bridge
(`enableSavedCard` is only saved cards). **For the backend:** sign `quickPayEvent` (and `send_sign_in_otp`, seen on
iOS in T6c), ideally every CheckoutPro hash name, the same way as the others.

### Android · UPI (Google Pay) payment, returned to the app — 2026-11-10 09:56 IST, OnePlus CPH2643 — ✅
Booking `sbkg_6mul92NFipV6` (Dreamscape, ₹1.02), attempt `ST261110E91YKLZG`. logcat:
```
09:56:52.975 POST /pay → pending_payment
09:56:53.886 hash quickPayEvent → 200 (backend fix in; no "hash failed" lines in the whole run)
09:57:33.272 PayU onPaymentSuccess (paid in Google Pay, came back)
09:57:33.971 POST /payment-result → next=confirmed status=confirmed pay=success
```
Android is unblocked; UPI intent works (P4).

### T5 · UPI (Google Pay) paid, Fracspace killed before returning — 2026-11-10 10:00 IST, Android — ✅
Booking `sbkg_MlwziBQjmuY-`, attempt `ST261110U551Q6W1`:
```
10:00:38.949 POST /pay → pending_payment → paid in Google Pay, Fracspace swiped away (no SDK event reached the app)
10:01:17.205 Fracspace reopened (new process)
10:01:23.474 clean-up → GET booking: status=confirmed pay=success → banner "Booking confirmed"
```
The server confirmed the UPI payment on its own (PayU callback) and the app showed it on reopen (P6 / R1).
