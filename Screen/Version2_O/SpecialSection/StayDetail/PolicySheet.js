// `.pol`: full-screen "Cancellation & Refund Policy" that slides up from the
// bottom (.6s cubic-bezier(.32,.72,0,1)); its rows `polin` in a stagger and
// the timeline bars grow in (`segin`).
import React, {memo} from 'react';
import {ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import Animated, {Easing, useAnimatedStyle} from 'react-native-reanimated';
import Svg, {Path, Rect} from 'react-native-svg';
import {colors, fonts} from '../theme';
import {E, PressScale} from '../anim';
import {BackIcon, GlassButton} from '../HubBits';
import {CheckIcon, CloseIcon, useShot, useTo} from './bits';
import {useRenderCount} from '../perf';

const SLIDE = Easing.bezierFn(0.32, 0.72, 0, 1);

/** `.pol.show .pol-body > *`: polin .6s --out, +80ms per child. */
function Row({open, i, style, children}) {
  const p = useShot(open, 600, i * 80);
  const a = useAnimatedStyle(() => {
    const t = E.out(p.value);
    return {opacity: t, transform: [{translateY: 16 * (1 - t)}]};
  });
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** `.tl-bar i`: segin (scaleX 0→1 from the left) .9s --out. */
function Seg({open, delay, flex, color}) {
  const p = useShot(open, 900, delay);
  const a = useAnimatedStyle(() => ({transform: [{scaleX: E.out(p.value)}]}));
  return <Animated.View style={[styles.seg, {flex, backgroundColor: color}, a]} />;
}

function Rule({open, i, tint, bg, title, titleSize = 15, body, style, children}) {
  return (
    <Row open={open} i={i} style={[styles.rule, style]}>
      <View style={[styles.ri, {backgroundColor: bg}]}>{children(tint)}</View>
      <View style={styles.ruleCopy}>
        <Text style={[styles.ruleTitle, {fontSize: titleSize}]}>{title}</Text>
        <Text style={styles.ruleBody}>{body}</Text>
      </View>
    </Row>
  );
}

const GREEN = '#4ADE80';
const RED = '#F87171';
const tint = pct => (pct >= 100 ? GREEN : pct <= 0 ? RED : colors.gold);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** One line per refund rule; `prev` is the rule with the next longer notice. */
function ruleText(r, prev) {
  const h = r.minHoursBeforeCheckIn;
  const pct = r.refundPercent;
  if (h > 0) {
    return pct >= 100
      ? `Cancel up to ${h} hours before check-in and get a full refund.`
      : `Cancel at least ${h} hours before check-in and get ${pct}% back.`;
  }
  const within = prev ? ` within ${prev.minHoursBeforeCheckIn} hours of check-in` : '';
  return pct <= 0 ? `Cancellations made${within} are not refunded.` : `Cancellations made${within} get ${pct}% back.`;
}

function PolicySheet({open, onClose, stayName, checkIn, policy, insets}) {
  const {rules, freeHours: free} = policy;
  const example =
    free && free % 24 === 0 && checkIn
      ? `Check-in Saturday at ${checkIn} → cancel free until ${DAYS[(((6 - free / 24) % 7) + 7) % 7]} at ${checkIn}.`
      : '';
  useRenderCount('PolicySheet');
  const {height} = useWindowDimensions();
  const v = useTo(open ? 1 : 0, 600, SLIDE);
  const a = useAnimatedStyle(() => ({transform: [{translateY: height * (1 - v.value)}]}), [height]);

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityViewIsModal={open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={[styles.pol, a]}>
      <View style={[styles.top, {paddingTop: insets.top + 16}]}>
        <GlassButton label="Close policy" onPress={onClose} style={styles.back}>
          <BackIcon />
        </GlassButton>
        <Text style={styles.title}>Cancellation & Refund Policy</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.body, {paddingBottom: 110 + insets.bottom}]}>
        <Row open={open} i={0}>
          <Text style={styles.lead}>{stayName} · applies to all suites</Text>
        </Row>

        <Row open={open} i={1} style={styles.tl}>
          <Text style={styles.tlTitle}>Your cancellation window</Text>
          <View style={styles.tlBar}>
            {free ? (
              <>
                <Seg open={open} delay={300} flex={3} color={GREEN} />
                <Seg open={open} delay={600} flex={1} color={RED} />
              </>
            ) : (
              <Seg open={open} delay={300} flex={1} color={tint(rules[0]?.refundPercent ?? 0)} />
            )}
          </View>
          <View style={styles.ticks}>
            <Text style={[styles.tick, styles.tickL]}>Booking</Text>
            <View style={styles.tickMid}>
              {free ? <Text style={[styles.tick, styles.tickOn]}>{free}h before</Text> : null}
            </View>
            <Text style={[styles.tick, styles.tickR]}>Check-in</Text>
          </View>
        </Row>

        {rules.map((r, i) => {
          const c = tint(r.refundPercent);
          return (
            <Rule
              key={i}
              open={open}
              i={2 + i}
              tint={c}
              bg={c === GREEN ? 'rgba(74,222,128,0.12)' : c === RED ? 'rgba(248,113,113,0.12)' : 'rgba(241,221,186,0.1)'}
              title={r.label}
              body={ruleText(r, rules[i - 1])}>
              {k =>
                r.refundPercent > 0 ? (
                  <CheckIcon size={20} color={k} strokeWidth={2.2} />
                ) : (
                  <CloseIcon size={20} color={k} strokeWidth={2.2} />
                )
              }
            </Rule>
          );
        })}
        {example ? (
          <Rule
            open={open}
            i={2 + rules.length}
            tint={colors.gold}
            bg="rgba(241,221,186,0.1)"
            title="Example"
            titleSize={13}
            style={styles.example}
            body={example}>
            {c => (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.9} strokeLinecap="round">
                <Rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
                <Path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
              </Svg>
            )}
          </Rule>
        ) : null}
      </ScrollView>
      <PressScale
        to={0.96}
        duration={400}
        onPress={onClose}
        accessibilityRole="button"
        style={[styles.cta, {bottom: 16 + insets.bottom}]}>
        <Text style={styles.ctaText}>Got it</Text>
      </PressScale>
    </Animated.View>
  );
}

