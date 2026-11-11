import {useSyncExternalStore} from 'react';
import {getFlag, subscribe} from './flagStore';

/** The flag's state ('live' | 'coming_soon' | 'hidden'); re-renders on change. */
export function useFlag(key) {
  return useSyncExternalStore(subscribe, () => getFlag(key));
}
