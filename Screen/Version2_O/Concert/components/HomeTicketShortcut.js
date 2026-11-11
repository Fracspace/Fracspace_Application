import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { BOOKING_THEME as T } from '../utils/concertData';
import { formatEventShort } from '../utils/concertFormat';
import { GetMyConcertBookings } from '../../../Services/UserApi';
import {
  normalizeBookingList,
  pickActiveTickets,
  pickLiveTickets,
} from '../utils/concertBookingAdapter';
import HomeLiveShowCard from './HomeLiveShowCard';
import { loadSavedTickets, saveTickets } from '../utils/concertTicketStore';

const PAGE = 20;
const REFETCH_MS = 60 * 1000;
// Shared across mounts so leaving and re-entering home does not re-fetch.
let lastFetch = { token: null, at: 0 };
// The server read in flight, and every mounted bar waiting for it. Home swaps
// to its skeleton while it loads (right after login especially), which
// unmounts this bar mid-request; the bar that mounts next must still get the
// answer, not skip the fetch as "recent" and keep showing an empty copy.
let inflight = null;
const listeners = new Set();

function refresh(token) {
  const now = Date.now();
  if (lastFetch.token === token && now - lastFetch.at < REFETCH_MS) return;
  if (inflight && inflight.token === token) return;
  const run = (async () => {
    try {
      // All statuses, not just confirmed: a refunded booking must come
      // back so its saved "valid" ticket is overwritten.
      const res = await GetMyConcertBookings({ limit: PAGE, token });
      const { bookings, pagination } = normalizeBookingList(res?.data);
      const complete = (pagination.pages || 1) <= 1;
      await saveTickets(bookings, { complete });
      // Marked fresh only once the copy is saved, so a bar reading it now
      // sees these tickets.
      lastFetch = { token, at: Date.now() };
      // A complete answer is the truth; only a multi-page list keeps the
      // saved rows it did not include.
      const next = complete ? bookings : await loadSavedTickets();
      listeners.forEach(fn => fn(token, next));
    } catch (_) {
      // offline or server trouble: keep what the saved copy showed
    } finally {
      if (inflight && inflight.run === run) inflight = null;
    }
  })();
  inflight = { token, run };
}

/**
 * "Your ticket" bar on the home screen: one tap from launch to the entry QR.
 *
 * Shows nothing unless the user is logged in and holds a usable ticket for a
 * show that has not finished. Draws from the saved copy first (instant, and
 * works at a venue with no signal), then refreshes from the server.
 */
export default function HomeTicketShortcut() {
  const navigation = useNavigation();
  // Every saved/fetched booking; what to show is derived on render so the
  // card switches to "live" as soon as a check-in arrives.
  const [list, setList] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      let myToken = null;
      let gotFresh = false;
      // A fetch started by an earlier (unmounted) bar lands here too.
      const onFresh = (token, next) => {
        if (alive && token === myToken) {
          gotFresh = true;
          setList(next);
        }
      };
      listeners.add(onFresh);
      (async () => {
        const token = await AsyncStorage.getItem('mytoken');
        if (!alive) return;
        myToken = token;
        if (!token) {
          setList([]);
          return;
        }
        const saved = await loadSavedTickets();
        // The server's answer may have landed while the copy was being read.
        if (alive && !gotFresh) setList(saved);
        // Home is visited constantly; one server read a minute is plenty.
        // My tickets and Booking Summary refresh on their own focus.
        if (alive) refresh(token);
      })();
      return () => {
        alive = false;
        listeners.delete(onFresh);
      };
    }, []),
  );

  // Checked in at the gate and the show is on: the live card replaces the QR bar.
  const live = pickLiveTickets(list);
  const active = pickActiveTickets(list);
  if (live.length) return <HomeLiveShowCard booking={live[0]} otherTickets={active} />;

  if (!active.length) return null;
  const next = active[0];
  const more = active.length - 1;
  const t = next.ticket;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => navigation.navigate('ConcertTicketQR', { booking: next })}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={'Show entry QR for ' + (next.concertTitle || 'your concert')}>
        <View style={styles.qrIcon}>
          <Icon name="qr-code" size={24} color="#000000" />
        </View>
        <View style={styles.body}>
          <Text style={styles.kicker}>YOUR TICKET</Text>
          <Text style={styles.title} numberOfLines={1}>
            {next.concertTitle || 'Concert'}
          </Text>
          {next.eventDate ? (
            <Text style={styles.sub} numberOfLines={1}>
              {formatEventShort(next.eventDate)}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Show QR</Text>
            <Icon name="chevron-forward" size={14} color={T.gold} />
          </View>
          <Text style={styles.admits}>Admits {t.remaining}</Text>
        </View>
      </TouchableOpacity>
      {more > 0 ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('ConcertBookings')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.more}>
            + {more} more ticket{more === 1 ? '' : 's'} · See all
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits on the white page between the navy header and the offers carousel.
  wrap: { paddingHorizontal: 15, marginTop: -6, marginBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.surface,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(206,143,82,0.45)',
  },
  qrIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: 12 },
  kicker: { color: T.gold, fontFamily: 'WorkSans-SemiBold', fontSize: 10, letterSpacing: 1 },
  title: { color: T.text, fontFamily: 'WorkSans-SemiBold', fontSize: 14.5, marginTop: 1 },
  sub: { color: T.textMuted, fontFamily: 'WorkSans-Regular', fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end', marginLeft: 8 },
  cta: { flexDirection: 'row', alignItems: 'center' },
  admits: { color: T.textMuted, fontFamily: 'WorkSans-Regular', fontSize: 11.5, marginTop: 4 },
  ctaText: { color: T.gold, fontFamily: 'WorkSans-SemiBold', fontSize: 13, marginRight: 2 },
  more: {
    color: '#021265',
    fontFamily: 'WorkSans-Medium',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
});
