// The concert the Hub shows (hero slide + Concert Experiences), from the same
// section API as Home and Concert Details. Loaded once at launch and again when
// the app returns after 10 min. Only a city whose show hasn't started yet
// counts, so the Hub never advertises a past concert; with none, it shows none.
import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {GetConcertSection} from '../../Services/UserApi';
import {normalizeSection} from '../Concert/utils/concertAdapter';

const STALE_MS = 10 * 60 * 1000;

let section; // undefined = loading, null = failed
let fetchedAt = 0;
const listeners = new Set();

async function load() {
  try {
    const token = await AsyncStorage.getItem('mytoken').catch(() => null);
    const {data} = await GetConcertSection({token});
    section = normalizeSection(data);
  } catch (e) {
    if (section === undefined) {
      section = null;
    }
  }
  fetchedAt = Date.now();
  listeners.forEach(fn => fn());
}

load();
AppState.addEventListener('change', state => {
  if (state === 'active' && Date.now() - fetchedAt > STALE_MS) {
    load();
  }
});

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** {concert, city} for the next show, null if none, undefined while loading. */
function pick(sec, now) {
  const concert = sec?.enabled ? sec.concert : null;
  const city = (concert?.cities || [])
    .filter(c => Date.parse(c.startsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  return city ? {concert, city} : null;
}

export function useNextConcert() {
  const sec = useSyncExternalStore(subscribe, () => section);
  const [now, setNow] = useState(Date.now);
  const next = useMemo(() => (sec === undefined ? undefined : pick(sec, now)), [sec, now]);
  // Look again when the current show starts, so it drops off on time.
  useEffect(() => {
    if (!next) {
      return;
    }
    const ms = Date.parse(next.city.startsAt) - Date.now() + 1000;
    const id = setTimeout(() => setNow(Date.now()), Math.min(Math.max(ms, 1000), 2147483647));
    return () => clearTimeout(id);
  }, [next]);
  return next;
}

/** "14 Nov 2026" from the city's display fields. */
export function showDate(city) {
  const year = new Date(city.startsAt).getFullYear();
  const mon = city.month ? city.month[0] + city.month.slice(1).toLowerCase() : '';
  return [city.day, mon, year].filter(Boolean).join(' ');
}
