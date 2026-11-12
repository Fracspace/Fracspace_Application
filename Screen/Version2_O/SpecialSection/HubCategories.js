// "Explore Categories": Stays / Shop / Concerts cards with animated icons.
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {Easing, useAnimatedStyle} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Circle, Ellipse, G, Path, Rect} from 'react-native-svg';
import {colors, fonts, type} from './theme';
import {E, LoopGate, PressScale, Reveal, Sheen, cssAngle, kf, useLoop} from './anim';
import {useRenderCount} from './perf';
import {ArrowCircle, MTag, Tag} from './HubBits';
import {useStaysHome} from './api/stays';

/**
 * How many stays the Stays screen lists (its /home retreats). The
 * pill keeps its space (invisible) until the count is known, so the card
 * doesn't jump when it arrives.
 */
function StaysCount() {
  const {data} = useStaysHome();
  const n = data?.retreats?.length;
  const known = typeof n === 'number' && n > 0;
  return (
    <View style={known ? null : styles.hide}>
      <MTag>{known ? `${n} ${n === 1 ? 'RETREAT' : 'RETREATS'}` : 'RETREATS'}</MTag>
    </View>
  );
}

const CARD_ANGLE = cssAngle(160);
const K = 44 / 40; // the 40-unit icons are drawn at 44px

// One absolutely positioned SVG layer, so each part can animate on its own
// around its CSS `transform-box: fill-box` origin (in px).
function Layer({style, origin, size = 44, viewBox = '0 0 40 40', children}) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {transformOrigin: [origin[0], origin[1], 0]}, style]}>
      <Svg width={size} height={size} viewBox={viewBox} fill="none">
        {children}
      </Svg>
    </Animated.View>
  );
}

