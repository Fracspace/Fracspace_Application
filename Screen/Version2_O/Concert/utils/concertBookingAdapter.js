/**
 * Normalizes the concert BOOKING endpoints (options / checkout / book /
 * verify / pay / list / cancel) into flat, safe shapes for the screens.
 *
 * Why this is a separate file from concertAdapter.js:
 * in /concerts/section, `tickets` is a config object ({min,max,default}); in
 * every booking response `tickets` is a plain integer count and the basket
 * lives in `items`. Same key, different type - keeping them apart stops one
 * being fed to code expecting the other.
 *
 * Money here is in WHOLE RUPEES, not paise, and every amount is computed by
 * the server. The client never does payment arithmetic: it displays what it
 * is given and sends back quantities only. `unitPrice`, `amount` and
 * `totalAmount` sent by the client are ignored by the API.
 */

/** First value that is actually present (null / undefined / '' all skip). */
const pick = (...vals) =>
  vals.find(v => v !== undefined && v !== null && v !== '');

/** An object with at least one key, else null. */
const filled = o =>
  o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length
    ? o
    : null;

/**
 * A real number, else null.
 *
 * A numeric string counts: this API already serialises at least one amount as
 * a string ("7000.00", see buildPayuForm), and a refund that arrives that way
 * must not read as nothing. '' / null / true / [] / '12abc' still give null,
 * so a missing value is never invented as 0.
 */
const num = v => {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }
  return null;
};

/** The same, but a missing amount is a meaningful zero. */
const amount = v => {
  const n = num(v);
  return n === null ? 0 : n;
};

const arr = v => (Array.isArray(v) ? v : []);

/** Unwraps { success, message, data } - also tolerates a bare data object. */
const unwrap = payload => (payload && payload.data ? payload.data : payload) || {};

export const BOOKING_STATUS = {
  PENDING: 'pending_payment',
  CONFIRMED: 'confirmed',
  FAILED: 'payment_failed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  REFUND_INITIATED: 'refund_initiated',
  REFUNDED: 'refunded',
};

/** Statuses from which nothing more can be attempted. */
const TERMINAL = [
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.FAILED,
  BOOKING_STATUS.EXPIRED,
  BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.REFUND_INITIATED,
  BOOKING_STATUS.REFUNDED,
];

/* ------------------------------------------------------------------ *
 *  Shared pieces                                                     *
 * ------------------------------------------------------------------ */

function normalizeItems(apiItems) {
  return arr(apiItems)
    .filter(i => i && i.ticketTypeId)
    .map(i => ({
      ticketTypeId: i.ticketTypeId,
      label: pick(i.label, i.ticketTypeId),
      unitPrice: amount(i.unitPrice),
      quantity: amount(i.quantity),
      amount: amount(i.amount),
    }));
}

function normalizeTicketTypes(apiTypes) {
  return arr(apiTypes)
    .filter(t => t && t.id)
    .map(t => {
      const available = t.available !== false;
      const soldOut = !!t.soldOut;
      // absent `remaining` means stock is not tracked, NOT zero
      const remaining = num(t.remaining);
      return {
        id: t.id,
        label: pick(t.label, t.id),
        description: pick(t.description, null),
        badge: pick(t.badge, null),
        // dashboard perks arrive with stray trailing commas ("Priority entry,")
        perks: (Array.isArray(t.perks) ? t.perks : [])
          .map(x => String(x || '').replace(/[,\s]+$/, '').trim())
          .filter(Boolean),
        price: amount(t.price),
        // struck-through "was" price; only meaningful when above the real one
        compareAtPrice:
          num(t.compareAtPrice) !== null && num(t.compareAtPrice) > amount(t.price)
            ? num(t.compareAtPrice)
            : null,
        discountPercent:
          num(t.compareAtPrice) !== null && num(t.compareAtPrice) > amount(t.price)
            ? Math.round((1 - amount(t.price) / num(t.compareAtPrice)) * 100)
            : null,
        available,
        soldOut,
        remaining,
        maxPerBooking: num(t.maxPerBooking),
        minPerBooking: num(t.minPerBooking),
        purchasable:
          available && !soldOut && (remaining === null || remaining > 0),
      };
    });
}

