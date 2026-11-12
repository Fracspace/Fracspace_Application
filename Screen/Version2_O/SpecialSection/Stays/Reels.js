// "See it before you stay": the stacked video-tour deck (`.deck`, `.rc`,
// `.rc-ui` in Stays.dc.html).
import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import {useIsFocused} from '@react-navigation/native';
import {colors, fonts, ls} from '../theme';
import {E, PressScale, enterUp, useGateOn, useLinger, useReducedMotion, useToggle} from '../anim';
import {Ripple} from './bits';
import {MuteIcon, PlayPauseIcon} from './icons';
import {useRenderCount} from '../perf';

const CARD_W = 300;
const CARD_H = 430;
// .rc.p0 / .p1 / .p2; `dim` stands in for filter: brightness(.5) / (.3)
const POS = [
  {x: 0, s: 1, r: 0, dim: 0},
  {x: 30, s: 0.93, r: 3, dim: 0.5},
  {x: 54, s: 0.86, r: 6, dim: 0.7},
];
// The stack's full width: the back card's offset plus its scaled width
// (cards scale from their left edge). The deck is centred at this width so
// the gaps either side match on every screen; left-anchored, wider phones
// (most iPhones) put all the spare room on the right.
const DECK_W = Math.ceil(Math.max(...POS.map(p => p.x + CARD_W * p.s)));
const ZOOM_MS = 9000;
// A video that isn't ready by then plays as its thumbnail (with the zoom).
const VIDEO_WAIT_MS = 5000;

/** One card of the deck; transitions between stack positions with the spring. */
const DeckCard = memo(function DeckCard({img, pos, hold, video, play, muted, onReady, onFail}) {
  useRenderCount('DeckCard');
  const reduced = useReducedMotion();
  const tx = useSharedValue(POS[pos].x);
  const sc = useSharedValue(POS[pos].s);
  const rot = useSharedValue(POS[pos].r);
  const dim = useSharedValue(POS[pos].dim);
  const zoom = useSharedValue(0); // `zoom 9s ease-out both` progress, p0 only

  useEffect(() => {
    const to = POS[pos];
    const move = v => (reduced ? v : withTiming(v, {duration: 750, easing: E.spring}));
    tx.value = move(to.x);
    sc.value = move(to.s);
    rot.value = move(to.r);
    dim.value = reduced ? to.dim : withTiming(to.dim, {duration: 600, easing: E.ease});
  }, [pos, reduced, tx, sc, rot, dim]);

  useEffect(() => {
    cancelAnimation(zoom);
    if (pos !== 0) {
      zoom.value = 0;
    } else if (!hold && !reduced) {
      // `.hold` pauses the zoom; resuming carries on from where it stopped.
      zoom.value = withTiming(1, {duration: (1 - zoom.value) * ZOOM_MS, easing: E.linear});
    }
  }, [pos, hold, reduced, zoom]);

  const card = useAnimatedStyle(() => ({
    transform: [{translateX: tx.value}, {scale: sc.value}, {rotate: `${rot.value}deg`}],
  }));
  const pic = useAnimatedStyle(() => ({
    transform: [{scale: pos === 0 ? 1.02 + 0.18 * E.easeOut(zoom.value) : 1}],
  }), [pos]);
  const shade = useAnimatedStyle(() => ({opacity: dim.value}));

  return (
    <Animated.View style={[styles.rc, {zIndex: 3 - pos}, card]}>
      <View style={styles.rcClip}>
        <Animated.Image source={img} style={[styles.fill, pic]} resizeMode="cover" />
        {pos === 0 && video ? (
          <ReelVideo uri={video} play={play} muted={muted} onReady={onReady} onFail={onFail} />
        ) : null}
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
          locations={[0, 0.26, 0.55, 1]}
        />
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, shade]} />
      </View>
    </Animated.View>
  );
});

/** The front card's video; stays invisible (thumbnail shows) until it can play. */
function ReelVideo({uri, play, muted, onReady, onFail}) {
  const [shown, setShown] = useState(false);
  return (
    <Video
      source={{uri}}
      style={[StyleSheet.absoluteFill, !shown && styles.hidden]}
      resizeMode="cover"
      paused={!play}
      muted={muted}
      repeat
      disableFocus
      playInBackground={false}
      // onLoad, not onReadyForDisplay: Android doesn't draw a transparent
      // player, so its first frame never arrives while it is hidden.
      onLoad={() => {
        setShown(true);
        onReady();
      }}
      onError={onFail}
    />
  );
}

const lin = duration => ({duration, easing: E.linear});

/**
 * `.seg`: progress bar for one reel (width transition .12s linear). The
 * current reel's bar follows `prog`, which Reels animates on the UI thread.
 */
