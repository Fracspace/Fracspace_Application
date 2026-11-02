// `.hero`: photo gallery with Ken Burns, scroll parallax, video-tour ring,
// odometer counter and dots (StayDetail.dc.html).
import React, {memo, useEffect, useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import Video from 'react-native-video';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Circle, Path} from 'react-native-svg';
import {colors, fonts} from '../theme';
import {E, PressScale, ViewportGate, useLoop, useReducedMotion} from '../anim';
import {BackIcon, GlassButton} from '../HubBits';
import {Odo, ShareIcon, useTo} from './bits';
import {useRenderCount} from '../perf';

export const HERO_H = 420;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 69.1; // 2πr, r = 11

/**
 * `.gi` / `.gi.on`: opacity .7s ease; the active photo snaps to scale(1) and
 * runs `kb` (9s ease-out, .7s delay, to scale 1.08); a leaving photo
 * transitions back to 1.08 over 1.2s --out.
 */
function Photo({item, on}) {
  const reduced = useReducedMotion();
  const o = useSharedValue(on ? 1 : 0);
  const s = useSharedValue(on ? 1 : 1.08);
  useEffect(() => {
    if (reduced) {
      o.value = on ? 1 : 0;
      s.value = 1;
      return;
    }
    o.value = withTiming(on ? 1 : 0, {duration: 700, easing: E.ease});
    if (on) {
      s.value = 1;
      s.value = withDelay(700, withTiming(1.08, {duration: 9000, easing: E.easeOut}));
    } else {
      s.value = withTiming(1.08, {duration: 1200, easing: E.out});
    }
  }, [on, reduced, o, s]);
  const a = useAnimatedStyle(() => ({opacity: o.value, transform: [{scale: s.value}]}));
  return (
    <Animated.Image
      source={item.img}
      accessibilityLabel={item.alt}
      resizeMode="cover"
      style={[StyleSheet.absoluteFill, styles.photo, a]}
    />
  );
}

/** `.gdots i`: width 5→18 (.45s --out), background .45→1 white (.3s). */
function Dot({on}) {
  const w = useTo(on ? 18 : 5, 450, E.out);
  const c = useTo(on ? 1 : 0, 300);
  const a = useAnimatedStyle(() => ({
    width: w.value,
    backgroundColor: interpolateColor(c.value, [0, 1], ['rgba(255,255,255,0.45)', '#FFFFFF']),
  }));
  return <Animated.View style={[styles.dot, a]} />;
}

/** `.ring .prog`: stroke-dashoffset 69.1→0, 6s linear infinite. */
function TourRing() {
  const p = useLoop(6000);
  const props = useAnimatedProps(() => ({strokeDashoffset: RING * (1 - p.value)}));
  return (
    <View style={styles.ringBox}>
      <Svg width={26} height={26} viewBox="0 0 26 26" style={styles.ringSvg}>
        <Circle cx="13" cy="13" r="11" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={2} />
        <AnimatedCircle
          cx="13"
          cy="13"
          r="11"
          fill="none"
          stroke={colors.gold}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={RING}
          animatedProps={props}
        />
      </Svg>
      <Svg width={10} height={10} viewBox="0 0 24 24" fill="#fff">
        <Path d="M7 4.5v15l13-7.5z" />
      </Svg>
    </View>
  );
}

const COUNTS = Array.from({length: 60}, (_, i) => String(i + 1));

/** Full-screen video tour, opened from the "Video Tour" pill. */
function TourPlayer({tour, onClose}) {
  return (
    <Modal visible animationType="fade" supportedOrientations={['portrait', 'landscape']} onRequestClose={onClose}>
      <View style={styles.player}>
        <Video
          source={{uri: tour.url}}
          poster={tour.thumb || undefined}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          controls
          onEnd={onClose}
        />
        <GlassButton label="Close video tour" onPress={onClose} style={styles.playerClose}>
          <BackIcon />
        </GlassButton>
      </View>
    </Modal>
  );
}

