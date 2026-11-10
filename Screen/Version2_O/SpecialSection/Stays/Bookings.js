// "My bookings" view of the Stays listing (Stays.dc.html, `isBookings`).
import React, {useEffect, useState} from 'react';
import {Alert, Image, Linking, StyleSheet, Text, View} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Line, Path, Rect} from 'react-native-svg';
import {colors, fonts} from '../theme';
import {E, PressScale, kf, useLoop, useReducedMotion, useToggle} from '../anim';
import {useFirstFrame} from '../perf';
import {Loop, useShot} from './bits';
import {
  ChevronIcon,
  ClockIcon,
  DirectionsIcon,
  DownloadIcon,
  HeadsetIcon,
  STAR_D,
} from './icons';
import {countdown} from './data';
import {cancelBooking, getBooking, money, reviewBooking, useStayBookings} from '../api/stays';
import {errText} from '../api/client';
import {ErrorCard, Skeleton} from '../api/ui';

const TABS = [
  {id: 'up', api: 'upcoming', label: 'Upcoming'},
  {id: 'past', api: 'completed', label: 'Completed'},
  {id: 'cxl', api: 'cancelled', label: 'Cancelled'},
];
const EMPTY = {
  up: ['No upcoming stays', 'Stays you book will show up here.'],
  past: ['No completed stays yet', 'Stays you finish will show up here.'],
  cxl: ['No cancelled bookings', 'Bookings you cancel will show up here.'],
};

const directions = b =>
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name}, ${b.address}`)}`).catch(
    () => {},
  );

const POLICY =
  'Cancellation policy: free cancellation up to 72 hours before check-in. Bookings cancelled within 72 hours of check-in are not refunded.';

/**
 * Cancel with the guest's OK: the refund comes from GET /bookings/:id
 * (`refundPreview`; list rows don't carry it), so they see it before
 * confirming. Resolves true once cancelled.
 */
async function confirmCancel(b) {
  let full;
  try {
    const r = await getBooking(b.id);
    full = r?.booking || r;
  } catch (e) {
    Alert.alert("Couldn't load this booking", errText(e));
    return false;
  }
  if (!full?.canCancel) {
    Alert.alert("This booking can't be cancelled", full?.cancellationPolicy?.summary || POLICY);
    return false;
  }
  const rp = full.refundPreview || {};
  const amount = rp.refundAmount || 0;
  const head = amount
    ? `You'll get ₹${money(amount)} back${rp.refundPercent && rp.refundPercent < 100 ? ` (${rp.refundPercent}% refund)` : ''}.`
    : "Check-in is less than 72 hours away, so you won't get a refund for this booking.";
  const ok = await new Promise(resolve =>
    Alert.alert(
      'Cancel this booking?',
      `${head}\n\n${POLICY}`,
      [
        {text: 'Keep booking', style: 'cancel', onPress: () => resolve(false)},
        {text: 'Cancel booking', style: 'destructive', onPress: () => resolve(true)},
      ],
      {cancelable: true, onDismiss: () => resolve(false)},
    ),
  );
  if (!ok) {
    return false;
  }
  try {
    const r = await cancelBooking(b.id);
    const refund = (r?.booking || r)?.refund;
    Alert.alert(
      'Booking cancelled',
      refund?.amount
        ? `Your refund of ₹${money(refund.amount)} has started${refund.toWallet ? ' and goes to your wallet' : ''}.`
        : 'Your booking at ' + b.name + ' is cancelled.',
    );
    return true;
  } catch (e) {
    Alert.alert("Couldn't cancel", errText(e));
    return false;
  }
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const META = '#ADA597';
// Colour helpers are plain JS, so resolve them before they reach a worklet.
const ST_BORDER = colors.whiteA(0.1);
const WHITE_0 = colors.whiteA(0);
const CNT_BG = colors.goldA(0.18);

/** `.bin`: cards rise in when a sub-tab is picked (.6s --out). */
const bin = () => {
  'worklet';
  const cfg = {duration: 600, easing: E.out};
  return {
    initialValues: {opacity: 0, transform: [{translateY: 18}, {scale: 0.98}]},
    animations: {
      opacity: withTiming(1, cfg),
      transform: [{translateY: withTiming(0, cfg)}, {scale: withTiming(1, cfg)}],
    },
  };
};

/** `.st` sub-tab with its count bubble. */
function SubTab({tab, on, onPress}) {
  const v = useToggle(on, {duration: 300, easing: E.ease});
  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [colors.card, colors.cream]),
    borderColor: interpolateColor(v.value, [0, 1], [ST_BORDER, WHITE_0]),
  }));
  const text = useAnimatedStyle(() => ({color: interpolateColor(v.value, [0, 1], [colors.soft, colors.ink])}));
  const cnt = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [CNT_BG, colors.ink]),
  }));
  const cntText = useAnimatedStyle(() => ({color: interpolateColor(v.value, [0, 1], [colors.soft, colors.gold])}));
  return (
    <PressScale to={0.92} duration={400} onPress={onPress} accessibilityRole="tab" accessibilityState={{selected: on}}>
      <Animated.View style={[styles.st, box]}>
        <Animated.Text style={[styles.stText, text]}>{tab.label}</Animated.Text>
        {tab.count ? (
          <Animated.View style={[styles.cnt, cnt]}>
            <Animated.Text style={[styles.cntText, cntText]}>{tab.count}</Animated.Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </PressScale>
  );
}

/** `.bstat.ok i`: green dot with the `okp` box-shadow pulse. */
function OkDot() {
  const p = useLoop(1600);
  const ring = useAnimatedStyle(() => {
    const t = E.easeOut(p.value);
    return {opacity: 0.6 * (1 - t), transform: [{scale: 1 + (14 / 6) * t}]};
  });
  return (
    <View style={[styles.statDot, styles.okDot]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.okRing, ring]} />
    </View>
  );
}

