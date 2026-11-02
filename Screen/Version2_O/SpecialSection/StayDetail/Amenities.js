// "Luxury Amenities" bento: animated icons (flow/flake/led, wifi, liq/bub,
// steam/twk, bell). The tiles are static (the design's tap-to-explore is off).
// Loops that only fade or move a shape run on a view around its own small
// drawing, so Android doesn't redraw the whole icon every frame.
import React, {memo, useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import Animated, {useAnimatedProps, useAnimatedStyle} from 'react-native-reanimated';
import Svg, {Circle, Defs, G, Path, RadialGradient, Rect, Stop} from 'react-native-svg';
import {colors, fonts} from '../theme';
import {E, Reveal, kf, useLoop} from '../anim';
import {useRenderCount} from '../perf';
import {h2} from './Suites';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const PEACH = '#F1A87A';
const ICE = '#BFE3FF';

/**
 * An overlay drawn in the icon's user space: the (x, y, w, h) box of it,
 * placed at (x, y) over the icon.
 */
function Layer({x = 0, y = 0, w, h, style, origin, svg, children}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.layer, {left: x, top: y, width: w, height: h}, origin && {transformOrigin: [origin[0] - x, origin[1] - y, 0]}, style]}>
      <Svg width={w} height={h} viewBox={`${x} ${y} ${w} ${h}`} fill="none" {...svg}>
        {children}
      </Svg>
    </Animated.View>
  );
}

/** `transform-box:fill-box` rotate around `origin` (spinf / liq). */
function useSpin(duration, stops, easing) {
  const p = useLoop(duration);
  return useAnimatedStyle(() => ({transform: [{rotate: `${kf(p.value, stops, easing)}deg`}]}));
}

// ---- Air conditioner: `.flow` (6 9 dashes, 1.6s), `.flake` spinf 6s, `.led` ledb.
function Flow({d, delay}) {
  const p = useLoop(1600, {delay});
  const props = useAnimatedProps(() => ({strokeDashoffset: -30 * p.value}));
  return <AnimatedPath d={d} stroke={ICE} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="6 9" animatedProps={props} />;
}

function AcIcon() {
  const led = useLoop(2000);
  const ledA = useAnimatedStyle(() => ({opacity: kf(led.value, [[0, 1], [0.5, 0.3], [1, 1]], E.easeInOut)}));
  const flake = useSpin(6000, [[0, 0], [1, 360]]);
  return (
    <View style={styles.acBox}>
      <Svg width={124} height={150} viewBox="0 0 124 150" fill="none">
        <Rect x="12" y="10" width="100" height="38" rx="12" fill="rgba(241,168,122,.12)" stroke={PEACH} strokeWidth={2} />
        <Path d="M26 36h72M26 42h72" stroke={PEACH} strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
      </Svg>
      <Layer x={94} y={17} w={8} h={8} style={ledA}>
        <Circle cx="98" cy="21" r="3" fill="#6EE7A0" />
      </Layer>
      <Layer x={20} y={56} w={84} h={94}>
        <Flow delay={0} d="M32 60c8 10-8 20 0 30s-8 20 0 30" />
        <Flow delay={-500} d="M62 60c8 10-8 20 0 30s-8 20 0 30s-8 14 0 22" />
        <Flow delay={-1000} d="M92 60c8 10-8 20 0 30s-8 20 0 30" />
      </Layer>
      <Layer w={124} h={150} origin={[18, 127]} style={flake}>
        <G stroke={ICE} strokeWidth={1.6} strokeLinecap="round">
          <Path d="M18 120v14M11 127h14M13 122l10 10M23 122l-10 10" />
        </G>
      </Layer>
    </View>
  );
}

// ---- Wi-Fi: `.w1/.w2/.w3` wifi 1.8s, delays 0 / .2s / .4s.
const WIFI = {stroke: PEACH, strokeWidth: 3, strokeLinecap: 'round'};

function Arc({d, delay}) {
  const p = useLoop(1800, {delay});
  const a = useAnimatedStyle(() => ({opacity: kf(p.value, [[0, 0.25], [0.4, 1], [1, 0.25]], E.easeInOut)}));
  return (
    <Layer w={58} h={48} style={a} svg={WIFI}>
      <Path d={d} />
    </Layer>
  );
}

