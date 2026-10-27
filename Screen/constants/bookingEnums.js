// Values sent by the fraction booking API (getFractionBookingDetails).

export const BOOKING_STAGE = Object.freeze({
  BOOKING_AMOUNT_PAID: 'bookingAmountPaid',
  FULL_PAYMENT_PAID: 'fullPaymentPaid',
  FRACTION_ALLOTTED: 'fractionAllotted',
});

// Timeline order shown on the booking history card.
export const BOOKING_STAGE_ORDER = [
  BOOKING_STAGE.BOOKING_AMOUNT_PAID,
  BOOKING_STAGE.FULL_PAYMENT_PAID,
  BOOKING_STAGE.FRACTION_ALLOTTED,
];

export const BOOKING_STATUS = Object.freeze({
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLATION_REQUESTED: 'cancellationRequested',
  CANCELLED: 'cancelled',
});

// Values the API sent before the enums were standardised.
const LEGACY_STAGE = {
  'full payment': BOOKING_STAGE.FULL_PAYMENT_PAID,
};

const STATUS_VALUES = Object.values(BOOKING_STATUS);
const STAGE_VALUES = Object.values(BOOKING_STAGE);

export const normalizeBookingStatus = booking => {
  const raw = booking?.bookingStatus;
  if (typeof raw === 'string' && raw.trim()) {
    const match = STATUS_VALUES.find(
      value => value.toLowerCase() === raw.trim().toLowerCase(),
    );
    if (match) {
      return match;
    }
  }
  // Older records have no bookingStatus when the payment was never completed.
  return BOOKING_STATUS.PENDING;
};

// Index into BOOKING_STAGE_ORDER, or -1 when no stage has been reached.
export const getBookingStageIndex = booking => {
  const raw = typeof booking?.stage === 'string' ? booking.stage.trim() : '';
  const stage = STAGE_VALUES.includes(raw)
    ? raw
    : LEGACY_STAGE[raw.toLowerCase()];
  if (stage) {
    return BOOKING_STAGE_ORDER.indexOf(stage);
  }
  // A successful booking without a stage has at least paid the booking amount.
  return normalizeBookingStatus(booking) === BOOKING_STATUS.SUCCESS ? 0 : -1;
};

export const getRemainingCancellationDays = booking => {
  const days = Number(booking?.remainingCancellationDays);
  return Number.isFinite(days) && days > 0 ? days : 0;
};

export const canCancelBooking = booking =>
  normalizeBookingStatus(booking) === BOOKING_STATUS.SUCCESS &&
  getRemainingCancellationDays(booking) > 0;
