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
 * Nearby places placed on the stylised 350×320 map around the stay at HOME,
 * by their real bearing and (scaled) distance. Places without coordinates,
 * or a stay without them, can't be placed and are left out. Keeps the 3 nearest.
 */
const HOME_XY = [205, 160];
function toPlaces(stay, list) {
  const c = stay.coordinates;
  if (!c || c.lat == null || c.lng == null) {
    return [];
  }
  const ok = (list || [])
    .filter(p => p.lat != null && p.lng != null)
    .map(p => ({p, d: p.distanceKm ?? kmBetween(c, p)}))
    .filter(x => x.d < 80) // anything further is bad data
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  if (!ok.length) {
    return [];
  }
  const cos = Math.cos((c.lat * Math.PI) / 180);
  const vec = p => [(p.lng - c.lng) * cos, -(p.lat - c.lat)];
  const far = Math.max(...ok.map(x => Math.hypot(...vec(x.p)))) || 1;
  const [hx, hy] = HOME_XY;
  return ok.map(({p, d}) => {
    const [vx, vy] = vec(p);
    const len = Math.hypot(vx, vy) || 1;
    // 70–150px from the stay, keeping the real direction; clamped inside the map.
    const r = 70 + (80 * len) / far;
    const x = Math.round(Math.min(325, Math.max(25, hx + (vx / len) * r)));
    const y = Math.round(Math.min(290, Math.max(50, hy + (vy / len) * r)));
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
      c: [hx + (x - hx) * 0.35 + nx, hy + (y - hy) * 0.35 + ny, hx + (x - hx) * 0.7 + nx, hy + (y - hy) * 0.7 + ny].map(Math.round),
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

export const useStayDetail = idOrSlug =>
  useQuery('stays:property:' + idOrSlug, () => getProperty(idOrSlug).then(toStay), {
    mock: USE_MOCK.stays ? mockStay(idOrSlug) : undefined,
  });
