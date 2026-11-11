// The held booking behind Review Booking: server pricing (PATCH), the hold
// countdown, pay, and releasing the room if the guest leaves without paying.
import {useCallback, useEffect, useRef, useState} from 'react';
import {patchBooking, payBooking, releaseBooking, toReviewState} from '../api/stays';
import {serverNow} from '../api/client';
import {forget, own, remember} from '../api/openBookings';
import {arm} from '../api/recover';

/** `booking` = the hold from Stay Detail's Reserve; null = mock mode. */
export function useHold(booking) {
  const [state, setState] = useState(() => (booking ? toReviewState(booking) : null));
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [left, setLeft] = useState(null); // whole seconds of the hold left
  const id = booking?.bookingId;
  const done = useRef(false); // paid, confirming, released or expired: nothing to release
  const paying = useRef(false); // checkout open: the server decides if the hold ran out
  // While Review is open, the launch / foreground clean-up leaves this booking alone.
  useEffect(() => own(id), [id]);
  /**
   * Leaving without paying: give the room back now (once). Review calls it on
   * `beforeRemove`, which fires however the screen is left; not on unmount, so
   * a remount (hot reload) never frees a room the guest is still looking at.
   */
  const release = useCallback(() => {
    // Never mid-checkout: the payment may still go through.
    if (id && !done.current && !paying.current) {
      done.current = true;
      releaseBooking(id).catch(() => {});
    }
  }, [id]);

  const fail = useCallback(e => {
    if (e.status === 410) {
      done.current = true;
      setExpired(true);
    }
    throw e;
  }, []);

  // Changes can overlap (quick taps, a slow network): only the newest one's
  // answer is drawn, and `busy` stays on until the last one is back.
  const seq = useRef(0);
  const inFlight = useRef(0);
  /**
   * PATCH dates / guests / coupon / wallet; resolves to the new state, or to
   * null when a newer change was sent meanwhile (its answer wins).
   */
  const patch = useCallback(
    async body => {
      const n = ++seq.current;
      inFlight.current += 1;
      setBusy(true);
      try {
        const res = await patchBooking(id, body);
        if (n !== seq.current) {
          return null;
        }
        const next = toReviewState(res.booking, res.quote);
        setState(next);
        return next;
      } catch (e) {
        return n === seq.current || e.status === 410 ? fail(e) : null;
      } finally {
        inFlight.current -= 1;
        if (!inFlight.current) {
          setBusy(false);
        }
      }
    },
    [id, fail],
  );

  // A fresh hold has no quote yet (wallet balance, coupon status): fetch one.
  useEffect(() => {
    if (id) {
      patch({useWallet: false}).catch(() => {});
    }
  }, [id, patch]);

  // Hold countdown, from the server's expiry.
  const expiresAt = state?.holdExpiresAt;
  useEffect(() => {
    if (!expiresAt || expired) {
      return;
    }
    const tick = () => {
      const s = Math.max(0, Math.round((expiresAt - serverNow()) / 1000));
      setLeft(s);
      if (s === 0 && !paying.current) {
        done.current = true;
        forget(id);
        setExpired(true);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [id, expiresAt, expired]);

  /** POST /pay. Resolves to the server's answer ({requiresPayment, booking, payment}). */
  const pay = useCallback(
    async useWallet => {
      try {
        const res = await payBooking(id, useWallet);
        if (res.requiresPayment) {
          paying.current = true;
          // If the app dies in the checkout, the next launch asks the server about it.
          remember(id, {phase: 'paying', attemptId: res.payment?.attemptId});
        } else {
          done.current = true;
          forget(id);
        }
        return res;
      } catch (e) {
        return fail(e);
      }
    },
    [id, fail],
  );

  /**
   * The checkout's outcome from the server (`next`): confirmed or cancelled is
   * finished; pending stays on disk for the server to settle later; anything
   * else puts the hold back to normal.
   */
  const settle = useCallback(
    (next, holdUntil) => {
      paying.current = false;
      if (next === 'pending') {
        done.current = true;
        // Looked at again when the hold runs out, so the guest hears the outcome.
        Promise.resolve(remember(id, {told: true, holdUntil})).then(arm);
      } else if (next === 'confirmed' || next === 'cancelled') {
        done.current = true;
        forget(id);
      } else {
        remember(id, {phase: 'held'});
      }
    },
    [id],
  );
  const expire = useCallback(() => {
    paying.current = false;
    done.current = true;
    forget(id);
    setExpired(true);
  }, [id]);

  return {live: !!booking, id, state, busy, expired, left, patch, pay, settle, expire, release};
}

/** 590 → "9:50" */
export const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
