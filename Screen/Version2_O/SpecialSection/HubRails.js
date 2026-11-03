// Hub rails: Featured Stays (scroll-scrubbed cards, heart burst), Iva
// Essentials (expanding steppers) and the floating cart bar.
import React, {useEffect, useMemo, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Path} from 'react-native-svg';
import {colors, fonts, ls, type} from './theme';
import {E, LoopGate, Nudge, PressScale, Reveal, Sheen, kf, useLinger, useReducedMotion, useToggle} from './anim';
import {useRenderCount} from './perf';
import {ArrowIcon, Tag} from './HubBits';
import {ivaProducts} from './data';
import {likeProperty, useStaysHome} from './api/stays';

const CARD_W = 288;
const CARD_GAP = 14;
const ICARD_W = 166;
const ICARD_GAP = 12;
const HEART = 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z';

function SectionHead({tag, title, sub, link, onLink}) {
  return (
    <Reveal style={styles.head}>
      <Tag dot>{tag}</Tag>
      <View style={styles.headRow}>
        <View style={{gap: 4, flexShrink: 1}}>
          <Text style={type.h2}>{title}</Text>
          <Text style={[type.muted, {fontSize: 12.5}]}>{sub}</Text>
        </View>
        <Pressable onPress={onLink} style={styles.link} accessibilityRole="link">
          <Text style={type.link}>{link}</Text>
          <Nudge style={type.link} />
        </Pressable>
      </View>
    </Reveal>
  );
}

// `.burst`: 8 dots flying out when a stay is liked (.65s ease-out).
function BurstDot({angle, gold}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = reduced ? 1 : withTiming(1, {duration: 650, easing: E.easeOut});
  }, [reduced, t]);
  const a = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{rotate: `${angle}deg`}, {translateY: -6 - 22 * t.value}, {scale: 1 - 0.7 * t.value}],
  }));
  return <Animated.View style={[styles.burstDot, {backgroundColor: gold ? colors.gold : colors.roseLight}, a]} />;
}

function Heart({liked, onPress, name}) {
  const fill = useToggle(liked, {duration: 200, easing: E.ease});
  const pop = useSharedValue(1);
  useEffect(() => {
    if (liked) {
      // .heart.liked svg{animation:pop .55s var(--spring)}
      pop.value = 0;
      pop.value = withTiming(1, {duration: 550, easing: E.linear});
    }
  }, [liked, pop]);
  const svg = useAnimatedStyle(() => ({
    transform: [{scale: kf(pop.value, [[0, 1], [0.3, 0.6], [0.65, 1.3], [1, 1]], E.spring)}],
  }));
  const filled = useAnimatedStyle(() => ({opacity: fill.value}));
  return (
    <PressScale to={0.85} duration={400} onPress={onPress} style={styles.heart} accessibilityRole="button" accessibilityLabel={`Save ${name}`}>
      <Animated.View style={svg}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path d={HEART} fill="none" stroke="#fff" strokeWidth={1.8} strokeLinejoin="round" />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, filled]}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d={HEART} fill={colors.rose} stroke={colors.rose} strokeWidth={1.8} strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </Animated.View>
      {liked ? (
        <View style={styles.burst} pointerEvents="none">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
            <BurstDot key={deg} angle={deg} gold={i % 2 === 1} />
          ))}
        </View>
      ) : null}
    </PressScale>
  );
}

