// App flags store: shows the saved copy at once, refreshes from
// GET /app/flags in the background, never blocks and never throws.
// Refreshes on start, on return to the foreground after 60 s, every
// refreshAfterSec while open, and when a scheduled change (nextChangeAt) is due.
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {request} from '../Version2_O/SpecialSection/api/client';
import {DEV_OVERRIDES, FALLBACK, STATES} from './registry';

const KEY = 'appFlags:v1';
const STALE_MS = 60 * 1000;
const DEFAULT_REFRESH_MS = 300 * 1000;

let flags = withOverrides(FALLBACK);
let fetchedAt = 0;
let timer = null;
let inflight = null;
let nextDelay = DEFAULT_REFRESH_MS;
const listeners = new Set();

function withOverrides(f) {
  return __DEV__ ? {...f, ...DEV_OVERRIDES} : f;
}

/** Known keys with valid states only; anything else keeps its fallback. */
function clean(raw) {
  const out = {...FALLBACK};
  Object.keys(FALLBACK).forEach(k => {
    if (STATES.includes(raw?.[k])) {
      out[k] = raw[k];
    }
  });
  return out;
}

function apply(next) {
  const f = withOverrides(next);
  if (Object.keys(f).some(k => f[k] !== flags[k])) {
    flags = f;
    listeners.forEach(fn => fn());
  }
}

function schedule() {
  clearTimeout(timer);
  timer = AppState.currentState === 'active' ? setTimeout(refresh, nextDelay) : null;
}

/** Fetches the flags now (one call at a time). */
export function refresh() {
  if (!inflight) {
    inflight = request('GET', '/app/flags', {timeout: 5000})
      .then(d => {
        const next = clean(d?.flags);
        fetchedAt = Date.now();
        apply(next);
        AsyncStorage.setItem(KEY, JSON.stringify({flags: next, fetchedAt})).catch(() => {});
        nextDelay = d?.refreshAfterSec > 0 ? d.refreshAfterSec * 1000 : DEFAULT_REFRESH_MS;
        // Time the scheduled flip on the server's clock, not this phone's.
        const due = Date.parse(d?.nextChangeAt) - Date.parse(d?.serverTime);
        if (due > 0 && due < nextDelay) {
          nextDelay = due + 1000;
        }
      })
      .catch(() => {
        nextDelay = DEFAULT_REFRESH_MS; // keep the copy we have
      })
      .finally(() => {
        inflight = null;
        schedule();
      });
  }
  return inflight;
}

export const getFlag = key => flags[key] ?? FALLBACK[key];

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Start on import (App.js imports this once at launch).
AsyncStorage.getItem(KEY)
  .then(raw => {
    const saved = raw && JSON.parse(raw);
    if (saved?.flags && !fetchedAt) {
      fetchedAt = saved.fetchedAt || 0;
      apply(clean(saved.flags));
    }
  })
  .catch(() => {})
  .finally(refresh);

AppState.addEventListener('change', state => {
  if (state !== 'active') {
    clearTimeout(timer);
    timer = null;
  } else if (Date.now() - fetchedAt > STALE_MS) {
    refresh();
  } else {
    schedule();
  }
});
