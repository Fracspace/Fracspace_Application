// "Luxury Amenities" bento. The first five amenities from the backend that
// have an animated icon (amenityIcons.js) get a tile; the rest are listed as
// pills under it. With only the design's four (AC / Wi-Fi / Mini Bar /
// Housekeeping) the design's layout is kept; otherwise tiles go two per row.
// Tiles are static (the design's tap-to-explore is off).
import React, {memo, useMemo, useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Defs, Path, RadialGradient, Rect, Stop} from 'react-native-svg';
import {colors, fonts} from '../theme';
import {Reveal} from '../anim';
import {useRenderCount} from '../perf';
import {h2} from './Suites';
import {AcIcon, BarIcon, HkIcon, PEACH, WifiIcon, amenityCode, iconFor} from './amenityIcons';

const MAX_ANIMATED = 5;
const CLASSIC = ['ac', 'wifi', 'minibar', 'housekeeping'];

/**
 * Splits the amenities into animated tiles (first MAX_ANIMATED with an icon,
 * one per icon) and the rest. Takes the api/stays.js shape: `list` (backend
 * order) when present, else `bento` + `more`.
 */
export function splitAmenities(amenities, max = MAX_ANIMATED) {
  const list = amenities.list || [
    ...Object.entries(amenities.bento || {}).map(([key, label]) => ({key, label})),
    ...(amenities.more || []),
  ];
  const tiles = [];
  const rest = [];
  const used = new Set();
  list.forEach(a => {
    const label = (a.label || '').trim();
    if (!label) {
      return;
    }
    const code = tiles.length < max ? amenityCode(a) : null;
    if (code && !used.has(code)) {
      used.add(code);
      tiles.push({code, label});
    } else {
      const icon = a.icon || a.iconUrl || null;
      rest.push({label, icon: typeof icon === 'string' ? {uri: icon} : icon});
    }
  });
  return {tiles, rest};
}

/** An icon drawn at `s` × its size (the tall AC art in a two-per-row tile). */
function Scaled({s, w, h, children}) {
  return (
    <View style={{width: w * s, height: h * s}}>
      <View style={[styles.scaled, {width: w, height: h, transform: [{scale: s}]}]}>{children}</View>
    </View>
  );
}

function TileIcon({code}) {
  if (code === 'ac') {
    return (
      <Scaled s={0.5} w={124} h={150}>
        <AcIcon />
      </Scaled>
    );
  }
  const Icon = iconFor(code);
  return <Icon />;
}

/** `.bell` badge on the housekeeping tile. */
function Bell() {
  return (
    <View style={styles.bell}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={PEACH} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M5 17h14M6 17a6 6 0 0 1 12 0M12 9V7.5" />
        <Circle cx="12" cy="6.5" r="1" />
      </Svg>
    </View>
  );
}

/**
 * `radial-gradient(circle at 85% 0%, rgba(241,168,122,a), transparent stop)`
 * over a flat base, sized to the tile (circle, farthest-corner).
 */
function Glow({w, h, alpha, stop, base, id}) {
  const cx = 0.85 * w;
  const r = Math.sqrt(cx * cx + h * h);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={id} cx={cx} cy={0} r={r} fx={cx} fy={0} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={PEACH} stopOpacity={alpha} />
          <Stop offset={stop} stopColor={PEACH} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={h} fill={base} />
      <Rect width={w} height={h} fill={`url(#${id})`} />
    </Svg>
  );
}

/** `.bt` tile. */
const Tile = memo(function Tile({id, label, style, row, children, after}) {
  const [size, setSize] = useState(null);
  return (
    <View style={style}>
      <View
        style={[styles.tile, row && styles.tileRow]}
        onLayout={e => setSize({w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height})}>
        {size ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
            <Glow id={id} w={size.w} h={size.h} alpha={0.12} stop={0.6} base={colors.card} />
          </View>
        ) : null}
        {children}
        <Text style={[styles.bl, row && styles.blRow]}>{label}</Text>
        {after}
      </View>
    </View>
  );
});