function normalizeCities(apiCities) {
  return arr(apiCities)
    .filter(c => c && c.id)
    .map(c => ({
      id: c.id,
      city: pick(c.city, c.venue, ''),
      venue: pick(c.venue, c.city, ''),
      venueAddress: pick(c.venueAddress, null),
      // fails closed: no explicit `true` means not on sale
      bookable: c.bookable === true,
      currency: pick(c.currency, 'INR'),
      fromPrice: num(c.fromPrice),
      eventDate: pick(c.startsAt, c.eventDate, null),
      timezone: pick(c.timezone, 'Asia/Kolkata'),
      // the server's own pre-formatted strings, preferred over anything the
      // client derives because the dashboard controls them
      dateLabel: pick(c.display && c.display.dateLabel, null),
      badge: pick(c.status && c.status.label, null),
      soldOut: !!c.soldOut,
      ticketTypes: normalizeTicketTypes(c.ticketTypes),
    }));
}

/**
 * The wallet block. `available` is the server's verdict on whether wallet can
 * be used for THIS user on THIS concert - it is false for a logged-out user,
 * for a zero balance, and when the concert has wallet payment switched off.
 * Never infer usability from `balance` alone.
 */
function normalizeWallet(apiWallet) {
  const w = filled(apiWallet) || {};
  return {
    enabled: w.enabled !== false,
    available: w.available === true,
    balance: amount(w.balance),
    label: pick(w.label, 'Pay using Fracspace wallet'),
    note: pick(w.note, null),
    unavailableNote: pick(w.unavailableNote, null),
    requiresLogin: w.requiresLogin === true,
    // null means "no cap", which is different from 0
    maxPercentOfTotal: num(w.maxPercentOfTotal),
    maxAmountPerBooking: num(w.maxAmountPerBooking),
    // set on a quote/booking, not on options
    applied: amount(w.applied),
    debited: w.debited === true,
  };
}

function normalizeRefundPolicy(apiPolicy) {
  const p = filled(apiPolicy) || {};
  return {
    enabled: p.enabled !== false,
    showInApp: p.showInApp !== false,
    cancellationAllowed: p.cancellationAllowed === true,
    processingFee: amount(p.processingFee),
    processingFeePercent: amount(p.processingFeePercent),
    nonRefundableAfterEvent: p.nonRefundableAfterEvent !== false,
    refundPayuToWallet: p.refundPayuToWallet === true,
    policyText: arr(p.policyText),
    rules: arr(p.rules).map(r => ({
      id: pick(r.id, null),
      label: pick(r.label, ''),
      minHoursBeforeEvent: num(r.minHoursBeforeEvent),
      refundPercent: amount(r.refundPercent),
      deadline: pick(r.deadline, null),
      note: pick(r.note, null),
    })),
  };
}

function normalizeCancellation(apiCancellation) {
  const c = filled(apiCancellation);
  if (!c) return null;
  return {
    allowed: c.allowed === true,
    policyId: pick(c.policyId, null),
    policyLabel: pick(c.policyLabel, ''),
    refundPercent: amount(c.refundPercent),
    refundableAmount: amount(c.refundableAmount),
    processingFee: amount(c.processingFee),
    walletRefundAmount: amount(c.walletRefundAmount),
    payuRefundAmount: amount(c.payuRefundAmount),
    note: pick(c.note, null),
  };
}

/**
 * Where the money actually went, per channel.
 *
 * Preferred over deriving rows from walletRefundAmount / payuRefundAmount,
 * because each destination carries its own status: a wallet credit can be
 * done while a bank refund is still in flight, and one line saying "refunded"
 * over both would be a lie.
 */
