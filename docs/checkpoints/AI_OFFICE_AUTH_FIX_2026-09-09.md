# AI Office auth fix checkpoint — 2026-09-09

Observed on real Android LINE opening the deployed AI Office URL: the page rendered `ต้องเข้าสู่ระบบ LINE` instead of establishing the existing LINE session.

Fix scope:
- AI Office only may actively establish/continue LIFF login.
- Customer raw preview behavior remains unchanged.
- No RLS/admin authorization weakening; `platform_admins` remains required after auth.
