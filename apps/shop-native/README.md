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
- Secure storage boundary for the MyTree JWT.
- Supabase client using the existing custom JWT via `accessToken` (no service-role key in the app).
- Owned-shop lookup through existing RLS-protected `shop_staff` data.
- Native Order Inbox.
- Native Order Detail read model based on the same `sub_orders` fields used by the Web shop UI.

## Environment

Copy `.env.example` to `.env` and fill only public app values.

Do not put `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, LINE channel secret, or other server secrets in the native app.

## Local development

```bash
cd apps/shop-native
npm install
npx expo install --fix
npm run typecheck
npx expo start
```

## Next implementation gate

Native authentication must be added before this app can read production shop data. It must preserve MyTree's identity model:

1. Shop signs in with LINE from the native app.
2. Native receives a LINE ID token through an approved OAuth/deep-link flow.
3. The ID token is exchanged through the existing MyTree Worker auth boundary.
4. Worker resolves the same `customer_id` identity and returns a Supabase-compatible JWT.
5. Native stores that JWT in SecureStore and all data access remains governed by existing RLS.

After auth is working, implement the approved MVP actions in this order:

1. Order Inbox + new-order push notification.
2. Order Detail.
3. Accept order.
4. Preparing state.
5. Nearby Rider offer / interested candidates / shop final selection.
6. Completed state.
7. Keep Web shop management as fallback during rollout.

Do not introduce a second shop identity system, client-side service-role access, direct rider auto-assignment, or a parallel backend.
