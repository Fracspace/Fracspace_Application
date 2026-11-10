import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BOOKING_THEME as T } from './utils/concertData';
import useBookingStatusBar from './utils/useBookingStatusBar';
import { formatEventShort, formatMoney } from './utils/concertFormat';
import { GetMyConcertBookings, classifyBookingError } from '../../Services/UserApi';
import {
  bookingStatusMeta,
  normalizeBookingList,
} from './utils/concertBookingAdapter';
import ConcertTicketCard from './components/ConcertTicketCard';
import { loadSavedTickets, saveTickets } from './utils/concertTicketStore';

const PAGE_SIZE = 20;

const TONE = {
  good: { fg: '#5FBE89', bg: 'rgba(95,190,137,0.14)' },
  warn: { fg: '#E0A85A', bg: 'rgba(224,168,90,0.14)' },
  bad: { fg: '#E0736A', bg: 'rgba(224,115,106,0.14)' },
  muted: { fg: T.textDim, bg: 'rgba(255,255,255,0.06)' },
};

/**
 * My tickets.
 *
 * Refetched on every focus rather than cached: the server re-checks stale
 * pending rows against PayU while serving this list, so a booking whose
 * callback was lost can come back confirmed here. A cached list would hide
 * exactly the case this screen exists to surface.
 *
 * Confirmed bookings show their entry ticket (QR). Every successful load is
 * also saved on the phone, and when the network fails the saved tickets are
 * shown instead, so the QR opens at a venue with no signal.
 */
