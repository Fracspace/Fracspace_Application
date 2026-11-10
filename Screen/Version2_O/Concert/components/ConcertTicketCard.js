import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-svg';
import { BOOKING_THEME as T } from '../utils/concertData';
import { formatEventShort, formatEventTime } from '../utils/concertFormat';
import { TICKET_STATE } from '../utils/concertBookingAdapter';

/**
 * QR drawing rules from the backend handoff: black on white even in dark mode,
 * a white quiet zone, error correction Q, at least 240 wide, nothing in the
 * middle. Draw exactly `ticket.code` - it is opaque.
 */
export function TicketQR({ code, size = 240, dimmed = false }) {
  return (
    <View style={[styles.qrPanel, dimmed && styles.qrDimmed]}>
      <QRCode
        value={code}
        size={size}
        ecl="Q"
        quietZone={16}
        color="#000000"
        backgroundColor="#FFFFFF"
      />
    </View>
  );
}

const BADGE = {
  [TICKET_STATE.VALID]: { label: 'Valid', fg: '#5FBE89', bg: 'rgba(95,190,137,0.14)' },
  [TICKET_STATE.PARTIALLY_USED]: { label: 'Partly used', fg: '#E0A85A', bg: 'rgba(224,168,90,0.14)' },
  [TICKET_STATE.USED]: { label: 'Used', fg: T.textDim, bg: 'rgba(255,255,255,0.06)' },
  [TICKET_STATE.VOID]: { label: 'Cancelled', fg: '#E0736A', bg: 'rgba(224,115,106,0.14)' },
};

export function ticketBadge(state) {
  return BADGE[state] || BADGE[TICKET_STATE.VALID];
}

/** "2 × Platinum, 1 × Gold" */
export function ticketTypesLine(ticket) {
  return (ticket?.types || [])
    .filter(t => t.quantity > 0)
    .map(t => t.quantity + ' × ' + t.label)
    .join(', ');
}

/** The one line under the QR that tells the guest where they stand. */
export function ticketStatusLine(ticket) {
  if (!ticket) return '';
  const n = ticket.tickets;
  switch (ticket.state) {
    case TICKET_STATE.PARTIALLY_USED:
      return ticket.admitted + ' of ' + n + ' entered · the rest can still use this QR';
    case TICKET_STATE.USED: {
      const at = ticket.lastAdmittedAt ? ' · ' + formatEventTime(ticket.lastAdmittedAt) : '';
      return 'Used — all ' + n + ' entered' + at;
    }
    case TICKET_STATE.VOID:
      return 'This ticket was cancelled';
    default:
      return 'Admits ' + n;
  }
}

/** True when the QR is worth opening full screen (there is one, and seats are left). */
export function canShowQr(ticket) {
  return (
    !!ticket &&
    !!ticket.code &&
    (ticket.state === TICKET_STATE.VALID || ticket.state === TICKET_STATE.PARTIALLY_USED)
  );
}

/**
 * One entry ticket per booking: the show, a state badge, the QR, "Admits N",
 * the ticket types and the reference code. Tapping the QR opens it full
 * screen (bright, big); tapping the rest calls onPress.
 */
export default function ConcertTicketCard({
  booking,
  onPress,
  onOpenQr,
  position, // { index, total } -> "Booking 1 of 2"
  qrSize = 240,
  style,
}) {
  const ticket = booking?.ticket;
  if (!ticket) return null;
  const badge = ticketBadge(ticket.state);
  const types = ticketTypesLine(ticket);
  const isVoid = ticket.state === TICKET_STATE.VOID || !ticket.code;
  const isUsed = ticket.state === TICKET_STATE.USED;
  const openable = canShowQr(ticket) && !!onOpenQr;
  const place = [booking.venue, booking.city].filter(Boolean).join(', ');

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.card, style]}
      accessibilityLabel={'Entry ticket for ' + (booking.concertTitle || 'concert')}>
      <View style={styles.head}>
        <View style={styles.headText}>
          {position && position.total > 1 ? (
            <Text style={styles.kicker}>
              BOOKING {position.index} OF {position.total}
            </Text>
          ) : null}
          <Text style={styles.title} numberOfLines={1}>
            {booking.concertTitle || 'Concert'}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: badge.bg }]}>
          <Text style={[styles.pillText, { color: badge.fg }]}>{badge.label}</Text>
        </View>
      </View>

      {place ? (
        <Text style={styles.sub} numberOfLines={1}>
          {place}
        </Text>
      ) : null}
      {booking.eventDate ? (
        <Text style={styles.sub}>{formatEventShort(booking.eventDate)}</Text>
      ) : null}

      {/* perforation */}
      <View style={styles.perf}>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={styles.dash} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      {isVoid ? (
        <View style={styles.voidBox}>
          <Icon name="close-circle-outline" size={22} color="#E0736A" />
          <Text style={styles.voidText}>This ticket was cancelled</Text>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={openable ? 0.85 : 1}
          disabled={!openable}
          onPress={() => onOpenQr && onOpenQr(booking)}
          style={styles.qrWrap}
          accessibilityRole="button"
          accessibilityLabel="Show entry QR full screen">
          <TicketQR code={ticket.code} size={qrSize} dimmed={isUsed} />
          {openable ? (
            <View style={styles.enlarge}>
              <Icon name="expand-outline" size={13} color={T.gold} />
              <Text style={styles.enlargeText}>Tap to show at the gate</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      )}

      {!isVoid ? (
        <Text style={[styles.admits, isUsed && { color: T.textMuted }]}>
          {ticketStatusLine(ticket)}
        </Text>
      ) : null}
      {types ? <Text style={styles.types}>{types}</Text> : null}

      {booking.referenceCode ? (
        <View style={styles.refRow}>
          <Text style={styles.refLabel}>REFERENCE</Text>
          <Text style={styles.refValue} selectable>
            {booking.referenceCode}
          </Text>
        </View>
      ) : null}
    </Wrapper>
  );
}

const NOTCH = 18;

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headText: { flex: 1 },
  kicker: {
    color: T.gold,
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 10.5,
    letterSpacing: 1,
    marginBottom: 3,
  },
  title: { color: T.text, fontFamily: 'WorkSans-SemiBold', fontSize: 16 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontFamily: 'WorkSans-SemiBold', fontSize: 10.5, letterSpacing: 0.3 },
  sub: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12.5,
    marginTop: 4,
  },

  perf: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    marginHorizontal: -16,
  },
  notch: {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: T.bg,
  },
  notchLeft: { marginLeft: -NOTCH / 2 },
  notchRight: { marginRight: -NOTCH / 2 },
  dash: {
    flex: 1,
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.14)',
    marginHorizontal: 6,
  },

  qrWrap: { alignItems: 'center' },
  qrPanel: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  qrDimmed: { opacity: 0.25 },
  enlarge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  enlargeText: { color: T.gold, fontFamily: 'WorkSans-Medium', fontSize: 12 },

  admits: {
    color: T.text,
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
  },
  types: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },

  voidBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 22,
    borderRadius: 12,
    backgroundColor: 'rgba(224,115,106,0.08)',
  },
  voidText: { color: '#E0736A', fontFamily: 'WorkSans-SemiBold', fontSize: 14 },

  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  refLabel: { color: T.textDim, fontFamily: 'WorkSans-Medium', fontSize: 10.5, letterSpacing: 1 },
  refValue: { color: T.text, fontFamily: 'WorkSans-SemiBold', fontSize: 13, letterSpacing: 0.5 },
});
