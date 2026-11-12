// Mock data for the Stays listing (Stays.dc.html) until the APIs are wired.
import {images} from '../data';

// Search sheet mock data until the APIs are wired (images: placeholders).
// `col` / `h` place each destination card in the two-column grid.
export const searchCities = [
  {city: 'Hyderabad', img: images.balcony, h: 240, col: 'L'},
  {city: 'Munnar', img: images.hilltop, h: 180, col: 'R'},
  {city: 'Alleppey', img: images.luxury, h: 190, col: 'L'},
  {city: 'Goa', img: null, h: 250, col: 'R'}, // drawn art until an image arrives
];

export const searchStays = [
  {name: 'Dreamscape', area: 'Banjara Hills', city: 'Hyderabad'},
  {name: 'Dreamscape OU Colony', area: 'Manikonda', city: 'Hyderabad'},
  {name: 'Fracspace Abode – I', area: 'Hyderabad', city: 'Hyderabad'},
  {name: 'Hilltop by Fracspace', area: 'Munnar', city: 'Munnar'},
  {name: 'Alleppey Backwater Cottages', area: 'Alleppey', city: 'Alleppey'},
  {name: '[Goa stay]', area: 'Goa', city: 'Goa'},
];

/** Destination capsules under the search bar, in order. */
export const chipCities = ['Hyderabad', 'Goa', 'Munnar', 'Alleppey'];

export const searchHints = ['Where to Next?', 'Try “Munnar”', 'Try “Banjara Hills”', 'Where to Next?'];

export const retreats = [
  {id: 'ht', name: 'Hilltop by Fracspace', loc: 'Munnar, Kerala', rate: '4.9', price: '₹5,999', tag: 'HillTop', img: images.hilltop},
  {id: 'ds', name: 'Dreamscape', loc: 'Banjara Hills, Hyderabad', rate: '4.8', price: '₹4,999', tag: 'Guest favourite', img: images.balcony},
  {id: 'ou', name: 'Dreamscape OU Colony', loc: 'Manikonda, Hyderabad', rate: '4.5', price: '₹4,500', tag: 'Boutique', img: images.luxury},
];

// secs drives the progress segments; stayId is where "Book this stay" goes.
export const reels = [
  {id: 'r1', title: 'Inside Dreamscape', dur: '0:12', secs: 12, loc: 'Munnar', stayId: 'ht', stayName: 'Hilltop by Fracspace', img: images.balcony},
  {id: 'r2', title: 'Elevated Living', dur: '0:07', secs: 7, loc: 'Munnar', stayId: 'ht', stayName: 'Hilltop by Fracspace', img: images.hilltop},
  {id: 'r3', title: 'A misty escape', dur: '0:09', secs: 9, loc: 'Munnar', stayId: 'ht', stayName: 'Hilltop by Fracspace', img: images.luxury},
];

export const offers = [
  {
    id: 'o1',
    theme: 'warm',
    badge: 'SUITE UPGRADE',
    title: '20% OFF SUITE',
    desc: 'City view & private\nairport transfer.',
    perk: 'Personal butler service included',
    code: 'FESTIVE20',
    art: 'crown',
  },
  {
    id: 'o2',
    theme: 'slate',
    badge: 'RETREATS',
    title: 'FLAT ₹[X] OFF',
    desc: 'On bookings at retreats.\nMin. 2 nights.',
    perk: '',
    code: '[CODE]',
    art: 'ticket',
  },
];

export const reviews = [
  {
    id: 'g1',
    place: 'Hilltop Munnar',
    rate: '5.0',
    quote: 'Rainy nights, breathtaking views, and delicious homemade Kerala food.',
    photos: '2 photos shared',
    ini: 'LC',
    name: 'Linson Chandy',
    date: 'Sep 2026',
    img: images.hilltop,
  },
  {
    id: 'g2',
    place: 'Hilltop Munnar',
    rate: '[x.x]',
    quote: '[Guest review quote]',
    photos: '3 photos shared',
    ini: 'PP',
    name: '[Guest name]',
    date: '[Month]',
    img: images.luxury,
  },
];

export const bookingTabs = [
  {id: 'up', label: 'Upcoming', count: '1'},
  {id: 'past', label: 'Completed', count: ''},
  {id: 'cxl', label: 'Cancelled', count: ''},
];

export const upcoming = {
  stayId: 'ds',
  img: images.balcony,
  name: 'Dreamscape Resort & Private Villas',
  sub: 'Luxury Room · Banjara Hills',
  checkIn: new Date(2026, 9, 15),
  checkInLabel: 'Thu, 15 Oct',
  checkInTime: 'from [2:00 PM]',
  checkOutLabel: 'Fri, 16 Oct',
  checkOutTime: 'by [11:00 AM]',
  nights: '1 night',
  meta: ['1 guest', '₹6,299 paid', 'ID [BOOKING-ID]'],
  details: [
    ['Paid on', '[Date, time]'],
    ['Payment method', '[Method]'],
    ['Transaction ID', '[TXN-ID]'],
    ['Cancellation', 'Non-refundable (within 72h)', '#FCA5A5'],
  ],
};

export const completed = {
  stayId: 'ht',
  img: images.hilltop,
  name: 'Hilltop by Fracspace',
  sub: '[Dates] · Munnar, Kerala',
};

/** The `.bcount` label: days until check-in. */
export function countdown(checkIn) {
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const d = Math.round((checkIn - t0) / 864e5);
  if (d > 1) {
    return `Check-in in ${d} days`;
  }
  return d === 1 ? 'Check-in tomorrow' : d === 0 ? 'Check-in today' : 'Stay in progress';
}