function normalizeRefundDestinations(apiRefundedTo) {
  const o = filled(apiRefundedTo);
  if (!o) return null;
  const destinations = arr(o.destinations)
    .filter(d => d && (d.label || d.channel))
    .map(d => ({
      channel: pick(d.channel, null),
      label: pick(d.label, d.channel),
      amount: amount(d.amount),
      status: pick(d.status, null),
      settled: d.status === 'refunded' || d.status === 'credited',
    }));
  return destinations.length
    ? { summary: pick(o.summary, ''), destinations }
    : null;
}

function normalizeRefund(apiRefund) {
  const r = filled(apiRefund);
  if (!r) return null;
  return {
    reason: pick(r.reason, null),
    policyLabel: pick(r.policyLabel, ''),
    refundPercent: amount(r.refundPercent),
    refundableAmount: amount(r.refundableAmount),
    processingFee: amount(r.processingFee),
    walletRefundAmount: amount(r.walletRefundAmount),
    payuRefundAmount: amount(r.payuRefundAmount),
    payuRefundStatus: pick(r.payuRefundStatus, null),
    payuRefundEta: pick(r.payuRefundEta, null),
    walletCreditedImmediately: r.walletCreditedImmediately === true,
    refundedAt: pick(r.refundedAt, null),
    refundedTo: normalizeRefundDestinations(r.refundedTo),
  };
}

/* ------------------------------------------------------------------ *
 *  Step 2 - booking options                                          *
 * ------------------------------------------------------------------ */

export function normalizeBookingOptions(payload) {
  const d = unwrap(payload);
  const b = filled(d.booking) || {};
  const cities = normalizeCities(d.cities);
  const defaultCityId = pick(d.defaultCityId, null);
  // the same guard as the section adapter: a stale default must not leave the
  // screen holding a city that is not in the list
  const usable = cities.some(c => c.id === defaultCityId && c.bookable);
  const selectedCityId = usable
    ? defaultCityId
    : (cities.find(c => c.bookable) || cities[0] || {}).id || null;

  return {
    concertId: pick(d.concertId, null),
    concertTitle: pick(d.concertTitle, ''),
    artist: pick(d.artist, ''),
    booking: {
      enabled: b.enabled === true,
      title: pick(b.title, 'Book your tickets'),
      subtitle: pick(b.subtitle, null),
      checkoutLabel: pick(b.checkoutLabel, 'Proceed to pay'),
      ticketSectionTitle: pick(b.ticketSectionTitle, 'SELECT TICKETS'),
      currency: pick(b.currency, 'INR'),
      requireLogin: b.requireLogin === true,
      minTicketsPerBooking: num(b.minTicketsPerBooking),
      maxTicketsPerBooking: num(b.maxTicketsPerBooking),
      // null means uncapped, which is NOT the same as 0
      maxTicketsPerUser: num(b.maxTicketsPerUser),
      ticketsAlreadyHeld: amount(b.ticketsAlreadyHeld),
      ticketsRemainingForUser: num(b.ticketsRemainingForUser),
      terms: arr(b.terms),
      successSheet: filled(b.successSheet) || {},
    },
    wallet: normalizeWallet(d.wallet),
    refundPolicy: normalizeRefundPolicy(d.refundPolicy),
    defaultCityId,
    selectedCityId,
    cities,
  };
}

/* ------------------------------------------------------------------ *
 *  Step 3 - checkout quote                                           *
 * ------------------------------------------------------------------ */

