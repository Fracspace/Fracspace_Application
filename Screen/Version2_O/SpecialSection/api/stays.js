// Stays API (docs: stays-api.md) and the adapters that turn its objects into
// the shapes the Stays screens were built on, so the UI code barely changes.
import {request, USE_MOCK} from './client';
import {useQuery} from './useQuery';
import {images} from '../data';
import * as mock from '../Stays/data';
import * as sd from '../StayDetail/data';

const P = '/stays';

export const getHome = () => request('GET', `${P}/home`);
export const getBookings = tab => request('GET', `${P}/bookings`, {params: {tab}});
export const likeProperty = (id, liked) => request('POST', `${P}/properties/${id}/like`, {body: {liked}});
export const reviewBooking = (id, rating, quote) =>
  request('POST', `${P}/bookings/${id}/review`, {body: quote ? {rating, quote} : {rating}});

// ---- formatting
const nf = new Intl.NumberFormat('en-IN', {maximumFractionDigits: 2});
export const inr = n => (n == null || isNaN(n) ? '' : '₹' + nf.format(Number(n)));
const rate1 = r => (r == null ? '' : Number(r).toFixed(1));
const pic = (url, fallback) => (url ? {uri: url} : fallback);
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
/** Last part of "Banjara Hills, Hyderabad" → "Hyderabad". */
const cityOf = loc => (loc || '').split(',').pop().trim();
/** "2026-10-15" → local Date at midnight (dates are the hotel's calendar day). */
export const day = s => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = d => `${DOW[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;
const stamp = iso => {
  const d = new Date(iso);
  if (isNaN(d)) {
    return '';
  }
  const h = d.getHours() % 12 || 12;
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
};
const FALLBACK = [images.balcony, images.hilltop, images.luxury];
const fb = i => FALLBACK[i % FALLBACK.length];

// ---- adapters (API → UI)
export const toRetreat = (r, i) => ({
  id: r.slug || r.id,
  propertyId: r.id,
  name: r.name || '',
  loc: r.location || '',
  rate: rate1(r.rating),
  price: inr(r.fromPrice),
  tag: r.tag || '',
  img: pic(r.image, fb(i)),
  liked: !!r.liked,
});

export const toReel = (v, i) => ({
  id: v.id,
  title: v.title || '',
  secs: v.durationSec > 0 ? v.durationSec : 10,
  dur: mmss(v.durationSec > 0 ? v.durationSec : 10),
  loc: v.location || '',
  stayId: v.propertySlug || v.propertyId,
  stayName: v.propertyName || '',
  img: pic(v.thumbnail, fb(i)),
  video: v.videoUrl || null,
});

export const toOffer = o => ({
  id: o.id,
  theme: o.theme === 'warm' ? 'warm' : 'slate',
  art: o.theme === 'warm' ? 'crown' : 'ticket',
  badge: o.badge || '',
  title: o.title || '',
  desc: o.description || '',
  perk: o.perk || '',
  code: o.code || '',
});

export const toReview = (g, i) => {
  const n = g.photoCount ?? (g.photos || []).length;
  return {
    id: g.id,
    place: g.place || '',
    rate: rate1(g.rating),
    quote: g.quote || '',
    photos: n ? `${plural(n, 'photo')} shared` : '',
    ini: g.initials || (g.name || '?').slice(0, 2).toUpperCase(),
    name: g.name || '',
    date: g.date || '',
    img: pic((g.photos || [])[0], fb(i)),
  };
};

const STATUS = {
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  held: 'Payment pending',
  pending_payment: 'Payment pending',
  payment_failed: 'Payment failed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refund_initiated: 'Refund initiated',
  refunded: 'Refunded',
  no_show: 'No show',
  expired: 'Expired',
};

/** Booking object → the upcoming / past booking cards. */
export function toBooking(b) {
  const p = b.property || {};
  const pay = b.payment || {};
  const cin = day(b.checkIn);
  const cout = day(b.checkOut);
  const guests = (b.adults || 0) + (b.children || 0);
  const method =
    pay.method === 'wallet' ? 'Wallet' : (pay.instrument || pay.gateway || '').replace(/^\w/, c => c.toUpperCase());
  const ref = b.referenceCode || '';
  return {
    id: b.bookingId,
    stayId: p.slug || p.id,
    status: b.status,
    statusLabel: STATUS[b.status] || '',
    ok: b.status === 'confirmed' || b.status === 'checked_in' || b.status === 'completed',
    img: pic(p.image || b.roomType?.image, images.balcony),
    name: p.name || '',
    sub: [b.roomType?.name, p.area || p.city].filter(Boolean).join(' · '),
    pastSub: [`${short(cin)} – ${short(cout)}`, [p.area, p.city].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    checkIn: cin,
    checkInLabel: short(cin),
    checkInTime: p.checkInLabel ? `from ${p.checkInLabel}` : '',
    checkOutLabel: short(cout),
    checkOutTime: p.checkOutLabel ? `by ${p.checkOutLabel}` : '',
    nights: plural(b.nights || 1, 'night'),
    meta: [
      plural(guests || 1, 'guest'),
      b.pricing?.total != null ? `${inr(b.pricing.total)} ${pay.paidAt ? 'paid' : 'total'}` : '',
      ref ? `ID ${ref}` : '',
    ].filter(Boolean),
    details: [
      pay.paidAt ? ['Paid on', stamp(pay.paidAt)] : null,
      method ? ['Payment method', method] : null,
      pay.transactionId ? ['Transaction ID', pay.transactionId] : null,
      b.cancellationPolicy?.summary ? ['Cancellation', b.cancellationPolicy.summary] : null,
    ].filter(Boolean),
    canReview: !!b.canReview,
    address: p.address || '',
  };
}

/** /home → everything the listing shows. */
export function toHome(h) {
  const retreats = (h.retreats || []).map(toRetreat);
  const cities = [...new Set(retreats.map(r => cityOf(r.loc)).filter(Boolean))];
  return {
    enabled: h.enabled !== false,
    disabledMessage: h.disabledMessage || null,
    retreats,
    total: h.destinationsCount ?? retreats.length,
    cities,
    reels: (h.reels || []).filter(v => v.videoUrl || v.thumbnail).map(toReel),
    offers: (h.offers || []).map(toOffer),
    reviews: (h.reviews || []).map(toReview),
    concierge: h.concierge || null,
    counts: h.bookings?.counts || null,
  };
}

const MOCK_HOME = {
  enabled: true,
  disabledMessage: null,
  retreats: mock.retreats,
  total: mock.retreats.length,
  cities: mock.chipCities,
  reels: mock.reels,
  offers: mock.offers,
  reviews: mock.reviews,
  concierge: {title: '24/7 Bespoke Concierge', subtitle: 'Private airport pickups & custom bookings'},
  counts: {upcoming: 1, completed: 1, cancelled: 0},
};

export const useStaysHome = () =>
  useQuery('stays:home', () => getHome().then(toHome), {mock: USE_MOCK.stays ? MOCK_HOME : undefined});

const MOCK_TABS = {
  upcoming: {counts: MOCK_HOME.counts, bookings: [{...mock.upcoming, statusLabel: 'Confirmed', ok: true}]},
  completed: {counts: MOCK_HOME.counts, bookings: [{...mock.completed, pastSub: mock.completed.sub, statusLabel: 'Completed', ok: true, canReview: true}]},
  cancelled: {counts: MOCK_HOME.counts, bookings: []},
};

export const useStayBookings = tab =>
  useQuery(
    'stays:bookings:' + tab,
    () => getBookings(tab).then(r => ({counts: r.counts || null, bookings: (r.bookings || []).map(toBooking)})),
    // Not kept on disk: bookings belong to whoever is signed in.
    {mock: USE_MOCK.stays ? MOCK_TABS[tab] : undefined, persist: false},
  );

// ---- Stay Detail
export const getProperty = (idOrSlug, params) => request('GET', `${P}/properties/${idOrSlug}`, {params});

// The four amenities the bento draws (animated icons), matched by key or label.
const BENTO = [
  ['ac', /\b(ac|a\/c|air[- ]?condition)/i],
  ['wifi', /wi-?fi/i],
  ['minibar', /mini[- ]?bar/i],
  ['housekeeping', /house[- ]?keeping/i],
];
const BENTO_LABEL = {ac: 'Air Conditioner', wifi: 'Wi-Fi', minibar: 'Mini Bar', housekeeping: 'House Keeping Service'};

function splitAmenities(list) {
  const bento = {};
  const more = [];
  const seen = new Set();
  (list || []).forEach(a => {
    const label = (a.label || '').trim();
    const hit = BENTO.find(([k, re]) => a.key === k || re.test(label));
    if (hit) {
      bento[hit[0]] = BENTO_LABEL[hit[0]];
    } else if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      more.push({label, icon: a.icon ? {uri: a.icon} : null});
    }
  });
  return {bento, more, count: Object.keys(bento).length + more.length};
}

const R = 6371;
function kmBetween(a, b) {
  const rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const km = n => `${n < 10 ? Math.round(n * 10) / 10 : Math.round(n)} km`;

/**
 * Nearby places on the stylised 350×320 map around the stay at HOME. Each pin
 * keeps its real bearing from the stay, its distance sets how far out it sits,
 * and pins are fanned apart so none overlap. If the stay's own coordinates
 * don't agree with the places' distances (bad data), bearings can't be trusted
 * and the pins are spread evenly instead. Keeps the 3 nearest.
 */
const HOME_XY = [205, 160];
const MIN_GAP = (55 * Math.PI) / 180;
function toPlaces(stay, list) {
  const c = stay.coordinates;
  const hasC = c && c.lat != null && c.lng != null;
  const ok = (list || [])
    .filter(p => p.lat != null && p.lng != null)
    .map(p => {
      const real = hasC ? kmBetween(c, p) : null;
      return {p, real, d: p.distanceKm ?? real};
    })
    .filter(x => x.d != null && x.d < 80)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  if (!ok.length) {
    return [];
  }
  // Trust bearings only if the stay's coordinates match the stated distances.
  const trusted = hasC && ok.every(x => x.p.distanceKm == null || Math.abs(x.real - x.p.distanceKm) < Math.max(5, x.p.distanceKm));
  const cos = hasC ? Math.cos((c.lat * Math.PI) / 180) : 1;
  const far = Math.max(...ok.map(x => x.d)) || 1;
  const pins = ok.map((x, i) => ({
    ...x,
    a: trusted
      ? Math.atan2(-(x.p.lat - c.lat), (x.p.lng - c.lng) * cos)
      : -Math.PI / 2 + (i * 2 * Math.PI) / ok.length - Math.PI / 6,
    r: 70 + (80 * x.d) / far,
  }));
  // Fan pins apart so none sit on top of another.
  pins.sort((a, b) => a.a - b.a);
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < pins.length; i++) {
      const next = pins[(i + 1) % pins.length];
      const gap = i === pins.length - 1 ? next.a + 2 * Math.PI - pins[i].a : next.a - pins[i].a;
      if (pins.length > 1 && gap < MIN_GAP) {
        const push = (MIN_GAP - gap) / 2;
        pins[i].a -= push;
        next.a += push;
      }
    }
  }
  const [hx, hy] = HOME_XY;
  return pins
    .sort((a, b) => a.d - b.d)
    .map(({p, d, a, r}) => {
      const x = Math.round(Math.min(325, Math.max(25, hx + Math.cos(a) * r)));
      const y = Math.round(Math.min(290, Math.max(50, hy + Math.sin(a) * r)));
      const nx = -(y - hy) * 0.18;
      const ny = (x - hx) * 0.18;
      const dist = km(d);
      return {
        id: p.id,
        name: p.name,
        short: dist,
        dist: p.driveMinutes ? `${dist} · ${p.driveMinutes}m` : dist,
        x,
        y,
        c: [hx + (x - hx) * 0.35 + nx, hy + (y - hy) * 0.35 + ny, hx + (x - hx) * 0.7 + nx, hy + (y - hy) * 0.7 + ny].map(
          Math.round,
        ),
        img: pic(p.image, images.hero),
        lat: p.lat,
        lng: p.lng,
      };
    });
}

function toPolicy(p) {
  const cx = p.policies?.cancellation || {};
  const rules = (cx.rules || []).slice().sort((a, b) => b.minHoursBeforeCheckIn - a.minHoursBeforeCheckIn);
  const free = rules.find(r => r.refundPercent === 100 && r.minHoursBeforeCheckIn > 0);
  return {
    text: cx.text || '',
    summary: cx.summary || '',
    rules,
    freeHours: free ? free.minHoursBeforeCheckIn : null,
    title: free ? 'Free cancellation' : rules[0]?.label || 'Cancellation policy',
    sub: free ? `Up to ${free.minHoursBeforeCheckIn} hrs before check-in` : cx.text || '',
  };
}

export function toStay(p) {
  const taxPct = p.tax?.inclusive ? 0 : Number(p.tax?.percent) || 0;
  const gallery = (p.gallery || []).filter(g => g.url).map(g => ({img: {uri: g.url}, alt: g.alt || p.name}));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name || '',
    short: p.name || '',
    rate: rate1(p.rating),
    address: p.location || p.address || '',
    city: p.city || cityOf(p.location),
    about: p.description || p.tagline || '',
    gallery: gallery.length ? gallery : [{img: pic(p.image, images.balcony), alt: p.name}],
    tour: p.videoTour?.url
      ? {url: p.videoTour.url, thumb: p.videoTour.thumbnail, dur: mmss(p.videoTour.durationSec || 0), secs: p.videoTour.durationSec || 0}
      : null,
    suites: (p.roomTypes || []).map((r, i) => ({
      id: r.id,
      name: r.name || '',
      spec:
        r.spec ||
        [r.sizeSqft ? `${r.sizeSqft} sq ft` : '', r.bedType || ''].filter(Boolean).join(' · ') ||
        (r.amenities || []).slice(0, 3).map(a => a.label).join(' · '),
      price: r.averageNightlyRate ?? r.baseRate ?? 0,
      img: pic(r.images?.[0]?.url, fb(i)),
      badge: r.badge || '',
      soldOut: !!r.soldOut,
      maxAdults: r.maxAdults || 2,
      maxChildren: r.maxChildren ?? 0,
    })),
    amenities: splitAmenities(p.amenities),
    checkIn: p.checkInLabel || '',
    checkOut: p.checkOutLabel || '',
    policy: toPolicy(p),
    taxPct,
    taxLabel: p.tax?.label || 'Taxes & fees',
    bookingRules: p.bookingRules || null,
    places: toPlaces(p, p.nearbyPlaces),
    phone: p.contact?.phone || null,
  };
}

/** Nightly total incl. taxes for a suite of this stay. */
export const stayTotal = (stay, suite) => Math.round(suite.price * (1 + stay.taxPct / 100));

const mockStays = new Map();
function mockStay(id) {
  if (!mockStays.has(id)) {
    const s = sd.stayFor(id);
    mockStays.set(id, {
      ...s,
      id,
      slug: id,
      city: s.address.split(', ').pop(),
      gallery: sd.gallery,
      tour: {url: null, dur: '0:45', secs: 45},
      suites: sd.suites,
      amenities: {bento: {...BENTO_LABEL}, more: [], count: 4},
      checkIn: '2:00 PM',
      checkOut: '11:00 AM',
      policy: toPolicy({
        policies: {
          cancellation: {
            rules: [
              {label: 'Free cancellation', minHoursBeforeCheckIn: 72, refundPercent: 100},
              {label: 'No refund', minHoursBeforeCheckIn: 0, refundPercent: 0},
            ],
          },
        },
      }),
      taxPct: 5,
      taxLabel: 'Taxes & fees',
      bookingRules: null,
      places: sd.places,
      phone: null,
    });
  }
  return mockStays.get(id);
}

/** `trip` (from the search) prices the suites for those dates. */
export const useStayDetail = (idOrSlug, trip) =>
  useQuery(
    `stays:property:${idOrSlug}${trip ? `:${trip.checkIn}:${trip.checkOut}` : ''}`,
    () => getProperty(idOrSlug, trip ? {checkIn: trip.checkIn, checkOut: trip.checkOut} : undefined).then(toStay),
    {
      mock: USE_MOCK.stays ? mockStay(idOrSlug) : undefined,
    },
  );

// ---- Booking: hold → review (PATCH) → pay / release
const opId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// One booking can hold several rooms of the same type; the server allows
// up to `rooms × maxAdults` adults and `rooms × maxChildren` children.
export const MAX_ROOMS = 5;
/** Rooms of `suite` needed for these guests (1 … MAX_ROOMS). */
export function roomsFor(adults, children, suite) {
  const a = Math.ceil((adults || 1) / (suite?.maxAdults || 2));
  const c = suite?.maxChildren ? Math.ceil((children || 0) / suite.maxChildren) : 1;
  return Math.min(MAX_ROOMS, Math.max(1, a, c));
}

/** POST /holds. `cin` / `cout` are local Dates. */
export const createHold = ({propertyId, roomTypeId, cin, cout, rooms = 1, adults = 1, children = 0, couponCode}) =>
  request('POST', `${P}/holds`, {
    body: {
      propertyId,
      roomTypeId,
      checkIn: ymd(cin),
      checkOut: ymd(cout),
      rooms,
      adults,
      children,
      ...(couponCode ? {couponCode} : null),
      idempotencyKey: opId(),
    },
  });

/** PATCH a held booking; dates as local Dates. Returns {booking, quote}. */
export const patchBooking = (id, {cin, cout, ...rest}) =>
  request('PATCH', `${P}/bookings/${id}`, {
    body: {...(cin ? {checkIn: ymd(cin)} : null), ...(cout ? {checkOut: ymd(cout)} : null), ...rest},
  });
export const releaseBooking = id => request('POST', `${P}/bookings/${id}/release`);
// Only PayU is integrated, so it is always asked for by name.
export const payBooking = (id, useWallet) => request('POST', `${P}/bookings/${id}/pay`, {body: {gateway: 'payu', useWallet}});
/** After the SDK closes (success, failure or cancel): the server checks with PayU. → {next, shouldPoll, pollAfterMs, booking} */
export const paymentResult = (id, attemptId, payload) =>
  request('POST', `${P}/bookings/${id}/payment-result`, {body: {attemptId, payload}, timeout: 30000});
export const paymentStatus = id => request('GET', `${P}/bookings/${id}/payment-status`);
/** Signs a hash the PayU SDK asks for mid-checkout. → {hash} */
export const payuHash = body => request('POST', `${P}/payments/payu/hash`, {body});

/** Money with paise only when there are any: 6298.95 → "6,298.95", 5999 → "5,999". */
export function money(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const whole = sd.inr(Math.floor(v));
  const paise = Math.round((v - Math.floor(v)) * 100);
  return paise ? `${whole}.${String(paise).padStart(2, '0')}` : whole;
}

/**
 * Booking + (optional) quote → what Review Booking draws. The quote (from
 * PATCH) is newer when present; a fresh hold only has the booking's pricing.
 */
export function toReviewState(booking, quote) {
  const pr = quote?.pricing || booking.pricing || {};
  const nights = booking.nights || (pr.nightly || []).length || 1;
  const walletAmount = quote?.wallet?.amount ?? booking.wallet?.amount ?? 0;
  const cx = quote?.cancellation || booking.cancellationPolicy || null;
  return {
    id: booking.bookingId,
    status: booking.status,
    cin: day(booking.checkIn),
    cout: day(booking.checkOut),
    rooms: booking.rooms || 1,
    adults: booking.adults || 1,
    children: booking.children || 0,
    checkInLabel: booking.property?.checkInLabel || '',
    checkOutLabel: booking.property?.checkOutLabel || '',
    holdExpiresAt: booking.holdExpiresAt ? new Date(booking.holdExpiresAt).getTime() : null,
    nights,
    rate: pr.nightly?.[0]?.rate ?? (pr.roomTotal || 0) / nights,
    roomTotal: pr.roomTotal || 0,
    extras: pr.extrasTotal || 0,
    discount: pr.discount || 0,
    offerCode: pr.offer?.code || null,
    taxLabel: pr.taxLabel || 'Taxes & fees',
    tax: pr.tax || 0,
    total: pr.total || 0,
    offer: quote?.offer || null, // {code, applied, reason}
    wallet: quote?.wallet || null, // {available, balance, amount}
    walletAmount,
    payable: quote?.payable ?? Math.max(0, (pr.total || 0) - walletAmount),
    cancel: cx ? {free: !!cx.freeCancellation, text: cx.summary || ''} : null,
  };
}

/** The confirmed booking → Success screen's receipt. */
export function toReceipt(b) {
  const pay = b.payment || {};
  const method =
    pay.method === 'wallet' ? 'Wallet' : (pay.instrument || pay.gateway || '').replace(/^\w/, c => c.toUpperCase());
  return {
    bookingId: b.referenceCode || b.bookingId,
    txnId: pay.transactionId || '—',
    method: method || '—',
    at: pay.paidAt ? stamp(pay.paidAt) : '',
    total: money(b.pricing?.total ?? pay.amount ?? 0),
  };
}