/** `.bmore`: grid-template-rows 0fr → 1fr (.45s --out). */
function More({open, children}) {
  const reduced = useReducedMotion();
  const h = useSharedValue(0);
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = reduced ? (open ? 1 : 0) : withTiming(open ? 1 : 0, {duration: 450, easing: E.out});
  }, [open, reduced, v]);
  const a = useAnimatedStyle(() => ({height: h.value * v.value}));
  return (
    <Animated.View style={[styles.more, a]}>
      <View style={styles.moreInner} onLayout={e => (h.value = e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  );
}

function Chevron({up}) {
  const v = useToggle(up, {duration: 400, easing: E.spring});
  const a = useAnimatedStyle(() => ({transform: [{rotate: `${180 * v.value}deg`}]}));
  return (
    <Animated.View style={a}>
      <ChevronIcon />
    </Animated.View>
  );
}

function IconBtn({label, children, onPress}) {
  return (
    <PressScale to={0.88} duration={350} onPress={onPress} accessibilityLabel={label} style={styles.bic}>
      {children}
    </PressScale>
  );
}

function Upcoming({b, onCancelled}) {
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancel = () => {
    if (busy) {
      return;
    }
    setBusy(true);
    confirmCancel(b).then(done => {
      setBusy(false);
      done && onCancelled();
    });
  };
  return (
    <>
      <Animated.View entering={bin} style={styles.bcard}>
        <View style={styles.bimg}>
          <Image source={b.img} style={styles.fill} resizeMode="cover" />
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={['rgba(10,10,12,0.35)', 'rgba(10,10,12,0)', 'rgba(10,10,12,0.85)']}
            locations={[0, 0.35, 1]}
          />
          <View style={[styles.bstat, styles.bstatOk, !b.ok && styles.bstatWait]}>
            {b.ok ? <OkDot /> : null}
            <Text style={[styles.bstatText, b.ok ? styles.okText : styles.doneText]}>{b.statusLabel}</Text>
          </View>
          <View style={styles.bcount}>
            <ClockIcon />
            <Text style={styles.bcountText}>{countdown(new Date(b.checkIn))}</Text>
          </View>
          <View style={styles.bimgText}>
            <Text style={styles.bname}>{b.name}</Text>
            <Text style={styles.bsub}>{b.sub}</Text>
          </View>
        </View>
        <View style={styles.bdates}>
          <View style={styles.dcol}>
            <Text style={styles.dlabel}>Check-in</Text>
            <Text style={styles.dvalue}>{b.checkInLabel}</Text>
            <Text style={styles.dlabel}>{b.checkInTime}</Text>
          </View>
          <View style={styles.bline}>
            <Svg style={styles.blineDash} height={2}>
              <Line x1="0" y1="0.75" x2="100%" y2="0.75" stroke={colors.goldA(0.3)} strokeWidth={1.5} strokeDasharray="4 4" />
            </Svg>
            <View style={styles.blinePill}>
              <Text style={styles.blineText}>{b.nights}</Text>
            </View>
          </View>
          <View style={[styles.dcol, styles.dcolEnd]}>
            <Text style={styles.dlabel}>Check-out</Text>
            <Text style={styles.dvalue}>{b.checkOutLabel}</Text>
            <Text style={styles.dlabel}>{b.checkOutTime}</Text>
          </View>
        </View>
        <View style={styles.bmeta}>
          {b.meta.map((m, i) => (
            <React.Fragment key={i}>
              {i ? <Text style={styles.bmetaText}>·</Text> : null}
              <Text style={styles.bmetaText}>{m}</Text>
            </React.Fragment>
          ))}
        </View>
        <More open={more && (b.details.length > 0 || b.canCancel)}>
          {b.details.map(([k, v, c]) => (
            <View key={k} style={styles.kv}>
              <Text style={styles.kvKey}>{k}</Text>
              <Text style={[styles.kvVal, c && {color: c}]}>{v}</Text>
            </View>
          ))}
          {b.canCancel ? (
            <PressScale to={0.97} duration={350} onPress={cancel} accessibilityRole="button" style={styles.cxl}>
              <Text style={styles.cxlText}>{busy ? 'Checking refund…' : 'Cancel booking'}</Text>
            </PressScale>
          ) : null}
        </More>
        <View style={styles.bact}>
          <PressScale
            to={0.95}
            duration={400}
            onPress={() => setMore(m => !m)}
            accessibilityState={{expanded: more}}
            style={[styles.bbtn, styles.grow]}>
            <Text style={styles.bbtnText}>{more ? 'Hide details' : 'View details'}</Text>
            <Chevron up={more} />
          </PressScale>
          <IconBtn label={`Directions to ${b.name}`} onPress={() => directions(b)}>
            <DirectionsIcon />
          </IconBtn>
          <IconBtn label="Chat with concierge">
            <HeadsetIcon size={18} strokeWidth={1.9} cord={false} />
          </IconBtn>
        </View>
      </Animated.View>
    </>
  );
}

/** `.star` rating button: fill transition .2s, `spop2` when it turns on. */
function RateStar({n, on, onPress}) {
  const pop = useShot(on, 450);
  const a = useAnimatedStyle(() => ({
    transform: [{scale: kf(pop.value, [[0, 0.6], [0.6, 1.25], [1, 1]], E.spring)}],
  }));
  return (
    <PressScale
      to={1}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{checked: on}}
      accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
      style={styles.star}>
      <Animated.View style={a}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d={STAR_D}
            fill={on ? '#F1B54A' : 'transparent'}
            stroke={on ? '#F1B54A' : '#6F6A63'}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </PressScale>
  );
}

