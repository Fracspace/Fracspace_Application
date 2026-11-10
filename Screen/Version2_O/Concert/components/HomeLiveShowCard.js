import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useIsFocused, useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import AudioWaveform from './AudioWaveform';
import {BOOKING_THEME as T} from '../utils/concertData';
import {formatEventTime} from '../utils/concertFormat';
import {TICKET_STATE} from '../utils/concertBookingAdapter';

const CARD_H = 156;

/** A value that runs 0 -> 1 forever (or back and forth) while `on`. */
function useLoopValue(on, duration, {delay = 0, alternate = false} = {}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) {
      v.stopAnimation();
      return undefined;
    }
    const step = to =>
      Animated.timing(v, {
        toValue: to,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });
    const seq = alternate
      ? Animated.sequence([Animated.delay(delay), step(1), step(0)])
      : Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(v, {toValue: 0, duration: 0, useNativeDriver: true}),
        ]);
    const loop = Animated.loop(seq);
    loop.start();
    return () => loop.stop();
  }, [on, duration, delay, alternate, v]);
  return v;
}

/** One stage spotlight sweeping from the top edge. */
function Beam({on, left, color, from, to, duration, delay}) {
  const v = useLoopValue(on, duration, {delay, alternate: true});
  const rotate = v.interpolate({inputRange: [0, 1], outputRange: [from, to]});
  const opacity = v.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.55, 0.9, 0.55],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.beam,
        {left, opacity, transform: [{translateY: -10}, {rotate}]},
      ]}>
      <LinearGradient
        colors={[color, 'transparent']}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/** A music note drifting up out of the crowd and fading. */
function Note({on, left, size, duration, delay, name}) {
  const v = useLoopValue(on, duration, {delay});
  const translateY = v.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -CARD_H * 0.8],
  });
  const translateX = v.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 8, -4],
  });
  const opacity = v.interpolate({
    inputRange: [0, 0.15, 0.7, 1],
    outputRange: [0, 0.9, 0.6, 0],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.note,
        {left, opacity, transform: [{translateY}, {translateX}]},
      ]}>
      <Icon name={name} size={size} color={T.goldLight} />
    </Animated.View>
  );
}

/** Soft crowd light that breathes behind everything. */
function Glow({on, style, color, duration, delay}) {
  const v = useLoopValue(on, duration, {delay, alternate: true});
  const opacity = v.interpolate({inputRange: [0, 1], outputRange: [0.25, 0.6]});
  const scale = v.interpolate({inputRange: [0, 1], outputRange: [0.9, 1.15]});
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        style,
        {backgroundColor: color, opacity, transform: [{scale}]},
      ]}
    />
  );
}

function LiveDot({on}) {
  const v = useLoopValue(on, 900, {alternate: true});
  const scale = v.interpolate({inputRange: [0, 1], outputRange: [1, 2.2]});
  const opacity = v.interpolate({inputRange: [0, 1], outputRange: [0.6, 0]});
  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[styles.dotRing, {opacity, transform: [{scale}]}]}
      />
      <View style={styles.dot} />
    </View>
  );
}

/**
 * Home card for a guest who is inside the venue: shown instead of the
 * "Your ticket" bar once the gate has checked them in, until the show ends.
 *
 * Stage beams sweep, crowd light breathes, notes float up and the equaliser
 * plays. Everything is the built-in Animated API on the native driver (no new
 * native code, so it ships over the air), stops while home is not on screen,
 * and stays still when the phone asks for reduced motion.
 */