export default memo(PolicySheet);

const styles = StyleSheet.create({
  pol: {...StyleSheet.absoluteFillObject, zIndex: 55, elevation: 55, backgroundColor: colors.ground},
  top: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10},
  back: {backgroundColor: colors.card, borderColor: 'rgba(255,255,255,0.2)'},
  title: {fontFamily: fonts.bold, fontSize: 16, color: '#fff'},
  body: {paddingTop: 6, paddingHorizontal: 20, gap: 14},
  lead: {fontFamily: fonts.regular, fontSize: 13, lineHeight: 13 * 1.55, color: colors.muted},
  tl: {padding: 18, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border},
  tlTitle: {fontFamily: fonts.bold, fontSize: 14, color: '#fff'},
  tlBar: {flexDirection: 'row', gap: 4, marginTop: 14, marginBottom: 8},
  seg: {height: 10, borderRadius: 5, transformOrigin: 'left'},
  ticks: {height: 16},
  tick: {position: 'absolute', top: 0, fontFamily: fonts.regular, fontSize: 10.5, color: '#8E887F'},
  tickL: {left: 0},
  tickR: {right: 0},
  tickMid: {position: 'absolute', left: '50%', right: 0, top: 0, alignItems: 'center'},
  tickOn: {position: 'relative', fontFamily: fonts.bold, color: '#E6E0D6'},
  rule: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  example: {backgroundColor: '#111014'},
  ri: {width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center'},
  ruleCopy: {flex: 1, gap: 4},
  ruleTitle: {fontFamily: fonts.bold, color: '#fff'},
  ruleBody: {fontFamily: fonts.regular, fontSize: 13, lineHeight: 13 * 1.5, color: colors.soft},
  cta: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink},
});