export function normalizeCheckoutQuote(payload) {
  const d = unwrap(payload);
  return {
    concertId: pick(d.concertId, null),
    cityId: pick(d.cityId, null),
    city: pick(d.city, ''),
    venue: pick(d.venue, ''),
    eventDate: pick(d.eventDate, null),
    items: normalizeItems(d.items),
    tickets: amount(d.tickets),
    currency: pick(d.currency, 'INR'),
    subtotal: amount(d.subtotal),
    discount: amount(d.discount),
    fees: amount(d.fees),
    totalAmount: amount(d.totalAmount),
    wallet: normalizeWallet(d.wallet),
    payuAmount: amount(d.payuAmount),
    requiresPayU: d.requiresPayU === true,
    // 'payu' | 'wallet' | 'wallet+payu'
    paymentMethod: pick(d.paymentMethod, 'payu'),
    ticketsAlreadyHeld: amount(d.ticketsAlreadyHeld),
    refundPolicy: normalizeRefundPolicy(d.refundPolicy),
    terms: arr(d.terms),
    notice: pick(d.notice, null),
  };
}

/* ------------------------------------------------------------------ *
 *  Payment summary rows                                              *
 * ------------------------------------------------------------------ */

/**
 * Turns a quote into the rows the review screen prints, in order.
 *
 * Every number is the server's. The only arithmetic here is `remaining`,
 * which is a restatement of two figures already shown (subtotal minus the
 * wallet amount), never an input to anything paid.
 *
 * The conditional rows are what make one component cover all three payment
 * shapes: a wallet row only when wallet was applied, a remaining row only on
 * a genuine split, and a fee row only when the server charged one.
 */
export function buildPaymentSummary(quote, { walletLabel } = {}) {
  if (!quote) return [];
  const subtotal = amount(quote.subtotal);
  const applied = amount(quote.wallet && quote.wallet.applied);
  const payu = amount(quote.payuAmount);
  const fees = amount(quote.fees);
  const discount = amount(quote.discount);

  const rows = [{ key: 'subtotal', label: 'Subtotal', value: subtotal }];

  if (applied > 0) {
    rows.push({
      key: 'wallet',
      label: walletLabel || 'Pay using Fracspace wallet',
      value: applied,
      negative: true,
      icon: 'wallet-outline',
    });
  }
  // only on a split: with wallet-only or gateway-only it would just repeat a
  // figure that is already on screen
  if (applied > 0 && payu > 0) {
    rows.push({
      key: 'remaining',
      label: 'Remaining Amount',
      value: subtotal - applied,
    });
  }
  if (discount > 0) {
    rows.push({
      key: 'discount',
      label: 'Discount',
      value: discount,
      negative: true,
      accent: true,
    });
  }
  if (fees > 0) {
    rows.push({
      key: 'fees',
      label: 'GST & Convenience Fee',
      value: fees,
    });
  }
  rows.push({ key: 'total', label: 'To Pay', value: payu, strong: true });
  return rows;
}

/* ------------------------------------------------------------------ *
 *  Entry ticket (QR)                                                 *
 * ------------------------------------------------------------------ */

export const TICKET_STATE = {
  VALID: 'valid',
  PARTIALLY_USED: 'partially_used',
  USED: 'used',
  VOID: 'void',
};

/**
 * `booking.ticket` - null until the booking confirms. `code` is the exact QR
 * content: opaque, never parsed or built here. It is null on a void ticket,
 * and a ticket without a code never shows a QR whatever its state says.
 */
export function normalizeTicket(apiTicket) {
  const t = filled(apiTicket);
  if (!t) return null;
  const code = typeof t.code === 'string' && t.code ? t.code : null;
  const known = Object.values(TICKET_STATE);
  let state = known.indexOf(t.state) !== -1 ? t.state : TICKET_STATE.VALID;
  if (!code) state = TICKET_STATE.VOID;
  const tickets = amount(t.tickets);
  const admitted = amount(t.admitted);
  const remaining = num(t.remaining) !== null ? amount(t.remaining) : Math.max(tickets - admitted, 0);
  return {
    code,
    state,
    tickets,
    admitted,
    remaining,
    types: arr(t.types)
      .filter(x => x && (x.label || x.ticketTypeId))
      .map(x => ({
        ticketTypeId: pick(x.ticketTypeId, null),
        label: pick(x.label, x.ticketTypeId),
        quantity: amount(x.quantity),
        admitted: amount(x.admitted),
        remaining: amount(x.remaining),
      })),
    version: amount(t.version),
    qrImageUrl: pick(t.qrImageUrl, null),
    issuedAt: pick(t.issuedAt, null),
    firstAdmittedAt: pick(t.firstAdmittedAt, null),
    lastAdmittedAt: pick(t.lastAdmittedAt, null),
  };
}

