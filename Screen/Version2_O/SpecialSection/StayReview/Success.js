// `.ok` "Booking confirmed" screen from StayReview.dc.html: circle reveal
// (okin), badge ring/fill/check (bring bfill bcheck, then bpulse), rays,
// ripples, sparks (spk) and the staggered cards (rise). One-shot animations
// read one clock; the infinite ones (rip, bpulse) start from it.
import React, {memo, useEffect, useRef, useState} from 'react';
import {Image, Linking, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Circle, Defs, Path, RadialGradient, Rect, Stop} from 'react-native-svg';
import {colors, fonts, ls} from '../theme';
import {E, LoopGate, PressScale, kf, useLoop, useReducedMotion} from '../anim';
import {useFirstFrame, useRenderCount} from '../perf';

const END = 2400;
const DRAW = Easing.bezierFn(0.65, 0, 0.35, 1);
const GREEN = '#6EE7A0';
const MUTED = '#ADA597';
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];
const SPARKS = [
  {delay: 1200, color: GREEN, pos: {left: '22%', top: '20%'}},
  {delay: 1350, color: colors.gold, pos: {right: '22%', top: '28%'}},
  {delay: 1500, color: colors.gold, pos: {left: '28%', bottom: '12%'}},
  {delay: 1250, color: GREEN, pos: {right: '26%', bottom: '16%'}},
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

function seg(t, delay, dur) {
  'worklet';
  return Math.min(1, Math.max(0, (t - delay) / dur));
}

/** `.okin` / `.home`: rise (.7s --out) after `delay`. */
function Rise({t, delay, duration = 700, dy = 16, style, children}) {
  const a = useAnimatedStyle(() => {
    const p = E.out(seg(t.value, delay, duration));
    return {opacity: p, transform: [{translateY: dy * (1 - p)}]};
  });
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

function Ray({t, r}) {
  const a = useAnimatedStyle(() => {
    const p = seg(t.value, 1100, 700);
    const e = E.easeOut(p);
    return {
      opacity: p <= 0 ? 0 : kf(p, [[0, 0], [0.4, 1], [1, 0]], E.easeOut),
      transform: [{rotate: `${r}deg`}, {translateY: p <= 0 ? -58 : -50 - 32 * e}, {scaleY: p <= 0 ? 1 : 0.3 + 0.7 * e}],
    };
  });
  return <Animated.View style={[styles.ray, a]} />;
}

function Rip({t, delay}) {
  const p = useLoop(2400, {delay});
  const a = useAnimatedStyle(() => {
    const e = E.easeOut(p.value);
    return {opacity: t.value < delay ? 0 : 0.9 * (1 - e), transform: [{scale: 0.9 + 0.9 * e}]};
  });
  return <Animated.View style={[styles.rip, a]} />;
}

function Spark({t, delay, color, pos}) {
  const a = useAnimatedStyle(() => {
    const p = seg(t.value, delay, 1600);
    return {
      opacity: kf(p, [[0, 0], [0.3, 1], [1, 0]], E.easeOut),
      transform: [
        {scale: kf(p, [[0, 0], [0.3, 1.2], [1, 0.4]], E.easeOut)},
        {translateY: kf(p, [[0, 0], [0.3, 0], [1, -14]], E.easeOut)},
      ],
    };
  });
  return <Animated.View style={[styles.spark, pos, {backgroundColor: color}, a]} />;
}

function Badge({t}) {
  const pulse = useLoop(2800, {delay: 1800});
  const wrap = useAnimatedStyle(() => ({
    transform: [{scale: kf(pulse.value, [[0, 1], [0.5, 1.04], [1, 1]], E.easeInOut)}],
  }));
  const fill = useAnimatedStyle(() => ({transform: [{scale: E.spring(seg(t.value, 750, 550))}]}));
  const ring = useAnimatedProps(() => ({strokeDashoffset: 315 * (1 - DRAW(seg(t.value, 200, 700)))}));
  const check = useAnimatedProps(() => ({strokeDashoffset: 70 * (1 - DRAW(seg(t.value, 1150, 450)))}));
  return (
    <Animated.View style={[styles.badge, wrap]}>
      <Animated.View style={[styles.bfill, fill]} />
      <Svg width={112} height={112} viewBox="0 0 112 112" style={StyleSheet.absoluteFill}>
        <AnimatedCircle
          cx={56}
          cy={56}
          r={50}
          fill="none"
          stroke={colors.gold}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="315"
          rotation={-90}
          origin="56, 56"
          animatedProps={ring}
        />
        <AnimatedPath
          d="M36 57.5 50 71l27-29"
          fill="none"
          stroke={colors.ink}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="70"
          animatedProps={check}
        />
      </Svg>
    </Animated.View>
  );
}

function DirIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12 20 4l-8 16-2-6z" />
    </Svg>
  );
}

function HomeIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2} strokeLinejoin="round">
      <Path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

function Kv({k, v, color}) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvK}>{k}</Text>
      <Text style={[styles.kvV, color && {color}]}>{v}</Text>
    </View>
  );
}

