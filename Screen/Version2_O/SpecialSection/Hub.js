// Special Section Hub (Hub.dc.html): the centre tab's landing screen.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Platform, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import Animated, {
  interpolate,
  Extrapolation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, fonts} from './theme';
import {E, LoopGate, RevealScope, ViewportGate, useReducedMotion} from './anim';
import {BackIcon, GlassButton, Tag} from './HubBits';
import HubHero, {SLIDE_MS} from './HubHero';
import {heroSlides} from './data';
import {useFlag} from '../../flags/useFlag';
import {showDate, useNextConcert} from './useNextConcert';
import HubCategories from './HubCategories';
import {CartBar, FeaturedStays, IvaEssentials} from './HubRails';
import HubConcert from './HubConcert';
import {navBottom} from './HubNavBar';
import {markTap, sinceTap, useFirstFrame, useJsFps, useRenderCount} from './perf';

/**
 * `.app{animation:portal 1.1s cubic-bezier(.7,0,.2,1)}`: the screen opens as a
 * circle growing from the centre tab (50% 94%) to 150% of the screen.
 */
function usePortal(width, height) {
  const reduced = useReducedMotion();
  const cx = width / 2;
  const cy = height * 0.94;
  const rMax = 1.5 * Math.sqrt((width * width + height * height) / 2);
  // Android clips the rounded, 2000×-scaled layers on the CPU every frame,
  // which makes the screen crawl, so the portal is iOS only.
  const off = reduced || Platform.OS === 'android';
  const s = useSharedValue(1);
  const play = useCallback(() => {
    if (off) {
      return;
    }
    s.value = 0;
    s.value = withTiming(1, {duration: 1100, easing: E.snap});
  }, [off, s]);
  const outer = useAnimatedStyle(() => {
    const k = Math.max(0.0005, s.value);
    return {
      borderRadius: s.value >= 1 ? 0 : rMax,
      overflow: s.value >= 1 ? 'visible' : 'hidden',
      transform: [{scale: k}],
    };
  });
  const inner = useAnimatedStyle(() => ({
    transform: [{scale: 1 / Math.max(0.0005, s.value)}],
  }));
  const layout = {
    outer: {position: 'absolute', left: cx - rMax, top: cy - rMax, width: rMax * 2, height: rMax * 2},
    inner: {position: 'absolute', left: rMax - cx, top: rMax - cy, width, height, transformOrigin: [cx, cy, 0]},
  };
  if (off) {
    return {play, outer: StyleSheet.absoluteFill, inner: StyleSheet.absoluteFill};
  }
  return {play, outer: [layout.outer, outer], inner: [layout.inner, inner]};
}

/** The concert slide's copy from the API's next show (design: "Harish Sagane\nLive"). */
function concertSlide({concert, city}) {
  return {
    eyebrow: `LIVE IN ${city.city.toUpperCase()}`,
    title: `${concert.artist || concert.title}\nLive`,
    sub: `${concert.title} · ${showDate(city)}, ${city.venue}`,
    params: {concertId: concert.id},
  };
}

