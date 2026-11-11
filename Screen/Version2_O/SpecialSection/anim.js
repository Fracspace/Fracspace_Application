// Shared Reanimated helpers for the Special Section screens. Everything runs on
// the UI thread and honours the OS "Reduce Motion" setting.
//
//   E                 CSS easings from the design (E.spring, E.out, E.snap, ...)
//   kf(p, stops, e)   worklet: evaluate a CSS @keyframes track at progress p
//   useLoop(ms, opts) infinite CSS animation clock → shared progress 0..1
//   useToggle(on,...) CSS transition between two states → shared 0..1
//   usePressScale     :active { transform: scale(x) } with the spring easing
//   PressScale        Pressable that does the above
//   Sheen             the gold/white shimmer sweep (`sheen` keyframes)
//   Nudge             the "→" arrow that nudges right (`nudge` keyframes)
//   RevealScope/Reveal  scroll-driven `.rv` reveal (fade + rise on entry)
//   enterUp(i, opts)  staggered fade-up entering animation for mount
//   LoopGate          pause every useLoop below it (e.g. while a tab is hidden)
//   useLinger(on, ms) `on`, held true for `ms` after it turns off (fade-outs)
//   ViewportGate      pause the loops in a section while it is scrolled off-screen
//
// Mapping a CSS animation: `animation: name 2.4s ease-in-out -1.2s infinite alternate`
//   const p = useLoop(2400, {delay: -1200, alternate: true});
//   useAnimatedStyle(() => ({opacity: kf(p.value, [[0, 0], [0.25, 1], [1, 0]], E.easeInOut)}));
// The easing is applied per keyframe segment, like CSS.

import React, {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, View, Text} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  makeMutable,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {useRenderCount} from './perf';

export {useReducedMotion};

/** Easings from the design's CSS (all are worklet functions). */
export const E = {
  spring: Easing.bezierFn(0.34, 1.56, 0.64, 1), // --spring: springy pop
  out: Easing.bezierFn(0.16, 1, 0.3, 1), // --out: smooth-out
  snap: Easing.bezierFn(0.7, 0, 0.2, 1),
  soft: Easing.bezierFn(0.2, 0.7, 0.3, 1),
  material: Easing.bezierFn(0.4, 0, 0.2, 1),
  ease: Easing.bezierFn(0.25, 0.1, 0.25, 1), // CSS `ease`
  easeIn: Easing.bezierFn(0.42, 0, 1, 1),
  easeOut: Easing.bezierFn(0, 0, 0.58, 1),
  easeInOut: Easing.bezierFn(0.42, 0, 0.58, 1),
  linear: Easing.linear,
};

/**
 * Evaluate a keyframe track. `stops` is [[at, value], ...] with `at` in 0..1,
 * sorted; repeated values model CSS rules like `0%,60%{...}`.
 */
export function kf(p, stops, easing) {
  'worklet';
  if (p <= stops[0][0]) {
    return stops[0][1];
  }
  for (let i = 1; i < stops.length; i++) {
    const a1 = stops[i][0];
    if (p <= a1) {
      const a0 = stops[i - 1][0];
      const v0 = stops[i - 1][1];
      const v1 = stops[i][1];
      const t = a1 > a0 ? (p - a0) / (a1 - a0) : 1;
      return v0 + (v1 - v0) * (easing ? easing(t) : t);
    }
  }
  return stops[stops.length - 1][1];
}

// The gate is a shared value (true = loops run), read on the UI thread, so
// pausing or resuming loops never re-renders the components that use them.
const LoopActive = createContext(makeMutable(true));

/** Pauses (and resets) every useLoop below it while `active` is false. */
export function LoopGate({active, children}) {
  const parent = useContext(LoopActive);
  // Not read from `parent` here (no shared-value reads during render); the
  // reaction below ANDs the parent in on the first frame.
  const own = useSharedValue(active);
  const act = useSharedValue(active);
  useEffect(() => {
    act.value = active;
  }, [active, act]);
  useAnimatedReaction(
    () => act.value && parent.value,
    on => {
      own.value = on;
    },
  );
  return <LoopActive.Provider value={own}>{children}</LoopActive.Provider>;
}

