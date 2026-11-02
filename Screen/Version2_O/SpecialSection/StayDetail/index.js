// Stay Detail (StayDetail.dc.html): hero gallery, suites, amenities, good to
// know, nearby map, Reserve bar with the "Room held" sheet, policy sheet.
import React, {forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {BackHandler, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, fonts, ls} from '../theme';
import {E, LoopGate, Reveal, RevealScope, ViewportGate, cssAngle, useLinger} from '../anim';
import {BackIcon, GlassButton, Grain} from '../HubBits';
import {StarIcon} from '../Stays/icons';
import {CheckIcon, ShareIcon, useLazy, useTo} from './bits';
import Hero, {HERO_H} from './Hero';
import Suites from './Suites';
import Amenities from './Amenities';
import GoodToKnow from './GoodToKnow';
import Nearby from './Nearby';
import BookingBar from './BookingBar';
import PolicySheet from './PolicySheet';
import {markTap, useFirstFrame, useJsFps, useRenderCount} from '../perf';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {booking, inr} from './data';
import {defaultDates, short} from '../StayReview/data';
import {createHold, day, money, releaseBooking, stayTotal, useStayDetail} from '../api/stays';
import {USE_MOCK} from '../api/client';
import {ErrorCard, Skeleton} from '../api/ui';

const CARD = cssAngle(160);
const clamp01 = v => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/** `.mh`: compact header that fades in between 330 and 400px of scroll. */
const MiniHeader = memo(function MiniHeader({scrollY, inset, stay, suiteName, totalLabel, onBack, onShare}) {
  useRenderCount('MiniHeader');
  const [on, setOn] = useState(false);
  useAnimatedReaction(
    () => scrollY.value > 330,
    (now, was) => {
      if (now !== was) {
        runOnJS(setOn)(now);
      }
    },
  );
  const a = useAnimatedStyle(() => {
    const p = clamp01((scrollY.value - 330) / 70);
    return {opacity: p, transform: [{translateY: -8 * (1 - p)}]};
  });
  return (
    <Animated.View pointerEvents={on ? 'box-none' : 'none'} style={[styles.mh, {paddingTop: inset, height: 62 + inset}, a]}>
      <GlassButton size={40} label="Back to stays" onPress={onBack}>
        <BackIcon />
      </GlassButton>
      <View style={styles.mhCopy}>
        <Text style={styles.mhTitle} numberOfLines={1}>
          {stay.name}
        </Text>
        <Text style={styles.mhSub} numberOfLines={1}>
          {suiteName} · ₹{totalLabel}/night
        </Text>
      </View>
      <GlassButton size={40} label="Share stay" onPress={onShare}>
        <ShareIcon size={18} />
      </GlassButton>
    </Animated.View>
  );
});

/** `.toast`: drops in (.5s spring) with opacity .25s; `ref.show()` shows it for 1.8s. */
const Toast = forwardRef(function Toast({top}, ref) {
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState(null);
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);
  useImperativeHandle(ref, () => ({
    // show() = "Link copied"; show(text) = a message (e.g. a failed hold).
    show(text) {
      clearTimeout(t.current);
      setMsg(text || null);
      setShow(true);
      t.current = setTimeout(() => setShow(false), text ? 3200 : 1800);
    },
  }));
  const y = useTo(show ? 0 : -20, 500, E.spring);
  const o = useTo(show ? 1 : 0, 250);
  const a = useAnimatedStyle(() => ({opacity: o.value, transform: [{translateY: y.value}]}));
  return (
    <View pointerEvents="none" style={[styles.toastRow, {top}]}>
      <Animated.View accessibilityLiveRegion="polite" style={[styles.toast, a]}>
        {msg ? null : <CheckIcon color={colors.ink} />}
        <Text style={styles.toastText}>{msg || 'Link copied'}</Text>
      </Animated.View>
    </View>
  );
});

/** The scrolling page; memoised so the Reserve bar and sheets don't re-render it. */
const ABOUT_LINES = 4;

/**
 * The description, cut to ABOUT_LINES with "Read more". A hidden full copy
 * counts the lines, so the toggle shows only when the text is longer.
 */
