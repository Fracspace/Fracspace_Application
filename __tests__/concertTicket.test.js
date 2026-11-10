jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  TICKET_STATE,
  normalizeBookingRecord,
  normalizeTicket,
} from '../Screen/Version2_O/Concert/utils/concertBookingAdapter';

const sample = {
  code: 'FST1.cbkg_V1StGXR8_Z5j.q9kq3Hk3m2ZtR0cQx8wJbA',
  qrImageUrl: 'https://apitest.fracspace.com/x/qr.png',
  version: 1,
  issuedAt: '2026-11-10T09:12:00.000Z',
  state: 'valid',
  tickets: 2,
  admitted: 0,
  remaining: 2,
  types: [{ ticketTypeId: 'vip', label: 'Platinum', quantity: 2, admitted: 0, remaining: 2 }],
  firstAdmittedAt: null,
  lastAdmittedAt: null,
};

const confirmed = extra => ({
  bookingId: 'b1',
  status: 'confirmed',
  cancellation: { allowed: true },
  ...extra,
});

describe('normalizeTicket', () => {
  it('returns null when the booking has no ticket yet', () => {
    expect(normalizeTicket(null)).toBeNull();
    expect(normalizeTicket(undefined)).toBeNull();
    expect(normalizeTicket({})).toBeNull();
  });

  it('keeps the code exactly as sent', () => {
    const t = normalizeTicket(sample);
    expect(t.code).toBe(sample.code);
    expect(t.state).toBe(TICKET_STATE.VALID);
    expect(t.tickets).toBe(2);
    expect(t.remaining).toBe(2);
    expect(t.types).toEqual([
      { ticketTypeId: 'vip', label: 'Platinum', quantity: 2, admitted: 0, remaining: 2 },
    ]);
  });

  it('treats a ticket without a code as void, whatever the state says', () => {
    expect(normalizeTicket({ ...sample, code: null }).state).toBe(TICKET_STATE.VOID);
  });

  it('falls back to valid for an unknown state and derives remaining', () => {
    const t = normalizeTicket({ ...sample, state: 'weird', admitted: 1, remaining: undefined });
    expect(t.state).toBe(TICKET_STATE.VALID);
    expect(t.remaining).toBe(1);
  });
});

describe('booking.ticket and cancel', () => {
  it('carries the ticket on the booking record', () => {
    const b = normalizeBookingRecord(confirmed({ ticket: sample }));
    expect(b.ticket.code).toBe(sample.code);
    expect(b.canCancel).toBe(true);
  });

  it('hides cancel once anyone has entered', () => {
    const b = normalizeBookingRecord(
      confirmed({ ticket: { ...sample, state: 'partially_used', admitted: 1, remaining: 1 } }),
    );
    expect(b.canCancel).toBe(false);
  });

  it('home shortcut shows usable tickets for upcoming shows, soonest first', () => {
    const { pickActiveTickets } = require('../Screen/Version2_O/Concert/utils/concertBookingAdapter');
    const now = Date.parse('2026-11-10T10:00:00Z');
    const mk = (id, eventDate, state = 'valid', code = 'C' + id) =>
      normalizeBookingRecord(confirmed({ bookingId: id, eventDate, ticket: { ...sample, code, state } }));
    const list = pickActiveTickets(
      [
        mk('later', '2026-11-20T14:00:00Z'),
        mk('soon', '2026-11-14T14:00:00Z'),
        mk('past', '2026-11-01T14:00:00Z'),
        mk('used', '2026-11-15T14:00:00Z', 'used'),
        mk('void', '2026-11-15T14:00:00Z', 'void', null),
        mk('partly', '2026-11-16T14:00:00Z', 'partially_used'),
      ],
      now,
    );
    expect(list.map(b => b.bookingId)).toEqual(['soon', 'partly', 'later']);
  });

  it('live card: someone checked in and the show has not ended', () => {
    const { pickLiveTickets } = require('../Screen/Version2_O/Concert/utils/concertBookingAdapter');
    const start = '2026-11-14T14:00:00Z';
    const mk = (id, state, admitted, eventDate = start) =>
      normalizeBookingRecord(
        confirmed({ bookingId: id, eventDate, ticket: { ...sample, code: 'C' + id, state, admitted, remaining: 2 - admitted } }),
      );
    const list = [
      mk('in', 'used', 2),
      mk('half', 'partially_used', 1),
      mk('notYet', 'valid', 0),
      mk('over', 'used', 2, '2026-11-13T14:00:00Z'),
    ];
    const during = Date.parse('2026-11-14T16:00:00Z');
    expect(pickLiveTickets(list, during).map(b => b.bookingId)).toEqual(['in', 'half']);
    const gatesOpen = Date.parse('2026-11-14T13:00:00Z');
    expect(pickLiveTickets(list, gatesOpen).map(b => b.bookingId)).toEqual(['in', 'half']);
    const afterShow = Date.parse('2026-11-14T20:00:00Z');
    expect(pickLiveTickets(list, afterShow)).toEqual([]);
  });

  it('leaves bookings without a ticket as they were', () => {
    const b = normalizeBookingRecord(confirmed({}));
    expect(b.ticket).toBeNull();
    expect(b.canCancel).toBe(true);
  });
});

describe('saved tickets on the phone', () => {
  const store = require('../Screen/Version2_O/Concert/utils/concertTicketStore');
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  const soon = new Date(Date.now() + 3 * 864e5).toISOString();
  const mk = (id, extra = {}) =>
    normalizeBookingRecord(
      confirmed({ bookingId: id, eventDate: soon, ticket: { ...sample, code: 'C' + id }, ...extra }),
    );

  beforeEach(() => AsyncStorage.clear());

  it('a complete list drops a booking that was refunded and left the list', async () => {
    await store.saveTickets([mk('a'), mk('b')]);
    await store.saveTickets([mk('a')], { complete: true });
    expect((await store.loadSavedTickets()).map(b => b.bookingId)).toEqual(['a']);
  });

  it('a cancelled booking overwrites its saved valid ticket', async () => {
    await store.saveTickets([mk('a')]);
    await store.saveTicket(mk('a', { status: 'cancelled', ticket: null }));
    expect(await store.loadSavedTickets()).toEqual([]);
  });

  it('drops shows that ended more than 30 days ago', async () => {
    const old = new Date(Date.now() - 40 * 864e5).toISOString();
    await store.saveTickets([mk('old', { eventDate: old }), mk('new')]);
    expect((await store.loadSavedTickets()).map(b => b.bookingId)).toEqual(['new']);
  });
});