/** Suitcase that bobs (`.bob` 2.8s, origin bottom centre). */
function StaysIcon() {
  const p = useLoop(2800);
  const a = useAnimatedStyle(() => ({
    transform: [
      {translateY: kf(p.value, [[0, 0], [0.3, -3], [0.6, 0], [1, 0]], E.easeInOut)},
      {rotate: `${kf(p.value, [[0, 0], [0.3, -4], [0.6, 3], [1, 0]], E.easeInOut)}deg`},
    ],
  }));
  return (
    <Animated.View style={[styles.icon, {transformOrigin: 'bottom'}, a]}>
      <Svg width={44} height={44} viewBox="0 0 40 40" fill="none" stroke={colors.gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={11} y={13} width={18} height={19} rx={3.5} fill="rgba(241,221,186,0.08)" />
        <Path d="M16 13V9.5A1.5 1.5 0 0 1 17.5 8h5A1.5 1.5 0 0 1 24 9.5V13M16 18v9M24 18v9" />
        <Circle cx={15} cy={35} r={1.4} />
        <Circle cx={25} cy={35} r={1.4} />
      </Svg>
    </Animated.View>
  );
}

const DROP = Easing.bezierFn(0.5, 0, 0.75, 0);

function BagItem({delay, children}) {
  // bagdrop 2.6s cubic-bezier(.5,0,.75,0)
  const p = useLoop(2600, {delay});
  const a = useAnimatedStyle(() => ({
    opacity: kf(p.value, [[0, 0], [0.12, 1], [0.38, 1], [0.46, 0], [1, 0]], DROP),
    transform: [{translateY: kf(p.value, [[0, -10], [0.38, 14], [0.46, 16], [1, 16]], DROP) * K}],
  }));
  return (
    <Layer origin={[22, 22]} style={a}>
      {children}
    </Layer>
  );
}

/** Shopping bag: glowing base, items dropping in, squash, sparkle. */
function ShopIcon() {
  const glowP = useLoop(1600);
  const p = useLoop(2600);
  const glow = useAnimatedStyle(() => {
    const t = kf(glowP.value, [[0, 0], [0.5, 1], [1, 0]], E.easeInOut);
    return {opacity: 0.55 + 0.45 * t, transform: [{scale: 1 + 0.15 * t}]};
  });
  const body = useAnimatedStyle(() => ({
    transform: [
      {scaleX: kf(p.value, [[0, 1], [0.34, 1], [0.42, 1.08], [0.52, 0.97], [0.62, 1], [1, 1]], E.easeInOut)},
      {scaleY: kf(p.value, [[0, 1], [0.34, 1], [0.42, 0.9], [0.52, 1.05], [0.62, 1], [1, 1]], E.easeInOut)},
    ],
  }));
  const spark = useAnimatedStyle(() => ({
    opacity: kf(p.value, [[0, 0], [0.45, 0], [0.58, 1], [0.75, 0], [1, 0]], E.easeInOut),
    transform: [
      {scale: kf(p.value, [[0, 0.3], [0.45, 0.3], [0.58, 1], [0.75, 0.3], [1, 0.3]], E.easeInOut)},
      {rotate: `${kf(p.value, [[0, 0], [0.45, 0], [0.58, 45], [0.75, 90], [1, 90]], E.easeInOut)}deg`},
    ],
  }));
  return (
    <View style={styles.icon}>
      <Layer origin={[20 * K, 26 * K]} style={glow}>
        <Ellipse cx={20} cy={26} rx={13} ry={10} fill="rgba(241,221,186,0.14)" />
      </Layer>
      <BagItem delay={0}>
        <Rect x={15} y={6} width={6} height={6} rx={1.5} fill="#F2A33A" />
      </BagItem>
      <BagItem delay={450}>
        <Circle cx={24.5} cy={8} r={3} fill={colors.goldDeep} />
      </BagItem>
      <Layer origin={[20 * K, 34.5 * K]} style={body}>
        <Path d="M10 16h20l-1.6 16.2a2.5 2.5 0 0 1-2.5 2.3H14.1a2.5 2.5 0 0 1-2.5-2.3z" fill="#1E1B17" stroke={colors.gold} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M15 19v-3.5a5 5 0 0 1 10 0V19" stroke={colors.gold} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M16.5 25.5h7" stroke={colors.gold} strokeWidth={1.4} strokeLinecap="round" opacity={0.5} />
      </Layer>
      <Layer origin={[33 * K, 9.2 * K]} style={spark}>
        <Path d="M33 6l1 2.2 2.2 1-2.2 1L33 12.4l-1-2.2-2.2-1 2.2-1z" fill={colors.highlight} />
      </Layer>
    </View>
  );
}

function FloatNote({delay, origin, children}) {
  // nfloat 2.4s ease-in-out: transform runs 0%→100%, opacity has 25%/70% stops
  const p = useLoop(2400, {delay});
  const a = useAnimatedStyle(() => {
    const t = E.easeInOut(p.value);
    return {
      opacity: kf(p.value, [[0, 0], [0.25, 1], [0.7, 1], [1, 0]], E.easeInOut),
      transform: [
        {translateX: 3 * t},
        {translateY: 6 - 15 * t},
        {rotate: `${-10 + 22 * t}deg`},
        {scale: 0.7 + 0.3 * t},
      ],
    };
  });
  return (
    <Layer origin={origin} viewBox="0 0 44 44" style={a}>
      {children}
    </Layer>
  );
}

/** Music notes: main note beats, two small notes float up. */
function ConcertIcon() {
  const p = useLoop(1200);
  const beat = useAnimatedStyle(() => ({
    transform: [
      {rotate: `${kf(p.value, [[0, 0], [0.25, -7], [0.5, 0], [0.75, 6], [1, 0]], E.easeInOut)}deg`},
      {scale: kf(p.value, [[0, 1], [0.25, 1.06], [0.5, 1], [0.75, 1.04], [1, 1]], E.easeInOut)},
    ],
  }));
  return (
    <View style={styles.icon}>
      <Layer origin={[18.5, 33.3]} viewBox="0 0 44 44" style={beat}>
        <Path d="M15 30V13l13-3v16" stroke={colors.gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M15 17l13-3" stroke={colors.gold} strokeWidth={2} strokeLinecap="round" />
        <G rotation={-20} origin="12, 30.5">
          <Ellipse cx={12} cy={30.5} rx={3.6} ry={2.8} fill={colors.gold} />
        </G>
        <G rotation={-20} origin="25, 26.5">
          <Ellipse cx={25} cy={26.5} rx={3.6} ry={2.8} fill={colors.gold} />
        </G>
      </Layer>
      <FloatNote delay={0} origin={[33.6, 24.3]}>
        <Path d="M34 22V12.5c2 .6 3.5 1.8 3.8 3.6" stroke={colors.goldDeep} strokeWidth={1.8} strokeLinecap="round" />
        <G rotation={-20} origin="32, 22.3">
          <Ellipse cx={32} cy={22.3} rx={2.6} ry={2} fill={colors.goldDeep} />
        </G>
      </FloatNote>
      <FloatNote delay={1200} origin={[7.6, 15.9]}>
        <Path d="M8 14V7.5c1.6.5 2.8 1.4 3 2.8" stroke={colors.goldDeep} strokeWidth={1.6} strokeLinecap="round" />
        <G rotation={-20} origin="6.4, 14.2">
          <Ellipse cx={6.4} cy={14.2} rx={2.2} ry={1.7} fill={colors.goldDeep} />
        </G>
      </FloatNote>
    </View>
  );
}

function CatCard({style, sheenDelay, onPress, label, disabled, children}) {
  if (disabled) {
    // Coming soon: not pressable, no sheen, and its icon loops stay still.
    return (
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${label}, coming soon`}
        accessibilityState={{disabled: true}}
        style={[styles.cat, style]}>
        <LinearGradient colors={[colors.cardTop, colors.cardBottom]} start={CARD_ANGLE.start} end={CARD_ANGLE.end} style={StyleSheet.absoluteFill} />
        <LoopGate active={false}>{children}</LoopGate>
      </View>
    );
  }
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.cat, style]}>
      <LinearGradient colors={[colors.cardTop, colors.cardBottom]} start={CARD_ANGLE.start} end={CARD_ANGLE.end} style={StyleSheet.absoluteFill} />
      {children}
      <Sheen duration={6000} delay={sheenDelay} alpha={0.09} band={[0.38, 0.5, 0.62]} angle={105} />
    </PressScale>
  );
}

/**
 * Each card follows its app flag: 'live' tappable, 'coming_soon' dimmed with a
 * COMING SOON tag and not tappable, 'hidden' not rendered. A lone Stays/Shop
 * card fills the row; with every card hidden the section is gone.
 */
export default React.memo(function HubCategories({stays, shop, concerts, onStays, onShop, onConcerts}) {
  useRenderCount('HubCategories');
  const showStays = stays !== 'hidden';
  const showShop = shop !== 'hidden';
  const showConcerts = concerts !== 'hidden';
  if (!showStays && !showShop && !showConcerts) {
    return null;
  }
  const dim = state => (state === 'coming_soon' ? styles.dim : null);
  return (
    <View style={styles.sec}>
      <Reveal style={styles.head}>
        <Text style={type.h2}>Explore Categories</Text>
        {/* <Tag>CURATED</Tag> */}
      </Reveal>
      {showStays || showShop ? (
        <Reveal style={styles.grid}>
          {showStays ? (
            <CatCard style={styles.half} sheenDelay={0} onPress={onStays} label="Stays" disabled={stays !== 'live'}>
              <View style={styles.top}>
                <View style={dim(stays)}>
                  <StaysIcon />
                </View>
                {stays === 'live' ? <ArrowCircle /> : null}
              </View>
              <Text style={[styles.h3, dim(stays)]}>Stays</Text>
              {stays === 'live' ? <StaysCount /> : <Tag>COMING SOON</Tag>}
              <Text style={[styles.meta, dim(stays)]}>Hotels · Villas · Resorts</Text>
            </CatCard>
          ) : null}
          {showShop ? (
            <CatCard style={styles.half} sheenDelay={500} onPress={onShop} label="Shop" disabled={shop !== 'live'}>
              <View style={styles.top}>
                <View style={dim(shop)}>
                  <ShopIcon />
                </View>
                {shop === 'live' ? <ArrowCircle /> : null}
              </View>
              <Text style={[styles.h3, dim(shop)]}>Shop</Text>
              {shop === 'live' ? <MTag>BOUTIQUE</MTag> : <Tag>COMING SOON</Tag>}
              <Text style={[styles.meta, dim(shop)]}>Membership · Home · Pooja</Text>
            </CatCard>
          ) : null}
        </Reveal>
      ) : null}
      {showConcerts ? (
        <Reveal style={showStays || showShop ? {marginTop: 12} : null}>
          <CatCard style={styles.wide} sheenDelay={1000} onPress={onConcerts} label="Concerts" disabled={concerts !== 'live'}>
            <View style={[styles.noteBox, dim(concerts)]}>
              <ConcertIcon />
            </View>
            <View style={styles.wideText}>
              <View style={styles.titleRow}>
                <Text style={[styles.h3, {marginTop: 0}, dim(concerts)]}>Fracspace Exclusive</Text>
                {concerts !== 'live' && <Tag>COMING SOON</Tag>}
              </View>
              <Text style={[styles.meta, {fontSize: 12}, dim(concerts)]}>Music · Live Events · Shows</Text>
            </View>
            {concerts === 'live' ? <ArrowCircle /> : null}
          </CatCard>
        </Reveal>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  hide: {opacity: 0},
  sec: {paddingTop: 5, paddingHorizontal: 20},
  head: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16},
  grid: {flexDirection: 'row', gap: 12},
  half: {flex: 1},
  dim: {opacity: 0.45},
  cat: {
    gap: 8,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  wide: {flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18},
  top: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  icon: {width: 44, height: 44},
  h3: {fontFamily: fonts.bold, fontSize: 17, color: colors.cream, marginTop: 4},
  meta: {fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted},
  noteBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldA(0.08),
    borderWidth: 1,
    borderColor: colors.goldA(0.2),
  },
  wideText: {flex: 1, gap: 6},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
});
