import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../../components/GradientView';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BOOKING_THEME as T } from './utils/concertData';
import useBookingStatusBar from './utils/useBookingStatusBar';
import VenueCarousel from './components/VenueCarousel';
import {
  formatEventDayLong,
  formatEventTime,
  formatMoney,
  formatStamp,
} from './utils/concertFormat';
import {
  CancelConcertBooking,
  GetConcertBooking,
  ResumeConcertPayment,
  classifyBookingError,
} from '../../Services/UserApi';
import {
  bookingStatusMeta,
  normalizeBookResponse,
  normalizeBookingRecord,
  normalizeCancelResponse,
  venueDirectionsUrl,
  venueMapUrl,
} from './utils/concertBookingAdapter';
import { clearPendingBooking } from './utils/concertPendingBooking';
import ConcertTicketCard from './components/ConcertTicketCard';
import { loadSavedTicket, saveTicket } from './utils/concertTicketStore';
import { useFocusEffect } from '@react-navigation/native';

const TONE = {
  good: { fg: '#CE8F52', bg: 'rgba(206,143,82,0.16)' },
  warn: { fg: '#E0A85A', bg: 'rgba(224,168,90,0.16)' },
  bad: { fg: '#E0736A', bg: 'rgba(224,115,106,0.16)' },
  muted: { fg: T.textDim, bg: 'rgba(255,255,255,0.07)' },
};

/**
 * Booking Summary.
 *
 * The row from the list renders immediately and the full record loads behind
 * it. That is not only about speed: the server re-checks a stale pending
 * booking against PayU while serving this endpoint, so the fetch can
 * legitimately change the status under the user.
 */