function About({text}) {
  const [lines, setLines] = useState(0);
  const [open, setOpen] = useState(false);
  const long = lines > ABOUT_LINES;
  return (
    <View>
      <Text
        style={[styles.about, styles.measure]}
        onTextLayout={e => setLines(e.nativeEvent.lines.length)}
        accessible={false}
        importantForAccessibility="no">
        {text}
      </Text>
      <Text style={styles.about} numberOfLines={open ? undefined : ABOUT_LINES}>
        {text}
      </Text>
      {long ? (
        <Text
          style={styles.more}
          onPress={() => setOpen(o => !o)}
          suppressHighlighting
          accessibilityRole="button"
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          {open ? 'Show less' : 'Read more'}
        </Text>
      ) : null}
    </View>
  );
}

const Page = memo(function Page({scrollY, contentRef, height, stage, stay, suite, top, barBottom, onBack, onShare, onPickSuite, onOpenPolicy}) {
  useRenderCount('Page');
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });
  return (
    <RevealScope scrollY={scrollY} contentRef={contentRef} viewportH={height}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
        <View ref={contentRef} collapsable={false}>
          <Hero gallery={stay.gallery} tour={stay.tour} scrollY={scrollY} top={top} onBack={onBack} onShare={onShare} />
          <View style={[styles.body, {paddingBottom: 150 + barBottom - 14}]}>
            <Reveal style={styles.titleBlock}>
              <Text style={styles.h1}>{stay.name}</Text>
              <View style={styles.rateRow}>
                {stay.rate ? (
                  <>
                    <StarIcon size={15} color="#F1A23B" />
                    <Text style={styles.rate}>{stay.rate}</Text>
                  </>
                ) : null}
                <Text style={styles.addr}>{stay.address}</Text>
              </View>
            </Reveal>
            {stay.about ? (
              <Reveal style={styles.cardWrap}>
                <LinearGradient colors={['#17161A', '#111114']} start={CARD.start} end={CARD.end} style={styles.card}>
                  <Text style={styles.aboutTitle}>About the {stay.short}</Text>
                  <About text={stay.about} />
                </LinearGradient>
              </Reveal>
            ) : null}
            {stay.suites.length ? (
              <ViewportGate>
                <Suites suites={stay.suites} suite={suite} onPick={onPickSuite} />
              </ViewportGate>
            ) : null}
            {stage >= 1 && stay.amenities.count ? (
              <ViewportGate>
                <Amenities amenities={stay.amenities} />
              </ViewportGate>
            ) : null}
            {stage >= 2 ? (
              <ViewportGate>
                <GoodToKnow
                  checkIn={stay.checkIn}
                  checkOut={stay.checkOut}
                  policy={stay.policy}
                  onOpenPolicy={onOpenPolicy}
                />
              </ViewportGate>
            ) : null}
            {stage >= 3 && stay.places.length ? (
              <ViewportGate>
                <Nearby stay={stay} />
              </ViewportGate>
            ) : null}
          </View>
        </View>
      </Animated.ScrollView>
    </RevealScope>
  );
});

/**
 * Mounts the sections below the fold one per frame after the first paint, so
 * opening Stay Detail paints the hero, suites and Reserve bar first.
 */
const DEFERRED = 3;
function useStage() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= DEFERRED) {
      return;
    }
    const id = requestAnimationFrame(() => setStage(stage + 1));
    return () => cancelAnimationFrame(id);
  }, [stage]);
  return stage;
}