export default function Hub({navigation}) {
  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const portal = usePortal(width, height);
  useRenderCount('Hub');
  if (isFocused) {
    sinceTap('Hub render');
  }
  useFirstFrame('Hub');
  useJsFps('Hub', isFocused);

  // App flags (portal → App Controls): 'live' | 'coming_soon' | 'hidden'.
  const stays = useFlag('hub.stays');
  const shop = useFlag('hub.shop');
  const concerts = useFlag('hub.concerts');
  const flagOf = useRef({});
  flagOf.current = {Stays: stays, IvaShop: shop, ConcertDetails: concerts};
  // Hidden sections lose their slide; coming-soon ones keep it without a CTA.
  // The next show from the concert API; undefined while loading, null if none.
  const show = useNextConcert();
  const slides = useMemo(() => {
    const state = {Stays: stays, IvaShop: shop, ConcertDetails: concerts};
    return heroSlides
      .filter(s => state[s.to] !== 'hidden' && (s.to !== 'ConcertDetails' || show))
      .map(s => ({...s, soon: state[s.to] === 'coming_soon', ...(s.to === 'ConcertDetails' ? concertSlide(show) : null)}));
  }, [stays, shop, concerts, show]);
  const count = useRef(slides.length);
  count.current = slides.length;

  const [slideState, setSlide] = useState(0);
  const slide = slideState < slides.length ? slideState : 0;
  const [qty, setQtyState] = useState({});
  const [jig, setJig] = useState(0);

  const scrollRef = useAnimatedRef();
  const contentRef = useRef(null);
  const categoriesY = useRef(0);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  // Portal on first open and whenever the centre tab is selected again.
  useEffect(() => {
    portal.play();
    const tabNav = navigation.getParent();
    return tabNav?.addListener('focus', portal.play);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  // Auto-advance every 5.2s while visible; tapping a segment restarts the timer.
  const timer = useRef(null);
  const startTimer = useCallback(() => {
    clearInterval(timer.current);
    timer.current = setInterval(() => setSlide(s => (s + 1) % count.current), SLIDE_MS);
  }, []);
  useFocusEffect(
    useCallback(() => {
      startTimer();
      return () => clearInterval(timer.current);
    }, [startTimer]),
  );

  const go = useCallback(
    (to, params) => {
      if (to === 'categories') {
        scrollRef.current?.scrollTo({y: categoriesY.current, animated: true});
      } else {
        // Only open a section that is live (its flag may have changed).
        if (flagOf.current[to] && flagOf.current[to] !== 'live') {
          return;
        }
        markTap(to);
        navigation.navigate(to, params);
      }
    },
    [navigation, scrollRef],
  );

  const setQty = useCallback((id, n) => {
    setQtyState(q => ({...q, [id]: Math.max(0, Math.min(9, n))}));
    setJig(j => j + 1);
  }, []);

  // Stable handlers so the memoised sections skip the 5.2s hero re-render.
  const act = useMemo(
    () => ({
      stays: () => go('Stays'),
      shop: () => go('IvaShop'),
      concerts: () => go('ConcertDetails'),
      openConcert: c => go('ConcertDetails', {concertId: c.id}),
      openStay: stay => navigation.navigate('StayDetail', {stayId: stay.id}),
      home: () => navigation.navigate('HomeStack', {screen: 'HomePage'}),
      cta: s => go(s.to, s.params),
      seg: i => {
        setSlide(i);
        startTimer();
      },
    }),
    [go, navigation, startTimer],
  );

  // .mh: compact header fades in between 300px and 380px of scroll
  const mh = useAnimatedStyle(() => {
    const t = interpolate(scrollY.value, [300, 380], [0, 1], Extrapolation.CLAMP);
    return {opacity: t, transform: [{translateY: -8 * (1 - t)}]};
  });
  const [mhOn, setMhOn] = useState(false);
  useAnimatedReaction(
    () => scrollY.value > 300,
    (on, was) => {
      if (on !== was) {
        runOnJS(setMhOn)(on);
      }
    },
  );

  const bottom = navBottom(insets);

  return (
    <View style={styles.page}>
      <Animated.View style={portal.outer}>
        <Animated.View style={portal.inner}>
          <LoopGate active={isFocused}>
            <View style={styles.app}>
              <RevealScope scrollY={scrollY} contentRef={contentRef} viewportH={height}>
                <Animated.ScrollView
                  ref={scrollRef}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
>
                  <View ref={contentRef} collapsable={false} style={styles.content}>
                    <ViewportGate>
                      <HubHero
                        slides={slides}
                        slide={slide}
                        scrollY={scrollY}
                        topInset={insets.top + 4}
                        onSeg={act.seg}
                        onCta={act.cta}
                        onBack={act.home}
                      />
                    </ViewportGate>
                    <View onLayout={e => (categoriesY.current = e.nativeEvent.layout.y)}>
                      <ViewportGate>
                        <HubCategories
                          stays={stays}
                          shop={shop}
                          concerts={concerts}
                          onStays={act.stays}
                          onShop={act.shop}
                          onConcerts={act.concerts}
                        />
                      </ViewportGate>
                    </View>
                    {stays === 'live' ? (
                      <ViewportGate>
                        <FeaturedStays onOpenStay={act.openStay} onViewAll={act.stays} />
                      </ViewportGate>
                    ) : null}
                    {shop !== 'hidden' ? (
                      <ViewportGate>
                        <IvaEssentials soon={shop === 'coming_soon'} qty={qty} setQty={setQty} onOpenShop={act.shop} />
                      </ViewportGate>
                    ) : null}
                    {concerts === 'live' && show ? (
                      <ViewportGate>
                        <HubConcert show={show} onOpen={act.openConcert} onViewAll={act.concerts} />
                      </ViewportGate>
                    ) : null}
                  </View>
                </Animated.ScrollView>
              </RevealScope>

              <Animated.View
                style={[styles.mh, {height: 60 + insets.top, paddingTop: insets.top}, mh]}
                pointerEvents={mhOn ? 'box-none' : 'none'}>
                <GlassButton size={40} label="Back to Fracspace home" onPress={act.home}>
                  <BackIcon />
                </GlassButton>
                <Text style={styles.mhTitle}>Special Section</Text>
                <Tag>CURATED</Tag>
              </Animated.View>

              {shop === 'live' ? <CartBar qty={qty} jig={jig} bottom={bottom + 88} onPress={act.shop} /> : null}

            </View>
          </LoopGate>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: colors.page, overflow: 'hidden'},
  app: {flex: 1, backgroundColor: colors.ground},
  content: {paddingBottom: 150},
  mh: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(10,10,12,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    zIndex: 30,
  },
  mhTitle: {flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.cream},
});