const Seg = memo(function Seg({state, prog}) {
  const cur = state === 'cur';
  const v = useSharedValue(state === 'done' ? 1 : 0);
  useEffect(() => {
    if (!cur) {
      v.value = withTiming(state === 'done' ? 1 : 0, lin(120));
      return;
    }
    // Leaving the current reel: carry on from where its bar got to.
    return () => {
      v.value = prog.value;
    };
  }, [cur, state, prog, v]);
  const a = useAnimatedStyle(() => ({transform: [{scaleX: cur ? prog.value : v.value}]}), [cur]);
  return (
    <View style={styles.seg}>
      <Animated.View style={[styles.segFill, a]} />
    </View>
  );
});

/** `.bigplay`: shown while paused (opacity .3s, transform .45s spring). */
function BigPlay({playing, onPress}) {
  const op = useToggle(!playing, {duration: 300, easing: E.ease});
  const sc = useToggle(!playing, {duration: 450, easing: E.spring});
  const shown = useLinger(!playing, 300); // its ripple runs only while it can be seen
  const a = useAnimatedStyle(() => ({opacity: op.value, transform: [{scale: 0.6 + 0.4 * sc.value}]}));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause video' : 'Play video'}
      style={styles.bigplayHit}>
      <Animated.View style={[styles.bigplay, a]}>
        <PlayPauseIcon playing={playing} />
        <Ripple duration={2200} color={colors.whiteA(0.6)} inset={1} active={shown} />
      </Animated.View>
    </Pressable>
  );
}

