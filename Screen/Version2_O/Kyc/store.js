// One shared copy of GET /kyc/me for all KYC screens. Every screen reads it
// with useKyc(); every check's response carries the new `kyc`, which goes in
// with setKyc() so the overview is current the moment the user returns.
import {useCallback, useContext, useEffect, useRef, useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {AppContext} from '../../Context/AppContext';
import {getKyc} from './api';

// `owner` is the account the data belongs to, so after a logout / login as
// someone else the screens never show the previous customer's steps.
let state = {kyc: null, owner: null, loading: false, error: null};
let currentOwner = null;
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

export const setKyc = kyc => kyc && emit({kyc, owner: currentOwner, error: null});

function setOwner(owner) {
  if (owner !== currentOwner) {
    currentOwner = owner;
    Object.keys(locked).forEach(k => delete locked[k]);
  }
}

// One /me at a time per account. A request started for the previous account
// (logout → login) doesn't block the new one, and its answer is dropped.
let inflight = null;
let inflightOwner;
export function refreshKyc() {
  if (!inflight || inflightOwner !== currentOwner) {
    const owner = currentOwner;
    inflightOwner = owner;
    emit({loading: true});
    const p = getKyc()
      .then(kyc => owner === currentOwner && emit({kyc, owner, loading: false, error: null}))
      // A failure for a new account also drops the previous account's data,
      // so the error (and Try again) shows instead of an endless spinner.
      .catch(error => owner === currentOwner && emit({loading: false, error, ...(state.owner !== owner && {kyc: null, owner})}))
      .finally(() => {
        if (inflight === p) {
          inflight = null;
        }
      });
    inflight = p;
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
  const {globalState} = useContext(AppContext) || {};
  const owner = globalState?.userEmail || globalState?.userDetails?.email || null;
  setOwner(owner);
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

  const mine = snap.owner === owner;
  return {...snap, kyc: mine ? snap.kyc : null, error: mine || !snap.kyc ? snap.error : null, refresh: refreshKyc};
}

/**
 * What a step screen shows for a failed call, per the API's error codes.
 * Returns {field} for a message under the input, or {note} for a banner;
 * `locked` / `off` tell the screen to disable the step / leave.
 */
export function checkError(e, type) {
  // ApiError fills in "Something went wrong" when the server sent no message;
  // treat that as nothing so the specific text below shows instead.
  const said = e?.message && e.message !== 'Something went wrong' ? e.message : null;
  switch (e?.status) {
    case 400:
      return {field: said || 'Please check this and try again.'};
    case 409:
      setTimeout(refreshKyc, 5000);
      return {note: said || 'A check is already running - wait a moment'};
    case 429:
      lockStepForToday(type);
      return {note: said || 'Too many attempts today - please try again tomorrow', locked: true};
    case 503:
      refreshKyc();
      return {note: said || 'Verification isn’t available right now. Please try again later.', off: true};
    case 0:
      // No answer (offline or timed out). The check may still have finished
      // on the server, so look again shortly rather than invite a paid retry.
      setTimeout(refreshKyc, 3000);
      return {note: said || 'No internet connection. Check your network and try again.'};
    default:
      return {note: said || 'Something went wrong. Please try again.'};
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
