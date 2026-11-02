# Special Section · API + feature-flag plan (draft, needs backend sign-off)

## 1. How the app calls the backend today
- `Screen/Services/UserApi.js`: one exported function per call, plain `axios`, full URL
  `https://apitest.fracspace.com/...` hard-coded in every call, `x-api-key: 'Fracspace@2024'` in every call.
- Auth: `AsyncStorage.getItem('mytoken')`, sent as `Authorization: Bearer <token>`.
- Newest pattern (Concert, ~line 1251): `CONCERT_BASE` + `concertHeaders({token})` adding
  `x-platform`, `x-app-version`, `x-device-id`. The Special Section layer will copy this pattern.
- Base URL / API key are parked login issues; the new layer reads both from **one** constant so
  the later fix is a one-line change. No new secrets are added.

## 2. What each section shows today (mock)
| Section | Mock file | Fields |
|---|---|---|
| 1 Hub | `SpecialSection/data.js` | heroSlides `{eyebrow,title,sub,img,to,cta,product?}`; stays rail `{id,name,sub,price,rate,loc,img}`; ivaProducts rail `{id,cat,name,price,img}`; concert card (already live via `GetConcertSection`) |
| 2 Stays | `Stays/data.js` | searchCities, searchStays `{name,area,city}`, chipCities, retreats `{id,name,loc,rate,price,tag,img}`, reels `{id,title,dur,secs,loc,stayId,img(video?)}`, offers `{id,theme,badge,title,desc,perk,code,art}`, reviews, bookings: upcoming `{stayId,img,name,sub,checkIn,checkInTime,checkOutTime,nights,guests,paid,bookingId,paidOn,method,txnId,cancellation}`, completed |
| 3 Stay Detail | `StayDetail/data.js` | stay `{name,short,rate,address,about}`, gallery `{img,alt}`, suites `{id,name,spec,price,img,badge?}`, tax 5%, amenities, good-to-know/policy, nearby places |
| 4 Review Booking | `StayReview/data.js` | check-in/out times, tax, max adults/kids, cancellation rule, availability per date, receipt `{bookingId,txnId,method}` |
| 5 IVA Shop | `IvaShop/data.js` | products `{id,name,price,img,cat,tag,desc,inside[]}`, delivery address, delivery days, order receipt |

## 3. Proposed endpoints (to confirm — none are wired until the backend gives real URLs/shapes)
Base: `/api/v1/special` · headers as Concert · token optional on reads, required on bookings/orders.

| # | Method + path | Returns |
|---|---|---|
| F | `GET /config` (or a field in an existing config call) | flags (see §4) |
| 1 | `GET /hub` | `{heroSlides[], stays[], ivaProducts[]}` (concert stays on its own API) |
| 2 | `GET /stays?city=&q=` | `{cities[], chips[], retreats[], reels[], offers[], reviews[]}` |
| 2 | `GET /stays/search?q=` | `{cities[], stays[]}` |
| 2 | `GET /stays/bookings` (auth) | `{upcoming[], completed[]}` |
| 3 | `GET /stays/:id` | `{stay, gallery[], suites[], amenities[], policies, nearby[]}` |
| 3/4 | `GET /stays/:id/availability?from=&to=` | `{dates:[{date,available,price}], checkIn, checkOut, taxRate, maxAdults, maxKids}` |
| 4 | `POST /stays/:id/quote` `{suiteId,checkIn,checkOut,adults,kids}` | `{nights,subtotal,tax,total,cancellation}` |
| 4 | `POST /stays/bookings` (auth) | `{bookingId,status,payment:{...}}` (payment gateway later) |
| 5 | `GET /iva/products` | `{products[]}` |
| 5 | `GET /iva/products/:id` | product incl. `inside[]` |
| 5 | `POST /iva/orders` (auth) | `{orderId,status,eta,payment:{...}}` |

Images: absolute URLs; prices as numbers in rupees (the app formats `₹`).

## 4. Feature flags
JSON the backend returns (also accepted nested as `specialSection` in an existing config call):
```json
{
  "specialSection": {
    "enabled": true,
    "sections": { "hub": true, "stays": true, "stayDetail": true, "stayReview": true, "ivaShop": true, "concerts": true },
    "minAppVersion": null,
    "ttlSeconds": 900
  }
}
```
- Fetched at startup (after first frame), cached in AsyncStorage (`ss_flags`); last cached value used offline.
- Safe default if never fetched and the fetch fails: **everything on** (today's behaviour, so a backend
  outage never hides a working feature). Backend can ship `enabled:false` to kill it; that value is cached.
- Refetched when the app returns to foreground (throttled by `ttlSeconds`).
- When off:
  - `enabled:false` → centre tab removed from the bar; any open Special screen pops to Home.
  - `hub:false` → same as `enabled:false` (the Hub is the tab's root).
  - `stays:false` → Hub hides the Stays category/rail/hero slide; `Stays`, `StayDetail`, `StayReview` blocked.
  - `stayDetail:false` / `stayReview:false` → cards stay visible but booking path is blocked (back to Stays/Hub).
  - `ivaShop:false` → Hub hides Iva category/rail/hero slide; `IvaShop` blocked.
  - `concerts:false` → Hub hides the concert card/slide; Concert screens blocked.
  - Blocked = a guard on each stack screen; a deep link or an already-open screen goes back to Hub (or Home if the Hub is off).

## 5. Data-layer rules
- `SpecialSection/api/` with `useSpecialQuery(key, fetcher, mock)`: returns mock instantly when
  `USE_MOCK` (dev switch, per section) is on; otherwise cached value → network → skeleton/empty/error.
- Mock `data.js` files stay, used as fallback per section until its endpoint is live.
- Fetch starts after the first frame (`InteractionManager`), never blocks mounting; no change to
  LoopGate / ViewportGate / staged mounting / memo.

## 6. Stay Detail amenities (agreed shape to request)
The amenity icons are animated drawings built into the app, so the backend sends **codes, not images**.
```json
"amenities": [
  { "code": "ac",           "label": "Air Conditioner",       "included": true },
  { "code": "wifi",         "label": "Wi-Fi",                 "included": true },
  { "code": "minibar",      "label": "Mini Bar",              "included": true },
  { "code": "housekeeping", "label": "House Keeping Service", "included": true },
  { "code": "pool",         "label": "Infinity Pool",         "included": true, "iconUrl": "https://.../pool.svg" }
]
```
- `code`: the four the app has animations for are `ac`, `wifi`, `minibar`, `housekeeping`. Any other code (e.g. `pool`, `parking`) is a **new amenity**: it is shown under the bento as a simple "More amenities" list (small static icon + label), not dropped.
- `iconUrl` (optional, new amenities only): a small single-colour SVG/PNG. If missing, the app shows a generic check icon. Ignored for the four animated codes.
- `label` is the text shown on the tile, so wording can change from the backend.
- The "N included" count is worked out by the app from `included: true`.
- Each code has a fixed place in the layout (ac = tall left tile, wifi / minibar = right column, housekeeping = wide bottom row).
