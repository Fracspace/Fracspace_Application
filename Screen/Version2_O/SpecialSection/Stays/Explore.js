// "Explore stays" view of the Stays listing (Stays.dc.html, `isExplore`).
// Returned as siblings; the search bar floats over the page (index.js) above a fixed slot here.
import React, {memo, useEffect, useMemo, useState} from 'react';
import {Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  interpolate,
  interpolateColor,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, {Defs, LinearGradient as SvgGradient, Path, Rect, Stop} from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import {colors, fonts, ls} from '../theme';
import {E, PressScale, RailGate, Reveal, ViewportGate, cssAngle, kf, useLoop, useToggle} from '../anim';
import {Burst, Ripple, Tag, useShot} from './bits';
import {CalendarIcon, CameraIcon, HEART_D, HeadsetIcon, PinIcon, SearchIcon, SlidersIcon, StarIcon} from './icons';
import {searchHints} from './data';
import {likeProperty} from '../api/stays';
import {ErrorCard, Skeleton} from '../api/ui';
import {guestLabel, whenLabel} from './SearchSheet';
import Reels from './Reels';
import Offers, {COUPON_W} from './Offers';
import {useFirstFrame, useRenderCount} from '../perf';

const RCARD_W = 302;
const RCARD_GAP = 14;
const REVIEW_W = 300;
// Colour helpers are plain JS, so resolve them before they reach a worklet.
const CHIP_BORDER = colors.whiteA(0.12);
const GOLD_0 = colors.goldA(0);

const SEARCH_H = 86; // `.search` 66 + `.sticky` padding 10 × 2

/**
 * `.sticky-search`: sticks below the status bar and darkens over the first 120px of scroll.
 * It floats outside the ScrollView, so once stuck it stays still instead of chasing the scroll.
 * `top` is its slot's y in the scroll content; `inset` pads it clear of the notch.
 */
export function SearchBar({scrollY, top, inset, style, onPress}) {
  useRenderCount('SearchBar');
  const seek = useLoop(4000);
  const roll = useLoop(10000);

  const stick = useAnimatedStyle(() => {
    const t = interpolate(scrollY.value, [0, 120], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [{translateY: Math.max(0, top - inset - scrollY.value)}],
      backgroundColor: `rgba(10,10,12,${0.86 * t})`,
      shadowOpacity: 0.45 * t,
    };
  }, [top, inset]);
  const icon = useAnimatedStyle(() => ({
    transform: [
      {rotate: `${kf(seek.value, [[0, 0], [0.7, 0], [0.78, -14], [0.86, 10], [1, 0]], E.easeInOut)}deg`},
    ],
  }));
  const strip = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: kf(
          roll.value,
          [[0, 0], [0.24, 0], [0.3, -20], [0.54, -20], [0.6, -40], [0.84, -40], [0.9, -60], [1, -60]],
          E.snap,
        ),
      },
    ],
  }));

  return (
    <Animated.View pointerEvents="box-none" style={[styles.sticky, {paddingTop: inset + 10}, style, stick]}>
      <PressScale
        to={0.97}
        onPress={onPress}
        accessibilityLabel="Search stays by destination, dates and guests"
        style={styles.search}>
        <View style={styles.sic}>
          <Animated.View style={icon}>
            <SearchIcon size={20} color={colors.gold} />
          </Animated.View>
        </View>
        <View style={styles.searchText}>
          <View style={styles.roll}>
            <Animated.View style={strip}>
              {searchHints.map((h, i) => (
                <Text key={i} style={styles.rollText} numberOfLines={1}>
                  {h}
                </Text>
              ))}
            </Animated.View>
          </View>
          <Text style={styles.searchSub}>Destination · Dates · Guests</Text>
        </View>
        <View style={styles.filterBtn}>
          <SlidersIcon size={18} color="#E6E0D6" />
        </View>
      </PressScale>
    </Animated.View>
  );
}

