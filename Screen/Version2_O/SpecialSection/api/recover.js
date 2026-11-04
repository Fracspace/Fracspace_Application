// Settles what openBookings.js remembered, on launch and on every return to
// the foreground: a hold no screen owns is released, and a payment the app
// never reported is reported now (the server asks PayU).
import {getBooking, paymentResult, paymentStatus, releaseBooking} from './stays';
import {forget, isOwned, readOpen, remember, settled} from './openBookings';

// The booking is gone or finished on the server: nothing left to clean up.
const GONE = new Set(['confirmed', 'checked_in', 'completed', 'cancelled', 'refund_initiated', 'refunded', 'no_show', 'expired']);

/** One booking: release it, ask about its payment, or drop it. → news for the guest, or null. */
async function settleOne(id, e) {
  let b;
  try {
    const r = await getBooking(id);
    b = r?.booking || r;
  } catch (err) {
    if ([403, 404, 410].includes(err.status)) {
      forget(id);
    }
    return null; // offline / signed out: try again next time
  }
  const name = e.name || b?.property?.name || 'your stay';
  if (!b || GONE.has(b.status)) {
    forget(id);
    return e.phase === 'paying' && b?.status === 'confirmed' ? {kind: 'confirmed', id, name} : null;
  }
  if (b.status === 'pending_payment' && e.phase === 'paying' && e.attemptId) {
    // The app closed before reporting: the server asks PayU now.
    const r = await paymentResult(id, e.attemptId, {event: 'appReopened'}).catch(() => null);
    const next = r?.next;
    if (next === 'confirmed') {
      forget(id);
      return {kind: 'confirmed', id, name};
    }
    if (next === 'pending' || !next) {
      if (e.told) {
        return null;
      }
      remember(id, {told: true}); // say "still confirming" once, then wait quietly
      return {kind: 'pending', id, name};
    }
    if (next === 'failed') {
      await releaseBooking(id).catch(() => {});
      return {kind: 'failed', id, name};
    }
    forget(id); // expired / cancelled
    return null;
  }
  if (b.status === 'pending_payment' && e.phase !== 'held') {
    // Paying from another device, or an attempt we never saw: leave it to the server.
    // (`held` = this phone saw its checkout end unpaid, though the server may
    // still say pending: released below like any other unused hold.)
    const r = await paymentStatus(id).catch(() => null);
    if (r?.booking && GONE.has(r.booking.status)) {
      forget(id);
    }
    return null;
  }
  // Still held (or back to held after a failed payment) and no screen has it.
  await releaseBooking(id).catch(() => {});
  return null;
}

let running = null;
/**
 * Cleans up every booking no screen owns. Run on launch and when the app
 * comes back to the foreground. Resolves to news to show:
 * [{kind: 'confirmed' | 'pending' | 'failed', id, name}].
 */
export function recoverOpenBookings() {
  if (!running) {
    running = (async () => {
      await settled();
      const all = await readOpen();
      const news = [];
      for (const [id, e] of Object.entries(all)) {
        if (!isOwned(id)) {
          if (__DEV__) {
            console.log('[recover]', id, `phase=${e.phase}`, e.attemptId || '');
          }
          const n = await settleOne(id, e).catch(() => null);
          if (__DEV__ && n) {
            console.log('[recover]', id, `banner=${n.kind}`);
          }
          n && news.push(n);
        }
      }
      return news;
    })().finally(() => {
      running = null;
    });
  }
  return running;
}

/**
 * Before a new Reserve: this property's booking whose payment is still being
 * confirmed (checked with the server first), as {id, name, holdExpiresAt}, else null.
 */
export async function pendingFor(propertyId) {
  await recoverOpenBookings().catch(() => {});
  const all = await readOpen();
  const hit = Object.entries(all).find(([id, e]) => e.phase === 'paying' && e.propertyId === propertyId && !isOwned(id));
  if (!hit) {
    return null;
  }
  const r = await getBooking(hit[0]).catch(() => null);
  const b = r?.booking || r;
  if (b?.status !== 'pending_payment') {
    return null;
  }
  return {id: hit[0], name: hit[1].name, holdExpiresAt: b.holdExpiresAt ? Date.parse(b.holdExpiresAt) : null};
}