/**
 * The nearest gate's state as a JS boolean, for things that are not loops
 * (a video player) but should also stop off screen or behind a sheet.
 */
export function useGateOn() {
  const gate = useContext(LoopActive);
  const [on, setOn] = useState(gate.value);
  useAnimatedReaction(
    () => gate.value,
    (v, was) => {
      if (v !== was) {
        runOnJS(setOn)(v);
      }
    },
  );
  return on;
}

/**
 * `on`, but held true for `ms` after it turns off. Gate the loops of something
 * that fades out with it so they stop only once it is invisible.
 */
export function useLinger(on, ms) {
  const [held, setHeld] = useState(on);
  useEffect(() => {
    if (on) {
      setHeld(true);
      return;
    }
    const id = setTimeout(() => setHeld(false), ms);
    return () => clearTimeout(id);
  }, [on, ms]);
  return on || held;
}

// Cycles per linear run in useLoop (~1 day for a 1s loop); then it repeats.
const CYCLES = 100000;

/**
 * Clock for an infinite CSS animation. Returns a shared value 0..1 (already
 * ping-ponged when `alternate`). `delay` < 0 starts mid-cycle like CSS;
 * `delay` > 0 waits first. `active: false` stops it at 0.
 */
export function useLoop(duration, {delay = 0, alternate = false, active = true} = {}) {
  const reduced = useReducedMotion();
  const gate = useContext(LoopActive);
  const local = active && !reduced;
  const clock = useSharedValue(0);

  // Starts/stops on the UI thread when the gate flips; re-created (and so
  // restarted) when the loop's own settings change.
  useAnimatedReaction(
    () => local && gate.value,
    (run, was) => {
      if (run === was) {
        return;
      }
      cancelAnimation(clock);
      if (!run) {
        clock.value = 0;
        return;
      }
      const cycle = alternate ? duration * 2 : duration;
      const phase = delay < 0 ? ((-delay % cycle) + cycle) % cycle / cycle : 0;
      // One linear run over CYCLES cycles; the clock is its fractional part.
      // Progress is elapsed time / duration, so loops never drift apart and a
      // late frame (app back from background) lands on the right phase. A
      // repeat-per-cycle chain restarts on whatever frame the last cycle ended,
      // which collapsed staggered loops (the nav words) onto each other.
      clock.value = phase;
      const timeline = withRepeat(
        withSequence(
          withTiming(phase, {duration: 0}),
          withTiming(phase + CYCLES, {duration: CYCLES * cycle, easing: Easing.linear}),
        ),
        -1,
      );
      clock.value = delay > 0 ? withDelay(delay, timeline) : timeline;
    },
    [local, duration, delay, alternate],
  );
  useEffect(() => () => cancelAnimation(clock), [clock]);

  return useDerivedValue(() => {
    const c = clock.value - Math.floor(clock.value);
    if (!alternate) {
      return c;
    }
    return c < 0.5 ? c * 2 : 2 - c * 2;
  });
}

/**
 * CSS transition between two states. Returns a shared value that animates to
 * 1 when `on` and to 0 when off, each direction with its own
 * {duration, easing, delay}. Reduced motion jumps straight there.
 */
export function useToggle(on, inCfg = {}, outCfg = inCfg) {
  const reduced = useReducedMotion();
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    const cfg = on ? inCfg : outCfg;
    if (reduced) {
      v.value = on ? 1 : 0;
      return;
    }
    const t = withTiming(on ? 1 : 0, {duration: cfg.duration ?? 300, easing: cfg.easing ?? E.ease});
    v.value = cfg.delay ? withDelay(cfg.delay, t) : t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, reduced]);
  return v;
}