/** `.chip` with the `chippop` keyframes when it turns on. */
function Chip({label, on, pin, aria, onPress}) {
  const v = useToggle(on, {duration: 300, easing: E.ease});
  const pop = useShot(on, 450);
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [colors.card, colors.gold]),
    borderColor: interpolateColor(v.value, [0, 1], [CHIP_BORDER, GOLD_0]),
    transform: [{scale: kf(pop.value, [[0, 0.9], [0.6, 1.06], [1, 1]], E.spring)}],
  }));
  const text = useAnimatedStyle(() => ({color: interpolateColor(v.value, [0, 1], ['#E6E0D6', colors.ink])}));
  return (
    <PressScale to={0.92} onPress={onPress} accessibilityState={{selected: on}} accessibilityLabel={aria}>
      <Animated.View style={[styles.chip, bg]}>
        {pin ? <PinIcon color={colors.ink} /> : null}
        <Animated.Text style={[styles.chipText, text]}>{label}</Animated.Text>
      </Animated.View>
    </PressScale>
  );
}

/**
 * Capsules under the search bar: the calendar button, then (after a search)
 * the chosen destination, dates and guests, then the other destinations.
 */
function Chips({cities, search, patch, openSearch}) {
  const ac = search.pillCity;
  const city = c => (
    <Chip
      key={'c-' + c}
      label={c}
      on={c === ac}
      pin={c === ac}
      aria={c === ac ? c + ', selected' : 'Show stays in ' + c}
      onPress={() => patch({pillCity: c === ac ? '' : c})}
    />
  );
  const when = whenLabel(search);
  const who = guestLabel(search);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <PressScale
        to={0.92}
        onPress={() => openSearch('when')}
        accessibilityLabel="Choose check-in and checkout dates"
        style={[styles.chip, styles.calp]}>
        <CalendarIcon />
      </PressScale>
      {search.applied ? (
        <>
          {ac ? city(ac) : null}
          <Chip key="dates" label={when} on aria={`Dates ${when}, change`} onPress={() => openSearch('when')} />
          <Chip key="guests" label={who} on aria={`${who}, change`} onPress={() => openSearch('who')} />
          {cities.filter(c => c !== ac).map(city)}
        </>
      ) : (
        cities.map(city)
      )}
    </ScrollView>
  );
}

/** `.heart`: pop + burst when liked, fill transition .2s. */
function Heart({liked, name, onPress}) {
  const pop = useShot(liked, 550);
  const a = useAnimatedStyle(() => ({
    transform: [{scale: kf(pop.value, [[0, 1], [0.3, 0.6], [0.65, 1.3], [1, 1]], E.spring)}],
  }));
  return (
    <PressScale to={0.85} duration={400} onPress={onPress} accessibilityLabel={`Save ${name}`} style={styles.heart}>
      <Animated.View style={a}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d={HEART_D}
            fill={liked ? colors.rose : 'rgba(10,10,12,0.25)'}
            stroke={liked ? colors.rose : '#fff'}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
      {liked ? <Burst /> : null}
    </PressScale>
  );
}

/** `.rcard` with `railfx`: scales/fades by its position in the rail viewport. */
function RetreatCard({r, i, sx, vw, liked, onLike, onOpen}) {
  useRenderCount('RetreatCard');
  const fx = useAnimatedStyle(() => {
    const left = 20 + i * (RCARD_W + RCARD_GAP) - sx.value;
    const p = (vw - left) / (vw + RCARD_W);
    const stops = (a, b) => [[0, a], [0.4, b], [0.6, b], [1, a]];
    return {
      opacity: kf(p, stops(0.55, 1)),
      transform: [{scale: kf(p, stops(0.92, 1))}],
    };
  }, [vw]);
  return (
    <Animated.View style={[styles.rcard, fx]}>
      <PressScale to={1} onPress={onOpen} accessibilityLabel={`Open ${r.name}`} style={styles.rcardPress}>
        <View style={styles.rimg}>
          <Image source={r.img} style={styles.fill} resizeMode="cover" />
          {r.tag ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{r.tag}</Text>
            </View>
          ) : null}
          <View style={styles.idots}>
            <View style={[styles.idot, styles.idotOn]} />
            <View style={styles.idot} />
            <View style={styles.idot} />
          </View>
        </View>
        <View style={styles.rrow}>
          <Text style={styles.rname}>{r.name}</Text>
          {r.rate ? (
            <View style={styles.rate}>
              <StarIcon />
              <Text style={styles.rateText}>{r.rate}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rloc}>{r.loc}</Text>
        <Text style={styles.price}>
          {r.price} <Text style={styles.perNight}>/night</Text>
        </Text>
      </PressScale>
      <Heart liked={liked} name={r.name} onPress={onLike} />
    </Animated.View>
  );
}

