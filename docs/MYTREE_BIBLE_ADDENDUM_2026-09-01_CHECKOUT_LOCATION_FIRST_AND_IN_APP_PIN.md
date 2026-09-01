# MyTree Bible Addendum — 2026-09-01 — Location-First Checkout + In-App Search/Pin

Status: APPROVED

## Product decision

Customer delivery checkout must become location-first and must not force customers to leave MyTree to obtain a Google Maps share link for the normal case.

Canonical delivery UX:

1. Choose/confirm delivery destination first.
2. Show confirmed place/pin, road distance and delivery fee.
3. Then collect recipient and human-readable delivery details.
4. Optionally save/reuse address.
5. Submit order using the existing signed route-quote/intent lifecycle.

Address and navigation remain separate concepts:

- Address = human-readable details for Customer/Shop/Rider.
- Delivery pin = authoritative Rider navigation destination.

## Destination methods

Supported destination methods remain:

- In-app place/address search (preferred)
- In-app map pin confirmation (preferred)
- Current-device GPS
- Google Maps share link fallback
- Direct latitude,longitude fallback

Current-device GPS is valid only when the phone's current location is the intended delivery destination. A Google Maps share link is not additionally required after successful GPS confirmation.

## In-app search and pin

MyTree should support a first-party location picker in LINE LIFF/web so Customer can remain inside MyTree:

- search places/addresses using Google Places
- bias search toward the shop/community when appropriate
- show a Google basemap
- center on selected result
- allow Customer to adjust/confirm a precise pin
- preserve Google Place identity when a named Place is selected
- allow a private-house pin even when no named Google Place exists
- show Open Map / Change Destination actions after confirmation

The in-app map is a destination-selection UI, not turn-by-turn navigation.

## Checkout draft resilience

Checkout must auto-save a short-lived local draft so switching apps/tabs or LIFF reload does not erase entered information.

Draft should preserve, where applicable:

- recipient name/phone
- premises
- locality/admin address
- Rider instructions
- fulfillment/payment/timing selections
- location input
- confirmed destination metadata
- saved-address selection

Draft is restored automatically for the same checkout context and cleared on successful order or explicit reset. Use a reasonable expiry such as 24 hours.

## Cost and security

- Do not expose Worker Places/Routes secrets to the frontend.
- Existing authenticated/rate-limited Worker endpoints remain authoritative for paid server-side operations.
- A browser map key, if required by Maps JavaScript API, must be separate from Worker keys and restricted by approved web origins plus API restriction.
- Selecting/re-rendering a saved or confirmed destination must not repeatedly call Google Routes.
- Route pricing remains authoritative road distance from Google Routes; do not call Haversine road distance.

## Sequencing

P0: reorder checkout to location-first, confirmed-state collapse, and auto-save/restore draft.

P1: in-app Search + Pin using Places + Google basemap, while keeping Google Maps share-link/GPS fallbacks.

Both stages must preserve Ordering Flow V2 and Rider Delivery V3 First-Accept architecture.