function Hero({gallery, tour, scrollY, top, onBack, onShare}) {
  useRenderCount('Hero');
  const [img, setImg] = useState(0);
  const [playing, setPlaying] = useState(false);
  const n = gallery.length;
  // `.gal` parallax: scroll 0→420px → translateY 170, scale 1.06, brightness .55.
  const par = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, scrollY.value / HERO_H));
    return {transform: [{translateY: 170 * p}, {scale: 1 + 0.06 * p}]};
  });
  const dim = useAnimatedStyle(() => ({opacity: 0.45 * Math.min(1, Math.max(0, scrollY.value / HERO_H))}));

  return (
    <View style={styles.hero}>
      <Animated.View style={[StyleSheet.absoluteFill, par]}>
        {gallery.map((g, i) => (
          <Photo key={i} item={g} on={i === img} />
        ))}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dim]} />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        colors={['rgba(10,10,12,0.45)', 'rgba(10,10,12,0)', 'rgba(10,10,12,0)', 'rgba(10,10,12,0.75)']}
        locations={[0, 0.22, 0.7, 1]}
      />
      <Pressable
        style={[styles.tap, styles.tapL]}
        onPress={() => setImg((img + n - 1) % n)}
        accessibilityRole="button"
        accessibilityLabel="Previous photo"
      />
      <Pressable
        style={[styles.tap, styles.tapR]}
        onPress={() => setImg((img + 1) % n)}
        accessibilityRole="button"
        accessibilityLabel="Next photo"
      />
      <GlassButton label="Back to stays" onPress={onBack} style={[styles.gbtn, styles.gbtnL, {top}]}>
        <BackIcon />
      </GlassButton>
      <GlassButton label="Share stay" onPress={onShare} style={[styles.gbtn, styles.gbtnR, {top}]}>
        <ShareIcon />
      </GlassButton>

      <View style={styles.dots} pointerEvents="none">
        {gallery.map((g, i) => (
          <Dot key={i} on={i === img} />
        ))}
      </View>

      <View style={styles.foot}>
        {tour ? (
          <PressScale
            to={0.92}
            duration={400}
            onPress={() => tour.url && setPlaying(true)}
            accessibilityRole="button"
            accessibilityLabel={`Play video tour, ${tour.secs} seconds`}
            style={styles.gpill}>
            <ViewportGate>
              <TourRing />
            </ViewportGate>
            <Text style={styles.gpillText}>Video Tour ({tour.dur})</Text>
          </PressScale>
        ) : (
          <View />
        )}
        <View style={[styles.gpill, styles.count]}>
          <Odo index={img} h={16} items={COUNTS.slice(0, n)} duration={600} textStyle={styles.countText} />
          <Text style={styles.countText}>{' '}/ {n}</Text>
        </View>
      </View>
      {playing ? <TourPlayer tour={tour} onClose={() => setPlaying(false)} /> : null}
    </View>
  );
}

export default memo(Hero);

const styles = StyleSheet.create({
  player: {flex: 1, backgroundColor: '#000'},
  playerClose: {position: 'absolute', top: 54, left: 16},
  hero: {height: HERO_H, overflow: 'hidden', backgroundColor: '#000'},
  photo: {width: '100%', height: '100%'},
  dim: {backgroundColor: '#000'},
  tap: {position: 'absolute', top: 80, bottom: 70, width: '50%', zIndex: 2},
  tapL: {left: 0},
  tapR: {right: 0},
  gbtn: {position: 'absolute', zIndex: 3, borderColor: 'rgba(255,255,255,0.2)'},
  gbtnL: {left: 20},
  gbtnR: {right: 20},
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 70,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    zIndex: 3,
  },
  dot: {height: 5, borderRadius: 3},
  foot: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  gpill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,12,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  gpillText: {fontFamily: fonts.semibold, fontSize: 12.5, color: '#fff'},
  ringBox: {width: 26, height: 26, alignItems: 'center', justifyContent: 'center'},
  ringSvg: {position: 'absolute', top: 0, left: 0, transform: [{rotate: '-90deg'}]},
  count: {paddingHorizontal: 12, gap: 0},
  countText: {fontFamily: fonts.bold, fontSize: 12, color: '#fff'},
});
