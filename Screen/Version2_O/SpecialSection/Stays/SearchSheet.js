// Search flow of the Stays listing (Stays.dc.html, `.flt`): Where → When → Who.
// The state lives in index.js so the capsules under the search bar can show it.
import React, {memo, useCallback, useEffect, useState} from 'react';
import {Image, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import Animated, {Easing, FadeIn, Keyframe, interpolateColor, useAnimatedStyle} from 'react-native-reanimated';
import Svg, {Circle, Defs, LinearGradient as SvgGradient, Path, Rect, Stop} from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, fonts, ls} from '../theme';
import {E, PressScale, useToggle} from '../anim';
import {ChevronSideIcon, PencilIcon, PeopleIcon, ResetIcon, SearchIcon, TickIcon} from './icons';
import {searchCities, searchStays} from './data';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STEPS = ['where', 'when', 'who'];
const GUESTS = [
  {k: 'a', label: 'Adults', sub: 'Ages 13 or above', min: 1},
  {k: 'c', label: 'Children', sub: 'Ages 12 or under', min: 0},
];
const DURS = ['A weekend', 'A week', 'A month'];

/** A fresh search: tomorrow for one night (made on open, so never in the past). */
export function initialSearch() {
  const t = new Date();
  const cin = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
  return {
    query: '',
    city: 'Hyderabad',
    mode: 'dates', // or 'flex'
    m: cin.getMonth(),
    y: cin.getFullYear(),
    in: cin,
    out: new Date(cin.getFullYear(), cin.getMonth(), cin.getDate() + 1),
    dur: 'A weekend',
    mon: '',
    g: {a: 1, c: 0},
    applied: false, // set by "Search stays"; the capsules then show the choices
    pillCity: '', // the destination capsule that is on
  };
}

const sameDay = (a, b) => !!a && !!b && a.toDateString() === b.toDateString();

export function whenLabel(s) {
  if (s.mode === 'flex') {
    return (s.dur || 'A weekend') + (s.mon ? ' · ' + s.mon : '');
  }
  const a = s.in;
  const b = s.out || s.in;
  if (!a) {
    return 'Any dates';
  }
  const ma = MONTHS[a.getMonth()];
  const mb = MONTHS[b.getMonth()];
  return a.getDate() + (ma === mb ? '' : ' ' + ma) + ' – ' + b.getDate() + ' ' + mb;
}

export function guestLabel(s) {
  const t = s.g.a + s.g.c;
  return t + (t === 1 ? ' guest' : ' guests');
}

const NIGHTS = {'A weekend': 2, 'A week': 7, 'A month': 30};

/**
 * The search's stay as check-in / checkout Dates, or null. "Flexible" turns
 * into real dates: the first possible start in the chosen month (else from
 * tomorrow), on a Friday for "A weekend".
 */
export function tripDates(s) {
  if (s.mode !== 'flex') {
    return s.in && s.out && s.out > s.in ? {cin: s.in, cout: s.out} : null;
  }
  const t = new Date();
  let cin = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
  const [mon, yr] = (s.mon || '').split(' ');
  const m = MONTHS.indexOf(mon);
  if (m >= 0 && Number(yr)) {
    const first = new Date(Number(yr), m, 1);
    cin = first > cin ? first : cin;
  }
  const dur = s.dur || 'A weekend';
  if (dur === 'A weekend') {
    cin = new Date(cin.getFullYear(), cin.getMonth(), cin.getDate() + ((5 - cin.getDay() + 7) % 7));
  }
  const cout = new Date(cin.getFullYear(), cin.getMonth(), cin.getDate() + NIGHTS[dur]);
  return {cin, cout};
}

const whereLabel = s => (s.city === 'Hyderabad' ? 'Banjara Hills, Hyderabad, Telangana' : s.city || 'Anywhere');
const fmtDay = d => (d ? DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() : 'Add date');
const stayCount = c => searchStays.filter(x => x.city === c).length;