function StayCard({stay, index, scrollX, width, liked, onLike, onOpen}) {
  const left = 20 + index * (CARD_W + CARD_GAP);
  const imgW = CARD_W * 1.16;
  // railfx / imgpar: animation-timeline: view(inline), linear
  const card = useAnimatedStyle(() => {
    const p = (width - (left - scrollX.value)) / (width + CARD_W);
    return {
      opacity: kf(p, [[0, 0.5], [0.4, 1], [0.6, 1], [1, 0.5]]),
      transform: [{scale: kf(p, [[0, 0.9], [0.4, 1], [0.6, 1], [1, 0.9]])}],
    };
  });
  const img = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (width - (left - scrollX.value)) / (width + CARD_W)));
    return {transform: [{translateX: (0.07 - 0.14 * p) * imgW}]};
  });
  return (
    <Animated.View style={[styles.scard, card]}>
      <Animated.Image source={stay.img} resizeMode="cover" style={[styles.simg, {width: imgW, left: -CARD_W * 0.08}, img]} />
      <LinearGradient
        colors={['rgba(10,10,12,0.35)', 'rgba(10,10,12,0)', 'rgba(10,10,12,0.15)', 'rgba(10,10,12,0.92)']}
        locations={[0, 0.28, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open ${stay.name}`} />
      <View style={styles.rchip} pointerEvents="none">
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z" fill={colors.gold} />
        </Svg>
        <Text style={styles.rchipText}>
          {stay.rate} · {stay.loc}
        </Text>
      </View>
      <Heart liked={liked} onPress={onLike} name={stay.name} />
      <View style={styles.sfoot} pointerEvents="none">
        <View style={{gap: 4, flexShrink: 1}}>
          <Text style={styles.sname}>{stay.name}</Text>
          <Text style={styles.ssub}>
            {stay.sub} · <Text style={styles.sprice}>{stay.price}</Text>
            <Text style={{fontSize: 11}}>/night</Text>
          </Text>
        </View>
        <View style={styles.sarr}>
          <ArrowIcon size={18} color="#fff" />
        </View>
      </View>
    </Animated.View>
  );
}

// Hub card from a /stays/home retreat: "Boutique Hotel" → tag or city,
// "Banjara Hills" → the area before the city.
const toCard = r => ({...r, sub: r.tag || r.city, loc: r.loc.split(',')[0].trim()});

/**
 * The stays marked featured in /stays/home (all of them if none are), from the
 * same cache the Stays screen reads. Nothing until the first load lands.
 */
export const FeaturedStays = React.memo(function FeaturedStays({onOpenStay, onViewAll}) {
  useRenderCount('FeaturedStays');
  const {width} = useWindowDimensions();
  const {data} = useStaysHome();
  const stays = useMemo(() => {
    const all = data?.enabled ? data.retreats : [];
    const top = all.filter(r => r.featured);
    return (top.length ? top : all).slice(0, 6).map(toCard);
  }, [data]);
  // Server's liked state until the guest taps; a failed like flips back.
  const [mine, setMine] = useState({});
  const onLike = s => {
    const next = !(mine[s.id] ?? s.liked);
    setMine(m => ({...m, [s.id]: next}));
    likeProperty(s.propertyId || s.id, next).catch(() => setMine(m => ({...m, [s.id]: !next})));
  };
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollX.value = e.contentOffset.x;
  });
  if (!stays.length) {
    return null;
  }
  return (
    <View style={{paddingTop: 38}}>
      <SectionHead
        tag="CURATED ESCAPES"
        title="Featured Stays"
        sub="Cinematic sanctuaries & architectural retreats"
        link="View all"
        onLink={onViewAll}
      />
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={CARD_W + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.srail}>
        {stays.map((s, i) => (
          <StayCard
            key={s.id}
            stay={s}
            index={i}
            width={width}
            scrollX={scrollX}
            liked={mine[s.id] ?? s.liked}
            onLike={() => onLike(s)}
            onOpen={() => onOpenStay(s)}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
});

function StepButton({label, onPress, style, a11y}) {
  return (
    <PressScale to={0.8} duration={300} onPress={onPress} style={[styles.stBtn, style]} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={4}>
      <Text style={styles.stText}>{label}</Text>
    </PressScale>
  );
}

// `.step`: "+" that springs open into − count + (width 36 → 96).
function Stepper({qty, onInc, onDec, name}) {
  const open = qty > 0;
  const w = useToggle(open, {duration: 500, easing: E.spring});
  const fade = useToggle(open, {duration: 200, easing: E.ease});
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withTiming(-36 * qty, {duration: 500, easing: E.spring});
  }, [qty, y]);
  const box = useAnimatedStyle(() => ({width: 36 + 60 * w.value}));
  const shown = useAnimatedStyle(() => ({opacity: fade.value}));
  const strip = useAnimatedStyle(() => ({transform: [{translateY: y.value}]}));
  return (
    <Animated.View style={[styles.step, box]}>
      <Animated.View style={[styles.stCount, shown]} pointerEvents="none">
        <Animated.View style={strip}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <Text key={n} style={styles.stNum}>
              {n}
            </Text>
          ))}
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.stMinus, shown]} pointerEvents={open ? 'auto' : 'none'}>
        <StepButton label="−" onPress={onDec} a11y={`Remove one ${name}`} />
      </Animated.View>
      <StepButton label="+" onPress={onInc} style={styles.stPlus} a11y={`Add ${name} to cart`} />
    </Animated.View>
  );
}

function IvaCard({product, qty, onInc, onDec, onOpen}) {
  return (
    <View style={styles.icard}>
      <Pressable style={styles.itile} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`View ${product.name}`}>
        {product.img ? (
          <Image source={product.img} resizeMode="cover" style={styles.fill} />
        ) : (
          <View style={styles.phIva}>
            <Text style={styles.phIvaText}>IVA</Text>
          </View>
        )}
        <Sheen duration={5000} rgb="255,255,255" alpha={0.55} band={[0.4, 0.5, 0.6]} angle={110} />
      </Pressable>
      <Text style={[type.muted, {fontSize: 11, marginTop: 2}]}>{product.cat}</Text>
      <Text style={styles.iname}>{product.name}</Text>
      <View style={styles.irow}>
        <Text style={styles.iprice}>₹{product.price}</Text>
        <Stepper qty={qty} onInc={onInc} onDec={onDec} name={product.name} />
      </View>
    </View>
  );
}

export const IvaEssentials = React.memo(function IvaEssentials({qty, setQty, onOpenShop}) {
  useRenderCount('IvaEssentials');
  return (
    <View style={{paddingTop: 38}}>
      <SectionHead
        tag="SACRED LIVING"
        title="Iva Essentials"
        sub="Spiritual décor & artisanal essentials"
        link="Explore"
        onLink={onOpenShop}
      />
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ICARD_W + ICARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.irail}>
        {ivaProducts.map(p => {
          const q = qty[p.id] || 0;
          return (
            <IvaCard
              key={p.id}
              product={p}
              qty={q}
              onInc={() => setQty(p.id, q + 1)}
              onDec={() => setQty(p.id, q - 1)}
              onOpen={onOpenShop}
            />
          );
        })}
      </Animated.ScrollView>
    </View>
  );
});

/** Floating cart bar; slides up once something is in the bag, bag jiggles on change. */
export function CartBar({qty, jig, bottom, onPress}) {
  useRenderCount('CartBar');
  let count = 0;
  let total = 0;
  ivaProducts.forEach(p => {
    const q = qty[p.id] || 0;
    count += q;
    total += q * p.price;
  });
  const show = count > 0;
  const slide = useToggle(show, {duration: 600, easing: E.spring});
  const fade = useToggle(show, {duration: 300, easing: E.ease});
  // The arrow's loop runs only while the bar is on screen (incl. its exit).
  const live = useLinger(show, 600);
  const reduced = useReducedMotion();
  const j = useSharedValue(1);
  useEffect(() => {
    if (jig > 0 && !reduced) {
      j.value = 0;
      j.value = withTiming(1, {duration: 600, easing: E.linear});
    }
  }, [jig, reduced, j]);
  const bar = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{translateY: (1 - slide.value) * 112}],
  }));
  const bag = useAnimatedStyle(() => ({
    transform: [
      {scale: kf(j.value, [[0, 1], [0.3, 1.25], [0.6, 0.95], [1, 1]], E.spring)},
      {rotate: `${kf(j.value, [[0, 0], [0.3, -10], [0.6, 6], [1, 0]], E.spring)}deg`},
    ],
  }));
  const label = `${count} ${count === 1 ? 'item' : 'items'} · ₹${total.toLocaleString('en-IN')}`;
  return (
    <Animated.View style={[styles.cart, {bottom}, bar]} pointerEvents={show ? 'auto' : 'none'}>
      <Pressable onPress={onPress} style={styles.cartInner} accessibilityRole="button" accessibilityLabel="View cart">
        <Animated.View style={[styles.bagc, bag]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth={1.8} strokeLinejoin="round">
            <Path d="M6 8h12l-1 12H7z" />
            <Path d="M9 8V6.5a3 3 0 0 1 6 0V8" strokeLinecap="round" />
          </Svg>
        </Animated.View>
        <View style={{flex: 1, gap: 1}}>
          <Text style={styles.cartLabel}>{label}</Text>
          <Text style={styles.cartSub}>Iva Essentials</Text>
        </View>
        <View style={styles.cartBtn}>
          <Text style={styles.cartBtnText}>View cart</Text>
          <LoopGate active={live}>
            <Nudge style={styles.cartBtnText} />
          </LoopGate>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {width: '100%', height: '100%'},
  head: {gap: 8, paddingHorizontal: 20, marginBottom: 14},
  headRow: {flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between'},
  link: {flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44},
  srail: {gap: CARD_GAP, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8},
  scard: {
    width: CARD_W,
    height: 356,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  simg: {position: 'absolute', top: 0, height: '100%'},
  rchip: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.groundA(0.5),
    borderWidth: 1,
    borderColor: colors.whiteA(0.16),
  },
  rchipText: {fontFamily: fonts.semibold, fontSize: 12, color: '#fff'},
  heart: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.groundA(0.45),
    borderWidth: 1,
    borderColor: colors.whiteA(0.16),
  },
  burst: {position: 'absolute', left: 21, top: 21, width: 0, height: 0},
  burstDot: {position: 'absolute', left: -2.5, top: -2.5, width: 5, height: 5, borderRadius: 2.5},
  sfoot: {
    position: 'absolute',
    left: 20,
    right: 16,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  sname: {fontFamily: fonts.bold, fontSize: 21, color: '#fff'},
  ssub: {fontFamily: fonts.regular, fontSize: 12.5, color: colors.soft},
  sprice: {fontFamily: fonts.bold, color: colors.cream},
  sarr: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.whiteA(0.1),
    borderWidth: 1,
    borderColor: colors.whiteA(0.18),
  },
  irail: {gap: ICARD_GAP, paddingHorizontal: 20},
  icard: {
    width: ICARD_W,
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 12,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itile: {height: 132, borderRadius: 16, backgroundColor: '#fff', overflow: 'hidden'},
  phIva: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ivaTile},
  phIvaText: {fontFamily: fonts.serif, fontSize: 26, letterSpacing: ls(0.12, 26), color: colors.ivaText},
  iname: {fontFamily: fonts.bold, fontSize: 14, color: colors.cream},
  irow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6},
  iprice: {fontFamily: fonts.extrabold, fontSize: 15, color: colors.cream},
  step: {height: 36, borderRadius: 18, backgroundColor: colors.gold, overflow: 'hidden'},
  stBtn: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center'},
  stText: {fontFamily: fonts.bold, fontSize: 18, color: colors.ink},
  stPlus: {position: 'absolute', right: 0, top: 0},
  stMinus: {position: 'absolute', left: 0, top: 0},
  stCount: {position: 'absolute', left: '50%', top: 0, width: 14, marginLeft: -7, height: 36, overflow: 'hidden'},
  stNum: {height: 36, lineHeight: 36, textAlign: 'center', fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink},
  cart: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.gold,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: {width: 0, height: 16},
    elevation: 18,
    zIndex: 34,
  },
  cartInner: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 10, paddingRight: 8},
  bagc: {width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink},
  cartLabel: {fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink},
  cartSub: {fontFamily: fonts.semibold, fontSize: 11, color: colors.ink, opacity: 0.7},
  cartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.ink,
  },
  cartBtnText: {fontFamily: fonts.bold, fontSize: 13, color: colors.gold},
});
