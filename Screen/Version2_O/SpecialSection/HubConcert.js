// "Concert Experiences": panning stage photo, swaying light beams, live dot,
// equaliser, shimmering ticket button and rippling play button.
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {useAnimatedStyle} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Path, Rect} from 'react-native-svg';
import {colors, fonts, type} from './theme';
import {E, Nudge, PressScale, Reveal, Sheen, kf, useLoop} from './anim';
import {Eyebrow, LiveDot} from './HubBits';
import {images} from './data';
import {useRenderCount} from './perf';
import {showDate} from './useNextConcert';

// .beam: sway 5.5s ease-in-out infinite alternate, rotate -20° → 20° from the top
function Beam({left, delay}) {
  const p = useLoop(5500, {delay, alternate: true});
  const a = useAnimatedStyle(() => ({
    transform: [{rotate: `${-20 + 40 * E.easeInOut(p.value)}deg`}],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.beam, {left}, a]}>
      <LinearGradient
        colors={['rgba(255,200,120,0.32)', 'rgba(255,200,120,0)', 'rgba(255,200,120,0)']}
        locations={[0, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// .eq i: scaleY .25 ↔ 1 from the bottom, each bar with its own tempo
const BARS = [
  [1000, 0],
  [800, -300],
  [1200, -600],
  [900, -200],
];
function EqBar({duration, delay}) {
  const p = useLoop(duration, {delay});
  const a = useAnimatedStyle(() => ({
    transform: [{scaleY: kf(p.value, [[0, 0.25], [0.5, 1], [1, 0.25]], E.easeInOut)}],
  }));
  return (
    <Animated.View style={[styles.eqBar, a]}>
      <LinearGradient colors={[colors.gold, colors.goldDark]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

// .playr::before/::after: two rings rippling out (2.4s ease-out, 1.2s apart)
function Ripple({delay}) {
  const p = useLoop(2400, {delay});
  const a = useAnimatedStyle(() => {
    const t = E.easeOut(p.value);
    return {opacity: 0.8 * (1 - t), transform: [{scale: 1 + 0.7 * t}]};
  });
  return <Animated.View pointerEvents="none" style={[styles.ring, a]} />;
}

function StagePhoto() {
  // pan 16s ease-in-out infinite alternate
  const p = useLoop(16000, {alternate: true});
  const a = useAnimatedStyle(() => {
    const t = E.easeInOut(p.value);
    return {transform: [{scale: 1.1 + 0.1 * t}, {translateX: -8 + 18 * t}]};
  });
  return <Animated.Image source={images.concert} resizeMode="cover" style={[StyleSheet.absoluteFill, styles.photo, a]} />;
}

/** `show` is useNextConcert()'s {concert, city}: the next show from the concert API. */
export default React.memo(function HubConcert({show, onOpen, onViewAll}) {
  useRenderCount('HubConcert');
  const {concert, city} = show;
  const open = () => onOpen(concert);
  return (
    <View style={styles.sec}>
      <Reveal style={styles.head}>
        <View style={{gap: 4, flexShrink: 1}}>
          <Text style={type.h2}>Concert Experiences</Text>
          <Text style={[type.muted, {fontSize: 12.5}]}>Live arena tours, musical nights</Text>
        </View>
        <Pressable onPress={onViewAll} style={styles.link} accessibilityRole="link">
          <Text style={type.link}>View all</Text>
          <Nudge style={type.link} />
        </Pressable>
      </Reveal>
      <Reveal>
        <View style={styles.concert}>
          <StagePhoto />
          <Beam left={190} delay={0} />
          <Beam left={260} delay={-2700} />
          <Beam left={320} delay={-1300} />
          <LinearGradient
            colors={['rgba(14,6,5,0.92)', 'rgba(14,6,5,0.6)', 'rgba(14,6,5,0.3)']}
            locations={[0, 0.6, 1]}
            start={{x: 0, y: 0.5}}
            end={{x: 1, y: 0.5}}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.body}>
            <Eyebrow dot={<LiveDot />}>{`LIVE IN ${city.city.toUpperCase()}`}</Eyebrow>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {concert.artist || concert.title}
              </Text>
              <View style={styles.eq}>
                {BARS.map(([d, dl]) => (
                  <EqBar key={d} duration={d} delay={dl} />
                ))}
              </View>
            </View>
            <View style={styles.dateRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth={1.8} strokeLinecap="round">
                <Rect x={4} y={5.5} width={16} height={14.5} rx={2.5} />
                <Path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
              </Svg>
              <Text style={styles.date} numberOfLines={1}>
                {showDate(city)} · {city.venue}
              </Text>
            </View>
            <View style={styles.actions}>
              <PressScale to={0.94} onPress={open} style={styles.tix} accessibilityRole="button">
                <Text style={styles.tixText}>Book Tickets</Text>
                <Nudge style={styles.tixText} />
                <Sheen duration={3600} rgb="255,255,255" alpha={0.75} band={[0.35, 0.5, 0.65]} angle={110} />
              </PressScale>
              <PressScale to={0.88} duration={400} onPress={open} style={styles.playr} accessibilityRole="button" accessibilityLabel="Play concert preview">
                <Ripple delay={0} />
                <Ripple delay={1200} />
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  <Path d="M8 5.5v13l11-6.5z" fill="#fff" />
                </Svg>
              </PressScale>
            </View>
          </View>
        </View>
      </Reveal>
    </View>
  );
});

const styles = StyleSheet.create({
  sec: {paddingTop: 34, paddingHorizontal: 20},
  head: {flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14},
  link: {flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44},
  concert: {
    height: 236,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#1A0806',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  photo: {width: '100%', height: '100%'},
  beam: {position: 'absolute', top: -40, width: 80, height: 300, transformOrigin: 'top', opacity: 0.85},
  body: {flex: 1, justifyContent: 'flex-end', gap: 10, padding: 20},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  title: {flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 22, color: '#fff'},
  eq: {flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 18},
  eqBar: {width: 4, height: '100%', borderRadius: 2, overflow: 'hidden', transformOrigin: 'bottom'},
  dateRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  date: {flexShrink: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.softer},
  actions: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4},
  tix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: colors.gold,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOpacity: 0.18,
    shadowRadius: 15,
    shadowOffset: {width: 0, height: 10},
  },
  tixText: {fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink},
  playr: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.whiteA(0.5),
  },
  ring: {
    position: 'absolute',
    left: -1,
    top: -1,
    right: -1,
    bottom: -1,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.whiteA(0.6),
  },
});
