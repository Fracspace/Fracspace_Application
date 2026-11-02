// Stays listing (Stays.dc.html): "Explore stays" / "My bookings" tabs.
import React, {useCallback, useRef, useState} from 'react';
import {StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, fonts, ls} from '../theme';
import {E, LoopGate, PressScale, RevealScope, enterUp, kf, useLoop, useToggle} from '../anim';
import {BackIcon, Grain} from '../HubBits';
import {navBottom} from '../HubNavBar';
import {markTap, useFirstFrame, useJsFps, useRenderCount} from '../perf';
import {SearchIcon, TicketIcon} from './icons';
import Explore, {SearchBar} from './Explore';
import Bookings from './Bookings';
import SearchSheet, {initialSearch} from './SearchSheet';
import {useStaysHome, ymd} from '../api/stays';
import {ErrorCard} from '../api/ui';

/** `.stg` header children: `rise .8s --out`, delays .05s / .15s. */
const rise = i => enterUp(i, {step: 100, delay: 50, duration: 800, dy: 14});

/** `.mbadge` with the `mbp` pulse. */
function Badge({children}) {
  const p = useLoop(2000);
  const a = useAnimatedStyle(() => ({
    transform: [{scale: kf(p.value, [[0, 1], [0.5, 1.15], [1, 1]], E.easeInOut)}],
  }));
  return (
    <Animated.View style={[styles.mbadge, a]}>
      <Text style={styles.mbadgeText}>{children}</Text>
    </Animated.View>
  );
}

function TabLabel({on, Icon, label, badge, onPress}) {
  const v = useToggle(on, {duration: 300, easing: E.ease});
  const a = useAnimatedStyle(() => ({color: interpolateColor(v.value, [0, 1], [colors.soft, colors.ink])}));
  const color = on ? colors.ink : colors.soft;
  return (
    <PressScale to={1} onPress={onPress} accessibilityRole="tab" accessibilityState={{selected: on}} style={styles.mt}>
      <Icon color={color} />
      <Animated.Text style={[styles.mtText, a]}>{label}</Animated.Text>
      {badge ? <Badge>{badge}</Badge> : null}
    </PressScale>
  );
}

/** `.mtab`: gold pill slides between the two tabs (.55s spring). */
function ViewTabs({view, setView, upcoming}) {
  const [w, setW] = useState(0);
  const v = useToggle(view === 'bookings', {duration: 550, easing: E.spring});
  const pillW = Math.max(0, (w - 2 - 8) / 2); // calc((100% - 8px) / 2) inside the 1px border
  const pill = useAnimatedStyle(() => ({transform: [{translateX: pillW * v.value}]}), [pillW]);
  return (
    <View style={styles.mtabWrap}>
      <View style={styles.mtab} accessibilityRole="tablist" onLayout={e => setW(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.mpill, {width: pillW}, pill]} />
        <TabLabel
          on={view === 'explore'}
          label="Explore stays"
          Icon={SearchIcon}
          onPress={() => setView('explore')}
        />
        <TabLabel
          on={view === 'bookings'}
          label="My bookings"
          badge={upcoming ? String(upcoming) : null}
          Icon={TicketIcon}
          onPress={() => setView('bookings')}
        />
      </View>
    </View>
  );
}

