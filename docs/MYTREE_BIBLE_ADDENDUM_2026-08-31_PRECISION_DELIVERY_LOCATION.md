# MyTree.cc Bible Addendum — Precision Delivery Location Core

**Approved:** 2026-08-31  
**Applies to:** Customer checkout + Rider Delivery V3  
**Priority:** P0 / delivery reliability foundation

## Canonical decision

MyTree delivery must use a **customer-confirmed destination pin** as the delivery source of truth. Device GPS is not assumed to be the destination and is only one optional input method.

Accepted destination inputs:

1. Google Maps share URL (`maps.app.goo.gl` / Google Maps URL)
2. explicit `latitude, longitude`
3. MyTree map pin picker
4. device GPS as an optional suggestion

Every input must normalize to canonical `delivery_destination_lat/lng` before the order is created. Customer must be shown the normalized point and explicitly confirm it.

## Accuracy rule

Device `accuracy_m` is metadata only. Poor GPS accuracy (for example ~100 m) must generate a warning and encourage Google Maps URL / pin confirmation. It must not be presented as a precise delivery destination.

## Rider decision context before First Accept

An eligible Rider may see before accepting:

- Shop pickup point
- Customer delivery destination/address
- Rider -> Shop distance
- Shop -> Customer route distance
- delivery fee

Customer name and phone remain hidden until the Rider wins Atomic First Accept.

## Delivery fee baseline

Current approved baseline: **10 THB/km from Shop -> Customer**.

Long-term authoritative calculation:

`Shop confirmed pin -> Customer confirmed pin -> road route -> 10 THB/km`

Google Routes API `TWO_WHEELER` is the preferred routing provider. Route distance, duration, provider and fee must be snapshotted on the order so Customer, Shop and Rider see the same authoritative quote.

Haversine may remain only as a clearly-labelled rollout/debug fallback. It is not the long-term pricing authority.

## Security

Google short-link expansion must happen server-side against a strict allowlist of Google Maps hosts. Do not create a generic URL fetch endpoint (SSRF risk).

## Regression guards

This work must not weaken or replace:

- Ordering Flow V2 atomic order creation
- Rider Delivery V3 First Accept / Atomic Auto Lock
- RLS and DB guards
- customer identity / Shop / Rider session architecture