export default function ConcertBookings({ navigation }) {
  useBookingStatusBar();

  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  // Showing the saved copy because the last load could not reach the server.
  const [offline, setOffline] = useState(false);

  // Guards a second page request while one is already in flight; onEndReached
  // fires repeatedly as the list settles.
  const fetching = useRef(false);
  // This screen is easy to leave mid-request - it loads on focus, so a quick
  // back tap lands every setState on an unmounted component.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async ({ nextPage = 1, mode = 'initial' } = {}) => {
    if (fetching.current) return;
    fetching.current = true;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'more') setLoadingMore(true);
    // 'silent' is the on-focus reload: it shows no indicator at all, because
    // the list is already on screen and correct until proven otherwise.
    try {
      const token = await AsyncStorage.getItem('mytoken');
      const res = await GetMyConcertBookings({
        page: nextPage,
        limit: PAGE_SIZE,
        token,
      });
      if (!mounted.current) return;
      const data = normalizeBookingList(res?.data);
      // Overwrite the offline copy so a replaced QR is never shown stale.
      saveTickets(data.bookings);
      setRows(prev => {
        // A refresh re-reads page 1 only. Replacing the whole list would throw
        // away the pages the user scrolled to load, so page 1 is merged over
        // them instead and the rest is kept in order.
        const merged =
          nextPage === 1
            ? mode === 'refresh' || mode === 'silent'
              ? data.bookings.concat(
                  prev.filter(
                    r => !data.bookings.some(b => b.bookingId === r.bookingId),
                  ),
                )
              : data.bookings
            : prev.concat(data.bookings);
        // A server that echoes the wrong page, or a list re-sorted between two
        // requests, would otherwise put the same booking in twice and break
        // keyExtractor.
        const seen = {};
        return merged.filter(r => {
          const k = r.bookingId || '';
          if (!k) return true;
          if (seen[k]) return false;
          seen[k] = true;
          return true;
        });
      });
      // The page we asked for, not the page the server says it sent: trusting
      // an echoed 1 for a page-2 request pins the cursor and makes every
      // further scroll re-append the same rows.
      setPage(prev => (nextPage === 1 && prev > 1 ? prev : nextPage));
      setPages(data.pagination.pages || 1);
      setError(null);
      setNeedsLogin(false);
      setOffline(false);
    } catch (err) {
      if (!mounted.current) return;
      const e = classifyBookingError(err);
      // No signal: fall back to the tickets saved on the phone.
      if (e.kind === 'network' && mode !== 'more') {
        const saved = await loadSavedTickets();
        if (!mounted.current) return;
        if (saved.length || mode === 'silent') {
          setOffline(true);
          if (mode !== 'silent') {
            setRows(prev => (prev.length ? prev : saved));
            setError(null);
          }
          return;
        }
      }
      // a failed "load more" must not wipe the rows already on screen
      if (mode !== 'more' && mode !== 'silent') {
        setRows([]);
        setNeedsLogin(e.kind === 'auth');
        setError(
          e.kind === 'auth'
            ? 'Log in to see the tickets you have booked.'
            : e.kind === 'network'
            ? 'Could not reach the server. Check your connection.'
            : e.message || 'Could not load your tickets.',
        );
      }
    } finally {
      fetching.current = false;
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The first focus loads with a spinner; every later one refreshes in place.
  // Using 'initial' every time unmounts the FlatList behind a full-screen
  // spinner, so coming back from a booking lost the scroll position and every
  // page after the first.
  const loadedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const mode = loadedOnce.current ? 'silent' : 'initial';
      loadedOnce.current = true;
      load({ nextPage: 1, mode });
    }, [load]),
  );

  // Back from the background (e.g. after WhatsApp): re-read so a replaced QR
  // or a new entry count shows up without leaving the screen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && loadedOnce.current) load({ nextPage: 1, mode: 'silent' });
    });
    return () => sub.remove();
  }, [load]);

  // "Booking 1 of 2" when one account holds several ticketed bookings for the
  // same show - each payment is its own QR, never merged.
  const positions = useMemo(() => {
    const groups = {};
    rows.forEach(r => {
      if (!r.ticket) return;
      const k = (r.concertId || '') + '|' + (r.eventDate || '');
      (groups[k] = groups[k] || []).push(r);
    });
    const out = {};
    Object.keys(groups).forEach(k => {
      const g = groups[k]
        .slice()
        .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      g.forEach((r, i) => {
        out[r.bookingId] = { index: i + 1, total: g.length };
      });
    });
    return out;
  }, [rows]);

  const openDetail = item =>
    navigation.navigate('ConcertBookingDetail', {
      bookingId: item.bookingId,
      booking: item,
    });

  const openQr = item => navigation.navigate('ConcertTicketQR', { booking: item });

  const onEndReached = () => {
    if (loading || loadingMore || refreshing) return;
    if (page >= pages) return;
    load({ nextPage: page + 1, mode: 'more' });
  };

  const renderRow = ({ item }) => {
    if (item.ticket) {
      return (
        <ConcertTicketCard
          booking={item}
          position={positions[item.bookingId]}
          onPress={() => openDetail(item)}
          onOpenQr={openQr}
        />
      );
    }
    const meta = bookingStatusMeta(item.status);
    const tone = TONE[meta.tone] || TONE.muted;
    const summary = item.items
      .map(i => i.label + ' × ' + i.quantity)
      .join(',  ');
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('ConcertBookingDetail', {
            bookingId: item.bookingId,
            booking: item,
          })
        }
        style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.title} numberOfLines={1}>
            {item.concertTitle || 'Concert'}
          </Text>
          <View style={[styles.pill, { backgroundColor: tone.bg }]}>
            <Text style={[styles.pillText, { color: tone.fg }]}>{meta.label}</Text>
          </View>
        </View>

        {item.city ? (
          <Text style={styles.sub} numberOfLines={1}>
            {[item.venue, item.city].filter(Boolean).join(', ')}
          </Text>
        ) : null}
        {item.eventDate ? (
          <Text style={styles.sub}>{formatEventShort(item.eventDate)}</Text>
        ) : null}

        <View style={styles.cardFoot}>
          <Text style={styles.summary} numberOfLines={1}>
            {summary || item.tickets + ' ticket' + (item.tickets === 1 ? '' : 's')}
          </Text>
          <Text style={styles.amount}>
            {formatMoney(item.totalAmount, item.currency)}
          </Text>
        </View>

        {item.referenceCode ? (
          <Text style={styles.ref}>{item.referenceCode}</Text>
        ) : null}

        {item.canResumePayment ? (
          <View style={styles.resumeRow}>
            <Icon name="alert-circle-outline" size={13} color="#E0A85A" />
            <Text style={styles.resumeText}>Payment not completed — tap to finish</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const empty = !loading && !error && rows.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.circleBtn}>
          <Icon name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My tickets</Text>
        <View style={{ width: 48 }} />
      </View>

      {offline && !loading ? (
        <View style={styles.offline}>
          <Icon name="cloud-offline-outline" size={14} color={T.textMuted} />
          <Text style={styles.offlineText}>
            Offline — showing your saved tickets. QR codes still work.
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={T.gold} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centre}>
          <Icon name="alert-circle-outline" size={28} color={T.textDim} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            onPress={() =>
              needsLogin
                ? navigation.navigate('NewLogin', {
                    redirectAfterLogin: { screen: 'ConcertBookings', params: {} },
                  })
                : load({ nextPage: 1, mode: 'initial' })
            }
            style={styles.retryBtn}>
            <Text style={styles.retryText}>
              {needsLogin ? 'Log in' : 'Try again'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : empty ? (
        <View style={styles.centre}>
          <Icon name="ticket-outline" size={30} color={T.textDim} />
          <Text style={styles.emptyTitle}>No tickets yet</Text>
          <Text style={styles.emptyText}>
            Bookings you make will show up here with your reference code.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => item.bookingId || String(i)}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ nextPage: 1, mode: 'refresh' })}
              tintColor={T.gold}
              colors={[T.gold]}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 18 }}>
                <ActivityIndicator color={T.gold} size="small" />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: T.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: T.text, fontFamily: 'WorkSans-Bold', fontSize: 17 },

  list: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 28 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 22,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  offlineText: { flex: 1, color: T.textMuted, fontFamily: 'WorkSans-Regular', fontSize: 12 },

  card: {
    backgroundColor: T.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: T.text, fontFamily: 'WorkSans-SemiBold', fontSize: 15.5 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontFamily: 'WorkSans-SemiBold', fontSize: 10.5, letterSpacing: 0.3 },

  sub: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12.5,
    marginTop: 4,
  },

  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  summary: { flex: 1, color: T.text, fontFamily: 'WorkSans-Medium', fontSize: 13 },
  amount: { color: T.gold, fontFamily: 'WorkSans-Bold', fontSize: 15 },

  ref: {
    color: T.textDim,
    fontFamily: 'WorkSans-Regular',
    fontSize: 11,
    letterSpacing: 0.4,
    marginTop: 8,
  },

  resumeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  resumeText: { color: '#E0A85A', fontFamily: 'WorkSans-Medium', fontSize: 11.5 },

  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyTitle: {
    color: T.text,
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 16,
    marginTop: 14,
  },
  emptyText: {
    color: T.textMuted,
    fontFamily: 'WorkSans-Regular',
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
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
});