export default function ConcertBookingDetail({ route, navigation }) {
  useBookingStatusBar();
  const { bookingId, booking: seed } = route.params || {};

  const [booking, setBooking] = useState(seed || null);
  const [loading, setLoading] = useState(!seed);
  const [error, setError] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refund, setRefund] = useState(null);

  // Cancel and resume both move money; neither may run twice.
  const busyRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const getToken = useCallback(async () => {
    try {
      return await AsyncStorage.getItem('mytoken');
    } catch (e) {
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    const id = bookingId || seed?.bookingId;
    if (!id) {
      setError('This booking could not be found.');
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const res = await GetConcertBooking(id, token);
      if (!mounted.current) return;
      const next = normalizeBookingRecord(res?.data?.data || res?.data);      // normalizeBookingRecord answers for any object, so an envelope or a
      // {data: null} body comes back as a record with no id, no items and no
      // status - which renders as a real booking worth zero rupees and hides
      // both Cancel and Complete payment. Only a record that identifies
      // itself may replace the row we were handed.
      if (next && next.bookingId) {
        setBooking(next);
        setError(null);
        // keep the offline copy of the QR current (a replaced code included)
        saveTicket(next);
        // The record may have just changed under an open confirmation sheet
        // (this endpoint re-checks stale pending bookings), so a sheet that is
        // no longer valid is taken down rather than left confirmable.
        if (!next.canCancel) setConfirmOpen(false);
      } else if (!seed) {
        setError('Could not load this booking.');
      }
    } catch (err) {
      if (!mounted.current) return;
      const e = classifyBookingError(err);
      // No signal and nothing handed in: the saved copy still has the QR.
      if (!seed && e.kind === 'network') {
        const saved = await loadSavedTicket(id);
        if (!mounted.current) return;
        if (saved) {
          setBooking(saved);
          setError(null);
          return;
        }
      }
      // the seeded row is still worth showing; only a cold load is fatal
      if (!seed) {
        setNeedsLogin(e.kind === 'auth');
        setError(
          e.kind === 'auth'
            ? 'Log in to see this booking.'
            : e.kind === 'notFound'
            ? 'This booking could not be found.'
            : e.message || 'Could not load this booking.',
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [bookingId, seed, getToken]);

  // On every focus, not just mount: the entry count ("1 of 2 entered") and a
  // QR that ops replaced only reach the guest through a re-read.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openUrl = url => {
    if (!url) return;
    Linking.openURL(url).catch(() =>
      setNotice('Could not open maps on this device.'),
    );
  };

  /* ---------------- resume an unfinished payment ---------------- */

  const onResume = async () => {
    if (busyRef.current || !booking?.bookingId) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const token = await getToken();
      const res = await ResumeConcertPayment(booking.bookingId, token);
      const result = normalizeBookResponse(res?.data);

      // /pay checks PayU first, so this means the earlier attempt succeeded
      if (!result.requiresPayU && result.booking?.isConfirmed) {
        await clearPendingBooking();
        if (!mounted.current) return;
        setBooking(result.booking);
        setNotice('That payment had already gone through. Your booking is confirmed.');
        return;
      }
      if (result.canOpenPayU) {
        if (!mounted.current) return;
        navigation.navigate('ConcertPaymentPage', {
          payuHtml: result.payuHtml,
          payuAction: result.payuAction,
          txnId: result.txnId,
          bookingId: result.booking?.bookingId || booking.bookingId,
          referenceCode: result.booking?.referenceCode || booking.referenceCode,
          booking: result.booking,
        });
        return;
      }
      setNotice('We could not reopen the payment. Please try again in a moment.');
    } catch (err) {
      const e = classifyBookingError(err);
      if (!mounted.current) return;
      setNotice(
        e.kind === 'network'
          ? 'Could not reach the server. Check your connection.'
          : e.message || 'This booking can no longer be paid for.',
      );
      // Re-reading the booking only helps when the server disagreed with us.
      // On a dead connection it is a second request that fails the same way.
      if (e.kind !== 'network') load();
    } finally {
      if (mounted.current) {
        setBusy(false);
        busyRef.current = false;
      }
    }
  };

  /* ---------------- cancel ---------------- */

  const onCancel = async () => {
    if (busyRef.current || !booking?.bookingId) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const token = await getToken();
      const res = await CancelConcertBooking(booking.bookingId, null, token);
      if (!mounted.current) return;
      const result = normalizeCancelResponse(res?.data);
      setConfirmOpen(false);
      if (result.booking) {
        setBooking(result.booking);
        // so the home "Your ticket" bar drops it straight away, even offline
        saveTicket(result.booking);
      } else {
        // The cancel went through but the response did not echo the booking.
        // Without this the pill still reads CONFIRMED and Cancel Booking stays
        // live beside the refund card, and a second tap cancels again.
        load();
      }
      setRefund(result.refund);
    } catch (err) {
      if (!mounted.current) return;
      const e = classifyBookingError(err);
      setConfirmOpen(false);
      setNotice(e.message || 'This booking could not be cancelled.');
      // a 409 means our copy is stale - the server knows the real state
      if (e.kind === 'conflict' || e.kind === 'notFound') load();
    } finally {
      if (mounted.current) {
        setBusy(false);
        busyRef.current = false;
      }
    }
  };

  /* ---------------- render ---------------- */

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centre]}>
        <ActivityIndicator color={T.gold} size="large" />
      </SafeAreaView>
    );
  }
  if (error || !booking) {
    return (
      <SafeAreaView style={[styles.safe, styles.centre]}>
        <Icon name="alert-circle-outline" size={28} color={T.textDim} />
        <Text style={styles.emptyText}>{error || 'Booking not found.'}</Text>
        <TouchableOpacity
          onPress={() =>
            needsLogin
              ? navigation.navigate('NewLogin', {
                  redirectAfterLogin: { screen: 'ConcertBookings', params: {} },
                })
              : navigation.goBack()
          }
          style={styles.retryBtn}>
          <Text style={styles.retryText}>{needsLogin ? 'Log in' : 'Go back'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const meta = bookingStatusMeta(booking.status);
  const tone = TONE[meta.tone] || TONE.muted;
  const p = booking.payment || {};
  const cur = booking.currency || 'INR';
  const c = booking.cancellation;
  const shownRefund = refund || booking.refund;
  const paidStamp = formatStamp(p.paidAt || booking.confirmedAt || booking.createdAt);
  const onlineLabel = p.payuMode ? 'Via ' + p.payuMode : 'Via CRED/Gpay/PayTm';
  const venueLine = [booking.venueAddress || booking.city]
    .filter(Boolean)
    .join(', ');

  // Reads "X deducted from your Fracspace wallet & Y paid via UPI" - only the
  // halves that actually happened.
  const paidParts = [];
  if (p.walletAmount > 0 && p.walletApplied) {
    paidParts.push(formatMoney(p.walletAmount, cur) + ' deducted from your Fracspace wallet');
  }
  if (p.payuAmount > 0 && p.payuStatus === 'success') {
    paidParts.push(
      formatMoney(p.payuAmount, cur) +
        ' paid via ' +
        (p.payuMode || 'CRED/Gpay/PayTm'),
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.circleBtn}>
          <Icon name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Summary</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        {/* ---------------- concert ---------------- */}
        <View style={[styles.card, styles.concertCard]}>
          {booking.concertImage ? (
            <Image
              source={{ uri: booking.concertImage }}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.poster, styles.posterEmpty]}>
              <Icon name="musical-notes-outline" size={22} color={T.textDim} />
            </View>
          )}

          <View style={styles.concertBody}>
            <View style={styles.concertHead}>
              <Text style={styles.concertTitle} numberOfLines={2}>
                {booking.concertTitle || 'Concert'}
              </Text>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE MUSIC</Text>
              </View>
            </View>
            {booking.artist ? (
              <Text style={styles.artist} numberOfLines={1}>
                {booking.artist}
              </Text>
            ) : null}

            {booking.eventDate ? (
              <Meta icon="calendar-outline" text={formatEventDayLong(booking.eventDate)} />
            ) : null}
            {booking.eventDate ? (
              <Meta icon="time-outline" text={formatEventTime(booking.eventDate) + ' onwards'} />
            ) : null}
            {booking.venue || booking.city ? (
              <Meta
                icon="location-outline"
                text={[booking.venue, booking.venueAddress || booking.city]
                  .filter(Boolean)
                  .join(', ')}
              />
            ) : null}
          </View>
        </View>

        {/* ---------------- entry ticket (QR) ---------------- */}
        {booking.ticket ? (
          <ConcertTicketCard
            booking={booking}
            onOpenQr={b => navigation.navigate('ConcertTicketQR', { booking: b })}
          />
        ) : null}

        {/* ---------------- tickets ---------------- */}
        <View style={styles.card}>
          <SectionHead icon="ticket-outline" title="Your Tickets" />
          {booking.items.map((i, idx) => (
            <View key={i.ticketTypeId || idx} style={styles.ticketBox}>
              <View style={styles.tierChip}>
                <Text style={styles.tierText}>{i.label}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={styles.ticketTopRow}>
                  <Text style={styles.ticketCount}>
                    {i.quantity} Ticket{i.quantity === 1 ? '' : 's'}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.statusText, { color: tone.fg }]}>
                      {meta.label.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {idx === 0 && booking.referenceCode ? (
                  <Text style={styles.bookingId}>
                    Booking ID: <Text style={styles.bookingIdValue}>{booking.referenceCode}</Text>
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {/* ---------------- venue ---------------- */}
        {booking.venue || booking.venueImages.length ? (
          <View style={styles.card}>
            {/* <SectionHead icon="location-outline" title="Venue" /> */}
            <View style={styles.venueRow}>
              <View style={styles.venueLeft}>
                <SectionHead icon="location-outline" title="Venue" />
                <Text style={styles.venueName}>{booking.venue}</Text>
                {venueLine ? <Text style={styles.venueAddr}>{venueLine}</Text> : null}
                {venueDirectionsUrl(booking) ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => openUrl(venueDirectionsUrl(booking))}
                    style={styles.dirBtn}>
                    <Icon name="navigate-outline" size={10} color={T.gold} />
                    <Text style={styles.dirText}>Get Directions</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.venueRight}>
                <VenueCarousel
                  images={booking.venueImages}
                  onOpenMaps={
                    venueMapUrl(booking)
                      ? () => openUrl(venueMapUrl(booking))
                      : null
                  }
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* ---------------- payment ---------------- */}
        <View style={styles.card}>
          <View style={styles.payHead}>
            <SectionHead icon="receipt-outline" title="Payment" flush />
            {paidStamp ? <Text style={styles.stamp}>{paidStamp}</Text> : null}
          </View>
          <View style={styles.divider} />

          {booking.items.map((i, idx) => (
            <Row
              key={i.ticketTypeId || idx}
              left={
                (booking.items.length > 1 ? i.label + ' ' : 'Ticket amount ') +
                '(' + i.quantity + ' × ' + formatMoney(i.unitPrice, cur) + ')'
              }
              right={formatMoney(i.amount, cur)}
            />
          ))}
          {p.walletAmount > 0 ? (
            <Row
              left={p.walletApplied ? 'Wallet used' : 'Wallet (not yet debited)'}
              right={'– ' + formatMoney(p.walletAmount, cur)}
              green
            />
          ) : null}
          {p.payuAmount > 0 ? (
            <Row left={onlineLabel} right={formatMoney(p.payuAmount, cur)} />
          ) : null}

          <View style={styles.divider} />
          <Row
            left={booking.isConfirmed ? 'Total paid' : 'Total'}
            right={formatMoney(booking.totalAmount, cur)}
            strong
          />

          {paidParts.length ? (
            <View style={styles.infoRow}>
              <Icon name="information-circle-outline" size={15} color={T.textDim} />
              <Text style={styles.infoText}>{paidParts.join(' & ')}</Text>
            </View>
          ) : null}
        </View>

        {/* ---------------- refund, once cancelled ---------------- */}
        {shownRefund ? (
          <View style={styles.card}>
            <SectionHead icon="cash-outline" title="Refund" />
            {shownRefund.policyLabel ? (
              <Text style={styles.venueAddr}>{shownRefund.policyLabel}</Text>
            ) : null}
            {shownRefund.reason ? (
              <Text style={styles.venueAddr}>Reason: {shownRefund.reason}</Text>
            ) : null}
            <View style={styles.divider} />
            <Row
              left={
                shownRefund.refundPercent > 0
                  ? 'Refund amount (' + shownRefund.refundPercent + '%)'
                  : 'Refund amount'
              }
              right={formatMoney(shownRefund.refundableAmount, cur)}
              strong
            />

            {/* The server's own per-channel breakdown when it sends one. Each
                destination carries its own status, so a credited wallet and a
                bank refund still in flight cannot share one misleading label. */}
            {shownRefund.refundedTo ? (
              shownRefund.refundedTo.destinations.map((d, i) => (
                <Row
                  key={(d.channel || 'dest') + i}
                  left={d.label + (d.settled ? '' : ' (in progress)')}
                  right={formatMoney(d.amount, cur)}
                  green={d.channel === 'wallet'}
                />
              ))
            ) : (
              <>
                {shownRefund.walletRefundAmount > 0 ? (
                  <Row
                    left={shownRefund.walletCreditedImmediately ? 'To your wallet (done)' : 'To your wallet'}
                    right={formatMoney(shownRefund.walletRefundAmount, cur)}
                    green
                  />
                ) : null}
                {shownRefund.payuRefundAmount > 0 ? (
                  <Row left="Back to your bank" right={formatMoney(shownRefund.payuRefundAmount, cur)} />
                ) : null}
              </>
            )}
            {shownRefund.processingFee > 0 ? (
              <Row left="Processing fee" right={'– ' + formatMoney(shownRefund.processingFee, cur)} />
            ) : null}
            {shownRefund.refundedAt ? (
              <Text style={styles.infoText}>
                Refunded on {formatStamp(shownRefund.refundedAt)}
                {shownRefund.refundedTo && shownRefund.refundedTo.summary
                  ? ' to your ' + shownRefund.refundedTo.summary.toLowerCase()
                  : ''}
                .
              </Text>
            ) : null}
            {shownRefund.payuRefundEta ? (
              <Text style={styles.infoText}>
                Bank refunds usually take {shownRefund.payuRefundEta}.
              </Text>
            ) : null}
          </View>
        ) : null}

        {notice ? <Text style={styles.warnText}>{notice}</Text> : null}

        {/* ---------------- actions ---------------- */}
        {booking.canResumePayment ? (
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={busy}
            onPress={onResume}
            style={{ marginTop: 22 }}>
            <GradientView
              colors={[T.goldDark, T.goldLight, T.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.cta, busy && { opacity: 0.6 }]}>
              {busy ? (
                <ActivityIndicator color="#1A1206" />
              ) : (
                <Text style={styles.ctaText}>Complete payment</Text>
              )}
            </GradientView>
          </TouchableOpacity>
        ) : null}

        {booking.canCancel ? (
          <TouchableOpacity
            disabled={busy}
            activeOpacity={0.85}
            onPress={() => setConfirmOpen(true)}
            style={styles.cancelBtn}>
            <Icon name="ticket-outline" size={17} color="#BA3939" />
            <Text style={styles.cancelText}>Cancel Booking</Text>
          </TouchableOpacity>
        ) : null}

        {booking.isConfirmed ? (
          <View style={styles.signOff}>
            <View style={styles.rule} />
            <Icon name="diamond-outline" size={9} color={T.gold} />
            <Text style={styles.signOffText}>SEE YOU AT THE CONCERT!</Text>
            <Icon name="diamond-outline" size={9} color={T.gold} />
            <View style={styles.rule} />
          </View>
        ) : null}
      </ScrollView>

      {/* The exact refund, shown before anything is cancelled. Every figure
          comes from the server's cancellation block, not from arithmetic
          done here. */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        // Android needs this: without it the hardware back button is swallowed
        // and the sheet cannot be dismissed, leaving the destructive button as
        // the most reachable way out.
        onRequestClose={() => {
          if (!busy) setConfirmOpen(false);
        }}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Cancel this booking?</Text>
            <Text style={styles.sheetBody}>
              {!c?.policyLabel
                ? 'This cannot be undone.'
                : c.refundPercent > 0
                ? c.policyLabel + ' — you get ' + c.refundPercent + '% back.'
                : c.policyLabel + ' — this booking is no longer refundable.'}
            </Text>

            {c && c.refundableAmount > 0 ? (
              <View style={styles.sheetCard}>
                <Row left="Refund amount" right={formatMoney(c.refundableAmount, cur)} strong />
                {c.walletRefundAmount > 0 ? (
                  <Row left="To your wallet" right={formatMoney(c.walletRefundAmount, cur)} green />
                ) : null}
                {c.payuRefundAmount > 0 ? (
                  <Row left="Back to your bank" right={formatMoney(c.payuRefundAmount, cur)} />
                ) : null}
                {c.processingFee > 0 ? (
                  <Row left="Processing fee" right={'– ' + formatMoney(c.processingFee, cur)} />
                ) : null}
              </View>
            ) : null}

            {c && c.refundableAmount <= 0 && c.note ? (
              <Text style={styles.sheetNote}>{c.note}</Text>
            ) : null}

            <TouchableOpacity
              disabled={busy}
              onPress={onCancel}
              style={[styles.destructive, busy && { opacity: 0.6 }]}
              activeOpacity={0.85}>
              {busy ? (
                <ActivityIndicator color="#BA3939" />
              ) : (
                <Text style={styles.destructiveText}>Yes, cancel booking</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              disabled={busy}
              onPress={() => setConfirmOpen(false)}
              style={styles.keepBtn}
              activeOpacity={0.8}>
              <Text style={styles.keepText}>Keep my booking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SectionHead({ icon, title, flush }) {
  return (
    <View style={[styles.sectionHead, flush && { marginBottom: 0 }]}>
      <Icon name={icon} size={17} color={T.gold} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Meta({ icon, text }) {
  return (
    <View style={styles.metaRow}>
      <Icon name={icon} size={12} color={T.gold} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function Row({ left, right, strong, green }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLeft, strong && styles.rowStrongLeft]}>{left}</Text>
      <Text
        style={[
          styles.rowRight,
          strong && styles.rowStrongRight,
          green && styles.rowGreen,
        ]}>
        {right}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  centre: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#202021',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: T.text, fontFamily: 'WorkSans-Bold', fontSize: 19 },
  body: { paddingHorizontal: 22, paddingBottom: 34 },

  card: {
    backgroundColor: T.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 10,
  },

  /* ---- concert ---- */
  concertCard: { flexDirection: 'row', gap: 14 },
  poster: { width: 108, height: 108, borderRadius: 12 },
  posterEmpty: {
    backgroundColor: '#171B24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  concertBody: { flex: 1, minWidth: 0 },
  concertHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  concertTitle: {
    flex: 1,
    color: T.text,
    fontFamily: 'WorkSans-Bold',
    fontSize: 14,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.45)',
  },
  liveDot: { width: 4, height: 4, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: {
    color: '#F87171',
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 8,
    letterSpacing: 0.4,
  },
  artist: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 8,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2.5 },
  metaText: {
    flex: 1,
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 10,
  },

  /* ---- sections ---- */
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { color: T.text, fontFamily: 'WorkSans-Medium', fontSize: 14 },

  /* ---- tickets ---- */
  ticketBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  tierChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(206,143,82,0.55)',
  },
  tierText: { color: T.gold, fontFamily: 'WorkSans-SemiBold', fontSize: 12 },
  ticketTopRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  ticketCount: { color: T.text, fontFamily: 'WorkSans-Bold', fontSize: 12 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  statusText: { fontFamily: 'WorkSans-SemiBold', fontSize: 8, letterSpacing: 0.4 },
  bookingId: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    marginTop: 4,
  },
  bookingIdValue: { color: T.text, fontFamily: 'WorkSans-SemiBold' },

  /* ---- venue ---- */
  venueRow: { flexDirection: 'row', gap: 10 },
  venueLeft: { flex: 1, minWidth: 0 },
  venueRight: { width: '50%' },
  venueName: { color: T.text, fontFamily: 'WorkSans-SemiBold', fontSize: 12 },
  venueAddr: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    marginTop: 3,
  },
  dirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(206,143,82,0.5)',
  },
  dirText: { color: T.gold, fontFamily: 'WorkSans-SemiBold', fontSize: 10 },

  /* ---- payment ---- */
  payHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stamp: { color: T.textMuted, fontFamily: 'WorkSans-Regular', fontSize: 12 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.border,
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 8,
  },
  rowLeft: { flex: 1, color: T.textMuted, fontFamily: 'WorkSans-Regular', fontSize: 12 },
  rowRight: { color: T.text, fontFamily: 'WorkSans-Medium', fontSize: 12 },
  rowStrongLeft: { color: T.text, fontFamily: 'WorkSans-Bold', fontSize: 14 },
  rowStrongRight: { color: T.gold, fontFamily: 'WorkSans-Bold', fontSize: 14 },
  rowGreen: { color: T.balance },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12 },
  infoText: {
    flex: 1,
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    lineHeight: 18,
  },

  /* ---- actions ---- */
  cta: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#1A1206', fontFamily: 'WorkSans-Bold', fontSize: 15.5 },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BA3939',
    marginTop: 26,
  },
  cancelText: { color: '#BA3939', fontFamily: 'WorkSans-SemiBold', fontSize: 16 },

  signOff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(206,143,82,0.35)' },
  signOffText: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Medium',
    fontSize: 12,
    letterSpacing: 1.1,
  },

  warnText: {
    color: '#E0A85A',
    fontFamily: 'WorkSans-Regular',
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 14,
  },
  emptyText: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 14,
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  retryText: { color: T.gold, fontFamily: 'WorkSans-SemiBold', fontSize: 13.5 },

  /* ---- cancel sheet ---- */
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 28,
  },
  sheetTitle: { color: T.text, fontFamily: 'WorkSans-Bold', fontSize: 19 },
  sheetBody: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 13.5,
    lineHeight: 21,
    marginTop: 8,
  },
  sheetNote: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 14,
    backgroundColor: T.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sheetCard: {
    backgroundColor: T.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  destructive: {
    marginTop: 18,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(186,57,57,0.6)',
    backgroundColor: 'rgba(186,57,57,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveText: { color: '#BA3939', fontFamily: 'WorkSans-SemiBold', fontSize: 15 },
  keepBtn: { paddingVertical: 14, alignItems: 'center' },
  keepText: { color: T.textMuted, fontFamily: 'WorkSans-Medium', fontSize: 14 },
});
