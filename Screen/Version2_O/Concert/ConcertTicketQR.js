import React, { useEffect } from 'react';
import {
  AppState,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  resetBrightness,
  setBrightnessLevel,
} from '@reeq/react-native-device-brightness';
import { formatEventShort } from './utils/concertFormat';
import {
  TicketQR,
  canShowQr,
  ticketBadge,
  ticketStatusLine,
  ticketTypesLine,
} from './components/ConcertTicketCard';

/**
 * Full-screen entry QR, shown at the gate.
 *
 * White page, big QR, screen brightness at full while it is open (restored on
 * leave and whenever the app goes to the background). Drawn entirely from the
 * booking passed in, so it works offline. Screenshots are deliberately not
 * blocked: the guest gets the same QR on WhatsApp, and the gate refuses a QR
 * once its seats are used.
 */
export default function ConcertTicketQR({ route, navigation }) {
  const { booking } = route.params || {};
  const ticket = booking?.ticket;
  const show = canShowQr(ticket);
  const { width } = useWindowDimensions();
  const size = Math.max(240, Math.min(width - 64, 340));

  useEffect(() => {
    if (!show) return undefined;
    const brighten = () => {
      try {
        setBrightnessLevel(1);
      } catch (_) {}
    };
    const restore = () => {
      try {
        resetBrightness();
      } catch (_) {}
    };
    brighten();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') brighten();
      else restore();
    });
    return () => {
      sub.remove();
      restore();
    };
  }, [show]);

  const badge = ticketBadge(ticket?.state);
  const types = ticketTypesLine(ticket);
  const place = [booking?.venue, booking?.city].filter(Boolean).join(', ');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.close}
          accessibilityLabel="Close">
          <Icon name="close" size={22} color="#111111" />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {booking?.concertTitle || 'Concert'}
        </Text>
        {place ? <Text style={styles.sub}>{place}</Text> : null}
        {booking?.eventDate ? (
          <Text style={styles.sub}>{formatEventShort(booking.eventDate)}</Text>
        ) : null}

        <View style={styles.qrBox}>
          {ticket?.code ? (
            <TicketQR code={ticket.code} size={size} dimmed={!show} />
          ) : (
            <Text style={styles.voidText}>This ticket was cancelled</Text>
          )}
        </View>

        <View style={[styles.pill, { backgroundColor: badge.bg }]}>
          <Text style={[styles.pillText, { color: badge.fg }]}>{badge.label}</Text>
        </View>
        {ticket?.code ? (
          <Text style={styles.admits}>{ticketStatusLine(ticket)}</Text>
        ) : null}
        {types ? <Text style={styles.types}>{types}</Text> : null}
        {booking?.referenceCode ? (
          <Text style={styles.ref} selectable>
            {booking.referenceCode}
          </Text>
        ) : null}
      </View>

      <Text style={styles.hint}>
        {show
          ? 'Show this QR at the entrance. It works without internet.'
          : ' '}
      </Text>
    </SafeAreaView>
  );
}

const INK = '#111111';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 4 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F1F3',
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 20, textAlign: 'center' },
  sub: { color: '#55555C', fontFamily: 'WorkSans-Regular', fontSize: 13.5, marginTop: 4, textAlign: 'center' },
  qrBox: { marginTop: 22, marginBottom: 18, alignItems: 'center', justifyContent: 'center' },
  voidText: { color: '#C2453B', fontFamily: 'WorkSans-SemiBold', fontSize: 16, paddingVertical: 60 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontFamily: 'WorkSans-SemiBold', fontSize: 11, letterSpacing: 0.3 },
  admits: { color: INK, fontFamily: 'WorkSans-SemiBold', fontSize: 18, marginTop: 10, textAlign: 'center' },
  types: { color: '#55555C', fontFamily: 'WorkSans-Regular', fontSize: 14, marginTop: 4, textAlign: 'center' },
  ref: { color: INK, fontFamily: 'WorkSans-SemiBold', fontSize: 14, letterSpacing: 1, marginTop: 14 },
  hint: {
    color: '#77777E',
    fontFamily: 'WorkSans-Regular',
    fontSize: 12.5,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
});
