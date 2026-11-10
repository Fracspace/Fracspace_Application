import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The on-device copy of the user's ticketed concert bookings, so the tickets
 * screen and the QR still open with no signal at the venue.
 *
 * Only bookings that carry a `ticket` are kept: those are the ones a guest has
 * to show at the gate. Every successful load overwrites the copy for the rows
 * it saw, so a QR that ops replaced (new `code`, higher `version`) is never
 * shown from the stale copy once the app has been online.
 *
 * Cleared on logout (NavigationStack) so a shared phone never shows the last
 * user's tickets.
 */
export const CONCERT_TICKETS_KEY = 'concert_tickets_v1';

async function readRaw() {
  try {
    const raw = await AsyncStorage.getItem(CONCERT_TICKETS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

/** Saved bookings (already normalised), newest first. */
export async function loadSavedTickets() {
  const list = await readRaw();
  return list
    .map(b => (b && b.bookingId ? b : null))
    .filter(Boolean);
}

/** One saved booking, for the detail screen when offline. */
export async function loadSavedTicket(bookingIdOrRef) {
  if (!bookingIdOrRef) return null;
  const list = await readRaw();
  return (
    list.find(b => b && (b.bookingId === bookingIdOrRef || b.referenceCode === bookingIdOrRef)) ||
    null
  );
}

/**
 * Merge freshly loaded bookings into the copy. A fresh row always wins; a row
 * that lost its ticket, or no longer has one, drops out. Rows the load did not
 * include (later pages) are kept.
 */
export async function saveTickets(bookings) {
  if (!Array.isArray(bookings) || !bookings.length) return;
  try {
    const fresh = bookings.filter(b => b && b.bookingId);
    const freshIds = {};
    fresh.forEach(b => {
      freshIds[b.bookingId] = true;
    });
    const kept = (await readRaw()).filter(b => b && !freshIds[b.bookingId]);
    const next = fresh.filter(b => b.ticket).concat(kept);
    await AsyncStorage.setItem(CONCERT_TICKETS_KEY, JSON.stringify(next));
  } catch (_) {
    // A full or failing disk only costs the offline copy.
  }
}

/** Save a single booking read from GET /bookings/:id. */
export function saveTicket(booking) {
  return saveTickets(booking ? [booking] : []);
}

