// Holds and payments this phone started and hasn't finished, kept on disk so
// a killed app (or a release that failed offline) can be cleaned up later
// (see recover.js). Stay Detail and Review `own` their booking while open, so
// the clean-up never touches a room the guest is looking at or a checkout
// still open.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ss:open';
const owned = new Map(); // bookingId → screens holding it
export const isOwned = id => owned.has(id);

let chain = Promise.resolve();
/** Resolves once every queued write is on disk. */
export const settled = () => chain;
export const readOpen = () => AsyncStorage.getItem(KEY).then(s => (s ? JSON.parse(s) : {})).catch(() => ({}));
/** Every write goes through one queue so two updates never overwrite each other. */
function edit(fn) {
  chain = chain
    .then(readOpen)
    .then(all => AsyncStorage.setItem(KEY, JSON.stringify(fn(all) || all)))
    .catch(() => {});
  return chain;
}

/** `entry` = {phase: 'held' | 'paying', attemptId?, propertyId?, name?}, merged into what's there. */
export const remember = (id, entry) => id && edit(all => ({...all, [id]: {...all[id], ...entry, at: Date.now()}}));
export const forget = id =>
  id &&
  edit(all => {
    delete all[id];
    return all;
  });

/** A screen is using this booking until the returned function is called. */
export function own(id) {
  if (!id) {
    return () => {};
  }
  owned.set(id, (owned.get(id) || 0) + 1);
  return () => {
    const n = (owned.get(id) || 1) - 1;
    n > 0 ? owned.set(id, n) : owned.delete(id);
  };
}
