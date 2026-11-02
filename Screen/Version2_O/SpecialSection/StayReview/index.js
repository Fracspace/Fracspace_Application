// Section 4 · Review Booking + success (StayReview.dc.html). Opened from Stay
// Detail's "Proceed to pay"; back returns there, "Back to Home" opens the Home
// tab. Payment is mocked (Proceed → 1.2s processing → confirm animation →
// success) until stays have a booking API; see `mockReceipt`.
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BackHandler, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {Easing, useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Path} from 'react-native-svg';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, fonts, ls} from '../theme';
import {E, LoopGate, PressScale, useLoop, useReducedMotion} from '../anim';
import {BackIcon, GlassButton, Grain} from '../HubBits';
import {StarIcon} from '../Stays/icons';
import {Odo, Sweep, useLazy, useShot, useTo} from '../StayDetail/bits';
import Calendar from './Calendar';
import Confirming, {CONFIRM_MS} from './Confirming';
import Success from './Success';
import {useFirstFrame, useJsFps, useRenderCount} from '../perf';
import {day, MAX_ROOMS, money, paymentResult, paymentStatus, roomsFor, toReceipt} from '../api/stays';
import {openPayU} from './payu';
import {errText} from '../api/client';
import {clock, useHold} from './useHold';
import {
  CHECK_IN,
  CHECK_OUT,
  MAX_ADULTS,
  MAX_KIDS,
  TAX,
  cancellation,
  defaultDates,
  inr,
  mockReceipt,
  nightsBetween,
  paidLabel,
  plural,
  reviewFor,
  short,
  today as todayDate,
} from './data';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const POLL_MS = 120000; // keep checking a pending payment for 2 minutes
const wait = ms => new Promise(r => setTimeout(r, ms));
// payment-result answers with `next`; payment-status may only carry the booking.
const NEXT = {confirmed: 'confirmed', payment_failed: 'failed', expired: 'expired', cancelled: 'cancelled'};
const nextOf = r => r?.next || NEXT[r?.booking?.status || r?.status] || 'pending';
const COUNTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const MUTED = '#ADA597';

/** `.stg > *`: rise (.7s --out) staggered 40 / 120 / 200 / 280 / 360ms. */
function Stage({t, i, style, children}) {
  const delay = 40 + 80 * i;
  const a = useAnimatedStyle(() => {
    const p = E.out(Math.min(1, Math.max(0, (t.value - delay) / 700)));
    return {opacity: p, transform: [{translateY: 16 * (1 - p)}]};
  });
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

function EditIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 20h4L19 9l-4-4L4 16z" />
    </Svg>
  );
}

function GoIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

/** `.dval`: dpop / dpop2 (rise 6px, .45s spring) every time dates are applied. */
function DateVal({flip, children}) {
  const p = useShot(flip + 1, 450);
  const a = useAnimatedStyle(() => {
    const e = E.spring(p.value);
    return {opacity: Math.min(1, e), transform: [{translateY: 6 * (1 - e)}]};
  });
  return <Animated.Text style={[styles.dval, a]}>{children}</Animated.Text>;
}

/** `.sb`: press .8 (.3s spring), disabled opacity .3 (.2s). */
function StepBtn({label, onPress, disabled, children}) {
  const o = useTo(disabled ? 0.3 : 1, 200);
  const a = useAnimatedStyle(() => ({opacity: o.value}));
  return (
    <Animated.View style={a}>
      <PressScale to={0.8} duration={300} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={styles.sb}>
        <Text style={styles.sbT}>{children}</Text>
      </PressScale>
    </Animated.View>
  );
}

function Stepper({title, sub, value, min, max, onDec, onInc, noun}) {
  return (
    <View style={styles.grow}>
      <View style={styles.growCopy}>
        <Text style={styles.growT}>{title}</Text>
        <Text style={styles.small}>{sub}</Text>
      </View>
      <View style={styles.step}>
        <StepBtn label={`Fewer ${noun}`} onPress={onDec} disabled={value <= min}>
          −
        </StepBtn>
        <View style={styles.sn} accessibilityLiveRegion="polite" accessibilityLabel={String(value)}>
          <Odo index={value} h={22} items={COUNTS.slice(0, max + 1)} duration={500} textStyle={styles.snT} />
        </View>
        <StepBtn label={`More ${noun}`} onPress={onInc} disabled={value >= max}>
          +
        </StepBtn>
      </View>
    </View>
  );
}

