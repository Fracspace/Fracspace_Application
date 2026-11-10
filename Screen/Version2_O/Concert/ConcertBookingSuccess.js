import React, { useEffect } from 'react';
import {
  BackHandler,
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
import { CONCERT_THEME as T } from './utils/concertData';
import useBookingStatusBar from './utils/useBookingStatusBar';
import { formatEventShort, formatMoney } from './utils/concertFormat';
import { clearPendingBooking } from './utils/concertPendingBooking';

/**
 * Back to the home tab.
 *
 * Two things had to be right here and neither was obvious:
 * the bottom tab is called "HomeStack", not "Home" - navigating to a screen
 * name that does not exist resolves to nothing and the button silently does
 * nothing; and simply switching tabs would leave ConcertDetails -> Checkout
 * -> Review -> Payment -> this screen still stacked underneath, so the user
 * would not move. Resetting the ROOT navigator clears all of it.
 */
function goToHome(navigation) {
  let root = navigation;
  while (root.getParent && root.getParent()) root = root.getParent();
  try {
    root.reset({ index: 0, routes: [{ name: 'BottomNavigations' }] });
  } catch (e) {
    navigation.navigate('BottomNavigations', { screen: 'HomeStack' });
  }
}

import { trackPurchase } from '../../utils/analytics';

export default function ConcertBookingSuccess({ route, navigation }) {
  useBookingStatusBar();
  const { booking, concert } = route.params || {};
  const payment = booking?.payment || {};
  const currency = booking?.currency || 'INR';

  useEffect(() => {
    clearPendingBooking();
    // Analytics funnel: concert booking paid.
    trackPurchase('concert', {
      value: booking?.totalAmount,
      transactionId: booking?.referenceCode || booking?.bookingId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goHome = () => goToHome(navigation);

  // There is nothing to go back to: the payment page was replaced, and the
  // booking is already paid for.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goHome();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.tickWrap}>
          <GradientView
            colors={[T.goldLight, T.gold, T.goldDark]}
            style={styles.tick}>
            <Icon name="checkmark" size={34} color="#1A1206" />
          </GradientView>
        </View>

        <Text style={styles.title}>You're going!</Text>
        <Text style={styles.subtitle}>
          {booking?.tickets || 0} ticket{booking?.tickets === 1 ? '' : 's'} booked
          {booking?.concertTitle || concert?.title
            ? ' for ' + (booking?.concertTitle || concert?.title)
            : ''}
        </Text>

        {booking?.referenceCode ? (
          <View style={styles.refCard}>
            <Text style={styles.refLabel}>BOOKING REFERENCE</Text>
            <Text style={styles.refValue}>{booking.referenceCode}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          {booking?.city ? (
            <Line icon="location-outline" text={booking.venue ? booking.venue + ', ' + booking.city : booking.city} />
          ) : null}
          {booking?.eventDate ? (
            <Line icon="calendar-outline" text={formatEventShort(booking.eventDate)} />
          ) : null}
          {booking?.email ? <Line icon="mail-outline" text={booking.email} /> : null}
        </View>

        {booking?.items?.length ? (
          <View style={styles.card}>
            {booking.items.map(i => (
              <Row
                key={i.ticketTypeId}
                left={i.label + ' × ' + i.quantity}
                right={formatMoney(i.amount, currency)}
              />
            ))}
            <View style={styles.divider} />
            <Row left="Total" right={formatMoney(booking.totalAmount, currency)} strong />
            {payment.walletAmount > 0 ? (
              <Row
                left="Paid from wallet"
                right={formatMoney(payment.walletAmount, currency)}
                accent
              />
            ) : null}
            {payment.payuAmount > 0 ? (
              <Row
                left={payment.payuMode ? 'Paid online (' + payment.payuMode + ')' : 'Paid online'}
                right={formatMoney(payment.payuAmount, currency)}
              />
            ) : null}
          </View>
        ) : null}

        <Text style={styles.note}>
          Your confirmation is on its way by email and WhatsApp. Your entry QR
          is in My tickets and opens even without internet.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        {booking?.bookingId ? (
          <TouchableOpacity
            activeOpacity={0.85}
            // No seed: the detail screen reads the booking fresh, because the
            // ticket (QR) can be issued a moment after the payment response.
            onPress={() =>
              navigation.navigate('ConcertBookingDetail', { bookingId: booking.bookingId })
            }
            style={styles.ticketBtn}
            accessibilityRole="button">
            <Icon name="qr-code-outline" size={17} color={T.gold} />
            <Text style={styles.ticketBtnText}>View my ticket</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity activeOpacity={0.9} onPress={goHome}>
          <GradientView
            colors={[T.goldLight, T.gold, T.goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}>
            <Text style={styles.ctaText}>Done</Text>
          </GradientView>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Line({ icon, text }) {
  return (
    <View style={styles.line}>
      <Icon name={icon} size={16} color={T.gold} />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

function Row({ left, right, strong, accent }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLeft, strong && styles.rowStrong, accent && styles.rowAccent]}>
        {left}
      </Text>
      <Text style={[styles.rowRight, strong && styles.rowStrong, accent && styles.rowAccent]}>
        {right}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  body: { paddingHorizontal: 22, paddingTop: 34, paddingBottom: 24 },
  tickWrap: { alignItems: 'center' },
  tick: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: T.text,
    fontFamily: 'WorkSans-Bold',
    fontSize: 24,
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  refCard: {
    backgroundColor: 'rgba(206,143,82,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(206,143,82,0.4)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  refLabel: {
    color: T.gold,
    fontFamily: 'WorkSans-Regular',
    fontSize: 10.5,
    letterSpacing: 1.2,
  },
  refValue: {
    color: T.text,
    fontFamily: 'WorkSans-Bold',
    fontSize: 18,
    letterSpacing: 0.6,
    marginTop: 6,
  },
  card: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
  },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  lineText: {
    flex: 1,
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    marginLeft: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.border,
    marginVertical: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLeft: { color: T.textMuted, fontFamily: 'WorkSans-Regular', fontSize: 13 },
  rowRight: { color: T.textMuted, fontFamily: 'WorkSans-Medium', fontSize: 13 },
  rowStrong: { color: T.text, fontFamily: 'WorkSans-Bold', fontSize: 14.5 },
  rowAccent: { color: T.gold },
  note: {
    color: T.textDim,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 22,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  cta: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#1A1206', fontFamily: 'WorkSans-Bold', fontSize: 15.5 },
  ticketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.borderActive,
    marginBottom: 10,
  },
  ticketBtnText: { color: T.gold, fontFamily: 'WorkSans-SemiBold', fontSize: 15 },
});
