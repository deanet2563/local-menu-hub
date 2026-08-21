# MyTree Shop Native

React Native + Expo merchant app for MyTree.

## Approved role split

- Customer: LINE / LIFF Web remains the primary Phase-1 surface.
- Shop: Native app, with the existing Web shop UI retained as fallback.
- Rider: Native app.
- Backend and data source remain shared: Cloudflare Worker + Supabase/Postgres/RLS.

## Foundation implemented in this branch

- Expo Router native shell.
- MyTree Shop application identity (`cc.mytree.shop`).
- Secure `ShopSession` storage in Expo SecureStore.
- Supabase client using the existing MyTree custom JWT via `accessToken`; no service-role key exists in the app.
- Owned-shop lookup through existing RLS-protected `shop_staff` data.
- Native Order Inbox.
- Native Order Detail read model based on the same `sub_orders` fields used by the Web shop UI.
- MyTree-owned local Expo module `MyTreeLineLogin` wrapping the official LINE SDKs for iOS and Android.
- Native LINE OpenID login returns only the raw ID token to JavaScript.
- Raw LINE ID token is sent to the existing Worker `POST /auth/line` broker.
- Worker remains the identity authority: it verifies LINE, resolves the same `customer_id`, and returns the existing Supabase-compatible JWT.
- CI validates TypeScript, Expo Doctor, and Android prebuild generation.

## Security boundary

The native app may contain only public configuration such as the LINE Login channel ID, app bundle/package IDs, Worker URL, Supabase URL, and Supabase anon key.

Never put `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, LINE channel secret, app signing keys, APNs keys, or Google service-account keys in the app.

## Environment

Copy `.env.example` to `.env` and fill only public app values.

## Local development

Native LINE Login requires a development build; Expo Go cannot load the custom Swift/Kotlin module.

```bash
cd apps/shop-native
npm install
npx expo install --fix
npm run typecheck
npm run doctor
npx expo prebuild --clean
npm run android
# On macOS: npm run ios
```

## LINE Developers account-owner gate

Before real-device LINE Login can pass, the existing LINE Login channel must have Mobile app configuration for MyTree Shop:

- LINE Login channel ID: `2010936243`
- Android package name: `cc.mytree.shop`
- iOS bundle ID: `cc.mytree.shop`
- Android package signature(s): recommended for debug/release builds
- iOS universal link: recommended hardening after the first login smoke test

The LINE channel secret remains server-side and is not required by the native app.

## Auth flow

```text
MyTree Shop
  -> MyTreeLineLogin local Expo module
  -> official LINE iOS / Android SDK
  -> OpenID ID token
  -> POST MyTree Worker /auth/line
  -> verify LINE token
  -> resolve existing customer_id
  -> issue short-lived MyTree/Supabase JWT
  -> SecureStore ShopSession
  -> Supabase RLS
  -> owned shop + order inbox
```

## Next implementation gate after real-device auth

1. New-order Expo push notification.
2. Accept order.
3. Preparing state.
4. Nearby Rider offer / interested candidates / shop final selection.
5. Completed state.
6. Keep Web shop management as fallback during rollout.

Do not introduce a second shop identity system, client-side service-role access, direct rider auto-assignment, or a parallel backend.