/** `.num`: the total as odometer digit columns (.5s spring), commas static. */
const Total = memo(function Total({label}) {
  useRenderCount('Total');
  const chars = label.split('');
  return (
    <View style={styles.num} accessibilityLabel={`₹${label}`}>
      <Text style={styles.numT}>₹</Text>
      {chars.map((ch, i) => {
        const key = chars.length - i;
        return ch === ',' || ch === '.' ? (
          <Text key={`c${key}`} style={styles.numT}>
            {ch}
          </Text>
        ) : (
          <Odo key={`d${key}`} index={Number(ch)} h={28} items={DIGITS} duration={500} textStyle={styles.numT} />
        );
      })}
    </View>
  );
});

function Spinner() {
  const p = useLoop(700);
  const a = useAnimatedStyle(() => ({transform: [{rotate: `${360 * p.value}deg`}]}));
  return <Animated.View style={[styles.spin, a]} />;
}

export default function StayReview({navigation, route}) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const reduced = useReducedMotion();
  useRenderCount('StayReview');
  useFirstFrame('StayReview');
  useJsFps('StayReview', isFocused);
  const params = route?.params;
  const review = useMemo(() => reviewFor(params), [params]);
  const today = useMemo(todayDate, []);
  // Mock mode: the search's dates and guests when Stays passed them.
  const first = useMemo(
    () => {
      const d = defaultDates();
      const trip = params?.trip;
      return trip && day(trip.checkIn) >= d.cin ? {cin: day(trip.checkIn), cout: day(trip.checkOut)} : d;
    },
    [params],
  );

  // Live: the hold from Stay Detail's Reserve; the server prices every change.
  const hold = useHold(params?.booking || null);
  const hs = hold.state;
  const live = hold.live && !!hs;
  // Per room; more guests take more rooms of the same type (up to MAX_ROOMS).
  const perRoom = useMemo(
    () => ({maxAdults: review.maxAdults || MAX_ADULTS, maxChildren: review.maxKids ?? MAX_KIDS}),
    [review],
  );
  const maxAdults = live ? perRoom.maxAdults * MAX_ROOMS : perRoom.maxAdults;
  const maxKids = live ? perRoom.maxChildren * MAX_ROOMS : perRoom.maxChildren;
  const [cin, setCin] = useState(hs ? hs.cin : first.cin);
  const [cout, setCout] = useState(hs ? hs.cout : first.cout);
  const [adults, setAdults] = useState(hs ? hs.adults : Math.min(maxAdults, params?.trip?.adults || review.adults));
  const [kids, setKids] = useState(hs ? hs.children : Math.min(maxKids, params?.trip?.children || 0));
  const rooms = live ? roomsFor(adults, kids, perRoom) : 1;
  const [notice, setNotice] = useState(null);
  const [code, setCode] = useState(hs?.offerCode || '');
  const [flip, setFlip] = useState(0);
  const [cal, setCal] = useState(false);
  const [view, setView] = useState(new Date(first.cin.getFullYear(), first.cin.getMonth(), 1));
  const [pin, setPin] = useState(null);
  const [pout, setPout] = useState(null);
  // Read by `pick` so it stays the same function and the day cells keep their memo.
  const range = useRef({pin, pout});
  range.current = {pin, pout};
  const [calMounted, calOpen] = useLazy(cal);
  const [phase, setPhase] = useState('idle'); // idle | busy | anim | done
  const [paid, setPaid] = useState(null);
  // Confirming and Success take ~0.6s each to build: both mount hidden during
  // "Processing…" (Success a frame later) so neither starts on a frozen frame.
  const [prep, setPrep] = useState(false);
  useEffect(() => {
    if (phase !== 'busy') {
      return;
    }
    const id = requestAnimationFrame(() => setPrep(true));
    return () => cancelAnimationFrame(id);
  }, [phase]);
  // The page's sweep stops once an overlay covers it (Confirming fades in over 300ms).
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    if (phase !== 'anim') {
      return;
    }
    const id = setTimeout(() => setCovered(true), 300);
    return () => clearTimeout(id);
  }, [phase]);
  const t1 = useRef(null);
  const t2 = useRef(null);
  useEffect(() => () => {
    clearTimeout(t1.current);
    clearTimeout(t2.current);
  }, []);

  // Mount clock for the `.stg` stagger.
  const t = useSharedValue(reduced ? 1100 : 0);
  useEffect(() => {
    if (!reduced) {
      t.value = withTiming(1100, {duration: 1100, easing: Easing.linear});
    }
  }, [reduced, t]);

  // A date / guest change is sent to the server after a short pause; if it is
  // refused (sold out, too many guests) the trip goes back to what is held.
  const {patch} = hold;
  useEffect(() => {
    if (!live) {
      return;
    }
    const same =
      cin.getTime() === hs.cin.getTime() &&
      cout.getTime() === hs.cout.getTime() &&
      adults === hs.adults &&
      kids === hs.children &&
      rooms === hs.rooms;
    if (same) {
      return;
    }
    const id = setTimeout(() => {
      patch({cin, cout, rooms, adults, children: kids})
        .then(next => {
          setNotice(null);
          setCin(next.cin);
          setCout(next.cout);
          setAdults(next.adults);
          setKids(next.children);
        })
        .catch(e => {
          setNotice(errText(e));
          setCin(hs.cin);
          setCout(hs.cout);
          setAdults(hs.adults);
          setKids(hs.children);
        });
    }, 450);
    return () => clearTimeout(id);
  }, [live, hs, cin, cout, rooms, adults, kids, patch]);

  // A coupon claimed on the Stays listing fills the field.
  useEffect(() => {
    if (live && !hs.offerCode) {
      AsyncStorage.getItem('ss:coupon')
        .then(c => c && setCode(x => x || c))
        .catch(() => {});
    }
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const couponOn = live && hs.discount > 0;
  const applyCoupon = useCallback(() => {
    const c = code.trim().toUpperCase();
    if (!c) {
      return;
    }
    patch({couponCode: c})
      .then(() => setNotice(null))
      .catch(e => setNotice(errText(e)));
  }, [code, patch]);
  const removeCoupon = useCallback(() => {
    setCode('');
    AsyncStorage.removeItem('ss:coupon').catch(() => {});
    patch({couponCode: null}).catch(e => setNotice(errText(e)));
  }, [patch]);
  const walletOn = live && hs.walletAmount > 0;
  const toggleWallet = useCallback(
    on => patch({useWallet: on}).catch(e => setNotice(errText(e))),
    [patch],
  );

  // Leaving Review without paying (back button, gesture) frees the room at once.
  const {release} = hold;
  useEffect(() => navigation.addListener('beforeRemove', release), [navigation, release]);

  // The hold ran out: say so, then go back to Stay Detail to reserve again.
  useEffect(() => {
    if (!hold.expired) {
      return;
    }
    setNotice('Your hold expired. Reserve the room again to continue.');
    const id = setTimeout(() => navigation.goBack(), 2500);
    return () => clearTimeout(id);
  }, [hold.expired, navigation]);

  const localNights = Math.max(1, nightsBetween(cin, cout));
  const nights = live ? hs.nights : localNights;
  const room = review.price * nights;
  const tax = Math.round(room * TAX);
  const totalLabel = live ? money(hs.total) : inr(room + tax);
  const payLabel = live ? money(hs.payable) : totalLabel;
  const nightsLabel = plural(nights, 'night', 'nights');
  const roomsLabel = rooms > 1 ? ` · ${rooms} rooms` : '';
  const guestLabel = plural(adults + kids, 'guest', 'guests') + roomsLabel;
  const guestFull = plural(adults, 'adult', 'adults') + (kids ? ` · ${plural(kids, 'child', 'children')}` : '') + roomsLabel;
  const cxl = live && hs.cancel?.text
    ? {free: hs.cancel.free, color: hs.cancel.free ? '#4ADE80' : '#F87171', text: hs.cancel.text}
    : cancellation(cin);
  const inLabel = (live && hs.checkInLabel) || CHECK_IN;
  const outLabel = (live && hs.checkOutLabel) || CHECK_OUT;

  const back = useCallback(() => navigation.goBack(), [navigation]);
  const home = useCallback(() => {
    navigation.popToTop();
    navigation.navigate('HomeStack', {screen: 'HomePage'});
  }, [navigation]);

  const openCal = useCallback(() => {
    setPin(cin);
    setPout(cout);
    setView(new Date(cin.getFullYear(), cin.getMonth(), 1));
    setCal(true);
  }, [cin, cout]);
  const closeCal = useCallback(() => setCal(false), []);
  const pick = useCallback(d => {
    const {pin: from, pout: to} = range.current;
    if (!from || to || d <= from) {
      setPin(d);
      setPout(null);
    } else {
      setPout(d);
    }
  }, []);
  const prevMonth = useCallback(() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1)), []);
  const nextMonth = useCallback(() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1)), []);
  const apply = useCallback(() => {
    if (pin && pout) {
      setCin(pin);
      setCout(pout);
      setCal(false);
      setFlip(f => f + 1);
    }
  }, [pin, pout]);

  // After the PayU checkout: `wait` = still confirming (a tap re-checks),
  // `closed` = cancelled meanwhile (nothing left to pay).
  const after = useRef(null);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);
  const paidOk = useCallback(b => {
    setNotice(null);
    setPaid(toReceipt(b));
    setPhase('anim');
    t2.current = setTimeout(() => setPhase('done'), CONFIRM_MS);
  }, []);
  // The server's word on the payment, polled while it is pending (UPI can be slow).
  const outcome = useCallback(
    async (start, event) => {
      let r = start;
      const until = Date.now() + POLL_MS;
      while (nextOf(r) === 'pending' && Date.now() < until && mounted.current) {
        setNotice('Confirming your payment…');
        await wait(r.pollAfterMs || 3000);
        r = await paymentStatus(hold.id).catch(() => r); // a network blip: keep waiting
      }
      if (!mounted.current) {
        return;
      }
      const next = nextOf(r);
      if (next === 'confirmed') {
        hold.settle(true);
        after.current = null;
        paidOk(r.booking);
        return;
      }
      setPhase('idle');
      if (next === 'pending') {
        hold.settle(true);
        after.current = 'wait';
        setNotice("We'll notify you once your payment is confirmed. Tap Proceed to pay to check again.");
      } else if (next === 'expired') {
        hold.expire();
      } else if (next === 'cancelled') {
        hold.settle(true);
        after.current = 'closed';
        setNotice('This booking was cancelled. Check My bookings for details.');
      } else {
        hold.settle(false);
        setNotice(
          event === 'onPaymentCancel'
            ? 'Payment cancelled. Tap Proceed to pay to try again.'
            : "Payment didn't go through. Tap Proceed to pay to try again.",
        );
      }
    },
    [hold, paidOk],
  );

  const pay = useCallback(() => {
    if (phase !== 'idle' || hold.expired || hold.busy || after.current === 'closed') {
      return;
    }
    setPhase('busy');
    if (live) {
      setNotice(null);
      if (after.current === 'wait') {
        paymentStatus(hold.id)
          .then(r => outcome(r))
          .catch(e => {
            setPhase('idle');
            setNotice(errText(e));
          });
        return;
      }
      hold
        .pay(walletOn)
        .then(async res => {
          if (!res.requiresPayment) {
            paidOk(res.booking);
            return;
          }
          const {attemptId} = res.payment;
          const result = await openPayU(res.payment);
          // Always reported, success or not; the server asks PayU itself.
          const r = await paymentResult(hold.id, attemptId, result).catch(e =>
            e.status === 410 ? {next: 'expired'} : {next: 'pending'},
          );
          await outcome(r, result.event);
        })
        .catch(e => {
          setPhase('idle');
          setNotice(errText(e));
          if (e.errors?.useWallet) {
            patch({useWallet: false}).catch(() => {}); // balance changed: redraw the amount
          }
        });
      return;
    }
    setPaid({at: paidLabel(new Date()), ...mockReceipt()});
    t1.current = setTimeout(() => {
      setPhase('anim');
      t2.current = setTimeout(() => setPhase('done'), CONFIRM_MS);
    }, 1200);
  }, [phase, live, hold, walletOn, patch, paidOk, outcome]);

  // Android back: closes the calendar, waits out the payment, leaves success for Home.
  useEffect(() => {
    if (!cal && phase === 'idle') {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (cal) {
        setCal(false);
      } else if (phase === 'done') {
        home();
      }
      return true;
    });
    return () => sub.remove();
  }, [cal, phase, home]);

  const busy = phase === 'busy';
  const bottom = Math.max(16, insets.bottom);

  return (
    <View style={styles.page}>
      <LoopGate active={isFocused}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.stg, {paddingTop: 16 + insets.top, paddingBottom: 130 + bottom - 16}]}>
          <Stage t={t} i={0} style={styles.top}>
            <GlassButton label="Back to stay details" onPress={back} style={styles.gbtn}>
              <BackIcon />
            </GlassButton>
            <Text style={styles.h1}>Review booking</Text>
            {live && hold.left != null ? (
              <View style={[styles.held, hold.left < 60 && styles.heldLow]} accessibilityLabel={`Room held for ${clock(hold.left)}`}>
                <Text style={[styles.heldT, hold.left < 60 && styles.heldTLow]}>{`Held · ${clock(hold.left)}`}</Text>
              </View>
            ) : null}
          </Stage>

          <Stage t={t} i={1} style={[styles.card, styles.stay]}>
            <Image source={review.img} style={styles.stayImg} accessibilityLabel={`${review.room} at ${review.short}`} />
            <View style={styles.stayCopy}>
              <Text style={styles.stayName}>{review.name}</Text>
              <Text style={styles.small12}>{review.room}</Text>
              <View style={styles.rateRow}>
                <StarIcon size={12} color="#F1A23B" />
                <Text style={styles.rateT}>
                  <Text style={styles.rateB}>{review.rate}</Text>
                  {` · ${review.place}`}
                </Text>
              </View>
            </View>
          </Stage>

          <Stage t={t} i={2} style={[styles.card, styles.clip]}>
            <View style={styles.tripHead}>
              <Text style={styles.cap}>YOUR TRIP</Text>
              <PressScale to={0.96} onPress={openCal} accessibilityRole="button" style={styles.edit}>
                <Text style={styles.editT}>Edit dates</Text>
                <EditIcon />
              </PressScale>
            </View>
            <Pressable
              onPress={openCal}
              accessibilityRole="button"
              accessibilityLabel={`Change dates, ${short(cin)} to ${short(cout)}`}
              style={styles.drow}>
              <View style={styles.dcol}>
                <Text style={styles.small}>Check-in</Text>
                <DateVal flip={flip}>{short(cin)}</DateVal>
                <Text style={styles.small}>{`from ${inLabel}`}</Text>
              </View>
              <View style={styles.nights}>
                <Text style={styles.nightsT}>{nightsLabel}</Text>
              </View>
              <View style={[styles.dcol, styles.dcolR]}>
                <Text style={styles.small}>Check-out</Text>
                <DateVal flip={flip}>{short(cout)}</DateVal>
                <Text style={styles.small}>{`by ${outLabel}`}</Text>
              </View>
            </Pressable>
            <Stepper
              title="Adults"
              sub={live ? `Age 13+ · ${perRoom.maxAdults} per room` : 'Age 13+'}
              noun="adults"
              value={adults}
              min={1}
              max={maxAdults}
              onDec={() => setAdults(a => Math.max(1, a - 1))}
              onInc={() => setAdults(a => Math.min(maxAdults, a + 1))}
            />
            <Stepper
              title="Children"
              sub={live && perRoom.maxChildren ? `Age 2–12 · ${perRoom.maxChildren} per room` : 'Age 2–12'}
              noun="children"
              value={kids}
              min={0}
              max={maxKids}
              onDec={() => setKids(k => Math.max(0, k - 1))}
              onInc={() => setKids(k => Math.min(maxKids, k + 1))}
            />
          </Stage>

          <Stage t={t} i={3} style={[styles.card, styles.price]}>
            <Text style={styles.cap}>{hold.busy ? 'PRICE BREAKDOWN · UPDATING…' : 'PRICE BREAKDOWN'}</Text>
            <View style={styles.prow}>
              <Text style={styles.prowK}>
                {`₹${live ? money(hs.rate) : inr(review.price)} × ${rooms > 1 ? `${rooms} rooms × ` : ''}${nightsLabel}`}
              </Text>
              <Text style={styles.prowV}>{`₹${live ? money(hs.roomTotal) : inr(room)}`}</Text>
            </View>
            {live && hs.extras > 0 ? (
              <View style={styles.prow}>
                <Text style={styles.prowK}>Extra guests</Text>
                <Text style={styles.prowV}>{`₹${money(hs.extras)}`}</Text>
              </View>
            ) : null}
            {couponOn ? (
              <View style={styles.prow}>
                <Text style={styles.prowK}>{`Coupon ${hs.offerCode || ''}`}</Text>
                <Text style={[styles.prowV, styles.green]}>{`−₹${money(hs.discount)}`}</Text>
              </View>
            ) : null}
            <View style={styles.prow}>
              <Text style={styles.prowK}>{live ? hs.taxLabel : 'Taxes & fees (5%)'}</Text>
              <Text style={styles.prowV}>{`₹${live ? money(hs.tax) : inr(tax)}`}</Text>
            </View>
            <View style={styles.rule} />
            <View style={styles.totalRow}>
              <Text style={styles.totalK}>Total</Text>
              <Total label={totalLabel} />
            </View>
            {walletOn ? (
              <View style={styles.prow}>
                <Text style={styles.prowK}>Paid from wallet</Text>
                <Text style={[styles.prowV, styles.green]}>{`−₹${money(hs.walletAmount)}`}</Text>
              </View>
            ) : null}
            <Text style={styles.small115}>{`${guestLabel} · ${nightsLabel}`}</Text>
          </Stage>

          {live ? (
            <Stage t={t} i={4} style={[styles.card, styles.price]}>
              <Text style={styles.cap}>COUPON</Text>
              <View style={styles.cRow}>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  editable={!couponOn}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="Enter coupon code"
                  placeholderTextColor={MUTED}
                  returnKeyType="done"
                  onSubmitEditing={applyCoupon}
                  style={styles.cInput}
                />
                <PressScale
                  to={0.95}
                  onPress={couponOn ? removeCoupon : applyCoupon}
                  accessibilityRole="button"
                  style={[styles.cBtn, couponOn && styles.cBtnOff]}>
                  <Text style={[styles.cBtnT, couponOn && styles.cBtnTOff]}>{couponOn ? 'Remove' : 'Apply'}</Text>
                </PressScale>
              </View>
              {couponOn ? (
                <Text style={[styles.small12, styles.green]}>{`Applied · you save ₹${money(hs.discount)}`}</Text>
              ) : hs.offer?.code && !hs.offer.applied && hs.offer.reason ? (
                <Text style={[styles.small12, styles.red]}>{hs.offer.reason}</Text>
              ) : null}
            </Stage>
          ) : null}

          {live && hs.wallet?.available && hs.wallet.balance > 0 ? (
            <Stage t={t} i={4} style={styles.card}>
              {/* The whole card toggles: on iOS a UISwitch inside the scroll view
                  misses quick taps (only drags flip it), so the switch only shows the state. */}
              <Pressable
                onPress={() => toggleWallet(!walletOn)}
                disabled={hold.busy}
                accessibilityRole="switch"
                accessibilityState={{checked: walletOn, disabled: hold.busy}}
                accessibilityLabel="Pay from wallet"
                style={styles.wallet}>
                <View style={styles.walletCopy}>
                  <Text style={styles.walletT}>Pay from wallet</Text>
                  <Text style={styles.small12}>{`Balance ₹${money(hs.wallet.balance)}`}</Text>
                </View>
                <View pointerEvents="none">
                  <Switch
                    value={walletOn}
                    trackColor={{false: 'rgba(255,255,255,0.15)', true: colors.gold}}
                    thumbColor={walletOn ? colors.ink : '#E6E0D6'}
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                  />
                </View>
              </Pressable>
            </Stage>
          ) : null}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Stage t={t} i={4} style={[styles.cxl, cxl.free ? styles.cxlOk : styles.cxlNo]}>
            <View style={[styles.cdot, {backgroundColor: cxl.color}]} />
            <Text style={[styles.cxlT, cxl.free ? styles.cxlTOk : styles.cxlTNo]}>{cxl.text}</Text>
          </Stage>
        </ScrollView>

        {/* The fade is a background layer: on iOS a padded LinearGradient lays its
            children out with the padding twice, pushing the button off the edge. */}
        <View pointerEvents="box-none" style={[styles.dock, {paddingBottom: bottom}]}>
          <LinearGradient
            pointerEvents="none"
            colors={[colors.groundA(0), colors.ground]}
            locations={[0, 0.32]}
            style={StyleSheet.absoluteFill}
          />
          <PressScale to={0.97} duration={450} onPress={pay} accessibilityRole="button" accessibilityState={{busy}} style={styles.pay}>
            {busy ? null : (
              <LoopGate active={!covered}>
                <Sweep duration={3400} alpha={0.6} />
              </LoopGate>
            )}
            <View>
              <Text style={styles.payK}>Total payable</Text>
              <Text style={styles.payV}>{`₹${payLabel}`}</Text>
            </View>
            <View style={styles.pgo}>
              {busy ? <Spinner /> : null}
              <Text style={styles.pgoT}>{busy ? 'Processing…' : 'Proceed to pay'}</Text>
              {busy ? null : <GoIcon />}
            </View>
          </PressScale>
        </View>

        {calMounted ? (
          <Calendar
            open={calOpen}
          view={view}
          pin={pin}
          pout={pout}
          today={today}
          bottom={insets.bottom}
          onClose={closeCal}
          onPick={pick}
          onPrev={prevMonth}
          onNext={nextMonth}
            onApply={apply}
          />
        ) : null}

        {phase === 'busy' || phase === 'anim' ? (
          <Confirming
            play={phase === 'anim'}
            img={review.img}
            stayName={review.name}
            stayShort={review.short}
            inShort={short(cin)}
            outShort={short(cout)}
            guestLabel={guestLabel}
            nights={nights}
          />
        ) : null}
        {prep && paid ? (
          <Success
            play={phase === 'done'}
            review={review}
            receipt={paid}
            inShort={short(cin)}
            outShort={short(cout)}
            nightsLabel={nightsLabel}
            guestFull={guestFull}
            totalLabel={paid.total || totalLabel}
            paidAt={paid.at}
            insets={insets}
            onHome={home}
          />
        ) : null}

        <Grain opacity={0.07} />
      </LoopGate>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: colors.ground},
  stg: {gap: 14, paddingHorizontal: 20},
  top: {flexDirection: 'row', alignItems: 'center', gap: 12},
  gbtn: {backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'},
  h1: {fontFamily: fonts.extrabold, fontSize: 19, color: colors.white, flex: 1},
  held: {paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: colors.goldA(0.14)},
  heldLow: {backgroundColor: 'rgba(248,113,113,0.16)'},
  heldT: {fontFamily: fonts.bold, fontSize: 12, color: colors.gold, fontVariant: ['tabular-nums']},
  heldTLow: {color: '#FCA5A5'},
  green: {color: '#6EE7A0'},
  red: {color: '#FCA5A5'},
  notice: {fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: '#FCA5A5', paddingHorizontal: 4},
  cRow: {flexDirection: 'row', gap: 10},
  cInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.cream,
  },
  cBtn: {height: 44, paddingHorizontal: 18, borderRadius: 14, justifyContent: 'center', backgroundColor: colors.gold},
  cBtnOff: {backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.goldA(0.4)},
  cBtnT: {fontFamily: fonts.bold, fontSize: 13, color: colors.ink},
  cBtnTOff: {color: colors.gold},
  wallet: {flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12},
  walletCopy: {flex: 1, gap: 2},
  walletT: {fontFamily: fonts.bold, fontSize: 14, color: colors.cream},
  card: {borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border},
  clip: {overflow: 'hidden'},
  cap: {fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: ls(0.14, 10.5), color: '#8E887F'},
  small: {fontFamily: fonts.regular, fontSize: 11, color: MUTED},
  small12: {fontFamily: fonts.regular, fontSize: 12, color: MUTED},
  small115: {fontFamily: fonts.regular, fontSize: 11.5, color: MUTED},

  stay: {flexDirection: 'row', gap: 12, padding: 10},
  stayImg: {width: 92, height: 92, borderRadius: 16},
  stayCopy: {flex: 1, minWidth: 0, justifyContent: 'center', gap: 4},
  stayName: {fontFamily: fonts.bold, fontSize: 15, color: colors.white},
  rateRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  rateT: {fontFamily: fonts.regular, fontSize: 12, color: colors.soft},
  rateB: {fontFamily: fonts.bold, color: colors.white},

  tripHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingHorizontal: 16},
  edit: {flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32},
  editT: {fontFamily: fonts.bold, fontSize: 12, color: colors.gold},
  drow: {flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16},
  dcol: {flex: 1, gap: 3},
  dcolR: {alignItems: 'flex-end'},
  dval: {fontFamily: fonts.extrabold, fontSize: 16, color: colors.white},
  nights: {height: 26, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.goldA(0.3), justifyContent: 'center'},
  nightsT: {fontFamily: fonts.bold, fontSize: 11, color: colors.gold},
  grow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: colors.hairline,
  },
  growCopy: {gap: 2},
  growT: {fontFamily: fonts.bold, fontSize: 14, color: colors.white},
  step: {flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.goldA(0.22)},
  sb: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
  sbT: {fontFamily: fonts.bold, fontSize: 18, color: colors.gold},
  sn: {width: 18, height: 22, overflow: 'hidden', alignItems: 'center'},
  snT: {fontFamily: fonts.extrabold, fontSize: 15, color: colors.white, textAlign: 'center'},

  price: {padding: 16, gap: 12},
  prow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  prowK: {fontFamily: fonts.regular, fontSize: 13.5, color: colors.soft},
  prowV: {fontFamily: fonts.bold, fontSize: 13.5, color: colors.white},
  rule: {height: 1, backgroundColor: colors.borderStrong},
  totalRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  totalK: {fontFamily: fonts.bold, fontSize: 15, color: colors.white},
  num: {flexDirection: 'row', alignItems: 'flex-start', height: 28},
  numT: {fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 28, color: colors.white},

  cxl: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1},
  cxlOk: {backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.2)'},
  cxlNo: {backgroundColor: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.22)'},
  cxlTOk: {color: '#C9F5DA'},
  cxlTNo: {color: '#FFD0D0'},
  cdot: {width: 8, height: 8, borderRadius: 4},
  cxlT: {flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17.5},

  dock: {position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40, paddingTop: 22, paddingHorizontal: 16},
  pay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 62,
    paddingLeft: 20,
    paddingRight: 10,
    borderRadius: 20,
    backgroundColor: colors.gold,
    overflow: 'hidden',
  },
  payK: {fontFamily: fonts.semibold, fontSize: 11, color: colors.ink, opacity: 0.7},
  payV: {fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink},
  pgo: {flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.ink},
  pgoT: {fontFamily: fonts.extrabold, fontSize: 14, color: colors.gold},
  spin: {width: 16, height: 16, borderRadius: 8, borderWidth: 2.5, borderColor: colors.goldA(0.3), borderTopColor: colors.gold},
});
