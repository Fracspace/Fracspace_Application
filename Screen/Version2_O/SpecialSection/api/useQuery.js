// Tiny cached query hook. Shows the last good copy at once (memory, then the
// on-disk copy), then refreshes after the first frame, so loading never holds
// up the screen's first paint and a dead network still shows something.
import {useCallback, useEffect, useRef, useState} from 'react';
import {InteractionManager} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const memory = new Map();
const diskKey = key => 'ss:q:' + key;

/** Drop cached copies whose key starts with `prefix` (e.g. after a booking). */
export function invalidate(prefix) {
  for (const k of memory.keys()) {
    if (k.startsWith(prefix)) {
      memory.delete(k);
    }
  }
}

/**
 * `key` names the cache entry (null = don't fetch). `fetcher` returns a
 * promise of the data. `mock` (a value) replaces the fetch entirely.
 * Returns {data, error, loading, refresh}: `loading` is true only while there
 * is nothing to show yet.
 */
export function useQuery(key, fetcher, {mock, persist = true} = {}) {
  const init = () => ({key, data: mock !== undefined ? mock : key ? memory.get(key) : undefined, error: null});
  const [stored, setState] = useState(init);
  // A new key starts from its own cache, never the previous key's data.
  const state = stored.key === key ? stored : init();
  const [tick, setTick] = useState(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  useEffect(() => {
    if (mock !== undefined || !key) {
      return;
    }
    let live = true;
    if (persist && !memory.has(key)) {
      AsyncStorage.getItem(diskKey(key))
        .then(s => {
          if (live && s && !memory.has(key)) {
            setState(p => (p.key !== key || p.data === undefined ? {key, data: JSON.parse(s), error: null} : p));
          }
        })
        .catch(() => {});
    }
    const task = InteractionManager.runAfterInteractions(() => {
      fetchRef
        .current()
        .then(data => {
          memory.set(key, data);
          if (persist) {
            AsyncStorage.setItem(diskKey(key), JSON.stringify(data)).catch(() => {});
          }
          if (live) {
            setState({key, data, error: null});
          }
        })
        .catch(error => {
          if (live) {
            setState(p => ({key, data: p.key === key ? p.data : undefined, error}));
          }
        });
    });
    return () => {
      live = false;
      task.cancel();
    };
  }, [key, mock, persist, tick]);

  const refresh = useCallback(() => {
    setState(p => ({...p, error: null}));
    setTick(t => t + 1);
  }, []);
  return {
    data: state.data,
    error: state.error,
    loading: state.data === undefined && !state.error,
    refresh,
  };
}
