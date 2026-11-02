// The held booking behind Review Booking: server pricing (PATCH), the hold
// countdown, pay, and releasing the room if the guest leaves without paying.
import {useCallback, useEffect, useRef, useState} from 'react';
import {patchBooking, payBooking, releaseBooking, toReviewState} from '../api/stays';

/** `booking` = the hold from Stay Detail's Reserve; null = mock mode. */
export function useHold(booking) {
  const [state, setState] = useState(() => (booking ? toReviewState(booking) : null));
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [left, setLeft] = useState(null); // whole seconds of the hold left
  const id = booking?.bookingId;
  const done = useRef(false); // paid (or expired): nothing to release
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
      if (id && !done.current) {
        releaseBooking(id).catch(() => {});
      }
    },
    [id],
  );

  const fail = useCallback(e => {
    if (e.status === 410) {
      done.current = true;
      setExpired(true);
    }
    throw e;
  }, []);

  /** PATCH dates / guests / coupon / wallet; resolves to the new state. */
  const patch = useCallback(
    async body => {
      setBusy(true);
      try {
        const res = await patchBooking(id, body);
        const next = toReviewState(res.booking, res.quote);
        if (live.current) {
          setState(next);
        }
        return next;
      } catch (e) {
        return fail(e);
      } finally {
        if (live.current) {
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
      const s = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        done.current = true;
        setExpired(true);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt, expired]);

  /** POST /pay. Resolves to the server's answer ({requiresPayment, booking, payment}). */
  const pay = useCallback(
    async useWallet => {
      try {
        const res = await payBooking(id, useWallet);
        if (!res.requiresPayment) {
          done.current = true;
        }
        return res;
      } catch (e) {
        return fail(e);
      }
    },
    [id, fail],
  );

  return {live: !!booking, state, busy, expired, left, patch, pay};
}

/** 590 → "9:50" */
export const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
