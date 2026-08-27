---
name: mytree-native-release
description: Use for MyTree Shop/Rider Expo native apps, EAS builds, Android APKs, Expo Doctor, dependency/lockfile problems, CI, LINE native login, SecureStore sessions, push readiness, location readiness, and real-device release gates.
---

# MyTree Native Release

## Release discipline

Use `Inspect -> Fix -> Branch -> PR -> CI -> Merge -> Build -> Real-device test`.

Do not declare a native slice GREEN because TypeScript or CI passes. Auth, push, location, persistence, and delivery behavior that depends on native runtime must pass the documented physical-device gate.

## Dependency and EAS rules

- Keep `package.json` and committed lockfile synchronized.
- Prefer deterministic EAS installs using the committed lockfile.
- After changing Expo/React Native dependencies, run the package manager install/check plus `expo-doctor` before building.
- Do not use `npm audit fix --force` as an automatic response to audit warnings.
- Separate warnings from blockers; fix the exact failing gate first.
- Keep public Expo environment values distinct from secrets; never place service-role/private credentials in the app.

## Rider auth gate

Before Rider Auth is GREEN, prove all applicable items:

1. Native LINE Login completes and returns to app.
2. Rider profile or approved-state handling is correct.
3. Server session exists with `client_kind = 'rider_native'` and is not revoked.
4. Kill/reopen restores session without LINE Login.
5. Explicit logout returns to signed-out state and sets matching server `revoked_at`.
6. Silent refresh is independently proven.
7. Push readiness succeeds on physical device.
8. Foreground location readiness succeeds on physical device.
9. Online/offline state sync is verified against backend truth when that slice is active.

## Shop auth gate

Apply the same persistent-session principles using `client_kind = 'shop_native'` and verify revoke/silent-refresh behavior independently.

## UI/build regression checklist

- Small Android viewport remains usable and scrollable.
- Loading/error/offline/permission-denied states remain reachable.
- Push and location permission denial does not trap the user.
- Existing Ordering Flow and Delivery V3 behavior is unchanged unless intentionally modified.

## Completion report

Include:

- source commit used for build,
- CI result,
- EAS Build ID/link if available,
- physical-device PASS/FAIL matrix,
- exact remaining gate before GREEN.