/** `.press:active{transform:scale(to)}` with `transition: transform <duration> var(--spring)`. */
export function usePressScale(to = 0.96, duration = 450) {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({transform: [{scale: s.value}]}));
  const go = target => {
    s.value = withTiming(target, {duration, easing: E.spring});
  };
  return {style, onPressIn: () => go(to), onPressOut: () => go(1)};
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that scales down while held (defaults match `.press`). */
export function PressScale({to = 0.96, duration = 450, style, children, ...rest}) {
  const press = usePressScale(to, duration);
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[style, press.style]}>
      {children}
    </AnimatedPressable>
  );
}

/** CSS linear-gradient angle → react-native-linear-gradient start/end. */
export function cssAngle(deg) {
  const r = (deg * Math.PI) / 180;
  const dx = Math.sin(r) / 2;
  const dy = -Math.cos(r) / 2;
  return {start: {x: 0.5 - dx, y: 0.5 - dy}, end: {x: 0.5 + dx, y: 0.5 + dy}};
}

/**
 * The `sheen` shimmer: a diagonal band sweeping across its parent
 * (`@keyframes sheen{0%,60%{-130%}85%,100%{130%}}`). Place it last inside a
 * parent with `overflow: 'hidden'`.
 *   rgb    '241,221,186' (gold, default) or '255,255,255'
 *   alpha  peak opacity of the band
 *   band   [start, peak, end] gradient stops, e.g. [0.38, 0.5, 0.62]
 *   angle  CSS gradient angle in deg
 *   from   start offset in widths (CSS -130% → -1.3)
 */
export function Sheen({
  duration = 6000,
  delay = 0,
  rgb = '241,221,186',
  alpha = 0.09,
  band = [0.38, 0.5, 0.62],
  angle = 105,
  from = -1.3,
  to = 1.3,
  easing = E.easeInOut,
}) {
  const w = useSharedValue(0);
  const p = useLoop(duration, {delay});
  const style = useAnimatedStyle(() => ({
    opacity: w.value ? 1 : 0,
    transform: [{translateX: kf(p.value, [[0, from], [0.6, from], [0.85, to], [1, to]], easing) * w.value}],
  }));
  const dir = cssAngle(angle);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={e => {
        w.value = e.nativeEvent.layout.width;
      }}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={[`rgba(${rgb},0)`, `rgba(${rgb},${alpha})`, `rgba(${rgb},0)`]}
          locations={band}
          start={dir.start}
          end={dir.end}
        />
      </Animated.View>
    </View>
  );
}

/** `.nudge`: an inline "→" that drifts 4px right and back (1.8s ease-in-out). */
export function Nudge({style, children = '→'}) {
  const p = useLoop(1800);
  const a = useAnimatedStyle(() => ({
    transform: [{translateX: kf(p.value, [[0, 0], [0.5, 4], [1, 0]], E.easeInOut)}],
  }));
  return (
    <Animated.View style={a}>
      <Text style={style}>{children}</Text>
    </Animated.View>
  );
}

const RevealCtx = createContext(null);

/**
 * Provides scroll position for <Reveal>. `scrollY` is a shared value from
 * useAnimatedScrollHandler, `contentRef` a ref to a View wrapping all of the
 * ScrollView's content, `viewportH` the ScrollView's visible height.
 */
export function RevealScope({scrollY, contentRef, viewportH, children}) {
  // Memoised so a screen re-render doesn't re-render every Reveal/ViewportGate.
  const value = useMemo(() => ({scrollY, contentRef, viewportH}), [scrollY, contentRef, viewportH]);
  return <RevealCtx.Provider value={value}>{children}</RevealCtx.Provider>;
}

/**
 * The `.rv` reveal: opacity 0→1 and translateY 30→0, scrubbed by scroll while
 * the element enters the viewport (animation-range: entry 0% entry 55%).
 */
