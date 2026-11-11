// Hub hero carousel: 4 auto-advancing slides (Ken Burns photos / floating
// product tiles), staggered copy, segmented pager with odometer, scroll parallax.
import React, {useCallback, useEffect} from 'react';
import {Image, Pressable, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Defs, RadialGradient, Rect, Stop} from 'react-native-svg';
import {colors, fonts, ls} from './theme';
import {E, LoopGate, Nudge, PressScale, kf, useLinger, useLoop, useReducedMotion, useToggle} from './anim';
import {BackIcon, Eyebrow, GlassButton, Tag} from './HubBits';
import {images} from './data';
import {useRenderCount} from './perf';

export const HERO_H = 476;
export const SLIDE_MS = 5200;
const PHOTO_H = 340;

function PhotoSlide({img, on, width}) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1.1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  useEffect(() => {
    // .hs.on img.cover{animation:kb 6.4s ease-out both}; off → scale(1.1)
    if (on && !reduced) {
      const cfg = {duration: 6400, easing: E.easeOut};
      s.value = 1.22;
      tx.value = 0;
      ty.value = 0;
      s.value = withTiming(1.05, cfg);
      tx.value = withTiming(-6, cfg);
      ty.value = withTiming(-4, cfg);
    } else {
      s.value = 1.1;
      tx.value = 0;
      ty.value = 0;
    }
  }, [on, reduced, s, tx, ty]);
  // CSS applies scale before translate: scale(1.05) translate(-6px,-4px)
  const a = useAnimatedStyle(() => ({
    transform: [{scale: s.value}, {translateX: tx.value}, {translateY: ty.value}],
  }));
  return (
    <>
      <Animated.Image source={img} resizeMode="cover" style={[{position: 'absolute', left: 0, top: 0, width, height: PHOTO_H}, a]} />
      <LinearGradient
        colors={['rgba(10,10,12,0)', colors.groundAlt, colors.groundAlt]}
        locations={[0, 0.85, 1]}
        style={styles.fade}
      />
      <View style={styles.base} />
    </>
  );
}

function FloatTile({img, left, top, rot, rot2, lift, duration, on}) {
  const p = useLoop(duration, {active: on});
  const a = useAnimatedStyle(() => ({
    transform: [
      {rotate: `${kf(p.value, [[0, rot], [0.5, rot2], [1, rot]], E.easeInOut)}deg`},
      {translateY: kf(p.value, [[0, 0], [0.5, lift], [1, 0]], E.easeInOut)},
    ],
  }));
  return (
    <Animated.View style={[styles.ptile, {left, top}, a]}>
      <View style={styles.ptileClip}>
        <Image source={img} resizeMode="cover" style={styles.fill} />
      </View>
    </Animated.View>
  );
}

function ProductSlide({on, width}) {
  // radial-gradient(circle at 58% 30%, rgba(217,178,111,.42), transparent 58%)
  const cx = width * 0.58;
  const cy = HERO_H * 0.3;
  const r = Math.hypot(Math.max(cx, width - cx), Math.max(cy, HERO_H - cy));
  const dx = (width - 390) / 2;
  return (
    <View style={[StyleSheet.absoluteFill, {backgroundColor: colors.groundAlt}]}>
      <Svg width={width} height={HERO_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="pstage" cx={cx} cy={cy} r={r} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="rgb(217,178,111)" stopOpacity={0.42} />
            <Stop offset="0.58" stopColor="rgb(14,13,15)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={HERO_H} fill="url(#pstage)" />
      </Svg>
      <FloatTile img={images.shivaKit} left={50 + dx} top={64} rot={-9} rot2={-6} lift={-10} duration={4800} on={on} />
      <FloatTile img={images.ritualsKit} left={190 + dx} top={108} rot={8} rot2={5} lift={-12} duration={5400} on={on} />
    </View>
  );
}

const Slide = React.memo(function Slide({slide, on, width}) {
  // .hs{transition:opacity 1.1s ease}
  const v = useToggle(on, {duration: 1100, easing: E.ease});
  const a = useAnimatedStyle(() => ({opacity: v.value}));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, a]} pointerEvents="none">
      {slide.product ? <ProductSlide on={on} width={width} /> : <PhotoSlide img={slide.img} on={on} width={width} />}
    </Animated.View>
  );
});

