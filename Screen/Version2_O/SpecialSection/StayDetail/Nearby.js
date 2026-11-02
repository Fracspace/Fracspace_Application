// "Nearby Places to Explore": stylised map with route draw, the `drive` car,
// home `ripple2`, `pinhop` pins, the `infoA/B` card and place chips.
import React, {memo, useMemo, useState} from 'react';
import {Image, Linking, StyleSheet, Text, View} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, {Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop} from 'react-native-svg';
import {colors, fonts} from '../theme';
import {E, PressScale, Reveal, kf, useLoop} from '../anim';
import {useColor, useShot, useTo} from './bits';
import {HOME} from './data';
import {h2} from './Suites';
import {useRenderCount} from '../perf';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const PEACH = '#F1A87A';
const MAP_W = 350;
const MAP_H = 320;

const routeD = p => `M${HOME[0]} ${HOME[1]}C${p.c.join(' ')} ${p.x} ${p.y}`;

/** Points at equal arc-length steps along a place's cubic route (for `offset-path`). */
function routeTable(p, n = 48) {
  const [x0, y0] = HOME;
  const [x1, y1, x2, y2] = p.c;
  const at = t => {
    const u = 1 - t;
    return [
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * p.x,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * p.y,
    ];
  };
  const fine = [];
  let len = 0;
  let prev = at(0);
  for (let i = 0; i <= 400; i++) {
    const pt = at(i / 400);
    len += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
    fine.push([len, pt[0], pt[1]]);
    prev = pt;
  }
  const xs = [];
  const ys = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const target = (len * k) / n;
    while (j < fine.length - 1 && fine[j][0] < target) {
      j++;
    }
    xs.push(fine[j][1]);
    ys.push(fine[j][2]);
  }
  return {len, xs, ys};
}

const routesFor = places => Object.fromEntries(places.map(p => [p.id, {d: routeD(p), ...routeTable(p)}]));

/** `.route` / `.route.on`: dash draw 1s --out, opacity .3s, peach glow. */
function Route({r, on}) {
  const draw = useTo(on ? 1 : 0, 1000, E.out);
  const op = useTo(on ? 1 : 0, 300);
  const props = useAnimatedProps(() => ({strokeDashoffset: r.len * (1 - draw.value), opacity: op.value}));
  const glow = useAnimatedProps(() => ({strokeDashoffset: r.len * (1 - draw.value), opacity: 0.3 * op.value}));
  return (
    <>
      <AnimatedPath d={r.d} stroke={PEACH} strokeWidth={9} strokeLinecap="round" strokeDasharray={r.len} animatedProps={glow} />
      <AnimatedPath d={r.d} stroke={PEACH} strokeWidth={3.5} strokeLinecap="round" strokeDasharray={r.len} animatedProps={props} />
    </>
  );
}

/** `.car`: `drive` 2.8s ease-in-out, .9s delay, along the current route. */
function Car({route}) {
  const {xs, ys} = route;
  const p = useLoop(2800, {delay: 900});
  const a = useAnimatedStyle(() => {
    const f = E.easeInOut(p.value) * (xs.length - 1);
    const i = Math.min(xs.length - 2, Math.floor(f));
    const t = f - i;
    return {
      opacity: kf(p.value, [[0, 0], [0.1, 1], [0.85, 1], [1, 0]], E.easeInOut),
      transform: [{translateX: xs[i] + (xs[i + 1] - xs[i]) * t - 8}, {translateY: ys[i] + (ys[i + 1] - ys[i]) * t - 8}],
    };
  }, [xs, ys]);
  return (
    <Animated.View pointerEvents="none" style={[styles.car, a]}>
      <View style={styles.carCore} />
    </Animated.View>
  );
}

/** `.home i`: ripple2 2.4s ease-out (scale .4→1.8, fade). */
function HomeRing({delay}) {
  const p = useLoop(2400, {delay});
  const a = useAnimatedStyle(() => {
    const t = E.easeOut(p.value);
    return {opacity: 1 - t, transform: [{scale: 0.4 + 1.4 * t}]};
  });
  return <Animated.View style={[styles.hring, a]} />;
}

const HOP_S = [[0, 1], [0.4, 1.3], [1, 1.3]];
const HOP_Y = [[0, 0], [0.4, -8], [1, 0]];