export function Reveal({style, children, dy = 30}) {
  useRenderCount('Reveal');
  const ctx = useContext(RevealCtx);
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const top = useSharedValue(1e9);
  const height = useSharedValue(1);
  const vh = ctx?.viewportH ?? 800;
  const scrollY = ctx?.scrollY;
  const off = reduced || !scrollY;

  const onLayout = () => {
    const content = ctx?.contentRef?.current;
    if (!ref.current || !content) {
      return;
    }
    ref.current.measureLayout(content, (x, y, w, h) => {
      top.value = y;
      height.value = Math.max(1, h);
    });
  };

  const a = useAnimatedStyle(() => {
    if (off) {
      return {opacity: 1, transform: [{translateY: 0}]};
    }
    const entered = scrollY.value + vh - top.value;
    const p = Math.min(1, Math.max(0, entered / (0.55 * height.value)));
    return {opacity: p, transform: [{translateY: (1 - p) * dy}]};
  }, [off, vh, dy]);

  return (
    <Animated.View ref={ref} onLayout={onLayout} style={[style, a]}>
      {children}
    </Animated.View>
  );
}

/**
 * Staggered fade-up for mounting lists: `<Animated.View entering={enterUp(i)}>`.
 * Item i starts after `delay + i * step` ms.
 */
export function enterUp(index = 0, {step = 80, delay = 0, duration = 600, dy = 30, easing = E.out} = {}) {
  const d = delay + index * step;
  return () => {
    'worklet';
    return {
      initialValues: {opacity: 0, transform: [{translateY: dy}]},
      animations: {
        opacity: withDelay(d, withTiming(1, {duration, easing})),
        transform: [{translateY: withDelay(d, withTiming(0, {duration, easing}))}],
      },
    };
  };
}

/**
 * A View inside a <RevealScope> whose looping animations (useLoop) only run
 * while it is on screen (with `margin` px of slack). Off-screen loops cost
 * frames without being seen; they restart where CSS would when they return.
 */
export function ViewportGate({style, children, margin = 120}) {
  useRenderCount('ViewportGate');
  const ctx = useContext(RevealCtx);
  const parent = useContext(LoopActive);
  const ref = useRef(null);
  const top = useSharedValue(0);
  const height = useSharedValue(1e9);
  const own = useSharedValue(true); // the reaction below sets it on the first frame
  const vh = ctx?.viewportH ?? 800;
  const scrollY = ctx?.scrollY;

  const onLayout = () => {
    const content = ctx?.contentRef?.current;
    if (!ref.current || !content) {
      return;
    }
    ref.current.measureLayout(content, (x, y, w, h) => {
      top.value = y;
      height.value = h;
    });
  };

  // Decided on the UI thread during scroll: no JS round trip, no re-render.
  useAnimatedReaction(
    () => {
      if (!parent.value) {
        return false;
      }
      if (!scrollY) {
        return true;
      }
      const y = scrollY.value;
      return top.value + height.value > y - margin && top.value < y + vh + margin;
    },
    on => {
      own.value = on;
    },
    [vh, margin],
  );

  return (
    <View ref={ref} collapsable={false} onLayout={onLayout} style={style}>
      <LoopActive.Provider value={own}>{children}</LoopActive.Provider>
    </View>
  );
}

/**
 * ViewportGate for one item of a horizontal rail: its loops run only while it
 * is within the rail's viewport. `sx` is the rail's scroll x; `left` / `width`
 * are the item's box in the rail content. Adds no view.
 */
export function RailGate({sx, left, width, viewportW, margin = 40, children}) {
  const parent = useContext(LoopActive);
  const own = useSharedValue(true); // the reaction below sets it on the first frame
  useAnimatedReaction(
    () => parent.value && left + width > sx.value - margin && left < sx.value + viewportW + margin,
    on => {
      own.value = on;
    },
    [left, width, viewportW, margin],
  );
  return <LoopActive.Provider value={own}>{children}</LoopActive.Provider>;
}