/** The deck. Reports the current position ("1 / 3") via onPos. */
export default function Reels({reels, onBook, onPos}) {
  const focused = useIsFocused();
  const gateOn = useGateOn();
  const [reel, setReel] = useState(0);
  // The front video: 'wait' (thumbnail + zoom), 'ready' (playing) or 'thumb' (slow / failed).
  const [vid, setVid] = useState('wait');
  const [sec, setSec] = useState(0); // whole seconds played, for the time label
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [flipN, setFlipN] = useState(0);
  const n = reels.length;
  useRenderCount('Reels');

  const goReel = useCallback(i => {
    setReel(i);
    setVid('wait');
    setSec(0);
    setFlipN(f => f + 1);
  }, []);
  const togglePlay = useCallback(() => setPlaying(p => !p), []);

  // The bar runs on the UI thread; JS only wakes once a second for the time
  // label and at the end of the reel to advance (the design ticks every 100ms).
  const prog = useSharedValue(0);
  const played = useRef({reel: 0, ms: 0});
  const cur = reels[reel] || reels[0];
  const waiting = !!cur.video && vid === 'wait';
  const run = playing && focused && !waiting;
  useEffect(() => {
    if (!waiting) {
      return;
    }
    const id = setTimeout(() => setVid(v => (v === 'wait' ? 'thumb' : v)), VIDEO_WAIT_MS);
    return () => clearTimeout(id);
  }, [waiting, reel]);
  const onReady = useCallback(() => setVid(v => (v === 'wait' ? 'ready' : v)), []);
  const onFail = useCallback(() => setVid('thumb'), []);
  useEffect(() => {
    const p = played.current;
    const total = cur.secs * 1000;
    if (p.reel !== reel) {
      prog.value = p.reel > reel ? 1 : 0; // this bar was full if we went back
      p.reel = reel;
      p.ms = 0;
    }
    const to = withTiming(p.ms / total, lin(120));
    if (!run) {
      prog.value = to;
      return;
    }
    prog.value = withSequence(to, withTiming(1, lin(total - p.ms)));
    const start = Date.now() - p.ms;
    const next = ms => Math.min(total, (Math.floor(ms / 1000) + 1) * 1000) - ms;
    let id;
    const tick = () => {
      const ms = Date.now() - start;
      if (ms >= total) {
        goReel((reel + 1) % n);
        return;
      }
      setSec(Math.floor(ms / 1000));
      id = setTimeout(tick, next(ms));
    };
    id = setTimeout(tick, next(p.ms));
    return () => {
      clearTimeout(id);
      p.ms = Math.min(total, Date.now() - start);
    };
  }, [reel, run, n, prog, goReel, cur.secs]);
  useEffect(() => {
    onPos?.(`${reel + 1} / ${n}`);
  }, [reel, n, onPos]);

  const time = `0:${String(sec).padStart(2, '0')} / ${cur.dur}`;
  // The property this reel tours; its first letter fills the avatar.
  const name = (cur.stayName || '').trim();
  const cap = i => enterUp(i, {step: 80, duration: 700, dy: 16});

  return (
    <View style={styles.wrap}>
      <View style={styles.deck}>
        {/* The deck shows three cards (POS); the rest mount when they move up. */}
        {reels.map((v, i) => (i - reel + n) % n < POS.length && (
          <DeckCard
            key={v.id}
            img={v.img}
            pos={(i - reel + n) % n}
            hold={!playing}
            video={i === reel && vid !== 'thumb' ? v.video : null}
            play={playing && focused && gateOn}
            muted={muted}
            onReady={onReady}
            onFail={onFail}
          />
        ))}
        <View style={styles.ui}>
          <View style={styles.segs}>
            {reels.map((v, i) => (
              <Seg key={v.id} state={i < reel ? 'done' : i === reel ? 'cur' : 'todo'} prog={prog} />
            ))}
          </View>
          <View style={styles.head}>
            {name ? (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{name[0].toUpperCase()}</Text>
              </View>
            ) : null}
            <View style={styles.headText}>
              {name ? (
                <Text style={styles.brand} numberOfLines={1}>
                  {name}
                </Text>
              ) : null}
              <Text style={styles.time}>{time}</Text>
            </View>
            <PressScale
              to={0.85}
              duration={350}
              onPress={() => setMuted(m => !m)}
              accessibilityLabel={muted ? 'Unmute' : 'Mute'}
              style={styles.rbtn}>
              <MuteIcon muted={muted} />
            </PressScale>
          </View>
          <Pressable
            style={[styles.tapz, styles.left0]}
            onPress={() => goReel((reel + n - 1) % n)}
            accessibilityLabel="Previous video"
          />
          <Pressable
            style={[styles.tapz, styles.right0]}
            onPress={() => goReel((reel + 1) % n)}
            accessibilityLabel="Next video"
          />
          <BigPlay playing={playing} onPress={togglePlay} />
          <View key={flipN} style={styles.cap} pointerEvents="box-none">
            <Animated.Text entering={cap(0)} style={styles.capLoc}>
              {cur.loc.toUpperCase()}
            </Animated.Text>
            <Animated.Text entering={cap(1)} style={styles.capTitle}>
              {cur.title}
            </Animated.Text>
            <Animated.View entering={cap(2)}>
              <PressScale to={0.92} duration={400} onPress={() => onBook(cur)} style={styles.watch}>
                <Text style={styles.watchText}>Book this stay</Text>
                <Text style={styles.watchText}>→</Text>
              </PressScale>
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {paddingHorizontal: 20},
  deck: {height: 440, width: DECK_W, alignSelf: 'center'},
  fill: {width: '100%', height: '100%'},
  hidden: {opacity: 0},
  rc: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CARD_W,
    height: CARD_H,
    borderRadius: 30,
    transformOrigin: 'left center',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 25,
    shadowOffset: {width: 0, height: 24},
    backgroundColor: colors.card,
  },
  rcClip: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.whiteA(0.1),
    backgroundColor: colors.card,
  },
  dim: {backgroundColor: '#000'},
  ui: {position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H, zIndex: 4, borderRadius: 30, overflow: 'hidden'},
  segs: {position: 'absolute', top: 12, left: 14, right: 14, flexDirection: 'row', gap: 5, zIndex: 3},
  seg: {flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.whiteA(0.3), overflow: 'hidden'},
  segFill: {height: '100%', width: '100%', backgroundColor: '#fff', transformOrigin: 'left center'},
  head: {position: 'absolute', top: 26, left: 14, right: 10, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 3},
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldA(0.16),
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  avatarText: {fontFamily: fonts.serif, fontSize: 18, color: colors.gold},
  headText: {flex: 1},
  brand: {fontFamily: fonts.bold, fontSize: 13, color: '#fff'},
  time: {fontFamily: fonts.regular, fontSize: 11, color: '#E6E0D6'},
  rbtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: colors.whiteA(0.25),
  },
  left0: {left: 0},
  right0: {right: 0},
  tapz: {position: 'absolute', top: 70, bottom: 120, width: '50%', zIndex: 2},
  bigplayHit: {position: 'absolute', left: CARD_W / 2 - 32, top: CARD_H / 2 - 32, width: 64, height: 64, zIndex: 3},
  bigplay: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,12,0.45)',
    borderWidth: 1,
    borderColor: colors.whiteA(0.4),
  },
  cap: {position: 'absolute', left: 18, right: 18, bottom: 18, alignItems: 'flex-start', gap: 8, zIndex: 3},
  capLoc: {fontFamily: fonts.extrabold, fontSize: 10.5, letterSpacing: ls(0.14, 10.5), color: colors.gold},
  capTitle: {fontFamily: fonts.serif, fontSize: 34, lineHeight: 34, color: '#fff'},
  watch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.gold,
  },
  watchText: {fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink},
});