/** True when the QR is worth showing to the gate (there is one, and seats are left). */
export function canShowQr(ticket) {
  return (
    !!ticket &&
    !!ticket.code &&
    (ticket.state === TICKET_STATE.VALID || ticket.state === TICKET_STATE.PARTIALLY_USED)
  );
}

// A show stays on the home screen until 12 hours after it starts.
const SHOW_GRACE_MS = 12 * 60 * 60 * 1000;

/** Usable tickets for shows that have not finished, soonest show first. */
export function pickActiveTickets(bookings, now = Date.now()) {
  return (bookings || [])
    .filter(b => b && canShowQr(b.ticket))
    .filter(b => {
      const t = b.eventDate ? Date.parse(b.eventDate) : NaN;
      return isNaN(t) || t + SHOW_GRACE_MS >= now;
    })
    .sort((a, b) => String(a.eventDate || '').localeCompare(String(b.eventDate || '')));
}

// How long after the start a show counts as "on" for someone who is inside.
// The API sends no end time, so this is a generous concert length.
export const SHOW_LIVE_MS = 5 * 60 * 60 * 1000;

/**
 * Bookings whose holder is inside the venue right now: at least one person
 * has been checked in at the gate and the show has not ended. Soonest first.
 * Before the start time this still counts - gates open early - as long as
 * someone has actually entered.
 */
export function pickLiveTickets(bookings, now = Date.now()) {
  return (bookings || [])
    .filter(b => {
      const t = b && b.ticket;
      if (!t || !t.code || !(t.admitted > 0)) return false;
      if (t.state !== TICKET_STATE.USED && t.state !== TICKET_STATE.PARTIALLY_USED) return false;
      const start = b.eventDate ? Date.parse(b.eventDate) : NaN;
      if (isNaN(start)) return false;
      return now < start + SHOW_LIVE_MS;
    })
    .sort((a, b) => String(a.eventDate || '').localeCompare(String(b.eventDate || '')));
}

/* ------------------------------------------------------------------ *
 *  The booking record (book / verify / pay / list / get all use this)*
 * ------------------------------------------------------------------ */

