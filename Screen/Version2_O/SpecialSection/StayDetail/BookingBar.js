// `.bar` (odometer price + Reserve button with idle / loading / done) and the
// `.sheet` "Room held" summary above it, which can be dragged down to close.
import React, {memo, useEffect, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Svg, {Path} from 'react-native-svg';
import {colors, fonts, ls} from '../theme';
import {E, PressScale, useLoop, usePressScale} from '../anim';
import {ArrowRight, CHECK_D, CloseIcon, Odo, Sweep, useLazy, useShot, useTo} from './bits';
import {useRenderCount} from '../perf';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const BAR_H = 82;

/** `.num`: ₹ + one odometer column per digit (.7s spring). */
function Price({label}) {
  const chars = label.split('');
  return (
    <View style={styles.num} accessible accessibilityLabel={`₹${label} per night`}>
      <Text style={styles.numText}>₹</Text>
      {chars.map((ch, i) => {
        const key = chars.length - i; // keyed from the right so columns keep rolling when the length changes
        return ch === ',' ? (
          <Text key={key} style={styles.numText}>
            ,
          </Text>
        ) : (
          <Odo key={key} index={Number(ch)} h={30} items={DIGITS} duration={700} textStyle={styles.numText} />
        );
      })}
    </View>
  );
}

/** `.spin`: .7s linear rotation. */
function Spinner() {
  const p = useLoop(700);
  const a = useAnimatedStyle(() => ({transform: [{rotate: `${360 * p.value}deg`}]}));
  return <Animated.View style={[styles.spin, a]} />;
}

/** `.chk path`: draw .45s ease, .05s delay. */
function DrawnCheck() {
  const p = useShot(true, 450, 50);
  const props = useAnimatedProps(() => ({strokeDashoffset: 22 * (1 - E.ease(p.value))}));
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <AnimatedPath
        d={CHECK_D}
        stroke="#14532D"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={22}
        animatedProps={props}
      />
    </Svg>
  );
}

const PHASE = {idle: 0, loading: 1, done: 2};

/** `.rsv`: background .35s between the phases, press .94, sheen while idle. */
function Reserve({phase, onPress}) {
  const press = usePressScale(0.94, 450);
  const v = useTo(PHASE[phase], 350);
  const a = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1, 2], [colors.gold, '#E4CFA9', '#E6F4EA']),
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLiveRegion="polite"
      style={[styles.rsv, a, press.style]}>
      {phase === 'idle' ? (
        <>
          <Text style={styles.rsvText}>Reserve</Text>
          <ArrowRight color={colors.ink} />
          <Sweep duration={3200} alpha={0.7} />
        </>
      ) : null}
      {phase === 'loading' ? (
        <>
          <Spinner />
          <Text style={styles.rsvText}>Holding…</Text>
        </>
      ) : null}
      {phase === 'done' ? (
        <>
          <DrawnCheck />
          <Text style={[styles.rsvText, styles.rsvDone]}>Reserved</Text>
        </>
      ) : null}
    </AnimatedPressable>
  );
}

/**
 * `.sheet` / `.sheet.show`: translateY(40px) scale(.96) → none (.6s spring),
 * opacity .3s. A pan down past 60px (or a flick) closes it.
 */