/** Amenities without an animated icon: a quiet pill each, under the bento. */
function More({items}) {
  return (
    <Reveal style={styles.more}>
      {items.map(a => (
        <View key={a.label} style={styles.mpill}>
          {a.icon ? (
            <Image source={a.icon} style={styles.micon} resizeMode="contain" />
          ) : (
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PEACH} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="m5 12.5 4.5 4.5L19 7.5" />
            </Svg>
          )}
          <Text style={styles.mtext}>{a.label}</Text>
        </View>
      ))}
    </Reveal>
  );
}

/** Two-per-row tiles; an odd last one spans the row. */
function Grid({tiles}) {
  const rows = [];
  for (let i = 0; i < tiles.length; i += 2) {
    rows.push(tiles.slice(i, i + 2));
  }
  return rows.map(row =>
    row.length === 2 ? (
      <View key={row[0].code} style={styles.cols}>
        {row.map(t => (
          <Tile key={t.code} id={t.code} label={t.label} style={styles.flex}>
            <TileIcon code={t.code} />
          </Tile>
        ))}
      </View>
    ) : (
      <Tile key={row[0].code} id={row[0].code} row label={row[0].label} after={row[0].code === 'housekeeping' ? <Bell /> : null}>
        <TileIcon code={row[0].code} />
      </Tile>
    ),
  );
}

/** The design's bento: AC tall on the left, Wi-Fi / Mini Bar stacked, Housekeeping wide. */
function Classic({tiles}) {
  const b = Object.fromEntries(tiles.map(t => [t.code, t.label]));
  const right = b.wifi || b.minibar;
  return (
    <>
      {b.ac || right ? (
        <View style={styles.cols}>
          {b.ac ? (
            <Tile id="ac" label={b.ac} style={styles.flex}>
              <View style={styles.acCenter}>
                <AcIcon />
              </View>
            </Tile>
          ) : null}
          {right ? (
            <View style={[styles.flex, styles.stack]}>
              {b.wifi ? (
                <Tile id="wifi" label={b.wifi}>
                  <WifiIcon />
                </Tile>
              ) : null}
              {b.minibar ? (
                <Tile id="bar" label={b.minibar}>
                  <BarIcon />
                </Tile>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      {b.housekeeping ? (
        <Tile id="hk" row label={b.housekeeping} after={<Bell />}>
          <HkIcon />
        </Tile>
      ) : null}
    </>
  );
}

function Amenities({amenities}) {
  useRenderCount('Amenities');
  const {tiles, rest} = useMemo(() => splitAmenities(amenities), [amenities]);
  const classic = tiles.every(t => CLASSIC.includes(t.code));
  return (
    <View>
      <Reveal style={styles.head}>
        <Text style={h2}>Luxury Amenities</Text>
        <Text style={styles.sub}>{amenities.count} included</Text>
      </Reveal>
      {tiles.length ? (
        <Reveal style={styles.bento}>{classic ? <Classic tiles={tiles} /> : <Grid tiles={tiles} />}</Reveal>
      ) : null}
      {rest.length ? <More items={rest} /> : null}
    </View>
  );
}

export default memo(Amenities);

const styles = StyleSheet.create({
  head: {flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 30, marginBottom: 12},
  acCenter: {alignSelf: 'center'},
  scaled: {transformOrigin: [0, 0, 0]},
  sub: {fontFamily: fonts.regular, fontSize: 12, color: colors.muted},
  bento: {gap: 10},
  more: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10},
  mpill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  micon: {width: 16, height: 16, tintColor: PEACH},
  mtext: {fontFamily: fonts.regular, fontSize: 12.5, color: colors.soft},
  cols: {flexDirection: 'row', gap: 10},
  flex: {flex: 1},
  stack: {gap: 10},
  tile: {
    flexGrow: 1,
    minHeight: 118,
    padding: 14,
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tileRow: {flexDirection: 'row', alignItems: 'center', minHeight: 96},
  clip: {borderRadius: 21, overflow: 'hidden'},
  bl: {fontFamily: fonts.bold, fontSize: 13.5, color: colors.cream},
  blRow: {flex: 1, paddingLeft: 8},
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(241,168,122,0.4)',
  },
});
