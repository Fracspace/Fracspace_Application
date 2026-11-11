// Small pieces of logic shared by LoginPanel and SignupPanel: one request at a
// time, the resend cooldown, input checks and request error alerts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const RESEND_SECONDS = 30;

/**
 * Saves the login (token + email) in one write, or not at all. App start needs
 * both (NavigationStack: the profile call is by email), so saving only one left
 * users half logged in. Throws when either is missing or the write fails; the
 * caller then stays on the login screen.
 */
export async function saveSession({ token, email }) {
  if (!token || !email) {
    throw new Error('Sign-in response is missing the token or email');
  }
  try {
    await AsyncStorage.multiSet([['mytoken', String(token)], ['Email', String(email)]]);
  } catch (e) {
    await AsyncStorage.multiRemove(['mytoken', 'Email']).catch(() => {});
    throw e;
  }
}

/** Shown when saveSession fails: nothing was saved, so the user just retries. */
export function alertSessionNotSaved() {
  Alert.alert('Couldn’t sign you in', 'Something went wrong while signing you in. Please try again.');
}

/**
 * Runs one request at a time: taps while one is running are ignored.
 * Returns [busy, run]; `run(fn)` resolves to fn's result, or undefined when
 * it was ignored.
 */
export function useSingleFlight() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async fn => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, run];
}

/** Seconds left before "Resend code" works again. Returns [left, start]. */
export function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const start = useCallback((seconds = RESEND_SECONDS) => setLeft(seconds), []);
  return [left, start];
}

/** 0:27 */
export const formatSeconds = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Indian mobile numbers are 10 digits; other countries' national numbers
// are 4–14 digits (E.164 allows 15 including the country code).
export const phoneMaxLength = code => (code === '+91' ? 10 : 14);
export const isValidPhone = (code, phone) =>
  code === '+91' ? /^\d{10}$/.test(phone) : /^\d{4,14}$/.test(phone);
export const onlyDigits = text => text.replace(/\D/g, '');

export const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
export const isValidName = name => name.trim().length > 1;

/** Alert for a failed request: the server's message, or a readable fallback. */
export function alertRequestError(error, title = 'Something went wrong') {
  if (error?.response) {
    Alert.alert(title, error.response.data?.message || 'Please try again.');
  } else if (error?.request) {
    Alert.alert('No connection', 'Please check your internet connection and try again.');
  } else {
    Alert.alert(title, 'Please try again.');
  }
}