function Sheet({show, bottom, suiteName, stayShort, sub, onClose, onPay}) {
  const t = useTo(show ? 1 : 0, 600, E.spring);
  const o = useTo(show ? 1 : 0, 300);
  const drag = useSharedValue(0);

  useEffect(() => {
    if (show) {
      drag.value = 0;
    }
  }, [show, drag]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(show)
        .activeOffsetY([-8, 8])
        .onChange(e => {
          const y = drag.value + e.changeY;
          drag.value = y;
        })
        .onEnd(e => {
          if (drag.value > 60 || e.velocityY > 600) {
            runOnJS(onClose)();
          } else {
            drag.value = withTiming(0, {duration: 450, easing: E.spring});
          }
        }),
    [show, onClose, drag],
  );

  const a = useAnimatedStyle(() => {
    const d = drag.value < 0 ? drag.value * 0.2 : drag.value;
    return {
      opacity: o.value,
      transform: [{translateY: 40 * (1 - t.value) + d}, {scale: 0.96 + 0.04 * t.value}],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        pointerEvents={show ? 'auto' : 'none'}
        accessibilityViewIsModal={show}
        accessibilityLabel="Reservation summary"
        style={[styles.sheet, {bottom}, a]}>
        <View style={styles.sheetTop}>
          <View style={styles.sheetCopy}>
            <Text style={styles.held}>ROOM HELD</Text>
            <Text style={styles.sheetTitle}>
              {suiteName} · {stayShort}
            </Text>
            <Text style={styles.sheetSub}>{sub}</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close summary" style={styles.close}>
            <CloseIcon color={colors.ink} />
          </Pressable>
        </View>
        <PressScale to={0.96} onPress={onPay} accessibilityRole="button" style={styles.pay}>
          <Text style={styles.payText}>Continue to payment</Text>
          <Text style={styles.payText}>→</Text>
        </PressScale>
      </Animated.View>
    </GestureDetector>
  );
}

function BookingBar({bottom, phase, sheet, sheetSub, suiteName, stayShort, totalLabel, onReserve, onCloseSheet, onPay}) {
  useRenderCount('BookingBar');
  const [sheetMounted, sheetShown] = useLazy(sheet);
  return (
    <>
      {sheetMounted ? (
        <Sheet
          show={sheetShown}
          bottom={bottom + BAR_H + 12}
          suiteName={suiteName}
          stayShort={stayShort}
          sub={sheetSub}
          onClose={onCloseSheet}
          onPay={onPay}
        />
      ) : null}
      <View style={[styles.bar, {bottom}]}>
        <View style={styles.priceCol}>
          <View style={styles.priceRow}>
            <Price label={totalLabel} />
            <Text style={styles.per}>/ night</Text>
          </View>
          <Text style={styles.tax}>Taxes included</Text>
        </View>
        <Reserve phase={phase} onPress={onReserve} />
      </View>
    </>
  );
}

export default memo(BookingBar);

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 12,
    borderRadius: 26,
    backgroundColor: 'rgba(20,19,23,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: {width: 0, height: 18},
    elevation: 24,
    zIndex: 40,
  },
  priceCol: {gap: 2},
  priceRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 6},
  num: {flexDirection: 'row', alignItems: 'flex-start', height: 30},
  numText: {fontFamily: fonts.extrabold, fontSize: 24, height: 30, lineHeight: 30, letterSpacing: ls(-0.01, 24), color: '#fff'},
  per: {fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginBottom: 5},
  tax: {fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted},
  rsv: {
    width: 148,
    height: 58,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  rsvText: {fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink},
  rsvDone: {color: '#14532D'},
  spin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: 'rgba(26,22,17,0.25)',
    borderTopColor: colors.ink,
  },
  sheet: {
    position: 'absolute',
    left: 14,
    right: 14,
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.cream,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 25,
    shadowOffset: {width: 0, height: 20},
    elevation: 22,
    zIndex: 39,
  },
  sheetTop: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10},
  sheetCopy: {flex: 1, gap: 4},
  held: {fontFamily: fonts.extrabold, fontSize: 10.5, letterSpacing: ls(0.1, 10.5), color: '#8A6A3A'},
  sheetTitle: {fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink},
  sheetSub: {fontFamily: fonts.regular, fontSize: 12.5, color: '#5A5247'},
  close: {width: 44, height: 44, marginTop: -8, marginRight: -8, borderRadius: 22, alignItems: 'center', justifyContent: 'center'},
  pay: {
    marginTop: 14,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payText: {fontFamily: fonts.bold, fontSize: 14, color: colors.gold},
});