export function normalizeBookingRecord(apiBooking) {
  const b = filled(apiBooking);
  if (!b) return null;

  const p = filled(b.payment) || {};
  const status = pick(b.status, null);
  const payuAmount = amount(p.payuAmount);
  const cancellation = normalizeCancellation(b.cancellation);
  const ticket = normalizeTicket(b.ticket);
  // The server answers 409 once anyone has entered; never offer it then.
  const anyoneEntered = !!ticket && ticket.admitted > 0;

  return {
    bookingId: pick(b.bookingId, null),
    referenceCode: pick(b.referenceCode, null),
    status,
    concertId: pick(b.concertId, null),
    concertTitle: pick(b.concertTitle, ''),
    artist: pick(b.artist, ''),
    concertImage: pick(b.concertImage, null),

    name: pick(b.name, ''),
    email: pick(b.email, ''),
    countryCode: pick(b.countryCode, ''),
    phoneNumber: pick(b.phoneNumber, ''),

    cityId: pick(b.cityId, null),
    city: pick(b.city, ''),
    venue: pick(b.venue, ''),
    venueAddress: pick(b.venueAddress, null),
    locationUrl: pick(b.locationUrl, null),
    directionUrl: pick(b.directionUrl, null),
    venueCoordinates:
      filled(b.venueCoordinates) &&
      num(b.venueCoordinates.lat) !== null &&
      num(b.venueCoordinates.lng) !== null
        ? { lat: b.venueCoordinates.lat, lng: b.venueCoordinates.lng }
        : null,
    // only real strings survive; a null in the array would render as a broken
    // image tile in the carousel
    venueImages: arr(b.venueImages).filter(u => typeof u === 'string' && u),
    eventDate: pick(b.eventDate, null),
    timezone: pick(b.timezone, 'Asia/Kolkata'),

    items: normalizeItems(b.items),
    // NOTE: an integer count here, unlike `tickets` in /concerts/section
    tickets: amount(b.tickets),
    currency: pick(b.currency, 'INR'),
    subtotal: amount(b.subtotal),
    totalAmount: amount(b.totalAmount),

    payment: {
      method: pick(p.method, null),
      walletAmount: amount(p.walletAmount),
      // false until the booking confirms - the wallet is NOT held meanwhile
      walletApplied: p.walletApplied === true,
      payuAmount,
      payuStatus: pick(p.payuStatus, null),
      payuTxnId: pick(p.payuTxnId, null),
      payuMode: pick(p.payuMode, null),
      paidAt: pick(p.paidAt, null),
    },

    cancellation,
    refund: normalizeRefund(b.refund),
    ticket,

    expiresAt: pick(b.expiresAt, null),
    createdAt: pick(b.createdAt, null),
    confirmedAt: pick(b.confirmedAt, null),

    // ---- derived ----
    isPending: status === BOOKING_STATUS.PENDING,
    isConfirmed: status === BOOKING_STATUS.CONFIRMED,
    isTerminal: TERMINAL.indexOf(status) !== -1,
    /** Can be handed back to /bookings/:id/pay. */
    canResumePayment: status === BOOKING_STATUS.PENDING && payuAmount > 0,
    /** Cancel is offered only when the server says so AND on a confirmed row. */
    canCancel:
      status === BOOKING_STATUS.CONFIRMED && !!cancellation && cancellation.allowed && !anyoneEntered,
  };
}

/* ------------------------------------------------------------------ *
 *  Venue links                                                       *
 * ------------------------------------------------------------------ */

/**
 * Where "Open in maps" and "Get directions" point.
 *
 * The server's own link wins when it sends one. Coordinates are the fallback
 * because a venue can have them before anyone has pasted a share link, and a
 * dead button is worse than a generic pin.
 */
export function venueMapUrl(booking) {
  if (!booking) return null;
  if (booking.locationUrl) return booking.locationUrl;
  const c = booking.venueCoordinates;
  if (c) {
    return (
      'https://www.google.com/maps/search/?api=1&query=' + c.lat + ',' + c.lng
    );
  }
  const q = [booking.venue, booking.venueAddress, booking.city]
    .filter(Boolean)
    .join(', ');
  return q
    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q)
    : null;
}

export function venueDirectionsUrl(booking) {
  if (!booking) return null;
  if (booking.directionUrl) return booking.directionUrl;
  const c = booking.venueCoordinates;
  if (c) {
    return (
      'https://www.google.com/maps/dir/?api=1&destination=' +
      c.lat + ',' + c.lng + '&travelmode=driving'
    );
  }
  const q = [booking.venue, booking.venueAddress, booking.city]
    .filter(Boolean)
    .join(', ');
  return q
    ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q)
    : null;
}