export default function Stays({navigation}) {
  const {height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [view, setView] = useState('explore');
  const home = useStaysHome();
  const paused = home.data && !home.data.enabled;
  const [searchTop, setSearchTop] = useState(0);
  // Applied search choices (the capsules read them). The sheet edits its own
  // copy and hands it back on close, so its taps re-render only the sheet.
  const [search, setSearch] = useState(initialSearch);
  const [sheetStep, setSheetStep] = useState(null); // open at this step, or closed
  const patch = useCallback(p => setSearch(s => ({...s, ...p})), []);
  const closeSheet = useCallback(next => {
    setSearch(next);
    setSheetStep(null);
  }, []);
  useRenderCount('Stays');
  useFirstFrame('Stays');
  useJsFps('Stays', isFocused);

  const contentRef = useRef(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Hub'));
  // The applied search (dates + guests) goes with the stay, through to the
  // hold and Review Booking. Read from a ref so openStay keeps its identity.
  const searchRef = useRef(search);
  searchRef.current = search;
  const openStay = useCallback(
    stayId => {
      markTap('StayDetail');
      const s = searchRef.current;
      const dated = s.applied && s.mode === 'dates' && s.in && s.out && s.out > s.in;
      const trip = dated ? {checkIn: ymd(s.in), checkOut: ymd(s.out), adults: Math.max(1, s.g.a), children: s.g.c} : undefined;
      navigation.navigate('StayDetail', {stayId, trip});
    },
    [navigation],
  );

  return (
    <View style={styles.page}>
      <LoopGate active={isFocused && !sheetStep}>
        <RevealScope scrollY={scrollY} contentRef={contentRef} viewportH={height}>
          <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
            <View ref={contentRef} collapsable={false} style={{paddingBottom: navBottom(insets) + 94}}>
              <View style={[styles.head, {paddingTop: insets.top + 18}]}>
                <Animated.View entering={rise(0)}>
                  <PressScale
                    to={0.88}
                    duration={400}
                    onPress={back}
                    accessibilityRole="button"
                    accessibilityLabel="Back to Special Section"
                    style={styles.gbtn}>
                    <BackIcon />
                  </PressScale>
                </Animated.View>
                <Animated.View entering={rise(1)} style={styles.brand}>
                  <Text style={styles.brandName}>dreamscape</Text>
                  <Text style={styles.brandSub}>BANJARA HILLS</Text>
                </Animated.View>
              </View>

              <ViewTabs view={view} setView={setView} upcoming={home.data?.counts?.upcoming} />

              {paused ? (
                <ErrorCard
                  title="Stays are taking a short break"
                  message={home.data.disabledMessage || 'Please check back soon.'}
                  style={styles.paused}
                />
              ) : view === 'explore' ? (
                <Explore
                  data={home.data}
                  error={home.error}
                  onRetry={home.refresh}
                  onSearchTop={setSearchTop}
                  onOpenStay={openStay}
                  search={search}
                  patch={patch}
                  openSearch={setSheetStep}
                />
              ) : (
                <Bookings counts={home.data?.counts} onExplore={() => setView('explore')} onOpenStay={openStay} />
              )}
            </View>
          </Animated.ScrollView>
        </RevealScope>
        {view === 'explore' && !paused && searchTop > 0 ? (
          <SearchBar
            scrollY={scrollY}
            top={searchTop}
            inset={insets.top}
            style={styles.searchFloat}
            onPress={() => setSheetStep('where')}
          />
        ) : null}
        <Grain />
      </LoopGate>
      {sheetStep ? <SearchSheet init={search} step={sheetStep} onClose={closeSheet} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: colors.ground},
  searchFloat: {position: 'absolute', top: 0, left: 0, right: 0},
  paused: {marginTop: 24},
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  gbtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.whiteA(0.1),
  },
  brand: {alignItems: 'flex-end'},
  brandName: {fontFamily: fonts.serif, fontSize: 30, lineHeight: 30, letterSpacing: ls(0.01, 30), color: '#fff'},
  brandSub: {
    fontFamily: fonts.bold,
    fontSize: 7.5,
    lineHeight: 7.5,
    letterSpacing: ls(0.28, 7.5),
    color: colors.soft,
    marginTop: 2,
  },
  mtabWrap: {paddingTop: 10, paddingHorizontal: 20, paddingBottom: 4},
  mtab: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  mpill: {position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 14, backgroundColor: colors.gold},
  mt: {flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8},
  mtText: {fontFamily: fonts.bold, fontSize: 13},
  mbadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F87171',
  },
  mbadgeText: {fontFamily: fonts.extrabold, fontSize: 10.5, color: '#fff'},
});
