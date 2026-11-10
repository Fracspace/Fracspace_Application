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

  it('leaves bookings without a ticket as they were', () => {
    const b = normalizeBookingRecord(confirmed({}));
    expect(b.ticket).toBeNull();
    expect(b.canCancel).toBe(true);
  });
});