// `fcIn` / `pcIn` / `dpop` entrances.
const OUT = Easing.bezier(0.2, 0.9, 0.25, 1);
const cardIn = new Keyframe({
  0: {opacity: 0, transform: [{translateY: 16}, {scale: 0.98}]},
  100: {opacity: 1, transform: [{translateY: 0}, {scale: 1}], easing: OUT},
}).duration(450);
const sumIn = new Keyframe({
  0: {opacity: 0, transform: [{translateY: 16}, {scale: 0.98}]},
  100: {opacity: 1, transform: [{translateY: 0}, {scale: 1}], easing: Easing.ease},
}).duration(350);
const placeIn = delay =>
  new Keyframe({
    0: {opacity: 0, transform: [{translateY: 14}, {scale: 0.97}]},
    100: {opacity: 1, transform: [{translateY: 0}, {scale: 1}], easing: OUT},
  })
    .duration(500)
    .delay(delay);
const PLACE_IN = {L: placeIn(0), R: placeIn(80)};
const dayPop = new Keyframe({
  0: {transform: [{scale: 0.7}]},
  100: {transform: [{scale: 1}], easing: E.spring},
}).duration(300);

/** `.pc2`: destination card; gold outline and tick when picked. */
const Place = memo(function Place({c, on, onPick}) {
  const v = useToggle(on, {duration: 250, easing: E.ease});
  const chk = useToggle(on, {duration: 400, easing: E.spring});
  const ring = useAnimatedStyle(() => ({
    borderColor: interpolateColor(v.value, [0, 1], ['rgba(241,221,186,0)', colors.gold]),
  }));
  const tick = useAnimatedStyle(() => ({
    opacity: Math.min(1, chk.value * 1.6),
    transform: [{scale: 0.4 + 0.6 * chk.value}],
  }));
  const n = stayCount(c.city);
  return (
    <Animated.View entering={PLACE_IN[c.col]}>
      <PressScale
        to={0.96}
        duration={450}
        onPress={() => onPick(c.city)}
        accessibilityState={{selected: on}}
        accessibilityLabel={`${c.city}, ${n} stays`}>
        <View style={[styles.pc2, {height: c.h}]}>
          {c.img ? <Image source={c.img} style={styles.fill} resizeMode="cover" /> : <GoaArt />}
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
            locations={[0, 0.45, 1]}
          />
          <View style={styles.pcnt}>
            <Text style={styles.pcntText}>
              {n} {n === 1 ? 'stay' : 'stays'}
            </Text>
          </View>
          <Animated.View style={[styles.pchk, tick]}>
            <TickIcon />
          </Animated.View>
          <Text style={styles.pname}>{c.city.toUpperCase()}</Text>
        </View>
        <Animated.View pointerEvents="none" style={[styles.outline, ring]} />
      </PressScale>
    </Animated.View>
  );
});

/** Goa has no photo yet: the sunset-palm art from the design. */
function GoaArt() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 160 220" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <SvgGradient id="goaSky" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#F7A86B" />
          <Stop offset="0.55" stopColor="#E8667A" />
          <Stop offset="1" stopColor="#2B3A6B" />
        </SvgGradient>
      </Defs>
      <Rect width="160" height="220" fill="url(#goaSky)" />
      <Circle cx="96" cy="110" r="24" fill="#FFD9A0" />
      <Path d="M0 130 Q40 122 80 130 T160 128 V220 H0Z" fill="#1E5F7A" />
      <Path d="M0 150 Q40 142 80 150 T160 148" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={1.5} />
      <Path d="M0 172 Q40 164 80 172 T160 170" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth={1.5} />
      <Path d="M30 200 C34 160 38 130 46 104" stroke="#1A1611" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path
        d="M46 104 C30 96 18 100 10 110 M46 104 C40 88 26 84 16 86 M46 104 C56 88 70 86 80 92 M46 104 C62 98 74 104 80 114 M46 104 C48 90 46 80 40 72"
        stroke="#1A1611"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function Where({s, patch}) {
  const [focus, setFocus] = useState(false);
  const q = s.query.trim().toLowerCase();
  const list = q
    ? searchCities.filter(
        c =>
          c.city.toLowerCase().includes(q) ||
          searchStays.some(x => x.city === c.city && (x.name + ' ' + x.area).toLowerCase().includes(q)),
      )
    : searchCities;
  const pick = useCallback(city => patch({city, query: ''}), [patch]);
  const col = side =>
    list.filter(c => c.col === side).map(c => <Place key={c.city} c={c} on={s.city === c.city} onPick={pick} />);
  return (
    <Animated.View entering={cardIn} style={styles.fcard}>
      <View style={styles.row}>
        <Text style={styles.fh}>Where?</Text>
        <Text style={styles.muted12}>6 stays · 4 destinations</Text>
      </View>
      <View style={[styles.fsrch, focus && styles.fsrchOn]}>
        <SearchIcon size={18} color="#8E887F" />
        <TextInput
          value={s.query}
          onChangeText={query => patch({query})}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder="Search a city, area or stay"
          placeholderTextColor="#7E7870"
          accessibilityLabel="Search destinations"
          style={styles.input}
        />
      </View>
      <View style={styles.pgrid}>
        <View style={styles.pcol}>{col('L')}</View>
        <View style={styles.pcol}>{col('R')}</View>
      </View>
      {list.length === 0 ? <Text style={styles.noCity}>No destinations match — try Hyderabad or Munnar</Text> : null}
    </Animated.View>
  );
}

