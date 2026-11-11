// App flags (portal → App Controls; API docs/app-flags-api.md). Each flag is
// 'live' | 'coming_soon' | 'hidden'. FALLBACK must equal the API defaults, so a
// phone that never reached the API looks the same as a build without flags.
export const STATES = ['live', 'coming_soon', 'hidden'];

export const FALLBACK = {
  'hub.stays': 'live',
  'hub.shop': 'coming_soon',
  'hub.concerts': 'live',
};

/** Dev builds only: force a state to try it, e.g. {'hub.concerts': 'hidden'}. */
export const DEV_OVERRIDES = {};
