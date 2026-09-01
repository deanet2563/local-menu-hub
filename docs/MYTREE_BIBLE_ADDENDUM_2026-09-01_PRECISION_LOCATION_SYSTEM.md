# MyTree Bible Addendum — Precision Location System

**Decision date:** 2026-09-01  
**Status:** APPROVED — Master Plan / Delivery Location Architecture

This addendum records the approved production direction for customer delivery-location capture, Rider destination confidence, road routing and map accuracy. Where this document is more specific than earlier location notes, this later approved decision takes precedence.

---

## 1. Product Objective

MyTree must treat delivery location accuracy as a P0 operational requirement. A delivery destination must not be accepted merely because a parser found a syntactically valid latitude/longitude pair.

The product goal is:

> Customer can confidently confirm the real delivery point, and Rider can confidently navigate to the intended access/drop-off point.

Wrong-but-valid coordinates are more dangerous than a visible validation failure. When authoritative resolution is not available, MyTree must fail closed and ask the customer to confirm or choose the point again.

---

## 2. Five Core Google Maps Platform Services — APPROVED

The MyTree Precision Location System uses five primary Google Maps Platform services, each for a distinct responsibility.

### 2.1 Places API (New) — P0 place identity and official location

Use for:

- Google Maps Share Link fallback when the expanded URL does not expose trustworthy coordinates;
- place/name search;
- Place ID;
- official place location;
- formatted address / display name as needed;
- future autocomplete and place-selection UX;
- future entrance/navigation-point support where available.

A Google Maps document must not be treated as an arbitrary source of coordinates. Generic page-center or unrelated embedded lat/lng values are not authoritative.

### 2.2 Routes API — P0 financial road route

Use for:

- authoritative Shop → Customer road distance;
- route duration;
- delivery-fee calculation;
- TWO_WHEELER routing where appropriate and supported.

This remains subject to the canonical rule:

> **1 Delivery Order = 1 authoritative route calculation**

Customer, Shop, Rider and Admin reuse the same signed quote / order snapshot. Haversine remains non-financial proximity only.

### 2.3 Geocoding API — P1 address ↔ coordinate normalization

Use for:

- forward geocoding of address text when needed;
- reverse geocoding of a customer-confirmed pin;
- normalized human-readable destination context;
- navigation-point token support where available and useful for delivery access.

Geocoding output is supporting context. A customer-confirmed exact delivery pin remains more important than a generic building centroid.

### 2.4 Address Validation API — P1 delivery-address quality

Use for:

- detecting incomplete or low-confidence addresses;
- normalizing address components;
- prompting for missing house/soi/unit/landmark information;
- reducing valid-coordinate-but-unusable-address cases.

Address validation must not silently move a customer-confirmed delivery point.

### 2.5 Roads API — P1/P2 Rider GPS map matching

Use selectively for:

- snapping Rider GPS traces/points to the road network;
- reducing apparent Rider position drift into buildings, canals or adjacent parcels;
- future route-progress quality and operational diagnostics.

Roads API must not overwrite the customer destination. Rider location correction and customer destination authority are separate concerns.

---

## 3. Canonical Destination Model

MyTree must distinguish place identity, customer-selected drop-off point and Rider navigation/access point.

Target domain model:

```text
place_id
place_lat
place_lng

customer_pin_lat
customer_pin_lng

navigation_lat
navigation_lng
navigation_point_token (when supported)

formatted_address
location_source
location_accuracy_m
customer_confirmed_at

building_name
house_number
soi
gate
floor
unit
landmark
delivery_note
```

The same physical destination may therefore have three different useful coordinates:

1. **Place location** — official place/building location from Google Places.
2. **Customer delivery pin** — exact location the customer confirms for handoff.
3. **Navigation/access point** — road-side entrance or vehicle access point for Rider navigation.

They must not be collapsed into one field when the product reaches this stage.

---

## 4. Approved Customer Location Flow