export default function StayDetail({navigation, route}) {
  const stayId = route?.params?.stayId;
  const q = useStayDetail(stayId);
  const stay = q.data;
  const {height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  useRenderCount('StayDetail');
  useFirstFrame('StayDetail');
  useJsFps('StayDetail', isFocused);

  const [suitePick, setSuite] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [sheet, setSheet] = useState(false);
  const [policy, setPolicy] = useState(false);
  const [policyMounted, policyShown] = useLazy(policy);
  // The page's loops pause once the policy sheet has slid over it (.6s).
  const uncovered = useLinger(!policy, 600);
  const stage = useStage();
  const t1 = useRef(null);
  const toast = useRef(null);
  useEffect(() => () => clearTimeout(t1.current), []);

  const contentRef = useRef(null);
  const scrollY = useSharedValue(0);

  // The guest's pick, else the suite the stay highlights, else the first.
  const cur = useMemo(() => {
    const list = stay?.suites || [];
    return list.find(s => s.id === suitePick) || list.find(s => s.badge) || list[0] || null;
  }, [stay, suitePick]);
  const suite = cur?.id;
  const total = cur ? stayTotal(stay, cur) : 0;
  const totalLabel = inr(total);

  const back = useCallback(
    () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Stays')),
    [navigation],
  );
  const share = useCallback(() => toast.current?.show(), []);
  // The room held by Reserve (POST /holds). Released if the guest picks another
  // suite or leaves without continuing; Review Booking owns it once opened.
  const [held, setHeld] = useState(null);
  const heldRef = useRef(null);
  heldRef.current = held;
  const handedOff = useRef(false);
  const drop = useCallback(() => {
    if (heldRef.current) {
      releaseBooking(heldRef.current.bookingId).catch(() => {});
      setHeld(null);
    }
  }, []);
  useEffect(
    () => () => {
      if (!handedOff.current && heldRef.current) {
        releaseBooking(heldRef.current.bookingId).catch(() => {});
      }
    },
    [],
  );
  // Back from Review (which released the hold): start over from Reserve.
  useEffect(() => {
    if (isFocused && handedOff.current) {
      handedOff.current = false;
      setHeld(null);
      setPhase('idle');
      setSheet(false);
    }
  }, [isFocused]);

  const pickSuite = useCallback(
    id => {
      clearTimeout(t1.current);
      drop();
      setSuite(id);
      setPhase('idle');
      setSheet(false);
    },
    [drop],
  );
  const reserve = useCallback(async () => {
    if (phase === 'loading') {
      return;
    }
    if (phase === 'done') {
      setSheet(true);
      return;
    }
    setPhase('loading');
    if (USE_MOCK.stays) {
      t1.current = setTimeout(() => {
        setPhase('done');
        setSheet(true);
      }, 1200);
      return;
    }
    try {
      const {cin, cout} = defaultDates();
      const couponCode = await AsyncStorage.getItem('ss:coupon').catch(() => null);
      const res = await createHold({propertyId: stay.id, roomTypeId: cur.id, cin, cout, adults: 1, couponCode});
      setHeld(res.booking);
      setPhase('done');
      setSheet(true);
    } catch (e) {
      setPhase('idle');
      toast.current?.show(e.message);
      if (e.status === 409) {
        q.refresh(); // sold out: reload the suites
      }
    }
  }, [phase, stay, cur, q]);
  const closeSheet = useCallback(() => setSheet(false), []);
  const openPolicy = useCallback(() => setPolicy(true), []);
  const closePolicy = useCallback(() => setPolicy(false), []);
  const pay = useCallback(
    () => {
      markTap('StayReview');
      handedOff.current = !!held;
      navigation.navigate('StayReview', {
        stayId,
        suiteId: cur.id,
        suiteName: cur.name,
        price: cur.price,
        total,
        dates: booking.dates,
        guests: booking.guests,
        // For Review Booking's API step: the property and room as loaded here.
        propertyId: stay.id,
        stay: {name: stay.name, short: stay.short, rate: stay.rate, address: stay.address, taxPct: stay.taxPct},
        suite: {id: cur.id, name: cur.name, spec: cur.spec, price: cur.price, img: cur.img, maxAdults: cur.maxAdults, maxChildren: cur.maxChildren},
        booking: held,
      });
    },
    [navigation, stayId, stay, cur, total, held],
  );
  const sheetSub = held
    ? `${short(day(held.checkIn))} – ${short(day(held.checkOut))} · ${held.adults} guest${held.adults > 1 ? 's' : ''} · ₹${money(
        held.pricing?.total,
      )} incl. taxes`
    : `${booking.dates} · ${booking.guests} guest · ₹${totalLabel} incl. taxes`;

  // A stay that no longer exists (404) goes back to the listing.
  const gone = q.error?.status === 404;
  useEffect(() => {
    if (gone) {
      back();
    }
  }, [gone, back]);

  // Android back closes the policy, then the sheet, before leaving the screen.
  // Only while focused: the sheet stays open under Review Booking.
  useEffect(() => {
    if (!isFocused || (!policy && !sheet)) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (policy) {
        setPolicy(false);
      } else {
        setSheet(false);
      }
      return true;
    });
    return () => sub.remove();
  }, [isFocused, policy, sheet]);

  const top = Math.max(20, insets.top + 8);
  const barBottom = Math.max(14, insets.bottom - 18);

  if (!stay) {
    return (
      <View style={styles.page}>
        {q.error ? (
          <ErrorCard message={q.error.message} onRetry={q.refresh} style={{marginTop: top + 64}} />
        ) : (
          <>
            <Skeleton style={styles.skHero} />
            <View style={styles.body}>
              <Skeleton style={styles.skTitle} />
              <Skeleton style={styles.skCard} />
              <Skeleton style={styles.skCard} />
            </View>
          </>
        )}
        <GlassButton label="Back to stays" onPress={back} style={[styles.skBack, {top}]}>
          <BackIcon />
        </GlassButton>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <LoopGate active={isFocused && uncovered}>
        <Page
          scrollY={scrollY}
          contentRef={contentRef}
          height={height}
          stage={stage}
          stay={stay}
          suite={suite}
          top={top}
          barBottom={barBottom}
          onBack={back}
          onShare={share}
          onPickSuite={pickSuite}
          onOpenPolicy={openPolicy}
        />
        <MiniHeader
          scrollY={scrollY}
          inset={insets.top}
          stay={stay}
          suiteName={cur?.name || ''}
          totalLabel={totalLabel}
          onBack={back}
          onShare={share}
        />
        {cur ? (
          <BookingBar
            bottom={barBottom}
            phase={phase}
            sheet={sheet}
            sheetSub={sheetSub}
            suiteName={cur.name}
            stayShort={stay.short}
            totalLabel={totalLabel}
            onReserve={reserve}
            onCloseSheet={closeSheet}
            onPay={pay}
          />
        ) : null}
        {policyMounted ? (
          <PolicySheet
            open={policyShown}
            onClose={closePolicy}
            stayName={stay.name}
            checkIn={stay.checkIn}
            policy={stay.policy}
            insets={insets}
          />
        ) : null}
        <Toast ref={toast} top={top + 56} />
        <Grain opacity={0.07} />
      </LoopGate>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: colors.ground},
  body: {paddingTop: 22, paddingHorizontal: 20, backgroundColor: colors.ground},
  skHero: {height: HERO_H, borderRadius: 0},
  skTitle: {height: 56, marginBottom: 20},
  skCard: {height: 150, marginBottom: 14},
  skBack: {position: 'absolute', left: 20},
  titleBlock: {gap: 8},
  h1: {fontFamily: fonts.bold, fontSize: 22, letterSpacing: ls(-0.01, 22), color: '#fff'},
  rateRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  rate: {fontFamily: fonts.bold, fontSize: 13, color: '#fff'},
  addr: {fontFamily: fonts.regular, fontSize: 13, color: colors.muted, flexShrink: 1},
  cardWrap: {marginTop: 20},
  card: {padding: 18, borderRadius: 24, borderWidth: 1, borderColor: colors.borderStrong},
  aboutTitle: {fontFamily: fonts.bold, fontSize: 17, color: '#fff', marginBottom: 8},
  about: {fontFamily: fonts.regular, fontSize: 13, lineHeight: 13 * 1.65, color: colors.soft},
  measure: {position: 'absolute', left: 0, right: 0, opacity: 0},
  more: {alignSelf: 'flex-start', marginTop: 8, fontFamily: fonts.bold, fontSize: 13, color: colors.gold},
  mh: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(10,10,12,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    zIndex: 30,
  },
  mhCopy: {flex: 1, minWidth: 0},
  mhTitle: {fontFamily: fonts.bold, fontSize: 14, color: colors.cream},
  mhSub: {fontFamily: fonts.regular, fontSize: 11, color: colors.muted},
  toastRow: {position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50, elevation: 50},
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.gold,
  },
  toastText: {fontFamily: fonts.bold, fontSize: 13, color: colors.ink},
});
