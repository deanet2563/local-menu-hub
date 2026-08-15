# MyTree Rider — Native LINE Login Integration Plan

Decision date: 2026-08-13

## Decision

MyTree Rider will integrate LINE Login through a **MyTree-owned local Expo native module** that wraps LINE's official platform SDKs:

- iOS: official LINE SDK for iOS Swift
- Android: official LINE SDK for Android

We will not make a third-party React Native LINE wrapper a core authentication dependency.

## Why

1. LINE's current native SDK catalog provides official iOS, Android, Unity, and Flutter SDKs, but not an official React Native SDK.
2. Expo recommends local Expo Modules for app-specific Swift/Kotlin native code.
3. A thin MyTree-owned bridge minimizes third-party dependency, supply-chain, and ownership risk.
4. The LINE SDK should only perform LINE authentication and return an OpenID Connect ID token. MyTree identity/session authority remains the existing Worker `/auth/line` broker and Supabase JWT/RLS model.

## Native flow

```text
MyTree Rider
  -> MyTree local native module
  -> Official LINE SDK (iOS / Android)
  -> LINE Login with OpenID Connect scope
  -> LINE ID token
  -> MyTree Worker POST /auth/line
  -> verify token server-side with LINE
  -> resolve existing MyTree customer_id
  -> issue short-lived Supabase JWT
  -> store Rider session in SecureStore
  -> load Rider profile through RLS
```

## Native module boundary

The JavaScript interface should remain deliberately small:

```ts
type LineLoginResult = {
  idToken: string;
};

login(): Promise<LineLoginResult>
logout(): Promise<void>
```

Do not expose LINE access tokens to unrelated application modules unless a future requirement explicitly needs them.

## Configuration boundary

Public/mobile configuration may include:

- LINE Login channel ID
- Android package: `cc.mytree.rider`
- iOS bundle ID: `cc.mytree.rider`

Never commit:

- channel secret
- Supabase service-role key
- app signing private keys
- APNs private key
- Google service-account private key

## User/account-owner gate

Do not ask the owner to configure LINE Developers until the app CI is green and the native bridge scaffold is ready.

At that gate, the account owner will need to configure the native app/package identifiers in the existing LINE Login channel and provide/confirm only the public channel configuration required by the app. Private channel secrets remain server-side.

## Validation gate

Before merge/release:

1. Android real-device LINE installed -> app-to-app login
2. Android no LINE installed -> browser fallback
3. iOS real-device LINE installed -> app-to-app login
4. iOS no LINE installed -> browser fallback
5. ID token accepted by existing MyTree `/auth/line`
6. wrong audience / expired token rejected server-side
7. Rider resolves to the same existing `customer_id` used by LINE/LIFF web
8. session stored only in SecureStore
9. logout removes local session and disables Rider push device registration