function Completed({c, onOpenStay}) {
  const [rating, setRating] = useState(0);
  const rate = n => {
    setRating(n);
    if (c.id) {
      reviewBooking(c.id, n).catch(() => setRating(0));
    }
  };
  return (
    <Animated.View entering={bin} style={styles.bcard}>
      <View style={styles.pastRow}>
        <Image source={c.img} style={styles.pastImg} />
        <View style={styles.pastText}>
          <View style={[styles.bstat, styles.bstatDone]}>
            <View style={[styles.statDot, styles.doneDot]} />
            <Text style={[styles.bstatText, styles.doneText]}>{c.statusLabel}</Text>
          </View>
          <Text style={styles.pastName}>{c.name}</Text>
          <Text style={styles.pastSub}>{c.pastSub}</Text>
        </View>
      </View>
      {c.canReview || rating ? (
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>{rating ? 'Thanks for rating!' : 'Rate your stay'}</Text>
          <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Rate your stay">
            {[1, 2, 3, 4, 5].map(n => (
              <RateStar key={n} n={n} on={n <= rating} onPress={() => (rating ? null : rate(n))} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={styles.bact}>
        <PressScale to={0.95} duration={400} onPress={() => onOpenStay(c.stayId)} style={[styles.bbtn, styles.grow]}>
          <Text style={styles.bbtnText}>Book again</Text>
        </PressScale>
        <IconBtn label="Download invoice">
          <DownloadIcon />
        </IconBtn>
      </View>
    </Animated.View>
  );
}

/** `@keyframes float3` on the empty-state art. */
const float3 = p => {
  'worklet';
  return {transform: [{translateY: kf(p, [[0, 0], [0.5, -6], [1, 0]], E.easeInOut)}]};
};

/** `.empty` for cancelled bookings; the red cross draws itself (`exd`). */
function Empty({title, sub, onExplore}) {
  const p = useShot(true, 700, 300);
  const ex = useAnimatedProps(() => ({strokeDashoffset: 60 * (1 - E.ease(p.value))}));
  return (
    <Animated.View entering={bin} style={styles.empty}>
      <Loop duration={3200} track={float3}>
        <Svg width={96} height={96} viewBox="0 0 96 96" fill="none">
          <Rect x="16" y="22" width="64" height="58" rx="12" stroke={colors.gold} strokeWidth={2.5} />
          <Path d="M16 38h64M32 14v14M64 14v14" stroke={colors.gold} strokeWidth={2.5} strokeLinecap="round" />
          <AnimatedPath
            d="M38 50l20 20M58 50 38 70"
            stroke="#F87171"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={60}
            animatedProps={ex}
          />
        </Svg>
      </Loop>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
      <PressScale to={0.95} duration={400} onPress={onExplore} style={[styles.bbtn, styles.emptyBtn]}>
        <Text style={styles.bbtnText}>Explore stays</Text>
      </PressScale>
    </Animated.View>
  );
}

export default function Bookings({counts: homeCounts, onExplore, onOpenStay}) {
  const [bk, setBk] = useState('up');
  const tab = TABS.find(t => t.id === bk);
  const q = useStayBookings(tab.api);
  useFirstFrame('Bookings');
  const counts = q.data?.counts || homeCounts || {};
  const list = q.data?.bookings;
  let body;
  if (q.error && !list) {
    body = <ErrorCard message={q.error.message} onRetry={q.refresh} style={styles.flush} />;
  } else if (!list) {
    body = <Skeleton style={bk === 'up' ? styles.skUp : styles.skPast} />;
  } else if (!list.length) {
    body = <Empty key={bk} title={EMPTY[bk][0]} sub={EMPTY[bk][1]} onExplore={onExplore} />;
  } else {
    body = list.map((b, i) =>
      bk === 'up' ? (
        <Upcoming key={b.id || i} b={b} onCancelled={q.refresh} />
      ) : (
        <Completed key={b.id || i} c={b} onOpenStay={onOpenStay} />
      ),
    );
  }
  return (
    <View style={styles.bkv}>
      <View style={styles.subt} accessibilityRole="tablist" accessibilityLabel="Booking status">
        {TABS.map(t => (
          <SubTab
            key={t.id}
            tab={{...t, count: counts[t.api] ? String(counts[t.api]) : ''}}
            on={bk === t.id}
            onPress={() => setBk(t.id)}
          />
        ))}
      </View>
      {body}
      {list?.length ? <Text style={styles.note}>Showing bookings made with this account</Text> : null}
    </View>
  );
}

const hairline = {borderTopWidth: 1, borderTopColor: colors.hairline};

const styles = StyleSheet.create({
  fill: {width: '100%', height: '100%'},
  grow: {flex: 1},
  bkv: {paddingTop: 14, paddingHorizontal: 20, paddingBottom: 40, gap: 14},
  subt: {flexDirection: 'row', gap: 8},
  st: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  stText: {fontFamily: fonts.bold, fontSize: 12.5},
  cnt: {minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center'},
  cntText: {fontFamily: fonts.bold, fontSize: 10.5},
  bcard: {borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden'},
  bimg: {height: 160},
  bstat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  bstatOk: {position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(10,10,12,0.6)', borderColor: 'rgba(110,231,160,0.4)'},
  bstatWait: {borderColor: colors.goldA(0.4)},
  flush: {marginHorizontal: 0},
  skUp: {height: 380},
  skPast: {height: 200},
  bstatDone: {alignSelf: 'flex-start', backgroundColor: colors.goldA(0.1), borderColor: colors.goldA(0.3)},
  bstatText: {fontFamily: fonts.extrabold, fontSize: 11},
  statDot: {width: 6, height: 6, borderRadius: 3},
  okDot: {backgroundColor: '#4ADE80'},
  okText: {color: '#8FF0B8'},
  doneDot: {backgroundColor: colors.gold},
  doneText: {color: colors.gold},
  okRing: {borderRadius: 3, backgroundColor: 'rgb(74,222,128)'},
  bcount: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.gold,
  },
  bcountText: {fontFamily: fonts.extrabold, fontSize: 11, color: colors.ink},
  bimgText: {position: 'absolute', left: 16, right: 16, bottom: 14},
  bname: {fontFamily: fonts.extrabold, fontSize: 17, color: '#fff'},
  bsub: {fontFamily: fonts.regular, fontSize: 12, color: '#E6E0D6'},
  bdates: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16},
  dcol: {flex: 1, gap: 2},
  dcolEnd: {alignItems: 'flex-end'},
  dlabel: {fontFamily: fonts.regular, fontSize: 11, color: colors.muted},
  dvalue: {fontFamily: fonts.extrabold, fontSize: 15, color: '#fff'},
  bline: {width: 84, height: 24, alignItems: 'center', justifyContent: 'center'},
  blineDash: {position: 'absolute', left: 0, right: 0, top: 11.25},
  blinePill: {
    height: 22,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldA(0.3),
  },
  blineText: {fontFamily: fonts.bold, fontSize: 10.5, color: colors.gold},
  bmeta: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 12},
  bmetaText: {fontFamily: fonts.regular, fontSize: 11.5, color: META},
  more: {overflow: 'hidden'},
  moreInner: {position: 'absolute', left: 0, right: 0, top: 0},
  kv: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16, ...hairline},
  kvKey: {fontFamily: fonts.regular, fontSize: 12.5, color: META},
  kvVal: {fontFamily: fonts.bold, fontSize: 12.5, color: '#fff'},
  cxl: {alignItems: 'center', justifyContent: 'center', height: 44, marginHorizontal: 16, marginVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)'},
  cxlText: {fontFamily: fonts.bold, fontSize: 13, color: '#F87171'},
  bact: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, ...hairline},
  bbtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.gold,
  },
  bbtnText: {fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink},
  bic: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.goldA(0.3),
  },
  note: {fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center'},
  pastRow: {flexDirection: 'row', gap: 12, padding: 12},
  pastImg: {width: 84, height: 84, borderRadius: 16},
  pastText: {flex: 1, minWidth: 0, gap: 4},
  pastName: {fontFamily: fonts.bold, fontSize: 15, color: '#fff'},
  pastSub: {fontFamily: fonts.regular, fontSize: 12, color: colors.muted},
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...hairline,
  },
  rateLabel: {fontFamily: fonts.regular, fontSize: 12.5, color: colors.soft},
  stars: {flexDirection: 'row', gap: 2},
  star: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center'},
  empty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.whiteA(0.12),
  },
  emptyTitle: {fontFamily: fonts.bold, fontSize: 16, color: '#fff'},
  emptySub: {fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, textAlign: 'center'},
  emptyBtn: {marginTop: 6},
});
