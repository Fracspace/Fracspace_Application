import React, { useEffect, useRef, useState } from 'react';
import { Image, StatusBar, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

// Launch splash, Swiggy style: plain black first (the native launch screen is
// the same colour, so there is no seam), then the logo eases in, then the
// whole splash fades away over the app once its first screen is up.
export const LAUNCH_BG = '#000000';
const logo = require('../assets/launch-logo.png'); // white, 570x475 = 3x of 190x158
export const LOGO_W = 190;
export const LOGO_H = LOGO_W * (475 / 570);

/** The splash background, full screen. */
export function LaunchBackdrop({ style, children }) {
  return <View style={[styles.fill, style]}>{children}</View>;
}

/** The logo, at the splash's size. */
export function LaunchLogo() {
  return <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="Fracspace" />;
}

const LOGO_IN_MS = 520;
// The logo is on screen at least this long, so it never just flashes.
const MIN_SHOW_MS = 1100;
// Never hold the app back longer than this, even if it isn't ready.
const MAX_SHOW_MS = 5000;
const OUT_MS = 320;

/** `ready`: the app's first screen has mounted. `onDone`: the splash is gone. */
export default function LaunchSplash({ ready, onDone }) {
  const logoIn = useSharedValue(0);
  const out = useSharedValue(0);
  const [minDone, setMinDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    logoIn.value = withDelay(80, withTiming(1, { duration: LOGO_IN_MS, easing: Easing.out(Easing.cubic) }));
    const a = setTimeout(() => setMinDone(true), MIN_SHOW_MS);
    const b = setTimeout(() => setTimedOut(true), MAX_SHOW_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [logoIn]);

  useEffect(() => {
    if (leaving.current || !((ready && minDone) || timedOut)) {
      return;
    }
    leaving.current = true;
    out.value = withTiming(1, { duration: OUT_MS, easing: Easing.in(Easing.quad) }, finished => {
      if (finished) {
        runOnJS(onDone)();
      }
    });
  }, [ready, minDone, timedOut, out, onDone]);

  const wrap = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const mark = useAnimatedStyle(() => ({
    opacity: logoIn.value,
    transform: [{ scale: 0.86 + 0.14 * logoIn.value + 0.04 * out.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, wrap]} pointerEvents="none">
      <StatusBar hidden />
      <LaunchBackdrop>
        <Animated.View style={mark}>
          <LaunchLogo />
        </Animated.View>
      </LaunchBackdrop>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LAUNCH_BG,
    zIndex: 1000,
    elevation: 1000,
  },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: LAUNCH_BG },
  logo: { width: LOGO_W, height: LOGO_H },
});