/** `.city` capsule (flexible dates). */
function Pick({label, on, onPress}) {
  return (
    <Pressable onPress={onPress} accessibilityState={{selected: on}} style={[styles.city, on && styles.cityOn]}>
      <Text style={[styles.cityText, on && styles.cityTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** One calendar day; re-renders only when its own range state changes. */
const Day = memo(function Day({d, st, en, inR, rng, past, label, onPick}) {
  const end = st || en;
  return (
    <Pressable
      onPress={() => onPick(d)}
      disabled={past}
      accessibilityLabel={label}
      accessibilityState={{disabled: past}}
      style={[styles.dy, inR && styles.dyIn, past && styles.off]}>
      {end && rng ? <View style={[styles.half, st ? styles.halfR : styles.halfL]} /> : null}
      {end ? <Animated.View entering={dayPop} style={styles.dyEnd} /> : null}
      <Text style={[styles.dyText, end && styles.dyTextEnd]}>{d}</Text>
    </Pressable>
  );
});

function When({s, patch}) {
  // Range picking as in the design: a new start unless extending the open one.
  const {y, m} = s;
  const pickDay = useCallback(
    d =>
      patch(x => {
        const dt = new Date(y, m, d);
        const a = x.in;
        const b = x.out;
        if (!a || (b && !sameDay(a, b)) || dt < a) {
          return {in: dt, out: null};
        }
        return sameDay(dt, a) ? {out: null} : {out: dt};
      }),
    [patch, y, m],
  );
  const first = new Date(s.y, s.m, 1).getDay();
  const nd = new Date(s.y, s.m + 1, 0).getDate();
  const cells = [];
  for (let k = 0; k < first; k++) {
    cells.push(<View key={'e' + k} style={styles.dy} />);
  }
  const rng = !!s.in && !!s.out && !sameDay(s.in, s.out);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const atFirst = s.y < t0.getFullYear() || (s.y === t0.getFullYear() && s.m <= t0.getMonth());
  for (let d = 1; d <= nd; d++) {
    const dt = new Date(s.y, s.m, d);
    cells.push(
      <Day
        key={d}
        d={d}
        st={sameDay(dt, s.in)}
        en={sameDay(dt, s.out)}
        inR={!!s.in && !!s.out && dt > s.in && dt < s.out}
        rng={rng}
        past={dt < t0}
        label={`${d} ${MONTHS_LONG[s.m]}`}
        onPick={pickDay}
      />,
    );
  }
  const shift = n => {
    const d = new Date(s.y, s.m + n, 1);
    patch({m: d.getMonth(), y: d.getFullYear()});
  };
  const mons = [0, 1, 2, 3].map(k => {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
    return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  });
  return (
    <Animated.View entering={cardIn} style={styles.fcard}>
      <View style={styles.row}>
        <Text style={styles.fh}>When?</Text>
        <View style={styles.dfx}>
          {['dates', 'flex'].map(mode => (
            <Pressable
              key={mode}
              onPress={() => patch({mode})}
              accessibilityState={{selected: s.mode === mode}}
              style={[styles.dfxBtn, s.mode === mode && styles.dfxOn]}>
              <Text style={[styles.dfxText, s.mode === mode && styles.dfxTextOn]}>{mode === 'dates' ? 'Dates' : 'Flexible'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.lead}>Select exclusive stay duration for your fractional estate share.</Text>
      {s.mode === 'dates' ? (
        <View>
          <View style={[styles.row, styles.mt20]}>
            <Text style={styles.month}>
              {MONTHS_LONG[s.m]} {s.y}
            </Text>
            <View style={styles.navs}>
              <PressScale
                to={0.92}
                disabled={atFirst}
                onPress={() => shift(-1)}
                accessibilityLabel="Previous month"
                style={[styles.mnav, atFirst && styles.off]}>
                <ChevronSideIcon />
              </PressScale>
              <PressScale to={0.92} onPress={() => shift(1)} accessibilityLabel="Next month" style={styles.mnav}>
                <ChevronSideIcon right />
              </PressScale>
            </View>
          </View>
          <View style={styles.cal}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
              <Text key={i} style={styles.wd}>
                {w}
              </Text>
            ))}
            {cells}
          </View>
          <View style={styles.cio}>
            <View style={styles.cioBox}>
              <Text style={styles.flab}>CHECK-IN</Text>
              <Text style={styles.cioVal}>{fmtDay(s.in)}</Text>
            </View>
            <View style={styles.cioBox}>
              <Text style={styles.flab}>CHECKOUT</Text>
              <Text style={styles.cioVal}>{fmtDay(s.out)}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.mt20}>
          <Text style={styles.flab}>HOW LONG?</Text>
          <View style={styles.flex2}>
            {DURS.map(l => (
              <Pick key={l} label={l} on={s.dur === l} onPress={() => patch({dur: l})} />
            ))}
          </View>
          <Text style={[styles.flab, styles.mt18]}>WHEN?</Text>
          <View style={styles.flex2}>
            {mons.map(l => (
              <Pick key={l} label={l} on={s.mon === l} onPress={() => patch({mon: s.mon === l ? '' : l})} />
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

function Who({s, patch}) {
  const set = (k, n) => patch({g: {...s.g, [k]: n}});
  return (
    <Animated.View entering={cardIn} style={styles.fcard}>
      <View style={[styles.row, styles.mb6]}>
        <Text style={[styles.fh, styles.fhWho]}>Who?</Text>
        <View style={styles.whoIcon}>
          <PeopleIcon />
        </View>
      </View>
      {GUESTS.map(({k, label, sub, min}) => {
        const n = s.g[k];
        return (
          <View key={k} style={styles.who}>
            <View>
              <Text style={styles.whoLabel}>{label}</Text>
              <Text style={styles.whoSub}>{sub}</Text>
            </View>
            <View style={styles.stepper}>
              <PressScale
                to={0.88}
                duration={300}
                disabled={n <= min}
                onPress={() => set(k, Math.max(min, n - 1))}
                accessibilityLabel={`Fewer ${label}`}
                style={[styles.stpb, n <= min && styles.off]}>
                <Text style={styles.stpbText}>−</Text>
              </PressScale>
              <Text style={styles.wn}>{n}</Text>
              <PressScale
                to={0.88}
                duration={300}
                onPress={() => set(k, Math.min(10, n + 1))}
                accessibilityLabel={`More ${label}`}
                style={styles.stpb}>
                <Text style={styles.stpbText}>+</Text>
              </PressScale>
            </View>
          </View>
        );
      })}
    </Animated.View>
  );
}

/** `.fsum`: a finished step, tap to edit it. */
function Summary({label, value, right, onPress, icon}) {
  return (
    <Animated.View entering={sumIn}>
      <Pressable onPress={onPress} style={styles.fsum}>
        <Text style={styles.flab}>{label}</Text>
        <Text style={[styles.fsumText, right && styles.right]} numberOfLines={1}>
          {value}
        </Text>
        {icon}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Edits its own copy of the search (`init`, opened at `step`) so a tap
 * re-renders only the sheet; `onClose` gets the copy back.
 */
/** iOS doesn't resize the modal for the keyboard, so the bottom bar has to ride on top of it. */
function useIosKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return undefined;
    }
    const show = Keyboard.addListener('keyboardWillShow', e => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}

export default function SearchSheet({init, step: initStep, onClose}) {
  const insets = useSafeAreaInsets();
  const kb = useIosKeyboardHeight();
  const [s, setS] = useState(() => ({...init, step: initStep}));
  // Accepts a patch object or a function of the current state.
  const patch = useCallback(p => setS(x => ({...x, ...(typeof p === 'function' ? p(x) : p)})), []);
  const done = extra => {
    const {step, ...rest} = {...s, ...extra};
    onClose(rest);
  };
  const close = () => done({});
  const next = () => {
    if (s.step === 'where') {
      patch({step: 'when'});
    } else if (s.step === 'when') {
      patch({step: 'who'});
    } else {
      // Only a check-in picked: stay one night.
      const out = s.in && !s.out ? new Date(s.in.getFullYear(), s.in.getMonth(), s.in.getDate() + 1) : s.out;
      done({applied: true, pillCity: s.city || '', out});
    }
  };
  const reset = () => {
    if (s.step === 'where') {
      patch({city: '', query: ''});
    } else if (s.step === 'when') {
      patch({in: null, out: null, mon: '', dur: 'A weekend'});
    } else {
      patch({g: {a: 1, c: 0}});
    }
  };
  return (
    <Modal transparent statusBarTranslucent animationType="none" visible onRequestClose={close}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.flt} accessibilityViewIsModal>
        <View style={[styles.top, {paddingTop: insets.top + 10}]}>
          <Pressable onPress={close} accessibilityLabel="Close search" style={styles.back}>
            <ChevronSideIcon size={22} strokeWidth={1.8} />
          </Pressable>
          <Text style={styles.stepNo}>STEP {STEPS.indexOf(s.step) + 1} OF 3</Text>
        </View>
        <ScrollView
          style={styles.grow}
          contentContainerStyle={[styles.fsc, {paddingBottom: 120 + (kb || insets.bottom)}]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {s.step !== 'where' ? (
            <Summary
              label="WHERE"
              value={whereLabel(s)}
              onPress={() => patch({step: 'where'})}
              icon={<PencilIcon />}
            />
          ) : null}
          {s.step === 'who' ? (
            <Summary label="WHEN" value={whenLabel(s)} right onPress={() => patch({step: 'when'})} />
          ) : null}
          {s.step === 'where' ? <Where key="where" s={s} patch={patch} /> : null}
          {s.step === 'when' ? <When key="when" s={s} patch={patch} /> : null}
          {s.step === 'who' ? <Who key="who" s={s} patch={patch} /> : null}
        </ScrollView>
        {/* A plain View hosts the buttons: on iOS a LinearGradient container clips them to its padding. */}
        <View
          pointerEvents="box-none"
          style={[styles.fbar, kb ? [styles.fbarKb, {bottom: kb}] : {paddingBottom: 24 + insets.bottom}]}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0)', '#000', '#000']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable onPress={reset} style={styles.freset}>
            <ResetIcon />
            <Text style={styles.fresetText}>RESET</Text>
          </Pressable>
          <PressScale to={0.95} duration={400} onPress={next} style={styles.fnext}>
            <Text style={styles.fnextText}>{s.step === 'who' ? 'SEARCH STAYS' : 'NEXT'}</Text>
          </PressScale>
        </View>
      </Animated.View>
    </Modal>
  );
}

const card = {backgroundColor: '#12141A', borderWidth: 1, borderColor: colors.whiteA(0.06)};

const styles = StyleSheet.create({
  fill: {width: '100%', height: '100%'},
  grow: {flex: 1},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  right: {textAlign: 'right'},
  mt18: {marginTop: 18},
  mt20: {marginTop: 20},
  mb6: {marginBottom: 6},
  off: {opacity: 0.35},
  flt: {flex: 1, backgroundColor: 'rgba(0,0,0,0.88)'},
  top: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20},
  back: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  stepNo: {fontFamily: fonts.extrabold, fontSize: 10.5, letterSpacing: ls(0.2, 10.5), color: '#8E887F'},
  fsc: {paddingTop: 20, paddingHorizontal: 16, gap: 12},
  fcard: {borderRadius: 24, padding: 20, ...card},
  fsum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    ...card,
  },
  fsumText: {flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.cream},
  flab: {fontFamily: fonts.bold, fontSize: 11, letterSpacing: ls(0.06, 11), color: '#F2B38A'},
  fh: {fontFamily: fonts.bold, fontSize: 22, color: colors.cream},
  fhWho: {fontFamily: fonts.semibold},
  muted12: {fontFamily: fonts.regular, fontSize: 12, color: colors.muted},
  // where
  fsrch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: 14,
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#0A0B0F',
    borderWidth: 1,
    borderColor: colors.whiteA(0.1),
  },
  fsrchOn: {borderColor: colors.gold},
  input: {flex: 1, minWidth: 0, padding: 0, fontFamily: fonts.regular, fontSize: 14, color: '#fff'},
  pgrid: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16},
  pcol: {flex: 1, minWidth: 0, gap: 10},
  pc2: {borderRadius: 20, overflow: 'hidden', backgroundColor: '#1A1E27'},
  outline: {position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 24, borderWidth: 2},
  pcnt: {
    position: 'absolute',
    top: 10,
    left: 10,
    height: 22,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,12,0.5)',
    borderWidth: 1,
    borderColor: colors.whiteA(0.18),
  },
  pcntText: {fontFamily: fonts.bold, fontSize: 10, color: '#fff'},
  pchk: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  pname: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    textAlign: 'center',
    fontFamily: fonts.extrabold,
    fontSize: 15,
    letterSpacing: ls(0.08, 15),
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 8,
  },
  noCity: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
    paddingTop: 18,
    paddingBottom: 4,
  },
  // when
  dfx: {flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: '#0A0B0F'},
  dfxBtn: {minWidth: 98, height: 36, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center'},
  dfxOn: {backgroundColor: colors.gold},
  dfxText: {fontFamily: fonts.semibold, fontSize: 13, color: '#CFC8BD'},
  dfxTextOn: {color: colors.ink},
  lead: {fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: '#CFC8BD', marginTop: 14, maxWidth: 280},
  month: {fontFamily: fonts.semibold, fontSize: 18, color: colors.cream, paddingLeft: 6},
  navs: {flexDirection: 'row', gap: 8},
  mnav: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1E27',
  },
  cal: {flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, marginTop: 10},
  wd: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    paddingVertical: 8,
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: '#8E887F',
  },
  dy: {width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center'},
  dyIn: {backgroundColor: '#2A241C'},
  half: {position: 'absolute', top: 0, bottom: 0, width: '50%', backgroundColor: '#2A241C'},
  halfR: {right: 0},
  halfL: {left: 0},
  dyEnd: {position: 'absolute', top: 0, bottom: 0, left: 3, right: 3, borderRadius: 14, backgroundColor: colors.gold},
  dyText: {fontFamily: fonts.regular, fontSize: 15, color: '#E6E0D6'},
  dyTextEnd: {fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink},
  cio: {flexDirection: 'row', gap: 10, marginTop: 16},
  cioBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.whiteA(0.12),
  },
  cioVal: {fontFamily: fonts.semibold, fontSize: 14, color: '#E6E0D6', marginTop: 4},
  flex2: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10},
  city: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.whiteA(0.12),
    backgroundColor: '#0A0B0F',
  },
  cityOn: {backgroundColor: colors.gold, borderColor: colors.gold},
  cityText: {fontFamily: fonts.semibold, fontSize: 13, color: '#E6E0D6'},
  cityTextOn: {color: colors.ink},
  // who
  whoIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1E27',
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteA(0.07),
  },
  whoLabel: {fontFamily: fonts.semibold, fontSize: 17, color: colors.cream},
  whoSub: {fontFamily: fonts.regular, fontSize: 14, color: '#CFC8BD', marginTop: 4},
  stepper: {flexDirection: 'row', alignItems: 'center', gap: 8},
  stpb: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1E27',
  },
  stpbText: {fontFamily: fonts.regular, fontSize: 22, color: '#E6E0D6'},
  wn: {minWidth: 44, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 19, color: '#fff'},
  // bottom bar
  fbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  fbarKb: {paddingBottom: 12},
  freset: {flexDirection: 'row', alignItems: 'center', gap: 8, height: 48},
  fresetText: {fontFamily: fonts.semibold, fontSize: 14, letterSpacing: ls(0.06, 14), color: '#E6E0D6'},
  fnext: {
    height: 54,
    minWidth: 170,
    paddingHorizontal: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8D8B8',
    shadowColor: colors.gold,
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: {width: 0, height: 10},
  },
  fnextText: {fontFamily: fonts.bold, fontSize: 15, letterSpacing: ls(0.08, 15), color: colors.ink},
});
