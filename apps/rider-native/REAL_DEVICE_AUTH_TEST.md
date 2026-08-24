# Rider Native Auth — Real Device Gate

Target flow:

1. Build Android preview APK from canonical Rider Native source.
2. Launch MyTree Rider on a physical Android device.
3. Tap `เข้าสู่ระบบด้วย LINE`.
4. Complete LINE Login and return to Rider app without crash.
5. Confirm Rider profile loads or the app clearly reports that no approved Rider profile exists.
6. Confirm `public.app_sessions` creates a non-revoked row with `client_kind = 'rider_native'`.
7. Close and reopen the app; the Rider session must persist without repeating LINE Login.
8. Tap logout; confirm the app returns to signed-out state and the matching server refresh session has `revoked_at` set.
9. Silent refresh must be proven separately before the auth gate is GREEN.

Do not expose refresh tokens or refresh-token hashes during verification.