/* ------------------------------------------------------------------ *
 *  PayU form                                                         *
 * ------------------------------------------------------------------ */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s).replace(/[&<>"']/g, ch => ESCAPES[ch]);

/**
 * Builds the self-submitting form PayU needs.
 *
 * Unlike the escape-membership flow, this API returns { action, method, data }
 * rather than prebuilt HTML, so the page is assembled here.
 *
 * Two rules: echo EVERY key in `data` (PayU adds udf1..udf5 and others, and
 * the hash covers them, so picking known keys would break it), and never
 * reformat a value - `amount` arrives as the string "7000.00" and must not be
 * turned back into a number.
 */
export function buildPayuForm(payu) {
  const p = filled(payu);
  const data = filled(p && p.data);
  const action = p && typeof p.action === 'string' ? p.action : '';
  if (!data || !action) return null;

  const inputs = Object.keys(data)
    .filter(k => data[k] !== undefined && data[k] !== null)
    .map(
      k =>
        '<input type="hidden" name="' +
        esc(k) +
        '" value="' +
        esc(String(data[k])) +
        '" />',
    )
    .join('');

  const method = String(p.method || 'POST').toUpperCase() === 'GET' ? 'get' : 'post';

  return (
    '<!DOCTYPE html><html><head>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />' +
    '<style>html,body{margin:0;height:100%;background:#0A0806;color:#B9AFA6;' +
    'font-family:-apple-system,BlinkMacSystemFont,Roboto,sans-serif;' +
    'display:flex;align-items:center;justify-content:center}' +
    'p{font-size:15px;letter-spacing:0.2px}</style></head>' +
    '<body><p>Taking you to secure payment...</p>' +
    '<form id="payuForm" method="' + method + '" action="' + esc(action) + '">' +
    inputs +
    '</form>' +
    '<script>document.getElementById("payuForm").submit();</script>' +
    '</body></html>'
  );
}

/* ------------------------------------------------------------------ *
 *  Step 4 / 7 - book and resume-payment responses                    *
 * ------------------------------------------------------------------ */

export function normalizeBookResponse(payload) {
  const d = unwrap(payload);
  const booking = normalizeBookingRecord(d.booking);
  const payu = filled(d.payu);
  const payuHtml = buildPayuForm(payu);
  const requiresPayU = d.requiresPayU === true;

  return {
    booking,
    requiresPayU,
    payu,
    payuHtml,
    /**
     * The only safe gate for opening the WebView. `requiresPayU` true with no
     * usable form is a server-side problem, and opening an empty WebView would
     * strand the user on a blank screen instead of surfacing it.
     */
    canOpenPayU: requiresPayU && !!payuHtml,
    /** Gateway origin, needed as the WebView baseUrl (see ConcertPaymentPage). */
    payuAction: (payu && typeof payu.action === 'string' && payu.action) || null,
    /** Wallet covered the whole thing; there is nothing to pay online. */
    settledImmediately: !requiresPayU && !!booking && booking.isConfirmed,
    txnId: (payu && payu.data && pick(payu.data.txnid, null)) || null,
    notice: pick(d.notice, null),
  };
}

/* ------------------------------------------------------------------ *
 *  Step 8 - list                                                     *
 * ------------------------------------------------------------------ */

export function normalizeBookingList(payload) {
  const d = unwrap(payload);
  const pg = filled(d.pagination) || {};
  return {
    bookings: arr(d.bookings).map(normalizeBookingRecord).filter(Boolean),
    pagination: {
      page: amount(pg.page) || 1,
      limit: amount(pg.limit) || 20,
      total: amount(pg.total),
      pages: amount(pg.pages) || 1,
    },
  };
}

/* ------------------------------------------------------------------ *
 *  Step 10 - cancel                                                  *
 * ------------------------------------------------------------------ */

/**
 * The cancel response carries the refund twice: once nested on the booking and
 * once at the top level. They agree, but the top-level copy is the one with
 * walletCreditedImmediately and payuRefundEta, so it wins.
 */
export function normalizeCancelResponse(payload) {
  const d = unwrap(payload);
  const booking = normalizeBookingRecord(d.booking);
  const bookingRefund = filled(d.booking) ? filled(d.booking.refund) : null;
  return {
    booking,
    // The two refund blocks in the response are not identical: the top-level one
    // carries the delivery fields (eta, walletCreditedImmediately) while the one
    // inside the booking carries the record fields (reason, refundedAt). Reading
    // only one of them loses half the card, so they are merged key by key before
    // normalising - a key present on the top-level block wins.
    refund: normalizeRefund(mergeRefundBlocks(d.refund, bookingRefund)) || null,
  };
}

/** Top-level refund block wins per key; the booking's copy fills the gaps. */
function mergeRefundBlocks(primary, fallback) {
  const a = filled(primary);
  const b = filled(fallback);
  if (!a) return b;
  if (!b) return a;
  const out = {};
  Object.keys(b).forEach(k => { out[k] = b[k]; });
  Object.keys(a).forEach(k => {
    if (a[k] !== undefined && a[k] !== null) out[k] = a[k];
  });
  return out;
}

/**
 * How a status should read and how loud it should look.
 *
 * Kept here rather than in a screen because the list and the detail have to
 * agree: the same booking must not be "Confirmed" in one place and "Paid" in
 * the other.
 */
export function bookingStatusMeta(status) {
  switch (status) {
    case BOOKING_STATUS.CONFIRMED:
      return { label: 'Confirmed', tone: 'good' };
    case BOOKING_STATUS.PENDING:
      return { label: 'Payment pending', tone: 'warn' };
    case BOOKING_STATUS.FAILED:
      return { label: 'Payment failed', tone: 'bad' };
    case BOOKING_STATUS.EXPIRED:
      return { label: 'Expired', tone: 'muted' };
    case BOOKING_STATUS.CANCELLED:
      return { label: 'Cancelled', tone: 'muted' };
    case BOOKING_STATUS.REFUND_INITIATED:
      return { label: 'Refund on the way', tone: 'warn' };
    case BOOKING_STATUS.REFUNDED:
      return { label: 'Refunded', tone: 'muted' };
    default:
      return { label: status ? String(status) : 'Unknown', tone: 'muted' };
  }
}

/* ------------------------------------------------------------------ *
 *  Step 6 - verify                                                   *
 * ------------------------------------------------------------------ */

/** Outcomes from which the booking can still be paid for. */
const RESUMABLE = ['pending', 'unknown', 'error', 'not_found'];

/**
 * Reads a verify-payment response.
 *
 * Two traps the server response sets:
 *
 * 1. `shouldRetry` is PRESENT only when the server actually asked PayU
 *    (verified: true). When the booking was already settled the key is absent
 *    and must be read as false - hence `=== true`, never truthiness.
 *
 * 2. `not_found` is what comes back when the user never opened PayU at all -
 *    an abandoned checkout, not a lost payment. The server's message for it
 *    tells the user to contact support, which is alarming and wrong in that
 *    case. Pass payuAttempted:false and a neutral message is used instead.
 */
export function classifyVerifyResponse(res, { payuAttempted = true } = {}) {
  const d = unwrap(res && res.data ? res.data : res);
  const outcome = pick(d.outcome, 'unknown');
  const booking = normalizeBookingRecord(d.booking);
  const message = pick(d.message, (res && res.data && res.data.message), null);

  const paid = d.paid === true;
  const shouldRetry = d.shouldRetry === true;
  const resumable =
    !paid &&
    RESUMABLE.indexOf(outcome) !== -1 &&
    (!booking || booking.status === BOOKING_STATUS.PENDING);

  let displayMessage = message;
  if (outcome === 'not_found' && !payuAttempted) {
    displayMessage = 'Payment was not completed. Your booking is still open.';
  }

  return {
    outcome,
    paid,
    /** Poll again after a short delay. */
    shouldRetry,
    /** Offer a Retry button that calls /bookings/:id/pay. */
    resumable,
    /** Nothing further will change on its own. */
    terminal: !shouldRetry && !resumable,
    /** Needs a human - do not offer retry, show the reference code. */
    needsSupport: outcome === 'amount_mismatch',
    verified: d.verified === true,
    booking,
    message,
    displayMessage,
  };
}

export default {
  BOOKING_STATUS,
  bookingStatusMeta,
  normalizeCancelResponse,
  normalizeBookingOptions,
  normalizeCheckoutQuote,
  normalizeBookingRecord,
  normalizeBookResponse,
  normalizeBookingList,
  classifyVerifyResponse,
  buildPayuForm,
};