```text
Customer enters destination
        ↓
Google Maps Share Link / place search / address / direct lat,lng / device GPS / future map pin
        ↓
Resolve identity/location using high-confidence URL coordinates or Places API (New)
        ↓
Show destination on map to customer
        ↓
Customer confirms or adjusts exact drop-off pin
        ↓
Reverse Geocode / Address Validation as supporting checks
        ↓
Canonical customer-confirmed destination
        ↓
Server creates ONE authoritative Routes quote
        ↓
Customer sees distance + delivery fee
        ↓
Order consumes signed quote idempotently
        ↓
Destination + route snapshot stored for Shop/Rider/Admin
```

A Google Maps Share Link is a convenience input, not final authority by itself.

---

## 5. Destination Confidence Rules — P0

MyTree must enforce these rules:

- Do not accept arbitrary coordinates scraped from Google Maps HTML.
- Direct `lat,lng` input is accepted only after valid range checking and customer confirmation.
- Google Maps short links may first be expanded server-side on an allowlisted Google host.
- If the URL itself contains high-confidence coordinates, those may be used as the candidate point.
- If a named-place URL has no trustworthy coordinates, use Places API (New) rather than generic HTML coordinate patterns.
- If authoritative resolution still fails, fail closed.
- Always provide a map preview before final order submission for resolved delivery points.
- Customer must be able to change the point before confirming the order.
- GPS accuracy worse than the accepted threshold must show a warning rather than being represented as precise.
- Financial routing begins only after destination confirmation.

---

## 6. Rider Accuracy Strategy

The Rider experience should eventually show more than a bare coordinate pair.

Target Rider destination card:

```text
Customer-confirmed pin
Place/building name
Formatted address
Gate / entrance / landmark / delivery note
Road distance snapshot
Delivery fee snapshot
Open navigation
```

Future Rider navigation architecture may use Google Navigation SDK for Android/iOS. Where Google provides entrance/navigation-point tokens, MyTree may route the Rider to the best road-side access point while preserving the customer-confirmed handoff point separately.

Passenger transport remains outside the approved scope.

---

## 7. Community Entrance Intelligence

For dense local communities such as Sammakorn Village, MyTree may build first-party community access intelligence that complements Google data.

Examples:

- village gates;
- internal soi entrances;
- market loading/pickup points;
- clubhouse/community landmarks;
- known merchant pickup entrances;
- verified building/lobby/drop-off notes.

Google-derived data remains subject to Google policies. MyTree-owned or community-verified access notes may become a durable local operations asset.

---

## 8. Cost and Security Controls

- Google API keys remain server-side where possible.
- Use separate restricted keys/secrets by service when operationally useful.
- Restrict each key to only the APIs it needs.
- Add quotas and billing alerts before production scale.
- Use field masks to request only needed Places fields.
- Places fallback should run only when high-confidence coordinates are not already available.
- Routes calculations remain authenticated/rate-limited and one-authoritative-calculation-per-delivery.
- Customer/Rider refreshes must not trigger repeated paid route calculations.

Recommended Worker secrets:

```text
GOOGLE_MAPS_ROUTES_API_KEY
GOOGLE_MAPS_PLACES_API_KEY
```

Additional service keys may be introduced when Geocoding, Address Validation and Roads integrations become active.

---

## 9. Delivery Sequence

### P0 — Now

- Places API (New) enabled.
- Routes API enabled.
- Replace unreliable generic Google Maps HTML coordinate fallback with Places API (New).
- Keep fail-closed destination validation.
- Preserve customer map-preview confirmation.
- Preserve signed one-route-per-order quote lifecycle.

### P1 — Next

- Map pin picker / draggable exact drop-off point.
- Place name + formatted address shown during confirmation.
- Geocoding / reverse geocoding.
- Address Validation API.
- Expanded destination schema for place/customer-pin/navigation access separation.
- Rider destination card with entrance/landmark context.

### P2 — After core delivery E2E is stable

- Roads API Rider map matching.
- navigation/access-point intelligence.
- Navigation SDK evaluation/integration.
- community entrance intelligence and verified local access data.

---

## 10. Non-Negotiable Principle

> **MyTree must never prefer a guessed destination over an explicit validation failure.**

A Rider sent to the wrong location creates direct customer dissatisfaction, Rider wasted time, incorrect fee/ETA data and operational distrust. Precision location is therefore part of the core delivery transaction, not cosmetic map UX.