/**
 * okin: `clip-path: circle(0% → 150% at 50% 94%)`, .7s cubic-bezier(.7,0,.2,1).
 * Same scale trick as the Hub portal; Android fades instead (the clipped,
 * scaled layer is CPU-clipped every frame there).
 */
function useReveal(width, height, reduced, play) {
  const cx = width / 2;
  const cy = height * 0.94;
  const rMax = 1.5 * Math.sqrt((width * width + height * height) / 2);
  const android = Platform.OS === 'android';
  const s = useSharedValue(0);
  useEffect(() => {
    if (play) {
      s.value = reduced ? 1 : withTiming(1, {duration: 700, easing: E.snap});
    }
  }, [play, reduced, s]);
  const outer = useAnimatedStyle(() => {
    if (android) {
      return {opacity: s.value};
    }
    const k = Math.max(0.0005, s.value);
    return {borderRadius: s.value >= 1 ? 0 : rMax, overflow: s.value >= 1 ? 'visible' : 'hidden', transform: [{scale: k}]};
  });
  const inner = useAnimatedStyle(() => (android ? {} : {transform: [{scale: 1 / Math.max(0.0005, s.value)}]}));
  if (android) {
    return {outer: [StyleSheet.absoluteFill, outer], inner: StyleSheet.absoluteFill};
  }
  return {
    outer: [{position: 'absolute', left: cx - rMax, top: cy - rMax, width: rMax * 2, height: rMax * 2}, outer],
    inner: [{position: 'absolute', left: rMax - cx, top: rMax - cy, width, height, transformOrigin: [cx, cy, 0]}, inner],
  };
}

/** Built hidden (`play` false: clock and reveal at 0, loops off) so it can mount ahead of time. */
function Success({play, review, receipt, inShort, outShort, inTime, outTime, nightsLabel, guestFull, totalLabel, paidAt, insets, onHome}) {
  const {width, height} = useWindowDimensions();
  const reduced = useReducedMotion();
  useRenderCount('Success');
  useFirstFrame('Success');
  const t = useSharedValue(0);
  useEffect(() => {
    if (play) {
      t.value = reduced ? END : withTiming(END, {duration: END, easing: Easing.linear});
    }
  }, [play, reduced, t]);
  const reveal = useReveal(width, height, reduced, play);

  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = () => {
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };
  const directions = () =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${review.name}, ${review.address}`)}`);

  const gy = height * 0.18;
  const gr = Math.sqrt((width / 2) ** 2 + (height - gy) ** 2);
  const bottom = Math.max(16, insets.bottom);

  return (
    <View
      pointerEvents={play ? 'auto' : 'none'}
      accessibilityViewIsModal={play}
      accessibilityElementsHidden={!play}
      importantForAccessibility={play ? 'auto' : 'no-hide-descendants'}
      style={styles.ok}
      accessibilityLabel="Booking confirmed">
      <LoopGate active={play}>
      <Animated.View style={reveal.outer}>
        <Animated.View style={[reveal.inner, styles.okBg]}>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="okg" cx={width / 2} cy={gy} r={gr} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={GREEN} stopOpacity={0.16} />
                <Stop offset="0.45" stopColor={colors.ground} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={width} height={height} fill="url(#okg)" />
          </Svg>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scroll, {paddingTop: 34 + insets.top, paddingBottom: 120 + bottom}]}>
            <View style={styles.hero} importantForAccessibility="no-hide-descendants">
              {RAYS.map(r => (
                <Ray key={r} t={t} r={r} />
              ))}
              <Rip t={t} delay={1300} />
              <Rip t={t} delay={2500} />
              <Badge t={t} />
              {SPARKS.map(s => (
                <Spark key={s.delay} t={t} {...s} />
              ))}
            </View>

            <Rise t={t} delay={1300} style={styles.head}>
              <Text style={[styles.cap, {color: GREEN}]}>PAYMENT SUCCESSFUL</Text>
              <Text style={styles.h2}>Booking confirmed</Text>
              <Text style={styles.lead}>
                {`Your stay at ${review.short} is reserved. A confirmation has been sent to your email.`}
              </Text>
              <PressScale to={0.95} duration={350} onPress={copy} accessibilityRole="button" accessibilityLabel="Copy booking ID" style={styles.bid}>
                <Text style={styles.bidK}>Booking ID</Text>
                <Text style={styles.bidV}>{receipt.bookingId}</Text>
                <View style={styles.cp}>
                  <Text style={styles.cpT}>{copied ? 'Copied' : 'Copy'}</Text>
                </View>
              </PressScale>
            </Rise>

            <Rise t={t} delay={1450} style={[styles.card, styles.clip]}>
              <View style={styles.trip}>
                <View style={styles.dcol}>
                  <Text style={styles.small}>Check-in</Text>
                  <Text style={styles.date}>{inShort}</Text>
                  <Text style={styles.small}>{`from ${inTime}`}</Text>
                </View>
                <View style={styles.nights}>
                  <Text style={styles.nightsT}>{nightsLabel}</Text>
                </View>
                <View style={[styles.dcol, styles.dcolR]}>
                  <Text style={styles.small}>Check-out</Text>
                  <Text style={styles.date}>{outShort}</Text>
                  <Text style={styles.small}>{`by ${outTime}`}</Text>
                </View>
              </View>
              <Kv k="Guests" v={guestFull} />
            </Rise>

            <Rise t={t} delay={1550} style={[styles.card, styles.stay]}>
              <Image source={review.img} style={styles.stayImg} />
              <View style={styles.stayCopy}>
                <Text style={styles.stayName}>{review.name}</Text>
                <Text style={styles.small12}>{review.room}</Text>
                <Text style={styles.small12}>{review.address}</Text>
              </View>
              <PressScale onPress={directions} accessibilityRole="link" accessibilityLabel={`Get directions to ${review.short}`} style={styles.dirb}>
                <DirIcon />
              </PressScale>
            </Rise>

            <Rise t={t} delay={1650} style={[styles.card, styles.txn]}>
              <Text style={[styles.cap, styles.txnCap]}>TRANSACTION DETAILS</Text>
              <Kv k="Amount paid" v={`₹${totalLabel}`} color={GREEN} />
              <Kv k="Paid on" v={paidAt} />
              <Kv k="Payment method" v={receipt.method} />
              <Kv k="Transaction ID" v={receipt.txnId} />
            </Rise>
          </ScrollView>
          <LinearGradient
            pointerEvents="box-none"
            colors={[colors.groundA(0), colors.ground]}
            locations={[0, 0.32]}
            style={[styles.dock, {paddingBottom: bottom}]}>
            <Rise t={t} delay={1800} duration={600} dy={0}>
              <PressScale to={0.96} duration={400} onPress={onHome} accessibilityRole="button" style={styles.home}>
                <HomeIcon />
                <Text style={styles.homeT}>Back to Home</Text>
              </PressScale>
            </Rise>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
      </LoopGate>
    </View>
  );
}

