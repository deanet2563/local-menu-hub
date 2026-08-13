# MyTree Rider Native

MyTree-owned React Native + Expo application for food-delivery riders.

## Product scope — Phase 1

- Food delivery only. No passenger transport. No errand service.
- All approved riders are Free-tier eligible in Phase 1.
- Native push notification is a critical capability for nearby-job offers and assignment changes.
- Rider expresses **interest** in a nearby job; the shop remains the final rider selector.
- Delivery money is paid directly between the relevant parties. MyTree does not operate a rider wallet in Phase 1.
- Proof of Delivery stays inside MyTree.

## Ownership approach

This app is **not a fork of Enatega**.

Enatega was audited as a reference implementation. MyTree code is being implemented independently and uses standard open-source packages from the React Native / Expo ecosystem. Do not copy Enatega application code into this directory without a separate license and provenance review.

Target:

- 80–90% MyTree-owned application/business code.
- 10–20% standard open-source libraries/patterns.

## Current technology baseline

- Expo SDK 57
- React Native 0.86
- React 19.2.3
- Expo Router
- Expo Notifications
- Expo Location
- Expo SecureStore
- Expo Image Picker
- React Native Maps

Install Expo-managed native packages using:

```bash
npm run setup:native-deps
```

Expo should choose package versions compatible with the selected SDK.

## Planned Phase 1 screens

1. Readiness / onboarding
2. Nearby jobs
3. Job detail
4. Assigned delivery
5. Pickup
6. Delivery / Proof of Delivery
7. Delivery history
8. Rider profile

## Planned runtime flow

```text
Approved rider
  -> Native app readiness (push + location)
  -> Online
  -> Nearby-job push
  -> View job
  -> Interested
  -> Shop selects rider
  -> Assignment push
  -> Navigate to shop
  -> Pickup
  -> Navigate to customer
  -> Proof of Delivery
  -> Delivered
  -> History
```

## Backend boundary

The native application must integrate with the existing MyTree backend and data model. It must not introduce Enatega GraphQL/API dependencies.

Security-sensitive decisions stay server-side:

- rider approval / suspension
- nearby-job eligibility
- candidate interest validation
- final assignment locking
- delivery status transition validation
- proof metadata validation
- future Premium entitlements

## Secrets

Never commit service-role keys, private API keys, signing credentials, push-provider private keys, or other privileged secrets to the mobile app.

Mobile clients are untrusted. Supabase RLS and/or MyTree Worker endpoints must enforce authorization server-side.