function Retreats({retreats, total, city, onClear, liked, onLike, onOpen}) {
  const list = !retreats ? [] : city ? retreats.filter(r => r.loc.includes(city)) : retreats;
  const {width: vw} = useWindowDimensions();
  const sx = useSharedValue(0);
  const max = useSharedValue(1);
  const onScroll = useAnimatedScrollHandler(e => {
    sx.value = e.contentOffset.x;
    max.value = Math.max(1, e.contentSize.width - e.layoutMeasurement.width);
  });
  // `.thumb` follows the rail's scroll progress (scroll-timeline --rt).
  const thumb = useAnimatedStyle(() => ({
    transform: [{translateX: 36 * Math.min(1, Math.max(0, sx.value / max.value))}],
  }));
  return (
    <View style={styles.rtWrap}>
      <Reveal style={styles.secHead}>
        <Text style={styles.h2}>Curated Retreats</Text>
        <Text style={styles.sub}>Handpicked boutique stays · Swipe to explore</Text>
      </Reveal>
      {retreats && list.length === 0 ? (
        <View style={styles.none}>
          <Text style={styles.noneTitle}>{city ? `Stays in ${city} are coming soon` : 'New stays are coming soon'}</Text>
          <Text style={styles.noneSub}>
            {city ? 'Explore our other destinations meanwhile.' : 'We are adding new retreats. Check back shortly.'}
          </Text>
          {city ? (
            <Pressable onPress={onClear} style={styles.noneBtn}>
              <Text style={styles.noneBtnText}>Show all stays →</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onContentSizeChange={w => (max.value = Math.max(1, w - vw))}
        scrollEventThrottle={16}
        snapToInterval={RCARD_W + RCARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={[styles.rail, {gap: RCARD_GAP}]}>
        {!retreats ? [0, 1].map(i => <Skeleton key={i} style={styles.rcardSk} />) : null}
        {list.map((r, i) => (
          <RetreatCard
            key={r.id}
            r={r}
            i={i}
            sx={sx}
            vw={vw}
            liked={!!liked[r.id]}
            onLike={() => onLike(r.id)}
            onOpen={() => onOpen(r.id)}
          />
        ))}
      </Animated.ScrollView>
      <View style={styles.trackRow}>
        <View style={styles.track}>
          <Animated.View style={[styles.thumb, thumb]} />
        </View>
        <Text style={styles.trackText}>{retreats ? `Showing ${list.length} of ${Math.max(total, list.length)} destinations` : ' '}</Text>
      </View>
    </View>
  );
}

/** `@keyframes spinstar` on the review rating star. */
function SpinStar() {
  const p = useLoop(5000);
  const a = useAnimatedStyle(() => {
    const stops = (a0, b) => [[0, a0], [0.8, a0], [0.88, b], [1, a0]];
    return {
      transform: [
        {rotate: `${kf(p.value, stops(0, 72), E.easeInOut)}deg`},
        {scale: kf(p.value, stops(1, 1.25), E.easeInOut)},
      ],
    };
  });
  return (
    <Animated.View style={a}>
      <StarIcon size={14} />
    </Animated.View>
  );
}

function Review({g}) {
  useRenderCount('Review');
  return (
    <View style={styles.review}>
      <Image source={g.img} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <ReviewShade />
      </Svg>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{g.place}</Text>
      </View>
      <View style={styles.star5}>
        <SpinStar />
        <Text style={styles.star5Text}>{g.rate}</Text>
      </View>
      <View style={styles.qpanel}>
        <Text style={styles.quote}>“{g.quote}”</Text>
        {g.photos ? (
          <View style={styles.photos}>
            <CameraIcon />
            <Text style={styles.photosText}>{g.photos}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.reviewFoot}>
        <View style={styles.who}>
          <View style={styles.ini}>
            <Text style={styles.iniText}>{g.ini}</Text>
          </View>
          <Text style={styles.whoName}>{g.name}</Text>
        </View>
        <Text style={styles.date}>{g.date}</Text>
      </View>
    </View>
  );
}

// linear-gradient(180deg, .35 → 0 at 25% → 0 at 50% → .95 at 85%)
function ReviewShade() {
  const c = 'rgb(10,10,12)';
  return (
    <>
      <Defs>
        <SvgGradient id="rvshade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c} stopOpacity={0.35} />
          <Stop offset="0.25" stopColor={c} stopOpacity={0} />
          <Stop offset="0.5" stopColor={c} stopOpacity={0} />
          <Stop offset="0.85" stopColor={c} stopOpacity={0.95} />
        </SvgGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#rvshade)" />
    </>
  );
}

const CONCIERGE_TEL = 'tel:+919063448275';

function Concierge({c}) {
  return (
    <Reveal style={styles.concWrap}>
      <PressScale
        to={0.97}
        duration={400}
        onPress={() => Linking.openURL(CONCIERGE_TEL).catch(() => {})}
        accessibilityRole="button"
        accessibilityLabel="Call the concierge">
        <LinearGradient colors={[colors.cardTop, colors.cardBottom]} {...CONC_DIR} style={styles.conc}>
          <View style={styles.hs}>
            <HeadsetIcon />
            <Ripple duration={2600} color={colors.goldA(0.45)} />
            <Ripple duration={2600} delay={1300} color={colors.goldA(0.45)} />
          </View>
          <View style={styles.concText}>
            <Text style={styles.concTitle}>{c.title}</Text>
            {c.subtitle ? <Text style={styles.concSub}>{c.subtitle}</Text> : null}
          </View>
        </LinearGradient>
      </PressScale>
    </Reveal>
  );
}

/**
 * "See it before you stay". Holds the reel counter itself so a reel change
 * re-renders only this section, not the whole listing.
 */
const ReelsSection = memo(function ReelsSection({reels, onOpenStay}) {
  const [reelPos, setReelPos] = useState(`1 / ${reels.length}`);
  return (
    <ViewportGate style={styles.section}>
      <Reveal style={[styles.secHead, styles.secHeadRow, styles.mb16]}>
        <View style={styles.headCol}>
          <Text style={styles.h2}>See it before you stay</Text>
          <Text style={styles.sub}>Short video tours · tap a side to skip</Text>
        </View>
        <Tag>{reelPos}</Tag>
      </Reveal>
      <Reveal>
        <Reels reels={reels} onPos={setReelPos} onBook={reel => onOpenStay(reel.stayId)} />
      </Reveal>
    </ViewportGate>
  );
});

/**
 * Mounts the sections below the fold one per frame after the first paint, so
 * opening Stays (or switching back from My bookings) paints the top first.
 */
const DEFERRED = 4;
function useStage() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= DEFERRED) {
      return;
    }
    const id = requestAnimationFrame(() => setStage(stage + 1));
    return () => cancelAnimationFrame(id);
  }, [stage]);
  return stage;
}

export default memo(function Explore({data, error, onRetry, onSearchTop, onOpenStay, search, patch, openSearch}) {
  const stage = useStage();
  const {width: vw} = useWindowDimensions();
  // Scroll x of the Offers / Reviews rails, so each card loops only while in view.
  const offerX = useSharedValue(0);
  const reviewX = useSharedValue(0);
  const onOfferScroll = useAnimatedScrollHandler(e => {
    offerX.value = e.contentOffset.x;
  });
  const onReviewScroll = useAnimatedScrollHandler(e => {
    reviewX.value = e.contentOffset.x;
  });
  const [liked, setLiked] = useState({});
  const [claimed, setClaimed] = useState({});
  const d = data;
  // Server's liked state until the guest taps; a failed like flips back.
  const likedMap = useMemo(() => {
    const m = {};
    (d?.retreats || []).forEach(r => (m[r.id] = r.liked));
    return {...m, ...liked};
  }, [d, liked]);
  const onLike = id => {
    const next = !likedMap[id];
    setLiked(s => ({...s, [id]: next}));
    const r = d?.retreats?.find(x => x.id === id);
    likeProperty(r?.propertyId || id, next).catch(() => setLiked(s => ({...s, [id]: !next})));
  };
  // Claim keeps the code for Review Booking's coupon field.
  const onClaim = id => {
    setClaimed(s => ({...s, [id]: true}));
    const o = d?.offers?.find(x => x.id === id);
    if (o?.code) {
      AsyncStorage.setItem('ss:coupon', o.code).catch(() => {});
    }
  };
  useRenderCount('Explore');
  useFirstFrame('Explore');

  return (
    <>
      <View style={styles.searchSlot} onLayout={e => onSearchTop(e.nativeEvent.layout.y)} />

      <Chips cities={d?.cities || []} search={search} patch={patch} openSearch={openSearch} />

      {error && !d ? (
        <ErrorCard message={error.message} onRetry={onRetry} style={styles.errTop} />
      ) : (
        <Retreats
          retreats={d?.retreats}
          total={d?.total || 0}
          city={search.pillCity}
          onClear={() => patch({pillCity: ''})}
          liked={likedMap} onLike={onLike} onOpen={onOpenStay} />
      )}

      {stage > 0 && d?.reels.length ? <ReelsSection reels={d.reels} onOpenStay={onOpenStay} /> : null}

      {stage > 1 && d?.offers.length ? (
        <ViewportGate style={styles.section}>
          <Reveal style={[styles.secHead, styles.secHeadRow]}>
            <View style={styles.headCol}>
              <View style={styles.titleRow}>
                <Text style={styles.h2}>Exclusive Offers & Perks</Text>
                <Tag>{`${d.offers.length} ACTIVE`}</Tag>
              </View>
              <Text style={styles.sub}>Curated member rates & bespoke privileges</Text>
            </View>
          </Reveal>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={onOfferScroll}
            scrollEventThrottle={16}
            snapToInterval={COUPON_W + 12}
            decelerationRate="fast"
            contentContainerStyle={[styles.rail, styles.gap12]}>
            <Offers
              offers={d.offers}
              claimed={claimed}
              onClaim={onClaim}
              sx={offerX}
              viewportW={vw}
            />
          </Animated.ScrollView>
        </ViewportGate>
      ) : null}

      {stage > 2 && d?.reviews.length ? (
        <ViewportGate style={styles.section}>
          <Reveal style={styles.secHead}>
            <Text style={styles.h2}>Guest Experiences</Text>
            <Text style={styles.sub}>Unfiltered impressions from verified members</Text>
          </Reveal>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={onReviewScroll}
            scrollEventThrottle={16}
            snapToInterval={REVIEW_W + 12}
            decelerationRate="fast"
            contentContainerStyle={[styles.rail, styles.gap12]}>
            {d.reviews.map((g, i) => (
              <RailGate key={g.id} sx={reviewX} left={20 + i * (REVIEW_W + 12)} width={REVIEW_W} viewportW={vw}>
                <Review g={g} />
              </RailGate>
            ))}
          </Animated.ScrollView>
        </ViewportGate>
      ) : null}

      {stage > 3 && d?.concierge?.title ? (
        <ViewportGate>
          <Concierge c={d.concierge} />
        </ViewportGate>
      ) : null}
    </>
  );
});

const CONC_DIR = cssAngle(160);

const glass = {backgroundColor: 'rgba(10,10,12,0.55)', borderWidth: 1, borderColor: colors.whiteA(0.18)};

const styles = StyleSheet.create({
  fill: {width: '100%', height: '100%'},
  // search
  searchSlot: {height: SEARCH_H},
  sticky: {
    zIndex: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowRadius: 15,
    shadowOffset: {width: 0, height: 10},
  },
  search: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 33,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.whiteA(0.1),
  },
  sic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldA(0.1),
  },
  searchText: {flex: 1, gap: 2},
  roll: {height: 20, overflow: 'hidden'},
  rollText: {height: 20, lineHeight: 20, fontFamily: fonts.semibold, fontSize: 15, color: '#fff'},
  searchSub: {fontFamily: fonts.regular, fontSize: 12, color: colors.muted},
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.whiteA(0.1),
  },
  // chips
  chips: {gap: 8, paddingTop: 6, paddingHorizontal: 20},
  chip: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {fontFamily: fonts.semibold, fontSize: 13},
  calp: {width: 42, paddingHorizontal: 0, justifyContent: 'center', borderColor: colors.goldA(0.35), backgroundColor: colors.goldA(0.06)},
  // sections
  rtWrap: {paddingTop: 28},
  section: {paddingTop: 34},
  secHead: {gap: 4, paddingHorizontal: 20, marginBottom: 14},
  secHeadRow: {flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 0},
  headCol: {gap: 4, flexShrink: 1},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  h2: {fontFamily: fonts.bold, fontSize: 19, letterSpacing: ls(-0.01, 19), color: colors.cream},
  sub: {fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted},
  rail: {paddingHorizontal: 20},
  gap12: {gap: 12},
  mb16: {marginBottom: 16},
  // retreats
  rcard: {width: RCARD_W},
  rcardSk: {width: RCARD_W, height: 300},
  errTop: {marginTop: 18},
  rcardPress: {gap: 6},
  rimg: {height: 212, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.card},
  pill: {
    position: 'absolute',
    top: 14,
    left: 14,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    zIndex: 2,
    ...glass,
  },
  pillText: {fontFamily: fonts.semibold, fontSize: 11.5, color: '#fff'},
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  idots: {position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5},
  idot: {width: 5, height: 5, borderRadius: 3, backgroundColor: colors.whiteA(0.5)},
  idotOn: {width: 16, backgroundColor: '#fff'},
  rrow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8},
  rname: {fontFamily: fonts.bold, fontSize: 16, color: '#fff'},
  rate: {flexDirection: 'row', alignItems: 'center', gap: 4},
  rateText: {fontFamily: fonts.semibold, fontSize: 13, color: colors.cream},
  rloc: {fontFamily: fonts.regular, fontSize: 13, color: colors.muted},
  price: {fontFamily: fonts.extrabold, fontSize: 17, color: '#fff'},
  perNight: {fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted},
  none: {
    marginHorizontal: 20,
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.whiteA(0.07),
    alignItems: 'center',
  },
  noneTitle: {fontFamily: fonts.bold, fontSize: 15, color: colors.cream, textAlign: 'center'},
  noneSub: {fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 6, textAlign: 'center'},
  noneBtn: {marginTop: 12, minHeight: 44, justifyContent: 'center'},
  noneBtnText: {fontFamily: fonts.bold, fontSize: 13, color: colors.gold},
  trackRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 22, paddingHorizontal: 20},
  track: {width: 56, height: 4, borderRadius: 2, backgroundColor: colors.whiteA(0.14), overflow: 'hidden'},
  thumb: {position: 'absolute', left: 0, top: 0, width: 20, height: 4, borderRadius: 2, backgroundColor: colors.gold},
  trackText: {fontFamily: fonts.regular, fontSize: 12, color: colors.muted},
  // reviews
  review: {
    width: REVIEW_W,
    height: 344,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  star5: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    ...glass,
  },
  star5Text: {fontFamily: fonts.bold, fontSize: 12, color: '#fff'},
  qpanel: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 62,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(14,14,16,0.68)',
    borderWidth: 1,
    borderColor: colors.whiteA(0.1),
  },
  quote: {fontFamily: fonts.medium, fontSize: 13, lineHeight: 19.5, color: '#fff'},
  photos: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8},
  photosText: {fontFamily: fonts.regular, fontSize: 11, color: colors.muted},
  reviewFoot: {
    position: 'absolute',
    left: 14,
    right: 16,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  who: {flexDirection: 'row', alignItems: 'center', gap: 10},
  ini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.goldA(0.4),
  },
  iniText: {fontFamily: fonts.bold, fontSize: 11, color: colors.gold},
  whoName: {fontFamily: fonts.semibold, fontSize: 13.5, color: '#fff'},
  date: {fontFamily: fonts.regular, fontSize: 11, color: colors.muted},
  // concierge
  concWrap: {paddingTop: 30, paddingHorizontal: 20, paddingBottom: 40},
  conc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  hs: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldA(0.1),
  },
  concText: {flex: 1, gap: 4},
  concTitle: {fontFamily: fonts.bold, fontSize: 15, color: '#fff'},
  concSub: {fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted},
});