export default memo(Success);

const styles = StyleSheet.create({
  ok: {...StyleSheet.absoluteFillObject, zIndex: 70},
  okBg: {backgroundColor: colors.ground},
  scroll: {paddingHorizontal: 20, gap: 14},
  hero: {height: 150, alignItems: 'center', justifyContent: 'center'},
  ray: {position: 'absolute', left: '50%', top: '50%', width: 3, height: 16, marginLeft: -1.5, marginTop: -8, borderRadius: 2, backgroundColor: colors.gold},
  rip: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 112,
    height: 112,
    marginLeft: -56,
    marginTop: -56,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: 'rgba(110,231,160,0.45)',
  },
  badge: {width: 112, height: 112, alignItems: 'center', justifyContent: 'center', zIndex: 2},
  bfill: {width: 88, height: 88, borderRadius: 44, backgroundColor: colors.gold},
  spark: {position: 'absolute', width: 8, height: 8, borderRadius: 4},
  head: {alignItems: 'center', gap: 8},
  cap: {fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: ls(0.14, 10.5), color: '#8E887F'},
  h2: {fontFamily: fonts.extrabold, fontSize: 28, letterSpacing: ls(-0.02, 28), color: colors.white, textAlign: 'center'},
  lead: {fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: MUTED, maxWidth: 290, textAlign: 'center'},
  bid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    marginTop: 6,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(241,221,186,0.35)',
  },
  bidK: {fontFamily: fonts.regular, fontSize: 12.5, color: MUTED},
  bidV: {fontFamily: fonts.bold, fontSize: 12.5, color: colors.white, letterSpacing: ls(0.06, 12.5)},
  cp: {height: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.goldA(0.12), justifyContent: 'center'},
  cpT: {fontFamily: fonts.bold, fontSize: 11, color: colors.gold},
  card: {borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border},
  clip: {overflow: 'hidden'},
  trip: {flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16},
  dcol: {flex: 1, gap: 3},
  dcolR: {alignItems: 'flex-end'},
  small: {fontFamily: fonts.regular, fontSize: 11, color: MUTED},
  small12: {fontFamily: fonts.regular, fontSize: 12, color: MUTED},
  date: {fontFamily: fonts.bold, fontSize: 15.5, color: colors.white},
  nights: {height: 26, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.goldA(0.3), justifyContent: 'center'},
  nightsT: {fontFamily: fonts.bold, fontSize: 11, color: colors.gold},
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: colors.hairline,
  },
  kvK: {fontFamily: fonts.regular, fontSize: 13, color: MUTED},
  kvV: {fontFamily: fonts.bold, fontSize: 13, color: colors.white},
  stay: {padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center'},
  stayImg: {width: 64, height: 64, borderRadius: 14},
  stayCopy: {flex: 1, minWidth: 0, gap: 3},
  stayName: {fontFamily: fonts.bold, fontSize: 14.5, color: colors.white},
  dirb: {width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold},
  txn: {paddingVertical: 4},
  txnCap: {paddingTop: 12, paddingHorizontal: 16, paddingBottom: 4},
  dock: {position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 22, paddingHorizontal: 16},
  home: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.gold,
  },
  homeT: {fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink},
});
