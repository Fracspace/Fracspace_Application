// Video sources for react-native-video with smaller Android buffers.
//
// ExoPlayer's defaults buffer up to ~50 s per player; our clips are short promos
// and testimonials, so a few seconds ahead is plenty and cuts memory per player.
// The returned object is cached per URL: react-native-video reloads the player
// when `source` changes identity, so a new object on every render would restart it.
import { Platform } from 'react-native';

const ANDROID_BUFFER_CONFIG = {
  minBufferMs: 5000,
  maxBufferMs: 15000,
  bufferForPlaybackMs: 1500,
  bufferForPlaybackAfterRebufferMs: 2500,
  backBufferDurationMs: 0,
};

const cache = new Map();

// `cacheSizeMB` (Android only) keeps the downloaded video in ExoPlayer's disk
// cache, so later plays and loops don't fetch it again. iOS caching needs a
// native build flag, so it's left off there.
export function videoSource(uri, { cacheSizeMB } = {}) {
  if (!uri) return undefined;
  const key = cacheSizeMB ? `${uri}|${cacheSizeMB}` : uri;
  let source = cache.get(key);
  if (!source) {
    source =
      Platform.OS === 'android'
        ? {
            uri,
            bufferConfig: cacheSizeMB
              ? { ...ANDROID_BUFFER_CONFIG, cacheSizeMB }
              : ANDROID_BUFFER_CONFIG,
          }
        : { uri };
    cache.set(key, source);
  }
  return source;
}