function WifiIcon() {
  return (
    <View style={styles.wifiBox}>
      <Svg width={58} height={48} viewBox="0 0 58 48">
        <Circle cx="29" cy="42" r="3" fill={PEACH} />
      </Svg>
      <Arc delay={400} d="M4 18a35 35 0 0 1 50 0" />
      <Arc delay={200} d="M12 26a23 23 0 0 1 34 0" />
      <Arc delay={0} d="M20 34a11 11 0 0 1 18 0" />
    </View>
  );
}

// ---- Mini bar: `.liq` sway 2.2s, `.bub` rise 2.2s ease-in, delays 0 / .7s / 1.4s.
function Bubble({cx, cy, r, delay}) {
  const p = useLoop(2200, {delay});
  const a = useAnimatedStyle(() => ({
    opacity: kf(p.value, [[0, 0], [0.2, 1], [1, 0]], E.easeIn),
    transform: [{translateY: -10 * E.easeIn(p.value)}],
  }));
  return (
    <Layer x={cx - r} y={cy - r} w={2 * r} h={2 * r} style={a}>
      <Circle cx={cx} cy={cy} r={r} fill="#FFD3C2" />
    </Layer>
  );
}

function BarIcon() {
  const liq = useSpin(2200, [[0, -6], [0.5, 6], [1, -6]], E.easeInOut);
  return (
    <View style={styles.barBox}>
      <Svg width={48} height={54} viewBox="0 0 48 54" fill="none">
        <Path d="M10 4h28l-2.2 18a11.8 11.8 0 0 1-23.6 0z" stroke={PEACH} strokeWidth={2.4} strokeLinejoin="round" />
        <Path d="M24 34v13M16 49h16" stroke={PEACH} strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
      <Layer w={48} h={54} origin={[24, 23.35]} style={liq}>
        <Path d="M12.3 14h23.4l-1.2 8.2a10.5 10.5 0 0 1-21 0z" fill="rgba(241,120,90,.55)" />
      </Layer>
      <Bubble cx={20} cy={22} r={1.6} delay={0} />
      <Bubble cx={27} cy={24} r={1.2} delay={700} />
      <Bubble cx={24} cy={20} r={1} delay={1400} />
    </View>
  );
}

// ---- Housekeeping: `.steam` 2.4s, `.spk` twk 2.2s (s2 +1.1s).
function Sparkle({d, origin, delay}) {
  const p = useLoop(2200, {delay});
  const a = useAnimatedStyle(() => {
    const t = kf(p.value, [[0, 0], [0.5, 1], [1, 0]], E.easeInOut);
    return {opacity: t, transform: [{scale: 0.3 + 0.7 * t}, {rotate: `${45 * t}deg`}]};
  });
  return (
    <Layer w={86} h={64} origin={origin} style={a}>
      <Path d={d} fill={colors.gold} />
    </Layer>
  );
}

function HkIcon() {
  const p = useLoop(2400);
  const steam = useAnimatedStyle(() => ({
    opacity: kf(p.value, [[0, 0], [0.4, 1], [1, 0]], E.easeInOut),
    transform: [{translateY: kf(p.value, [[0, 2], [1, -3]], E.easeInOut)}],
  }));
  return (
    <View style={styles.hkBox}>
      <Layer w={86} h={64} style={steam}>
        <Path d="M34 16c-3-4 3-8 0-12M43 18c-3-4 3-8 0-12M52 16c-3-4 3-8 0-12" stroke="#E6E0D6" strokeWidth={2} strokeLinecap="round" />
      </Layer>
      <Svg width={86} height={64} viewBox="0 0 86 64" fill="none" strokeLinecap="round">
        <Path d="M14 52a29 29 0 0 1 58 0z" fill="rgba(241,168,122,.14)" stroke={PEACH} strokeWidth={2.4} strokeLinejoin="round" />
        <Path d="M8 54h70" stroke={PEACH} strokeWidth={3} />
        <Circle cx="43" cy="21" r="3" stroke={PEACH} strokeWidth={2.4} />
      </Svg>
      <Sparkle d="M76 14l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" origin={[76, 20.5]} delay={0} />
      <Sparkle d="M8 20l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" origin={[8, 24.5]} delay={1100} />
    </View>
  );
}

/** `.bell` badge on the housekeeping tile. */
function Bell() {
  return (
    <View style={styles.bell}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={PEACH} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M5 17h14M6 17a6 6 0 0 1 12 0M12 9V7.5" />
        <Circle cx="12" cy="6.5" r="1" />
      </Svg>
    </View>
  );
}

