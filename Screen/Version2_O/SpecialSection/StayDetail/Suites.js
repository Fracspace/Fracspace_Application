// "Available Suites": radio cards with `selpop`, radio tick and badge sheen.
import React, {memo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Path} from 'react-native-svg';
import {colors, fonts, ls, type} from '../theme';
import {E, Reveal, kf, usePressScale} from '../anim';
import {CHECK_D, FocusRing, Sweep, useShot, useTo} from './bits';
import {inr} from './data';
import {useRenderCount} from '../perf';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SELPOP = [[0, 0.97], [0.6, 1.015], [1, 1]];

function Suite({s, sel, onPick}) {
  useRenderCount('Suite');
  const press = usePressScale(0.97, 450);
  const pop = useShot(sel, 550); // `selpop .55s var(--spring)` each time it becomes selected
  const v = useTo(sel ? 1 : 0, 350); // border-color / box-shadow .35s
  const img = useTo(sel ? 1.06 : 1, 1000, E.out);
  const dim = useTo(sel ? 0 : 1, 400); // saturate(.75) brightness(.85) on the others
  const radio = useTo(sel ? 1 : 0, 300);
  const radioScale = useTo(sel ? 1.1 : 1, 450, E.spring);
  const tick = useTo(sel ? 0 : 20, 400, E.ease, sel ? 100 : 0);

  const box = useAnimatedStyle(() => ({
    borderColor: interpolateColor(v.value, [0, 1], ['rgba(255,255,255,0.08)', colors.gold]),
    shadowOpacity: 0.5 * v.value,
    transform: [{scale: sel ? kf(pop.value, SELPOP, E.spring) : 1}],
  }));
  const imgA = useAnimatedStyle(() => ({transform: [{scale: img.value}]}));
  const dimA = useAnimatedStyle(() => ({opacity: 0.18 * dim.value}));
  const radioA = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(radio.value, [0, 1], ['rgba(10,10,12,0.25)', colors.gold]),
    borderColor: interpolateColor(radio.value, [0, 1], ['rgba(255,255,255,0.85)', colors.gold]),
    transform: [{scale: radioScale.value}],
  }));
  const tickProps = useAnimatedProps(() => ({strokeDashoffset: tick.value}));

  return (
    <Reveal>
      <AnimatedPressable
        onPress={onPick}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="radio"
        accessibilityState={{checked: sel}}
        accessibilityLabel={`${s.name}, ${s.spec}, ₹${inr(s.price)} per night`}
        style={press.style}>
        <Animated.View style={[styles.suiteOuter, box]}>
          <FocusRing v={v} radius={22} color={colors.goldA(0.12)} />
          <View style={styles.suite}>
            <Animated.Image source={s.img} resizeMode="cover" style={[StyleSheet.absoluteFill, styles.img, imgA]} />
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimA]} />
            <LinearGradient
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              colors={['rgba(10,10,12,0)', 'rgba(10,10,12,0.88)']}
              locations={[0.3, 1]}
            />
            {s.badge ? (
              <View style={styles.gc}>
                <Text style={styles.gcText}>{s.badge}</Text>
                <Sweep duration={3400} alpha={0.8} />
              </View>
            ) : null}
            <Animated.View style={[styles.radio, radioA]}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <AnimatedPath
                  d={CHECK_D}
                  stroke={colors.ink}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={20}
                  animatedProps={tickProps}
                />
              </Svg>
            </Animated.View>
            <View style={styles.meta}>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.spec}>{s.spec}</Text>
            </View>
            <View style={styles.pbox}>
              <Text style={styles.price}>₹{inr(s.price)}</Text>
              <Text style={styles.per}>/nt</Text>
            </View>
          </View>
        </Animated.View>
      </AnimatedPressable>
    </Reveal>
  );
}

function Suites({suites, suite, onPick}) {
  return (
    <View>
      <Reveal style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.h2}>Available Suites</Text>
          <Text style={styles.sub}>Select a suite configuration for this stay</Text>
        </View>
        <Text style={styles.count}>{suites.length === 1 ? '1 Option' : `${suites.length} Options`}</Text>
      </Reveal>
      <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="Suite options">
        {suites.map(s => (
          <Suite key={s.id} s={s} sel={s.id === suite} onPick={() => onPick(s.id)} />
        ))}
      </View>
    </View>
  );
}

export default memo(Suites);

export const h2 = {...type.h2, fontSize: 19, letterSpacing: ls(-0.01, 19)};

const styles = StyleSheet.create({
  head: {flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28, marginBottom: 12},
  headText: {gap: 4},
  h2,
  sub: {fontFamily: fonts.regular, fontSize: 12, color: colors.muted},
  count: {fontFamily: fonts.bold, fontSize: 12, color: '#F1A87A'},
  list: {gap: 12},
  suiteOuter: {
    borderRadius: 22,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowRadius: 20,
    shadowOffset: {width: 0, height: 18},
  },
  suite: {height: 149, borderRadius: 20.5, overflow: 'hidden', backgroundColor: colors.card},
  img: {width: '100%', height: '100%'},
  dim: {backgroundColor: '#000'},
  gc: {
    position: 'absolute',
    top: 12,
    left: 12,
    height: 24,
    paddingHorizontal: 9,
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: colors.gold,
    overflow: 'hidden',
  },
  gcText: {fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: ls(0.08, 10), color: colors.ink},
  radio: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {position: 'absolute', left: 14, bottom: 14, gap: 3},
  name: {fontFamily: fonts.bold, fontSize: 16, color: '#fff'},
  spec: {fontFamily: fonts.regular, fontSize: 12, color: colors.soft},
  pbox: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(10,10,12,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  price: {fontFamily: fonts.extrabold, fontSize: 15, color: '#fff'},
  per: {fontFamily: fonts.regular, fontSize: 11, color: colors.muted},
});