export default function HomeLiveShowCard({booking, otherTickets}) {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => alive && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v =>
      setReduceMotion(!!v),
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  // Entrance: fade and rise in once.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const on = focused && !reduceMotion;
  const t = booking.ticket;
  const start = Date.parse(booking.eventDate);
  const started = !isNaN(start) && Date.now() >= start;
  const enteredAt = t.firstAdmittedAt
    ? formatEventTime(t.firstAdmittedAt)
    : null;
  // QRs that still let people in: the rest of this booking's group, plus any
  // other booking (a second payment) nobody has entered on yet. Each is its
  // own QR, so the live card must never hide them.
  const qrTargets = [
    ...(t.state === TICKET_STATE.PARTIALLY_USED ? [booking] : []),
    ...(otherTickets || []).filter(b => b.bookingId !== booking.bookingId),
  ];
  const stillToEnter = qrTargets.reduce((n, b) => n + (b.ticket?.remaining || 0), 0);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() =>
          navigation.navigate('ConcertBookingDetail', {
            bookingId: booking.bookingId,
            booking,
          })
        }
        accessibilityRole="button"
        accessibilityLabel={
          "You're in at " +
          (booking.concertTitle || 'the concert') +
          '. Enjoy the show.'
        }>
        <View style={styles.card}>
          {/* The gradient is only a background layer: with padding or a border
              on it, the library draws inside the padding box. */}
          <LinearGradient
            colors={['#1C0D24', '#0D0E13', '#24140A']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* stage */}
          <Glow
            on={on}
            color="#B0367A"
            duration={2600}
            delay={0}
            style={styles.glowLeft}
          />
          <Glow
            on={on}
            color={T.gold}
            duration={3200}
            delay={700}
            style={styles.glowRight}
          />
          <Beam
            on={on}
            left="18%"
            color="rgba(230,179,121,0.34)"
            from="-28deg"
            to="12deg"
            duration={3400}
            delay={0}
          />
          <Beam
            on={on}
            left="62%"
            color="rgba(196,70,140,0.32)"
            from="24deg"
            to="-14deg"
            duration={3000}
            delay={400}
          />
          <Beam
            on={on}
            left="84%"
            color="rgba(230,179,121,0.22)"
            from="-10deg"
            to="20deg"
            duration={4200}
            delay={900}
          />
          <Note
            on={on}
            left="58%"
            size={14}
            duration={3600}
            delay={0}
            name="musical-note"
          />
          <Note
            on={on}
            left="70%"
            size={18}
            duration={4200}
            delay={1200}
            name="musical-notes"
          />
          <Note
            on={on}
            left="82%"
            size={12}
            duration={3200}
            delay={2100}
            name="musical-note"
          />
          <Note
            on={on}
            left="92%"
            size={16}
            duration={4600}
            delay={600}
            name="musical-notes"
          />
          {/* crowd fade at the bottom so text stays readable */}
          <LinearGradient
            colors={['transparent', 'rgba(8,8,10,0.85)']}
            style={styles.floorFade}
            pointerEvents="none"
          />

          {/* content */}
          <View style={styles.content}>
            <View style={styles.topRow}>
              <View style={styles.livePill}>
                <LiveDot on={on} />
                <Text style={styles.liveText}>
                  {started ? 'LIVE NOW' : 'GATES OPEN'}
                </Text>
              </View>
              <AudioWaveform
                playing={on}
                bars={7}
                height={22}
                barWidth={3}
                gap={3}
                color={T.goldLight}
              />
            </View>

            <View style={styles.bottom}>
              <Text style={styles.kicker}>YOU'RE IN</Text>
              <Text style={styles.title} numberOfLines={1}>
                {booking.concertTitle || 'Concert'}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {enteredAt ? 'Checked in at ' + enteredAt + '  ·  ' : ''}
                {started ? 'Enjoy the show' : 'The show starts soon'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {qrTargets.length ? (
        <TouchableOpacity
          onPress={() =>
            qrTargets.length === 1
              ? navigation.navigate('ConcertTicketQR', {booking: qrTargets[0]})
              : navigation.navigate('ConcertBookings')
          }
          style={styles.othersRow}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Icon name="qr-code-outline" size={14} color="#021265" />
          <Text style={styles.othersText}>
            {stillToEnter} still to enter ·{' '}
            {qrTargets.length === 1 ? 'Show QR' : 'Show ' + qrTargets.length + ' QRs'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {paddingHorizontal: 15, marginTop: -6, marginBottom: 16},
  card: {
    height: CARD_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0D0E13',
    borderWidth: 1,
    borderColor: 'rgba(206,143,82,0.35)',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    justifyContent: 'space-between',
  },
  beam: {
    position: 'absolute',
    top: 0,
    width: 64,
    height: CARD_H * 1.4,
    borderRadius: 32,
    overflow: 'hidden',
    transformOrigin: 'top',
  },
  glow: {position: 'absolute', width: 180, height: 180, borderRadius: 90},
  glowLeft: {left: -50, bottom: -110},
  glowRight: {right: -40, bottom: -120},
  note: {position: 'absolute', bottom: 10},
  floorFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: CARD_H * 0.6,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  liveText: {
    color: '#FFFFFF',
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 10.5,
    letterSpacing: 1.2,
  },
  dotWrap: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B4E'},
  dotRing: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B4E',
  },

  bottom: {},
  kicker: {
    color: T.gold,
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 10.5,
    letterSpacing: 1.4,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'WorkSans-Bold',
    fontSize: 19,
    marginTop: 2,
  },
  sub: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'WorkSans-Regular',
    fontSize: 12.5,
    marginTop: 3,
  },

  othersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  othersText: {color: '#021265', fontFamily: 'WorkSans-Medium', fontSize: 12},
});