/**
 * `radial-gradient(circle at 85% 0%, rgba(241,168,122,a), transparent stop)`
 * over a flat base, sized to the tile (circle, farthest-corner).
 */
function Glow({w, h, alpha, stop, base, id}) {
  const cx = 0.85 * w;
  const r = Math.sqrt(cx * cx + h * h);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={id} cx={cx} cy={0} r={r} fx={cx} fy={0} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={PEACH} stopOpacity={alpha} />
          <Stop offset={stop} stopColor={PEACH} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={h} fill={base} />
      <Rect width={w} height={h} fill={`url(#${id})`} />
    </Svg>
  );
}

/** `.bt` tile. */
function Tile({id, label, style, row, children, after}) {
  const [size, setSize] = useState(null);
  return (
    <View style={style}>
      <View
        style={[styles.tile, row && styles.tileRow]}
        onLayout={e => setSize({w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height})}>
        {size ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
            <Glow id={id} w={size.w} h={size.h} alpha={0.12} stop={0.6} base={colors.card} />
          </View>
        ) : null}
        {children}
        <Text style={[styles.bl, row && styles.blRow]}>{label}</Text>
        {after}
      </View>
    </View>
  );
}

/** Amenities without an animated icon: a quiet pill each, under the bento. */
function More({items}) {
  return (
    <Reveal style={styles.more}>
      {items.map(a => (
        <View key={a.label} style={styles.mpill}>
          {a.icon ? (
            <Image source={a.icon} style={styles.micon} resizeMode="contain" />
          ) : (
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PEACH} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="m5 12.5 4.5 4.5L19 7.5" />
            </Svg>
          )}
          <Text style={styles.mtext}>{a.label}</Text>
        </View>
      ))}
    </Reveal>
  );
}

function Amenities({amenities}) {
  useRenderCount('Amenities');
  const {bento: b, more, count} = amenities;
  const right = b.wifi || b.minibar;
  return (
    <View>
      <Reveal style={styles.head}>
        <Text style={h2}>Luxury Amenities</Text>
        <Text style={styles.sub}>{count} included</Text>
      </Reveal>
      <Reveal style={styles.bento}>
        {b.ac || right ? (
          <View style={styles.cols}>
            {b.ac ? (
              <Tile id="ac" label={b.ac} style={styles.flex}>
                <AcIcon />
              </Tile>
            ) : null}
            {right ? (
              <View style={[styles.flex, styles.stack]}>
                {b.wifi ? (
                  <Tile id="wifi" label={b.wifi}>
                    <WifiIcon />
                  </Tile>
                ) : null}
                {b.minibar ? (
                  <Tile id="bar" label={b.minibar}>
                    <BarIcon />
                  </Tile>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
        {b.housekeeping ? (
          <Tile id="hk" row label={b.housekeeping} after={<Bell />}>
            <HkIcon />
          </Tile>
        ) : null}
      </Reveal>
      {more.length ? <More items={more} /> : null}
    </View>
  );
}

export default memo(Amenities);

const styles = StyleSheet.create({
  head: {flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 30, marginBottom: 12},
  layer: {position: 'absolute', top: 0, left: 0},
  acBox: {width: 124, height: 150, alignSelf: 'center'},
  wifiBox: {width: 58, height: 48},
  barBox: {width: 48, height: 54},
  hkBox: {width: 86, height: 64},
  sub: {fontFamily: fonts.regular, fontSize: 12, color: colors.muted},
  bento: {gap: 10},
  more: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10},
  mpill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  micon: {width: 16, height: 16, tintColor: PEACH},
  mtext: {fontFamily: fonts.regular, fontSize: 12.5, color: colors.soft},
  cols: {flexDirection: 'row', gap: 10},
  flex: {flex: 1},
  stack: {gap: 10},
  tile: {
    flexGrow: 1,
    minHeight: 118,
    padding: 14,
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tileRow: {flexDirection: 'row', alignItems: 'center', minHeight: 96},
  clip: {borderRadius: 21, overflow: 'hidden'},
  bl: {fontFamily: fonts.bold, fontSize: 13.5, color: colors.cream},
  blRow: {flex: 1, paddingLeft: 8},
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(241,168,122,0.4)',
  },
});
