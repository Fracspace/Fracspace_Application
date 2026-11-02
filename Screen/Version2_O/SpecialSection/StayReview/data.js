// Mock data and date helpers for Review Booking (StayReview.dc.html) until the
// stays booking API exists.
import {images} from '../data';
import {inr, stayFor, suites} from '../StayDetail/data';

export {inr};

const DAY = 864e5;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CHECK_IN = '2:00 PM';
export const CHECK_OUT = '11:00 AM';
export const TAX = 0.05;

export const MAX_ADULTS = 4;
export const MAX_KIDS = 3;

/** "Thu, 15 Oct" */
export const short = d => `${DOW[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const nightsBetween = (a, b) => Math.round((b - a) / DAY);

export function today() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/** The default stay: check in tomorrow, one night. */
export function defaultDates() {
  const cin = new Date(today().getTime() + DAY);
  cin.setHours(0, 0, 0, 0); // a DST change in between can shift the hour
  const cout = new Date(cin.getFullYear(), cin.getMonth(), cin.getDate() + 1);
  return {cin, cout};
}

/** Free cancellation up to 72h before check-in at 2:00 PM. */
export function cancellation(cin) {
  const at = new Date(cin.getTime());
  at.setHours(14, 0, 0, 0);
  const deadline = new Date(at.getTime() - 72 * 3600e3);
  const free = Date.now() < deadline.getTime();
  return {
    free,
    color: free ? '#4ADE80' : '#F87171',
    text: free
      ? `Free cancellation until ${short(deadline)}, ${CHECK_IN}`
      : 'Non-refundable: check-in is within 72 hours',
  };
}

/** Day cells for the month of `view` (leading blanks included). */
export function monthDays(view, pin, pout, t) {
  const y = view.getFullYear();
  const m = view.getMonth();
  const days = [];
  const lead = new Date(y, m, 1).getDay();
  for (let i = 0; i < lead; i++) {
    days.push({key: `b${i}`, blank: true});
  }
  const dim = new Date(y, m + 1, 0).getDate();
  for (let n = 1; n <= dim; n++) {
    const d = new Date(y, m, n);
    const isIn = !!pin && d.getTime() === pin.getTime();
    const isOut = !!pout && d.getTime() === pout.getTime();
    const between = !!pin && !!pout && d > pin && d < pout;
    days.push({
      key: String(n),
      n,
      d,
      off: d < t,
      sel: isIn || isOut,
      rs: isIn && !!pout,
      re: isOut,
      band: between || (isIn && !!pout) || isOut,
      today: d.getTime() === t.getTime(),
      label: short(d) + (isIn ? ', check-in' : '') + (isOut ? ', check-out' : ''),
    });
  }
  return days;
}

/** "28 Oct 2026, 4:05 PM" */
export function paidLabel(p) {
  let h = p.getHours();
  const m = String(p.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${p.getDate()} ${MON[p.getMonth()]} ${p.getFullYear()}, ${h}:${m} ${ap}`;
}

/** Stay + suite shown on the review card, from StayDetail's route params. */
export function reviewFor(params = {}) {
  // Live stays pass what Stay Detail loaded from the API.
  if (params.stay && params.suite) {
    const {stay, suite} = params;
    return {
      name: stay.name,
      short: stay.short,
      rate: stay.rate,
      place: stay.address.split(', ').pop(),
      address: stay.address,
      room: suite.spec ? `${suite.name} · ${suite.spec}` : suite.name,
      price: suite.price,
      img: suite.img || images.balcony,
      adults: Math.max(1, params.booking?.adults || params.guests || 1),
      maxAdults: suite.maxAdults || MAX_ADULTS,
      maxKids: suite.maxChildren ?? MAX_KIDS,
    };
  }
  const stay = stayFor(params.stayId);
  const suite = suites.find(s => s.id === params.suiteId) || suites[1];
  return {
    name: stay.name,
    short: stay.short,
    rate: stay.rate,
    place: stay.address.split(', ').pop(),
    address: stay.address,
    room: `${params.suiteName || suite.name} · ${suite.spec}`,
    price: params.price || suite.price,
    img: suite.img || images.balcony,
    adults: Math.min(MAX_ADULTS, Math.max(1, params.guests || 1)),
  };
}

/** Mock receipt until payments are wired to a stays booking API. */
export function mockReceipt() {
  const r = n => String(Math.floor(Math.random() * 10 ** n)).padStart(n, '0');
  return {bookingId: `FSST-${r(6)}`, txnId: `TXN${r(10)}`, method: 'UPI'};
}
