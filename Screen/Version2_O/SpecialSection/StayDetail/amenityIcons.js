// Animated amenity icons for the Stay Detail bento, and the name → icon lookup.
// Same rules as the original four (PERF.md §3 B2): the still parts are one
// `Svg`; every moving shape is its own small `Svg` inside an `Animated.View`
// that only changes transform / opacity. Loops pause through the section's
// ViewportGate / the screen's LoopGate (useLoop).
import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {useAnimatedProps, useAnimatedStyle} from 'react-native-reanimated';
import Svg, {Circle, Ellipse, G, Path, Rect} from 'react-native-svg';
import {colors} from '../theme';
import {E, kf, useLoop} from '../anim';

const AnimatedPath = Animated.createAnimatedComponent(Path);
export const PEACH = '#F1A87A';
const ICE = '#BFE3FF';
const MINT = '#6EE7A0';
const FILL = 'rgba(241,168,122,.12)';
const LINE = {stroke: PEACH, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round'};

/**
 * An overlay drawn in the icon's user space: the (x, y, w, h) box of it,
 * placed at (x, y) over the icon. `origin` is in icon coordinates.
 */
export function Layer({x = 0, y = 0, w, h, style, origin, svg, children}) {
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

/** Clips its children to the (x, y, w, h) box of the icon. */
function Clip({x, y, w, h, children}) {
  return (
    <View pointerEvents="none" style={[styles.layer, styles.clip, {left: x, top: y, width: w, height: h}]}>
      {children}
    </View>
  );
}

function Box({w, h, children}) {
  return <View style={{width: w, height: h}}>{children}</View>;
}

/** A looping track → animated style (`track` is a worklet of p 0..1). */
function useTrack(duration, track, delay = 0) {
  const p = useLoop(duration, {delay});
  return useAnimatedStyle(() => track(p.value));
}

/** `transform-box:fill-box` rotate around a point (spinf / liq / sway). */
function useSpin(duration, stops, easing, delay = 0) {
  return useTrack(duration, p => {
    'worklet';
    return {transform: [{rotate: `${kf(p, stops, easing)}deg`}]};
  }, delay);
}

const fadeRise = (from, to) => p => {
  'worklet';
  return {
    opacity: kf(p, [[0, 0], [0.4, 1], [1, 0]], E.easeInOut),
    transform: [{translateY: kf(p, [[0, from], [1, to]], E.easeInOut)}],
  };
};

/** Wavy line from x0 to x0 + len at height y (period `per`, amplitude `amp`). */
function wave(x0, y, len, per, amp) {
  let d = `M${x0} ${y}`;
  for (let x = 0; x < len; x += per) {
    d += `q${per / 4} ${-amp} ${per / 2} 0t${per / 2} 0`;
  }
  return d;
}

/** Water that drifts sideways by one wave period, clipped to (x, y, w, h). */
function Waves({x, y, w, h, lines, per = 12, duration = 2400, reverse}) {
  const a = useTrack(duration, p => {
    'worklet';
    return {transform: [{translateX: reverse ? -per * (1 - p) : -per * p}]};
  });
  return (
    <Clip x={x} y={y} w={w} h={h}>
      <Animated.View style={[styles.layer, {width: w + per, height: h}, a]}>
        <Svg width={w + per} height={h} viewBox={`${x} ${y} ${w + per} ${h}`} fill="none">
          {lines.map(([ly, color]) => (
            <Path key={ly} d={wave(x, ly, w + per, per, 2.5)} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
          ))}
        </Svg>
      </Animated.View>
    </Clip>
  );
}

/** Rising steam / smoke wisps (`steam`: fade in by 40 %, drift up). */
function Steam({x, y, w, h, d, color = '#E6E0D6', duration = 2400, delay = 0}) {
  const a = useTrack(duration, fadeRise(2, -3), delay);
  return (
    <Layer x={x} y={y} w={w} h={h} style={a}>
      <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Layer>
  );
}

/** `twk` sparkle: fade + scale .3→1 + 45deg twist. */
function Sparkle({x, y, w, h, d, origin, delay}) {
  const a = useTrack(2200, p => {
    'worklet';
    const t = kf(p, [[0, 0], [0.5, 1], [1, 0]], E.easeInOut);
    return {opacity: t, transform: [{scale: 0.3 + 0.7 * t}, {rotate: `${45 * t}deg`}]};
  }, delay);
  return (
    <Layer x={x} y={y} w={w} h={h} origin={origin} style={a}>
      <Path d={d} fill={colors.gold} />
    </Layer>
  );
}

const SPARK = (cx, cy, r) =>
  `M${cx} ${cy - r}l${r * 0.35} ${r * 0.65} ${r * 0.65} ${r * 0.35}-${r * 0.65} ${r * 0.35}-${r * 0.35} ${r * 0.65}-${r * 0.35}-${r * 0.65}-${r * 0.65}-${r * 0.35} ${r * 0.65}-${r * 0.35}z`;

// =========================================================== original four

// ---- Air conditioner: `.flow` (6 9 dashes, 1.6s), `.flake` spinf 6s, `.led` ledb.
function Flow({d, delay}) {
  const p = useLoop(1600, {delay});
  const props = useAnimatedProps(() => ({strokeDashoffset: -30 * p.value}));
  return <AnimatedPath d={d} stroke={ICE} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="6 9" animatedProps={props} />;
}

export const AcIcon = memo(function AcIcon() {
  const led = useTrack(2000, p => {
    'worklet';
    return {opacity: kf(p, [[0, 1], [0.5, 0.3], [1, 1]], E.easeInOut)};
  });
  const flake = useSpin(6000, [[0, 0], [1, 360]]);
  return (
    <Box w={124} h={150}>
      <Svg width={124} height={150} viewBox="0 0 124 150" fill="none">
        <Rect x="12" y="10" width="100" height="38" rx="12" fill={FILL} stroke={PEACH} strokeWidth={2} />
        <Path d="M26 36h72M26 42h72" stroke={PEACH} strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
      </Svg>
      <Layer x={94} y={17} w={8} h={8} style={led}>
        <Circle cx="98" cy="21" r="3" fill={MINT} />
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
    </Box>
  );
});

// ---- Wi-Fi: `.w1/.w2/.w3` wifi 1.8s, delays 0 / .2s / .4s.
const WIFI = {stroke: PEACH, strokeWidth: 3, strokeLinecap: 'round'};

function Arc({d, delay}) {
  const a = useTrack(1800, p => {
    'worklet';
    return {opacity: kf(p, [[0, 0.25], [0.4, 1], [1, 0.25]], E.easeInOut)};
  }, delay);
  return (
    <Layer w={58} h={48} style={a} svg={WIFI}>
      <Path d={d} />
    </Layer>
  );
}

export const WifiIcon = memo(function WifiIcon() {
  return (
    <Box w={58} h={48}>
      <Svg width={58} height={48} viewBox="0 0 58 48">
        <Circle cx="29" cy="42" r="3" fill={PEACH} />
      </Svg>
      <Arc delay={400} d="M4 18a35 35 0 0 1 50 0" />
      <Arc delay={200} d="M12 26a23 23 0 0 1 34 0" />
      <Arc delay={0} d="M20 34a11 11 0 0 1 18 0" />
    </Box>
  );
});

// ---- Mini bar: `.liq` sway 2.2s, `.bub` rise 2.2s ease-in, delays 0 / .7s / 1.4s.
function Bubble({cx, cy, r, delay}) {
  const a = useTrack(2200, p => {
    'worklet';
    return {
      opacity: kf(p, [[0, 0], [0.2, 1], [1, 0]], E.easeIn),
      transform: [{translateY: -10 * E.easeIn(p)}],
    };
  }, delay);
  return (
    <Layer x={cx - r} y={cy - r} w={2 * r} h={2 * r} style={a}>
      <Circle cx={cx} cy={cy} r={r} fill="#FFD3C2" />
    </Layer>
  );
}

export const BarIcon = memo(function BarIcon() {
  const liq = useSpin(2200, [[0, -6], [0.5, 6], [1, -6]], E.easeInOut);
  return (
    <Box w={48} h={54}>
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
    </Box>
  );
});

// ---- Housekeeping: `.steam` 2.4s, `.spk` twk 2.2s (s2 +1.1s).
export const HkIcon = memo(function HkIcon() {
  return (
    <Box w={86} h={64}>
      <Steam x={0} y={0} w={86} h={64} d="M34 16c-3-4 3-8 0-12M43 18c-3-4 3-8 0-12M52 16c-3-4 3-8 0-12" />
      <Svg width={86} height={64} viewBox="0 0 86 64" fill="none" strokeLinecap="round">
        <Path d="M14 52a29 29 0 0 1 58 0z" fill="rgba(241,168,122,.14)" stroke={PEACH} strokeWidth={2.4} strokeLinejoin="round" />
        <Path d="M8 54h70" stroke={PEACH} strokeWidth={3} />
        <Circle cx="43" cy="21" r="3" stroke={PEACH} strokeWidth={2.4} />
      </Svg>
      <Sparkle w={86} h={64} d="M76 14l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" origin={[76, 20.5]} delay={0} />
      <Sparkle w={86} h={64} d="M8 20l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" origin={[8, 24.5]} delay={1100} />
    </Box>
  );
});

// =========================================================== new icons

// ---- Pool: ladder + water drifting both ways.
const PoolIcon = memo(function PoolIcon() {
  return (
    <Box w={58} h={50}>
      <Svg width={58} height={50} viewBox="0 0 58 50" fill="none" {...LINE}>
        <Path d="M4 28h50v14a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill={FILL} />
        <Path d="M36 28V8a4 4 0 0 1 8 0M46 28V8a4 4 0 0 1 8 0M36 15h10M36 22h10" />
      </Svg>
      <Waves x={6} y={30} w={46} h={16} lines={[[35, ICE], [42, 'rgba(191,227,255,.55)']]} />
    </Box>
  );
});

// ---- Parking: P sign; a car rolls into the bay, waits, fades.
const ParkingIcon = memo(function ParkingIcon() {
  const car = useTrack(3200, p => {
    'worklet';
    return {
      opacity: kf(p, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]], E.easeInOut),
      transform: [{translateX: kf(p, [[0, 14], [0.4, 0], [1, 0]], E.out)}],
    };
  });
  return (
    <Box w={58} h={50}>
      <Svg width={58} height={50} viewBox="0 0 58 50" fill="none" {...LINE}>
        <Rect x="4" y="4" width="26" height="30" rx="7" fill={FILL} />
        <Path d="M13 28V11h6a5 5 0 0 1 0 10h-6M17 34v12" strokeWidth={2.6} />
        <Path d="M32 47h22" opacity={0.5} />
      </Svg>
      <Layer x={32} y={30} w={24} h={16} style={car} svg={{stroke: ICE, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'}}>
        <Path d="M35 42v-4l3-5h12l3 5v4zM37 42v2M51 42v2" fill="rgba(191,227,255,.15)" />
      </Layer>
    </Box>
  );
});

// ---- Kitchen: pot with a rattling lid and steam.
const KitchenIcon = memo(function KitchenIcon() {
  const lid = useTrack(1800, p => {
    'worklet';
    return {transform: [{translateY: kf(p, [[0, 0], [0.08, -2], [0.16, 0], [0.24, -2], [0.32, 0], [1, 0]], E.easeInOut)}]};
  });
  return (
    <Box w={56} h={50}>
      <Steam x={14} y={0} w={28} h={16} d="M20 14c-2-3 2-6 0-9M28 14c-2-3 2-6 0-9M36 14c-2-3 2-6 0-9" />
      <Svg width={56} height={50} viewBox="0 0 56 50" fill="none" {...LINE}>
        <Path d="M10 24h36v14a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8z" fill={FILL} />
        <Path d="M10 28H5M46 28h5" />
      </Svg>
      <Layer x={4} y={14} w={48} h={10} style={lid} svg={LINE}>
        <Path d="M8 21h40M24 21v-3h8v3" />
      </Layer>
    </Box>
  );
});

// ---- Breakfast / coffee: cup with two wisps.
const BreakfastIcon = memo(function BreakfastIcon() {
  return (
    <Box w={52} h={50}>
      <Steam x={12} y={2} w={20} h={16} d="M18 16c-2-3 2-6 0-9" />
      <Steam x={20} y={2} w={20} h={16} d="M26 16c-2-3 2-6 0-9" delay={1200} />
      <Svg width={52} height={50} viewBox="0 0 52 50" fill="none" {...LINE}>
        <Path d="M8 21h28v12a10 10 0 0 1-10 10h-8A10 10 0 0 1 8 33z" fill={FILL} />
        <Path d="M36 25h4a5 5 0 0 1 0 10h-4M4 47h40" />
      </Svg>
    </Box>
  );
});

// ---- Gym: dumbbell lifted and lowered.
const GymIcon = memo(function GymIcon() {
  const lift = useTrack(1600, p => {
    'worklet';
    return {transform: [{translateY: kf(p, [[0, 4], [0.4, -4], [0.6, -4], [1, 4]], E.easeInOut)}]};
  });
  return (
    <Box w={60} h={48}>
      <Svg width={60} height={48} viewBox="0 0 60 48" fill="none" {...LINE}>
        <Path d="M6 45h48" opacity={0.5} />
      </Svg>
      <Layer x={2} y={2} w={56} h={40} style={lift} svg={{stroke: PEACH, strokeLinecap: 'round'}}>
        <Path d="M14 22h32" strokeWidth={2.4} />
        <Path d="M8 14v16M14 10v24M46 10v24M52 14v16" strokeWidth={3.6} />
      </Layer>
    </Box>
  );
});

// ---- Spa: balanced stones, a swaying leaf and a sparkle.
const SpaIcon = memo(function SpaIcon() {
  const leaf = useSpin(3000, [[0, -8], [0.5, 6], [1, -8]], E.easeInOut);
  return (
    <Box w={56} h={50}>
      <Svg width={56} height={50} viewBox="0 0 56 50" fill={FILL} {...LINE}>
        <Ellipse cx="28" cy="42" rx="16" ry="5" />
        <Ellipse cx="28" cy="32" rx="11" ry="4.5" />
        <Ellipse cx="28" cy="23.5" rx="7" ry="3.5" />
      </Svg>
      <Layer x={34} y={4} w={20} h={18} origin={[36, 20]} style={leaf}>
        <Path d="M36 20c2-8 9-13 15-13-1 7-5 13-15 13z" fill="rgba(110,231,160,.3)" stroke={MINT} strokeWidth={2} strokeLinejoin="round" />
      </Layer>
      <Sparkle x={6} y={6} w={12} h={12} d={SPARK(12, 12, 5)} origin={[12, 12]} delay={0} />
    </Box>
  );
});

// ---- TV: a light band scanning the screen, blinking power LED.
const TvIcon = memo(function TvIcon() {
  const scan = useTrack(2400, p => {
    'worklet';
    return {transform: [{translateY: 22 * kf(p, [[0, 0], [0.5, 1], [1, 0]], E.easeInOut)}]};
  });
  const led = useTrack(2000, p => {
    'worklet';
    return {opacity: kf(p, [[0, 1], [0.5, 0.3], [1, 1]], E.easeInOut)};
  });
  return (
    <Box w={58} h={48}>
      <Svg width={58} height={48} viewBox="0 0 58 48" fill="none" {...LINE}>
        <Rect x="5" y="5" width="48" height="30" rx="5" fill={FILL} />
        <Path d="M22 44h14M29 35v9" />
        <Path d="M26 15v10l8-5z" fill={PEACH} stroke="none" />
      </Svg>
      <Clip x={7} y={7} w={44} h={26}>
        <Animated.View style={[styles.scan, scan]} />
      </Clip>
      <Layer x={45} y={28} w={6} h={6} style={led}>
        <Circle cx="48" cy="31" r="1.6" fill={MINT} />
      </Layer>
    </Box>
  );
});

// ---- Workspace: laptop with code lines and a blinking cursor.
const WorkIcon = memo(function WorkIcon() {
  const cursor = useTrack(1100, p => {
    'worklet';
    return {opacity: p < 0.5 ? 1 : 0};
  });
  return (
    <Box w={60} h={46}>
      <Svg width={60} height={46} viewBox="0 0 60 46" fill="none" {...LINE}>
        <Path d="M12 6h36a3 3 0 0 1 3 3v23H9V9a3 3 0 0 1 3-3z" fill={FILL} />
        <Path d="M4 34h52l-3 6H7z" />
        <Path d="M15 13h14M15 19h22M15 25h10" stroke={colors.gold} strokeWidth={2} opacity={0.7} />
      </Svg>
      <Layer x={27} y={21} w={4} h={8} style={cursor}>
        <Rect x="27.5" y="22" width="2.5" height="6" rx="1" fill={colors.gold} />
      </Layer>
    </Box>
  );
});

// ---- Pets: paw pad with toes hopping in turn.
function Toe({cx, cy, delay}) {
  const a = useTrack(1800, p => {
    'worklet';
    return {transform: [{translateY: kf(p, [[0, 0], [0.1, -3], [0.2, 0], [1, 0]], E.easeInOut)}]};
  }, delay);
  return (
    <Layer x={cx - 5} y={cy - 6} w={10} h={12} style={a}>
      <Ellipse cx={cx} cy={cy} rx="3.6" ry="4.6" fill={FILL} stroke={PEACH} strokeWidth={2.2} />
    </Layer>
  );
}

const PetIcon = memo(function PetIcon() {
  return (
    <Box w={52} h={50}>
      <Svg width={52} height={50} viewBox="0 0 52 50" fill="none" {...LINE}>
        <Path d="M26 46c-8 0-13-4-13-9 0-6 6-10 13-10s13 4 13 10c0 5-5 9-13 9z" fill={FILL} />
      </Svg>
      <Toe cx={11} cy={24} delay={0} />
      <Toe cx={19} cy={14} delay={150} />
      <Toe cx={33} cy={14} delay={300} />
      <Toe cx={41} cy={24} delay={450} />
    </Box>
  );
});

// ---- Fireplace: two flames flickering from their base.
function Flame({d, fill, delay}) {
  const a = useTrack(900, p => {
    'worklet';
    const s = kf(p, [[0, 1], [0.3, 1.12], [0.6, 0.94], [1, 1]], E.easeInOut);
    return {transform: [{scaleY: s}, {scaleX: 2 - s}]};
  }, delay);
  return (
    <Layer x={16} y={14} w={24} h={30} origin={[28, 43]} style={a}>
      <Path d={d} fill={fill} />
    </Layer>
  );
}

const FireIcon = memo(function FireIcon() {
  return (
    <Box w={56} h={50}>
      <Svg width={56} height={50} viewBox="0 0 56 50" fill="none" {...LINE}>
        <Path d="M10 47V18h36v29M5 47h46" fill={FILL} />
      </Svg>
      <Flame d="M28 43c-7 0-9-6-6-11 1 3 3 4 4 4-1-6 2-10 6-13 0 5 5 7 5 13 0 4-3 7-9 7z" fill="rgba(241,120,90,.75)" delay={0} />
      <Flame d="M28 43c-3 0-5-2-4-6 1 1 2 2 3 2 0-3 1-5 3-7 0 3 3 4 3 7 0 2-2 4-5 4z" fill={colors.gold} delay={450} />
      <Svg width={56} height={50} viewBox="0 0 56 50" fill="none" style={StyleSheet.absoluteFill}>
        <Path d="M17 44l22-5M17 39l22 5" stroke="#B98A4B" strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </Box>
  );
});

// ---- Garden: potted plant swaying from the soil.
const GardenIcon = memo(function GardenIcon() {
  const sway = useSpin(3000, [[0, -5], [0.5, 5], [1, -5]], E.easeInOut);
  return (
    <Box w={52} h={52}>
      <Layer x={8} y={4} w={36} h={34} origin={[26, 36]} style={sway} svg={{stroke: MINT, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'}}>
        <Path d="M26 36V18" />
        <Path d="M26 27c-8 0-12-5-12-11 7 0 12 4 12 11zM26 22c8 0 12-5 12-11-7 0-12 4-12 11z" fill="rgba(110,231,160,.3)" />
      </Layer>
      <Svg width={52} height={52} viewBox="0 0 52 52" fill="none" style={StyleSheet.absoluteFill} {...LINE}>
        <Path d="M14 36h24l-3 13H17z" fill="rgba(241,168,122,.2)" />
      </Svg>
    </Box>
  );
});

// ---- Beach: umbrella, a bobbing sun, rolling waves.
const BeachIcon = memo(function BeachIcon() {
  const sun = useTrack(3200, p => {
    'worklet';
    return {transform: [{translateY: kf(p, [[0, 2], [0.5, -2], [1, 2]], E.easeInOut)}]};
  });
  return (
    <Box w={58} h={50}>
      <Layer x={30} y={4} w={20} h={20} style={sun}>
        <Circle cx="40" cy="14" r="7" fill="rgba(241,221,186,.3)" stroke={colors.gold} strokeWidth={2} />
      </Layer>
      <Svg width={58} height={50} viewBox="0 0 58 50" fill="none" {...LINE}>
        <Path d="M6 28a14 14 0 0 1 28 0zM20 28v12" fill={FILL} />
      </Svg>
      <Waves x={2} y={38} w={54} h={12} lines={[[44, ICE]]} reverse />
    </Box>
  );
});

// ---- Power backup: battery bars charging one after another.
function Cell({x, i}) {
  const a = useTrack(2400, p => {
    'worklet';
    const on = 0.1 + i * 0.2;
    return {opacity: kf(p, [[0, 0.15], [on, 0.15], [on + 0.1, 1], [0.85, 1], [1, 0.15]], E.easeInOut)};
  });
  return (
    <Layer x={x} y={12} w={10} h={20} style={a}>
      <Rect x={x + 0.5} y="13" width="9" height="18" rx="2" fill={PEACH} />
    </Layer>
  );
}

const PowerIcon = memo(function PowerIcon() {
  return (
    <Box w={56} h={44}>
      <Svg width={56} height={44} viewBox="0 0 56 44" fill="none" {...LINE}>
        <Rect x="4" y="8" width="42" height="28" rx="6" fill={FILL} />
        <Path d="M51 17v10" strokeWidth={3.2} />
      </Svg>
      <Cell x={8} i={0} />
      <Cell x={20} i={1} />
      <Cell x={32} i={2} />
    </Box>
  );
});

// ---- Washing machine: the drum turning.
const LaundryIcon = memo(function LaundryIcon() {
  const drum = useSpin(2400, [[0, 0], [1, 360]]);
  return (
    <Box w={50} h={54}>
      <Svg width={50} height={54} viewBox="0 0 50 54" fill="none" {...LINE}>
        <Rect x="5" y="4" width="40" height="46" rx="7" fill={FILL} />
        <Path d="M5 14h40" />
        <Circle cx="25" cy="32" r="12" />
        <Circle cx="12" cy="9" r="1.6" fill={PEACH} stroke="none" />
        <Circle cx="19" cy="9" r="1.6" fill={PEACH} stroke="none" />
      </Svg>
      <Layer x={15} y={22} w={20} h={20} origin={[25, 32]} style={drum}>
        <Path d="M18 31q3.5-4 7 0t7 0" stroke={ICE} strokeWidth={2} strokeLinecap="round" />
        <Circle cx="28" cy="37" r="2" fill={ICE} />
      </Layer>
    </Box>
  );
});

// ---- BBQ: kettle grill, glowing embers, two smoke wisps.
function Ember({cx, delay}) {
  const a = useTrack(1400, p => {
    'worklet';
    return {opacity: kf(p, [[0, 0.3], [0.5, 1], [1, 0.3]], E.easeInOut)};
  }, delay);
  return (
    <Layer x={cx - 3} y={23} w={6} h={6} style={a}>
      <Circle cx={cx} cy="26" r="2" fill="#FF6B5A" />
    </Layer>
  );
}

const BbqIcon = memo(function BbqIcon() {
  return (
    <Box w={56} h={54}>
      <Steam x={14} y={0} w={14} h={18} d="M21 16c-3-3 3-6 0-10" />
      <Steam x={28} y={0} w={14} h={18} d="M35 16c-3-3 3-6 0-10" delay={1200} />
      <Svg width={56} height={54} viewBox="0 0 56 54" fill="none" {...LINE}>
        <Path d="M8 22h40a20 20 0 0 1-40 0z" fill={FILL} />
        <Path d="M18 40l-5 11M38 40l5 11M28 42v9" />
      </Svg>
      <Ember cx={20} delay={0} />
      <Ember cx={28} delay={450} />
      <Ember cx={36} delay={900} />
    </Box>
  );
});

// ---- Balcony / view: hills under a turning sun (`spinsun`).
const ViewIcon = memo(function ViewIcon() {
  const sun = useSpin(12000, [[0, 0], [1, 360]]);
  return (
    <Box w={58} h={48}>
      <Layer x={34} y={2} w={20} h={20} origin={[44, 12]} style={sun} svg={{stroke: colors.gold, strokeWidth: 1.9, strokeLinecap: 'round'}}>
        <Circle cx="44" cy="12" r="4" />
        <Path d="M44 4v2M44 18v2M36 12h2M50 12h2M38.3 6.3l1.4 1.4M48.3 16.3l1.4 1.4M38.3 17.7l1.4-1.4M48.3 7.7l1.4-1.4" />
      </Layer>
      <Svg width={58} height={48} viewBox="0 0 58 48" fill="none" {...LINE}>
        <Path d="M4 42l14-18 9 10 8-12 19 20z" fill={FILL} />
        <Path d="M4 46h50" opacity={0.5} />
      </Svg>
    </Box>
  );
});

// ---- Security: shield heartbeat (`shb`) with a ripple ring.
const SecurityIcon = memo(function SecurityIcon() {
  const shb = useTrack(4000, p => {
    'worklet';
    return {transform: [{scale: kf(p, [[0, 1], [0.82, 1], [0.88, 1.12], [0.94, 0.97], [1, 1]], E.easeInOut)}]};
  });
  const ring = useTrack(2400, p => {
    'worklet';
    const t = E.easeOut(p);
    return {opacity: 1 - t, transform: [{scale: 0.7 + 0.6 * t}]};
  });
  return (
    <Box w={52} h={54}>
      <Animated.View pointerEvents="none" style={[styles.ripple, ring]} />
      <Layer w={52} h={54} origin={[26, 28]} style={shb} svg={LINE}>
        <Path d="M26 5 10 11v12c0 11 7 20 16 24 9-4 16-13 16-24V11z" fill={FILL} />
        <Path d="m19 28 5 5 10-11" stroke="#4ADE80" strokeWidth={2.6} />
      </Layer>
    </Box>
  );
});

// ---- Hot water / shower: drops falling in turn.
function Drop({x, delay}) {
  const a = useTrack(1200, p => {
    'worklet';
    return {
      opacity: kf(p, [[0, 0], [0.2, 1], [0.8, 1], [1, 0]], E.linear),
      transform: [{translateY: 18 * E.easeIn(p)}],
    };
  }, delay);
  return (
    <Layer x={x - 2} y={20} w={4} h={8} style={a}>
      <Path d={`M${x} 22v4`} stroke={ICE} strokeWidth={2} strokeLinecap="round" />
    </Layer>
  );
}

const ShowerIcon = memo(function ShowerIcon() {
  return (
    <Box w={52} h={54}>
      <Svg width={52} height={54} viewBox="0 0 52 54" fill="none" {...LINE}>
        <Path d="M44 52V12a6 6 0 0 0-6-6H25v6" />
        <Path d="M13 20a12 12 0 0 1 24 0z" fill={FILL} />
      </Svg>
      <Drop x={17} delay={0} />
      <Drop x={22} delay={300} />
      <Drop x={27} delay={600} />
      <Drop x={32} delay={900} />
    </Box>
  );
});

// ---- Lift: doors sliding open and shut, arrow nudging up.
function Door({side}) {
  const a = useTrack(3000, p => {
    'worklet';
    return {transform: [{translateX: side * kf(p, [[0, 0], [0.3, 8], [0.7, 8], [1, 0]], E.easeInOut)}]};
  });
  return <Animated.View style={[styles.door, side < 0 ? styles.doorL : styles.doorR, a]} />;
}

const LiftIcon = memo(function LiftIcon() {
  const arrow = useTrack(1500, p => {
    'worklet';
    return {transform: [{translateY: kf(p, [[0, 1.5], [0.5, -1.5], [1, 1.5]], E.easeInOut)}]};
  });
  return (
    <Box w={48} h={54}>
      <Svg width={48} height={54} viewBox="0 0 48 54" fill="none" {...LINE}>
        <Rect x="6" y="4" width="36" height="46" rx="6" fill={FILL} />
      </Svg>
      <Layer x={18} y={5} w={12} h={10} style={arrow} svg={LINE}>
        <Path d="M20 12l4-4 4 4" strokeWidth={2} />
      </Layer>
      <Clip x={10} y={16} w={28} h={31}>
        <Door side={-1} />
        <Door side={1} />
      </Clip>
    </Box>
  );
});

// =========================================================== lookup

/**
 * Amenity code → icon. Order matters: the first pattern that matches a label
 * wins, so specific names come before generic ones (beach before view, ...).
 * Patterns run on the label lower-cased with punctuation turned into spaces.
 */
const ICONS = [
  ['ac', AcIcon, /\b(ac|a c|air ?con\w*|aircon|cooling)\b/],
  ['wifi', WifiIcon, /\b(wi ?fi|wireless|internet|broadband)\b/],
  ['minibar', BarIcon, /\b(mini ?bar|mini ?fridge|fridge|refrigerator|bar)\b/],
  ['housekeeping', HkIcon, /\b(house ?keeping|cleaning|maid|room service)\b/],
  ['pool', PoolIcon, /\b(pool|swimming|jacuzzi|hot ?tub)\b/],
  ['parking', ParkingIcon, /\b(parking|car ?park|garage|valet)\b/],
  ['kitchen', KitchenIcon, /\b(kitchen\w*|cooking|cookware|stove|microwave)\b/],
  ['breakfast', BreakfastIcon, /\b(breakfast|coffee|tea|cafe|dining|restaurant|meals?)\b/],
  ['gym', GymIcon, /\b(gym|fitness|workout)\b/],
  ['spa', SpaIcon, /\b(spa|massage|sauna|wellness|steam room)\b/],
  ['tv', TvIcon, /\b(tv|television|netflix|ott|dth|cable)\b/],
  ['workspace', WorkIcon, /\b(work ?space|work ?station|workspace|desk|office)\b/],
  ['pets', PetIcon, /\b(pets?|pet friendly|dogs?|cats?)\b/],
  ['fireplace', FireIcon, /\b(fire ?place|fire ?pit|bonfire|campfire)\b/],
  ['bbq', BbqIcon, /\b(bbq|barbe(cue|que)|grill)\b/],
  ['garden', GardenIcon, /\b(garden|lawn|yard|plants?)\b/],
  ['beach', BeachIcon, /\b(beach|sea|ocean|seaside|lake)\b/],
  ['power', PowerIcon, /\b(power ?backup|backup|generator|inverter|ups)\b/],
  ['laundry', LaundryIcon, /\b(washing ?machine|washer|laundry|dryer)\b/],
  ['shower', ShowerIcon, /\b(hot water|geyser|shower|bath ?tub|water heater)\b/],
  ['lift', LiftIcon, /\b(lift|elevator)\b/],
  ['security', SecurityIcon, /\b(security|cctv|guard|gated|safe)\b/],
  ['view', ViewIcon, /\b(balcony|view|terrace|patio|veranda|verandah)\b/],
];

const BY_CODE = Object.fromEntries(ICONS.map(([code, Icon]) => [code, Icon]));

const norm = s =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The animated icon code for an amenity `{key|code, label}`, or null. */
export function amenityCode(a) {
  const key = norm(a.code || a.key);
  if (key) {
    const hit = ICONS.find(([code, , re]) => norm(code) === key || re.test(key));
    if (hit) {
      return hit[0];
    }
  }
  const label = norm(a.label);
  const hit = label ? ICONS.find(([, , re]) => re.test(label)) : null;
  return hit ? hit[0] : null;
}

export const iconFor = code => BY_CODE[code] || null;

const styles = StyleSheet.create({
  layer: {position: 'absolute', top: 0, left: 0},
  clip: {overflow: 'hidden'},
  scan: {width: 44, height: 4, backgroundColor: 'rgba(191,227,255,0.35)'},
  ripple: {
    position: 'absolute',
    left: 4,
    top: 6,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(74,222,128,0.5)',
  },
  door: {
    position: 'absolute',
    top: 0,
    width: 13.5,
    height: 31,
    backgroundColor: 'rgba(191,227,255,0.15)',
    borderWidth: 1.4,
    borderColor: ICE,
    borderRadius: 2,
  },
  doorL: {left: 0},
  doorR: {right: 0},
});