/** `.mpin`: colour .3s; on → scale 1.3 with `pinhop` (.7s spring) and its label. */
function Pin({p, on, onPick}) {
  const c = useTo(on ? 1 : 0, 300);
  const s = useTo(on ? 1.3 : 1, 500, E.spring);
  const hop = useShot(on, 700);
  const lbl = useTo(on ? 1 : 0, 300);
  const lblY = useTo(on ? 0 : 6, 450, E.spring);
  const pin = useAnimatedStyle(() => ({
    transform: on
      ? [{translateY: kf(hop.value, HOP_Y, E.spring)}, {scale: kf(hop.value, HOP_S, E.spring)}]
      : [{translateY: 0}, {scale: s.value}],
  }), [on]);
  const fill = useAnimatedProps(() => ({fill: interpolateColor(c.value, [0, 1], ['#6F6A63', PEACH])}));
  const label = useAnimatedStyle(() => ({opacity: lbl.value, transform: [{translateY: lblY.value}]}));
  return (
    <PressScale
      to={1}
      onPress={onPick}
      accessibilityRole="button"
      accessibilityState={{selected: on}}
      accessibilityLabel={`${p.name}, ${p.dist}`}
      style={[styles.mpin, {left: p.x - 22, top: p.y - 46}, on && styles.mpinOn]}>
      <View pointerEvents="none" style={styles.plabelRow}>
        <Animated.View style={[styles.plabel, label]}>
          <Text style={styles.plabelText} numberOfLines={1}>
            {p.name}
          </Text>
        </Animated.View>
      </View>
      <Animated.View style={[styles.pinSvg, pin]}>
        <Svg width={30} height={38} viewBox="0 0 30 38">
          <AnimatedPath d="M15 37s-12-11-12-21a12 12 0 0 1 24 0c0 10-12 21-12 21z" animatedProps={fill} />
          <Circle cx="15" cy="15" r="4.5" fill={colors.ground} />
        </Svg>
      </Animated.View>
    </PressScale>
  );
}

