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
| R2 | Reserve again while one is pending | R1, then Reserve the same stay | ❌ a second hold and possibly a second payment | Pending booking shown instead (A6) | App | ☐ | ☐ |
| R3 | Push `booking.confirmed` tapped | Pay, wait for the push | ❔ | Opens My bookings → that booking (A5) | App | ☐ | ☐ |
| R4 | Push `payment.failed` / `hold.expiring` tapped | Trigger each | ❌ not handled | Opens Review Booking (A5) | App | ☐ | ☐ |
| R5 | My bookings after each case | Check tabs after H1–P19 | ❔ held / expired bookings not listed | Each booking in the right tab and status | Both | ☐ | ☐ |

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
- A6 Reserve shows an open pending payment for the same stay instead of holding again.