// .hc>* off: opacity .3s ease, transform .3s ease; on: opacity .6s ease,
// transform .8s var(--out), delays .25/.35/.45/.55s.
function CopyItem({on, index, children}) {
  const delay = 250 + index * 100;
  const op = useToggle(on, {duration: 600, easing: E.ease, delay}, {duration: 300, easing: E.ease});
  const ty = useToggle(on, {duration: 800, easing: E.out, delay}, {duration: 300, easing: E.ease});
  const a = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{translateY: (1 - ty.value) * 18}],
  }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

// Memoised (with onCta(slide) called here) so only the copies whose `on`
// changes re-render on a slide change.
const Copy = React.memo(function Copy({slide, on, onCta}) {
  const cta = useCallback(() => onCta(slide), [onCta, slide]);
  // Hidden copies sit at opacity 0: stop their dot/arrow loops once faded out.
  const live = useLinger(on, 300);
  return (
    <LoopGate active={live}>
      <View style={styles.hc} pointerEvents={on ? 'box-none' : 'none'}>
        <CopyItem on={on} index={0}>
          <Eyebrow>{slide.eyebrow}</Eyebrow>
        </CopyItem>
        <CopyItem on={on} index={1}>
          <Text style={styles.htitle}>{slide.title}</Text>
        </CopyItem>
        <CopyItem on={on} index={2}>
          <Text style={styles.sub}>{slide.sub}</Text>
        </CopyItem>
        <CopyItem on={on} index={3}>
          {slide.soon ? (
            // Its section's flag is coming_soon: the same tag as its category card.
            <View style={styles.soon} accessible accessibilityLabel={`${slide.cta}, coming soon`}>
              <Tag>COMING SOON</Tag>
            </View>
          ) : (
            <PressScale to={0.94} onPress={cta} style={styles.cta} accessibilityRole="button">
              <Text style={styles.ctaText}>{slide.cta}</Text>
              <Nudge style={styles.ctaText} />
            </PressScale>
          )}
        </CopyItem>
      </View>
    </LoopGate>
  );
});

function Seg({state, onPress, index, slide}) {
  const on = state === 'on';
  const w = useToggle(on, {duration: 550, easing: E.out});
  const done = useToggle(state === 'done', {duration: 300, easing: E.ease});
  const reduced = useReducedMotion();
  const fill = useSharedValue(0);
  useEffect(() => {
    // .seg.on i::after{animation:fillx 5.2s linear forwards}
    fill.value = 0;
    if (on) {
      fill.value = reduced ? 1 : withTiming(1, {duration: SLIDE_MS, easing: E.linear});
    }
  }, [on, slide, reduced, fill]);
  const bar = useAnimatedStyle(() => ({
    width: 6 + 28 * w.value,
    backgroundColor: interpolateColor(done.value, [0, 1], ['rgba(255,255,255,0.3)', 'rgba(241,221,186,0.85)']),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: on ? 1 : 0,
    transform: [{scaleX: fill.value}],
  }), [on]);
  return (
    <Pressable onPress={onPress} style={styles.seg} accessibilityRole="button" accessibilityLabel={`Show slide ${index + 1}`}>
      <Animated.View style={[styles.segBar, bar]}>
        <Animated.View style={[styles.segFill, fillStyle]} />
      </Animated.View>
    </Pressable>
  );
}

