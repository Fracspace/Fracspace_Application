// "Good to know": check-in/out times (`spinsun`, `moonb`, `travel`) and the
// cancellation card (`shb`, `pchk`) that opens the policy sheet.
import React, {memo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {useAnimatedProps, useAnimatedStyle} from 'react-native-reanimated';
import Svg, {Circle, Line, Path} from 'react-native-svg';
import {colors, fonts, ls} from '../theme';
import {E, Reveal, kf, useLoop, usePressScale} from '../anim';
import {ArrowRight, useShot} from './bits';
import {h2} from './Suites';
import {useRenderCount} from '../perf';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** `.ticon.sun svg`: spinsun 12s linear infinite. */
function Sun() {
  const p = useLoop(12000);
  const a = useAnimatedStyle(() => ({transform: [{rotate: `${360 * p.value}deg`}]}));
  return (
    <View style={[styles.ticon, styles.sun]}>
      <Animated.View style={a}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F2B85C" strokeWidth={1.9} strokeLinecap="round">
          <Circle cx="12" cy="12" r="4" />
          <Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** `.ticon.moon svg`: moonb rotate ±8deg, 3.6s ease-in-out. */
function Moon() {
  const p = useLoop(3600);
  const a = useAnimatedStyle(() => ({
    transform: [{rotate: `${kf(p.value, [[0, -8], [0.5, 8], [1, -8]], E.easeInOut)}deg`}],
  }));
  return (
    <View style={[styles.ticon, styles.moon]}>
      <Animated.View style={a}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#B8C0FF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** `.tline` dashed rule with the glowing dot that `travel`s across (3.2s). */
function TravelLine() {
  const [w, setW] = useState(0);
  const p = useLoop(3200);
  const a = useAnimatedStyle(() => ({
    opacity: kf(p.value, [[0, 0], [0.12, 1], [0.88, 1], [1, 0]], E.easeInOut),
    transform: [{translateX: (w - 7) * E.easeInOut(p.value)}],
  }), [w]);
  return (
    <View style={styles.tmid} onLayout={e => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={2} style={styles.tline}>
        <Line x1={0} y1={0.75} x2={w} y2={0.75} stroke="rgba(241,221,186,.25)" strokeWidth={1.5} strokeDasharray="4.5 3" />
      </Svg>
      {w ? <Animated.View style={[styles.travel, a]} /> : null}
      <View style={styles.tpill}>
        <Text style={styles.tpillText}>1 night</Text>
      </View>
    </View>
  );
}

/** `.ticon.shield`: `shb` heartbeat (4s) + the tick drawn once (`pchk` .7s --out, .4s delay). */
function Shield() {
  const p = useLoop(4000);
  const draw = useShot(true, 700, 400);
  const a = useAnimatedStyle(() => ({
    transform: [{scale: kf(p.value, [[0, 1], [0.82, 1], [0.88, 1.12], [0.94, 0.97], [1, 1]], E.easeInOut)}],
  }));
  const chk = useAnimatedProps(() => ({strokeDashoffset: 14 * (1 - E.out(draw.value))}));
  return (
    <View style={[styles.ticon, styles.shield]}>
      <Animated.View style={a}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 3.5 5 6v5.5c0 4.3 3 7.7 7 9 4-1.3 7-4.7 7-9V6z" />
          <AnimatedPath d="m8.8 12.2 2.3 2.3 4.3-4.6" strokeDasharray={14} animatedProps={chk} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** `.readpol` row; its arrow circle scales to .85 while pressed. */
function ReadPolicy({onPress}) {
  const press = usePressScale(0.85, 400);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      style={styles.readpol}>
      <Text style={styles.readpolText}>Read policy</Text>
      <Animated.View style={[styles.rpa, press.style]}>
        <ArrowRight size={14} color={colors.gold} strokeWidth={2.4} />
      </Animated.View>
    </Pressable>
  );
}

/** Small gold line icons for the house-rule rows. */
function RuleIcon({kind}) {
  return (
    <View style={styles.oicon}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {kind === 'pets' ? (
          <>
            <Circle cx="6" cy="10" r="1.8" />
            <Circle cx="10" cy="6" r="1.8" />
            <Circle cx="14" cy="6" r="1.8" />
            <Circle cx="18" cy="10" r="1.8" />
            <Path d="M12 12c-2.6 0-5 2.8-5 5.2 0 1.6 1.3 2.3 2.6 2.3 1 0 1.6-.5 2.4-.5s1.4.5 2.4.5c1.3 0 2.6-.7 2.6-2.3C17 14.8 14.6 12 12 12z" />
          </>
        ) : kind === 'children' ? (
          <>
            <Circle cx="12" cy="6" r="2.6" />
            <Path d="M8 21v-5.5L6 13l2.5-3h7l2.5 3-2 2.5V21M12 15v6" />
          </>
        ) : (
          <Path d="M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5" />
        )}
      </Svg>
    </View>
  );
}

/** House, pets and children policies from the API; hidden when none are set. */
function OtherPolicies({items}) {
  if (!items?.length) {
    return null;
  }
  return (
    <Reveal style={styles.others}>
      {items.map((o, i) => (
        <View key={o.key} style={[styles.orow, i > 0 && styles.orowLine]}>
          <RuleIcon kind={o.key} />
          <View style={styles.pcopy}>
            <Text style={styles.tlabel}>{o.label.toUpperCase()}</Text>
            <Text style={styles.otext}>{o.text}</Text>
          </View>
        </View>
      ))}
    </Reveal>
  );
}

function GoodToKnow({checkIn, checkOut, policy, onOpenPolicy}) {
  useRenderCount('GoodToKnow');
  return (
    <View style={styles.sec}>
      <Reveal>
        <Text style={h2}>Good to know</Text>
      </Reveal>

      <Reveal style={styles.times}>
        <View style={styles.tcol}>
          <Sun />
          <Text style={styles.tlabel}>CHECK-IN</Text>
          <Text style={styles.tval}>{checkIn}</Text>
        </View>
        <TravelLine />
        <View style={[styles.tcol, styles.tcolEnd]}>
          <Moon />
          <Text style={styles.tlabel}>CHECK-OUT</Text>
          <Text style={[styles.tval, styles.right]}>{checkOut}</Text>
        </View>
      </Reveal>

      <Reveal style={styles.policy}>
        <View style={styles.pmain}>
          <Shield />
          <View style={styles.pcopy}>
            <Text style={styles.tlabel}>CANCELLATION</Text>
            <Text style={styles.ptitle}>{policy.title}</Text>
            {policy.sub ? <Text style={styles.psub}>{policy.sub}</Text> : null}
          </View>
        </View>
        {policy.rules.length ? <ReadPolicy onPress={onOpenPolicy} /> : null}
      </Reveal>

      <OtherPolicies items={policy.others} />
    </View>
  );
}

export default memo(GoodToKnow);

const box = {borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border};

const styles = StyleSheet.create({
  sec: {paddingTop: 30, gap: 12},
  times: {...box, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 18},
  tcol: {gap: 4},
  tcolEnd: {alignItems: 'flex-end'},
  right: {textAlign: 'right'},
  ticon: {width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4},
  sun: {backgroundColor: 'rgba(242,184,92,0.14)'},
  moon: {backgroundColor: 'rgba(160,170,255,0.12)'},
  shield: {width: 44, height: 44, borderRadius: 14, marginBottom: 0, backgroundColor: 'rgba(74,222,128,0.12)'},
  tlabel: {fontFamily: fonts.semibold, fontSize: 11, letterSpacing: ls(0.06, 11), color: '#ADA597'},
  tval: {fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: ls(-0.01, 20), color: '#fff'},
  tmid: {flex: 1, height: 30, alignSelf: 'flex-end', marginBottom: 6, alignItems: 'center', justifyContent: 'center'},
  tline: {position: 'absolute', left: 0, top: 14.25},
  travel: {
    position: 'absolute',
    top: 11,
    left: 0,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 0},
  },
  tpill: {
    height: 24,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.ground,
    borderWidth: 1,
    borderColor: 'rgba(241,221,186,0.25)',
  },
  tpillText: {fontFamily: fonts.bold, fontSize: 10.5, color: colors.gold},
  policy: {...box, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 6},
  pmain: {flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 14},
  pcopy: {flex: 1, gap: 3, minWidth: 0},
  ptitle: {fontFamily: fonts.extrabold, fontSize: 16, letterSpacing: ls(-0.01, 16), color: '#fff'},
  psub: {fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted},
  others: {...box, paddingHorizontal: 18},
  orow: {flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14},
  orowLine: {borderTopWidth: 1, borderTopColor: colors.hairline},
  oicon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(241,221,186,0.1)',
  },
  otext: {fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.cream},
  readpol: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  readpolText: {fontFamily: fonts.bold, fontSize: 13, color: colors.gold},
  rpa: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(241,221,186,0.35)',
  },
});
