import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The on-device copy of the user's ticketed concert bookings, so the tickets
 * screen, the home "Your ticket" bar and the QR still open with no signal at
 * the venue.
 *
 * Only bookings that carry a `ticket` are kept: those are the ones a guest has
 * to show at the gate. Every successful load overwrites the copy for the rows
 * it saw, so a QR that ops replaced (new `code`, higher `version`) or a ticket
 * that was cancelled is never shown from a stale copy once the app has been
 * online. Shows that ended more than 30 days ago are dropped.
 *
 * Cleared on logout (useAccountActions, NavigationStack) so a shared phone
 * never shows the last user's tickets.
 */
export const CONCERT_TICKETS_KEY = 'concert_tickets_v1';

const KEEP_AFTER_SHOW_MS = 30 * 24 * 60 * 60 * 1000;

function notTooOld(b, now) {
  const t = b && b.eventDate ? Date.parse(b.eventDate) : NaN;
  return isNaN(t) || t + KEEP_AFTER_SHOW_MS >= now;
}

async function readRaw() {
  try {
    const raw = await AsyncStorage.getItem(CONCERT_TICKETS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(b => b && b.bookingId) : [];
  } catch (_) {
    return [];
  }
}

/** Saved bookings (already normalised). */
export async function loadSavedTickets() {
  const now = Date.now();
  return (await readRaw()).filter(b => notTooOld(b, now));
}

/** One saved booking, for the detail screen when offline. */
export async function loadSavedTicket(bookingIdOrRef) {
  if (!bookingIdOrRef) return null;
  const list = await readRaw();
  return (
    list.find(b => b.bookingId === bookingIdOrRef || b.referenceCode === bookingIdOrRef) || null
  );
}

/**
 * Merge freshly loaded bookings into the copy. A fresh row always wins; a row
 * that no longer has a ticket drops out.
 *
 * complete: true means `bookings` is the user's whole list (one page, all
 * statuses), so anything saved that is not in it is gone and is dropped too.
 * Otherwise rows the load did not include (later pages) are kept.
 */
export async function saveTickets(bookings, { complete = false } = {}) {
  if (!Array.isArray(bookings)) return;
  if (!bookings.length && !complete) return;
  try {
    const now = Date.now();
    const fresh = bookings.filter(b => b && b.bookingId);
    const freshIds = {};
    fresh.forEach(b => {
      freshIds[b.bookingId] = true;
    });
    const kept = complete ? [] : (await readRaw()).filter(b => !freshIds[b.bookingId]);
    const next = fresh
      .filter(b => b.ticket)
      .concat(kept)
      .filter(b => notTooOld(b, now));
    await AsyncStorage.setItem(CONCERT_TICKETS_KEY, JSON.stringify(next));
  } catch (_) {
    // A full or failing disk only costs the offline copy.
  }
}

/** Save a single booking read from GET /bookings/:id. */
export function saveTicket(booking) {
  return saveTickets(booking ? [booking] : []);
}
