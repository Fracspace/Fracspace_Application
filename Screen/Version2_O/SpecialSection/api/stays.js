// Stays API (docs: stays-api.md) and the adapters that turn its objects into
// the shapes the Stays screens were built on, so the UI code barely changes.
import {request, USE_MOCK} from './client';
import {useQuery} from './useQuery';
import {images} from '../data';
import * as mock from '../Stays/data';

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
