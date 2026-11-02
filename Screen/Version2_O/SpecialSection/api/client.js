// HTTP client for the Special Section APIs. Every response is
// `{success, message, data}`; this unwraps `data` and turns anything else into
// an ApiError the screens can show.
import axios from 'axios';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

// apitest for debug and release builds (for now). The key is the same one
// UserApi.js sends on every call; moving it off the app is a parked login issue.
export const API_BASE = 'https://apitest.fracspace.com/api/v1';
const API_KEY = 'Fracspace@2024';

/**
 * Dev switch: true = a section reads its mock data.js and never calls the
 * server. Flip one back on if its endpoint is down while you work on the UI.
 */
export const USE_MOCK = {
  stays: false,
};

export class ApiError extends Error {
  constructor(status, message, errors, data) {
    super(message || 'Something went wrong');
    this.status = status; // 0 = no connection / timeout
    this.errors = errors || null; // field → message
    this.data = data || null;
  }
}

/** The first field error (e.g. "Check-in is in the past"), else the message. */
export const errText = e => (e?.errors && Object.values(e.errors).find(v => typeof v === 'string')) || e?.message;

const getToken = () => AsyncStorage.getItem('mytoken').catch(() => null);

async function headers() {
  const h = {'Content-Type': 'application/json', 'x-api-key': API_KEY, 'x-platform': Platform.OS};
  try {
    h['x-app-version'] = DeviceInfo.getVersion();
  } catch (e) {}
  const token = await getToken();
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

/** `request('GET', '/stays/home', {params})` → the response's `data`. */
export async function request(method, path, {params, body, timeout = 15000} = {}) {
  try {
    const res = await axios({
      method,
      url: API_BASE + path,
      params,
      data: body,
      timeout,
      headers: await headers(),
    });
    const json = res.data || {};
    if (json.success === false) {
      throw new ApiError(res.status, json.message, json.errors, json.data);
    }
    return json.data !== undefined ? json.data : json;
  } catch (e) {
    if (e instanceof ApiError) {
      throw e;
    }
    const r = e.response;
    if (!r) {
      throw new ApiError(0, 'No internet connection. Check your network and try again.');
    }
    const json = r.data || {};
    throw new ApiError(r.status, json.message, json.errors, json.data);
  }
}