function Odometer({slide, count}) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withTiming(-16 * slide, {duration: 600, easing: E.spring});
  }, [slide, y]);
  const a = useAnimatedStyle(() => ({transform: [{translateY: y.value}]}));
  return (
    <View style={styles.odo}>
      <Animated.View style={a}>
        {Array.from({length: count}, (_, i) => String(i + 1)).map(n => (
          <Text key={n} style={styles.odoText}>
            {n}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

export default function HubHero({slides, slide, onSeg, onCta, onBack, scrollY, topInset}) {
  const {width} = useWindowDimensions();
  useRenderCount('HubHero');
  // .hero-inner{animation:heropar; animation-range:0 470px}
  const par = useAnimatedStyle(() => {
    const t = interpolate(scrollY.value, [0, 470], [0, 1], Extrapolation.CLAMP);
    return {opacity: 1 - 0.65 * t, transform: [{translateY: 150 * t}, {scale: 1 + 0.06 * t}]};
  });
  return (
    <View style={styles.hero}>
      <Animated.View style={[StyleSheet.absoluteFill, par]}>
        {slides.map((s, i) => (
          <Slide key={s.eyebrow} slide={s} on={i === slide} width={width} />
        ))}
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(10,10,12,0.5)', 'rgba(10,10,12,0)', 'rgba(10,10,12,0)']}
        locations={[0, 0.22, 1]}
        style={StyleSheet.absoluteFill}
      />
      <GlassButton label="Back to Fracspace home" onPress={onBack} style={[styles.back, {top: topInset}]}>
        <BackIcon />
      </GlassButton>
      <View style={styles.hcopies} pointerEvents="box-none">
        {slides.map((s, i) => (
          <Copy key={s.eyebrow} slide={s} on={i === slide} onCta={onCta} />
        ))}
      </View>
      <View style={styles.pager}>
        {slides.map((s, i) => (
          <Seg
            key={s.eyebrow}
            index={i}
            slide={slide}
            state={i === slide ? 'on' : i < slide ? 'done' : 'idle'}
            onPress={() => onSeg(i)}
          />
        ))}
        <View style={styles.count}>
          <Odometer slide={slide} count={slides.length} />
          <Text style={styles.odoText}>/{slides.length}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {width: '100%', height: '100%'},
  hero: {
    height: HERO_H,
    overflow: 'hidden',
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    backgroundColor: '#000',
  },
  fade: {position: 'absolute', left: 0, right: 0, top: 180, height: 180},
  base: {position: 'absolute', left: 0, right: 0, top: PHOTO_H, bottom: 0, backgroundColor: colors.groundAlt},
  ptile: {
    position: 'absolute',
    width: 150,
    height: 116,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.goldA(0.25),
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 25,
    shadowOffset: {width: 0, height: 24},
    elevation: 16,
  },
  ptileClip: {flex: 1, borderRadius: 17, overflow: 'hidden'},
  back: {position: 'absolute', left: 20},
  hcopies: {position: 'absolute', left: 20, right: 20, bottom: 24, height: 230},
  hc: {position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'flex-start', gap: 12},
  htitle: {
    fontFamily: fonts.extrabold,
    fontSize: 31,
    lineHeight: 31 * 1.12,
    letterSpacing: ls(-0.025, 31),
    color: colors.white,
  },
  sub: {fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 13.5 * 1.55, color: colors.soft, maxWidth: 300},
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.18,
    shadowRadius: 15,
    shadowOffset: {width: 0, height: 10},
  },
  soon: {height: 46, justifyContent: 'center'},
  ctaText: {fontFamily: fonts.bold, fontSize: 14, color: colors.ink},
  pager: {
    position: 'absolute',
    right: 20,
    bottom: 25,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: colors.groundA(0.55),
    borderWidth: 1,
    borderColor: colors.whiteA(0.1),
  },
  seg: {height: 44, justifyContent: 'center', paddingHorizontal: 3},
  segBar: {height: 6, borderRadius: 3, overflow: 'hidden'},
  segFill: {...StyleSheet.absoluteFillObject, backgroundColor: colors.gold, transformOrigin: 'left'},
  count: {flexDirection: 'row', alignItems: 'center', marginLeft: 8},
  odo: {height: 16, overflow: 'hidden'},
  odoText: {fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, height: 16, color: colors.cream},
});