/** `.info` card, re-entering with infoA/infoB (.55s spring) on every pick. */
function Info({place, n, city}) {
  const p = useShot(n + 1, 550);
  const a = useAnimatedStyle(() => {
    const t = E.spring(p.value);
    return {opacity: Math.min(1, t), transform: [{translateY: 14 * (1 - t)}, {scale: 0.97 + 0.03 * t}]};
  });
  const directions = () =>
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        place.lat != null ? `${place.lat},${place.lng}` : `${place.name}, ${city}`,
      )}`,
    ).catch(() => {});
  return (
    <Animated.View style={[styles.info, a]}>
      <Image source={place.img} resizeMode="cover" style={styles.infoImg} />
      <View style={styles.infoCopy}>
        <Text style={styles.infoName}>{place.name}</Text>
        <View style={styles.infoDist}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PEACH} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2.5M19 16v2.5" />
            <Circle cx="8" cy="13" r="1" />
            <Circle cx="16" cy="13" r="1" />
          </Svg>
          <Text style={styles.infoDistText}>{place.dist}</Text>
        </View>
      </View>
      <PressScale to={0.88} duration={400} onPress={directions} accessibilityRole="link" accessibilityLabel={`Directions to ${place.name}`} style={styles.dir}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 12 20 4l-8 16-2-6z" />
        </Svg>
      </PressScale>
    </Animated.View>
  );
}

/** `.pchip`: background/colour .3s, press .94. */
function Chip({p, on, onPick}) {
  const bg = useTo(on ? 1 : 0, 300);
  const a = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(bg.value, [0, 1], [colors.card, colors.gold]),
    borderColor: interpolateColor(bg.value, [0, 1], ['rgba(255,255,255,0.08)', 'rgba(241,221,186,0)']),
  }));
  const text = useColor(on, '#E6E0D6', colors.ink);
  return (
    <PressScale to={0.94} duration={400} onPress={onPick} accessibilityRole="button" accessibilityState={{selected: on}} style={styles.chipCell}>
      <Animated.View style={[styles.pchip, a]}>
        <Animated.Text style={[styles.chipName, text]}>{p.name}</Animated.Text>
        <Animated.Text style={[styles.chipShort, text]}>{p.short}</Animated.Text>
      </Animated.View>
    </PressScale>
  );
}

function MapBackdrop({w}) {
  return (
    <Svg width={w} height={MAP_H} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="mapbg" cx={0.6 * w} cy={MAP_H / 2} r={0.7 * Math.hypot(0.6 * w, MAP_H / 2)} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#18161C" />
          <Stop offset="1" stopColor="#0F0E12" />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={MAP_H} fill="url(#mapbg)" />
    </Svg>
  );
}

function Nearby({stay}) {
  useRenderCount('Nearby');
  const places = stay.places;
  const routes = useMemo(() => routesFor(places), [places]);
  const [place, setPlace] = useState(places[0].id);
  const [n, setN] = useState(0);
  const [w, setW] = useState(MAP_W);
  const pick = id => () => {
    if (id !== place) {
      setPlace(id);
      setN(x => x + 1);
    }
  };
  const cur = useMemo(() => places.find(p => p.id === place) || places[0], [places, place]);
  const ox = (w - MAP_W) / 2;
  const from = stay.address.split(',')[0];

  return (
    <View style={styles.sec}>
      <Reveal style={styles.head}>
        <Text style={h2}>Nearby Places to Explore</Text>
        <Text style={styles.sub}>From {from}</Text>
      </Reveal>
      <Reveal style={styles.map}>
        <View style={StyleSheet.absoluteFill} onLayout={e => setW(e.nativeEvent.layout.width)}>
          <MapBackdrop w={w} />
        </View>
        <View style={[styles.plane, {left: ox}]}>
          <Svg width={MAP_W} height={MAP_H} viewBox="0 0 350 320" fill="none" style={StyleSheet.absoluteFill}>
            <Ellipse cx="112" cy="250" rx="46" ry="30" fill="rgba(90,170,110,.14)" />
            <Path d="M60 40c30 6 40 30 20 46s-46 0-40-20 8-26 20-26z" fill="rgba(241,168,122,.08)" />
            <Path d="M-10 190C80 176 160 210 360 150" stroke="rgba(255,255,255,.07)" strokeWidth={10} />
            <Path d="M70 -10C96 100 112 210 140 330" stroke="rgba(255,255,255,.07)" strokeWidth={8} />
            <Path d="M-10 100C120 120 220 66 360 86" stroke="rgba(255,255,255,.06)" strokeWidth={7} />
            <Path d="M260 -10C246 120 284 210 262 330" stroke="rgba(255,255,255,.06)" strokeWidth={8} />
            <Path d="M-10 270C90 260 200 300 360 250M180 -10C190 80 170 200 200 330M-10 30C100 50 240 20 360 40" stroke="rgba(255,255,255,.04)" strokeWidth={3} />
            {places.map(p => (
              <Path key={p.id} d={routes[p.id].d} stroke="rgba(241,221,186,.18)" strokeWidth={2} strokeDasharray="3 5" />
            ))}
            {places.map(p => (
              <Route key={p.id} r={routes[p.id]} on={p.id === cur.id} />
            ))}
          </Svg>
          <Car route={routes[cur.id]} />
          <View pointerEvents="none" style={[styles.home, {left: HOME[0], top: HOME[1]}]}>
            <HomeRing delay={0} />
            <HomeRing delay={1200} />
            <View style={styles.hcore}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill={colors.ink}>
                <Path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />
              </Svg>
            </View>
            <Text style={styles.hlabel}>{stay.short}</Text>
          </View>
          {places.map(p => (
            <Pin key={p.id} p={p} on={p.id === place} onPick={pick(p.id)} />
          ))}
        </View>
        <View pointerEvents="none" style={styles.north}>
          <View style={styles.nBadge}>
            <Text style={styles.nText}>N</Text>
          </View>
          <Text style={styles.northText}>Stylised · not to scale</Text>
        </View>
        <Info place={cur} n={n} city={stay.city} />
      </Reveal>
      <View style={styles.chips}>
        {places.map(p => (
          <Chip key={p.id} p={p} on={p.id === place} onPick={pick(p.id)} />
        ))}
      </View>
    </View>
  );
}

export default memo(Nearby);

const styles = StyleSheet.create({
  sec: {paddingTop: 30},
  head: {flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12},
  sub: {fontFamily: fonts.regular, fontSize: 12, color: colors.muted},
  map: {
    height: MAP_H,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  plane: {position: 'absolute', top: 0, width: MAP_W, height: MAP_H},
  car: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(241,168,122,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: PEACH,
    shadowOpacity: 0.7,
    shadowRadius: 9,
    shadowOffset: {width: 0, height: 0},
  },
  carCore: {width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff'},
  home: {position: 'absolute', width: 0, height: 0, zIndex: 3},
  hring: {
    position: 'absolute',
    left: -22,
    top: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(241,221,186,0.6)',
  },
  hcore: {
    position: 'absolute',
    left: -15,
    top: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
  },
  hlabel: {position: 'absolute', left: 20, top: -10, width: 120, fontFamily: fonts.bold, fontSize: 10.5, color: colors.gold},
  mpin: {position: 'absolute', width: 44, height: 52, alignItems: 'center', zIndex: 4},
  mpinOn: {zIndex: 5},
  pinSvg: {width: 30, height: 38, transformOrigin: ['50%', '100%', 0]},
  plabelRow: {position: 'absolute', top: -22, left: -60, right: -60, alignItems: 'center'},
  plabel: {paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: PEACH},
  plabelText: {fontFamily: fonts.extrabold, fontSize: 10, color: colors.ink},
  north: {position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6},
  nBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nText: {fontFamily: fonts.extrabold, fontSize: 9, color: '#E6E0D6'},
  northText: {fontFamily: fonts.regular, fontSize: 9.5, color: '#8E887F'},
  info: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(20,19,23,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 6,
  },
  infoImg: {width: 56, height: 56, borderRadius: 12},
  infoCopy: {flex: 1, minWidth: 0, gap: 3},
  infoName: {fontFamily: fonts.bold, fontSize: 14.5, color: '#fff'},
  infoDist: {flexDirection: 'row', alignItems: 'center', gap: 6},
  infoDistText: {fontFamily: fonts.semibold, fontSize: 12, color: PEACH},
  dir: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {flexDirection: 'row', gap: 8, marginTop: 12},
  chipCell: {flex: 1},
  pchip: {
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  chipName: {fontFamily: fonts.bold, fontSize: 12},
  chipShort: {fontFamily: fonts.regular, fontSize: 10.5, opacity: 0.75},
});
