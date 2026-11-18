// One shared copy of GET /kyc/me for all KYC screens. Every screen reads it
// with useKyc(); every check's response carries the new `kyc`, which goes in
// with setKyc() so the overview is current the moment the user returns.
import {useCallback, useEffect, useRef, useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getKyc} from './api';

let state = {kyc: null, loading: false, error: null};
const subs = new Set();
const emit = next => {
  state = {...state, ...next};
  subs.forEach(fn => fn());
};

// Steps that hit the 5-a-day limit stay locked until the date changes.
const locked = {};
const today = () => new Date().toDateString();
export const lockStepForToday = type => {
  locked[type] = today();
  emit({});
};
export const isStepLocked = type => locked[type] === today();

export const setKyc = kyc => kyc && emit({kyc, error: null});

let inflight = null;
export function refreshKyc() {
  if (!inflight) {
    emit({loading: true});
    inflight = getKyc()
      .then(kyc => emit({kyc, loading: false, error: null}))
      .catch(error => emit({loading: false, error}))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

const subscribe = fn => {
  subs.add(fn);
  return () => subs.delete(fn);
};
const read = () => state;

/** The shared KYC state; refreshes on focus and when the app returns. */
export function useKyc({refreshOnFocus = true} = {}) {
  const snap = useSyncExternalStore(subscribe, read);
  const focused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (refreshOnFocus) {
        refreshKyc();
      }
      return () => {
        focused.current = false;
      };
    }, [refreshOnFocus]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && focused.current && refreshOnFocus) {
        refreshKyc();
      }
    });
    return () => sub.remove();
  }, [refreshOnFocus]);

  return {...snap, refresh: refreshKyc};
}

/**
 * What a step screen shows for a failed call, per the API's error codes.
 * Returns {field} for a message under the input, or {note} for a banner;
 * `locked` / `off` tell the screen to disable the step / leave.
 */
export function checkError(e, type) {
  const message = e?.message || 'Something went wrong. Please try again.';
  switch (e?.status) {
    case 400:
      return {field: message};
    case 409:
      setTimeout(refreshKyc, 5000);
      return {note: message || 'A check is already running - wait a moment'};
    case 429:
      lockStepForToday(type);
      return {note: message || 'Too many attempts today - please try again tomorrow', locked: true};
    case 503:
      refreshKyc();
      return {note: message, off: true};
    default:
      return {note: message};
  }
}

// ---- helpers the screens share ----
export const isDone = st => st === 'passed' || st === 'needs_review';

export function stepNumber(kyc, type) {
  const i = kyc?.steps?.findIndex(s => s.type === type) ?? -1;
  return {index: i + 1, total: kyc?.steps?.length || 0};
}

/** The screen route for a step type. */
export const ROUTES = {pan: 'KycPan', aadhaar: 'KycAadhaar', bank: 'KycBank'};

/** Where to go after a step finishes: the next open step, else the result. */
export function nextRoute(kyc) {
  if (!kyc) {
    return null;
  }
  if (['verified', 'pending_review', 'rejected'].includes(kyc.status)) {
    return 'KycResult';
  }
  return ROUTES[kyc.nextStep] || null;
}
