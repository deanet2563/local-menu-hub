---
name: mytree-security-review
description: Use for security review of MyTree auth, sessions, JWTs, RLS, SECURITY DEFINER functions, triggers, API/Worker routes, secrets, storage policies, admin functions, native credentials, dependency risk, or pre-merge review of security-sensitive changes.
---

# MyTree Security Review

## Review stance

Preserve defense in depth. A UI check is never a substitute for backend authorization, RLS, DB guards, or atomic state validation.

## Mandatory checks

Review as applicable:

- identity anchor remains `customer_id`;
- authentication and authorization are separated;
- short-lived access credentials and revocable sessions are preserved;
- logout/revoke behavior cannot be bypassed by stale client state;
- service-role/admin credentials never enter browser/native bundles;
- Worker/API endpoints authenticate before privileged actions;
- server-side pricing/business validation does not trust client values;
- RLS SELECT/INSERT/UPDATE/DELETE visibility matches intended actors;
- SECURITY DEFINER functions use narrow purpose and safe `search_path`;
- no RLS recursion is introduced;
- trigger ordering and guard behavior remain correct;
- admin bypass GUC is scoped and not accidentally reachable by clients;
- storage upload/update policies match owner/role boundaries;
- delivery assignment/state transitions remain atomic;
- cancellation/history/audit evidence is retained;
- secrets are not committed, logged, or copied into issue/PR text.

## Threat paths to test

At minimum consider unauthorized customer, other Shop staff, unassigned Rider, banned/revoked actor, stale token/session, replay/double-submit, concurrent Rider accept, direct API/RPC call bypassing UI, malicious file path/upload, and privilege escalation through admin/helper functions.

## Change discipline

- Never fix a failing path by weakening RLS/guards broadly.
- Prefer a narrow authorized RPC/helper over cross-table client access.
- For function signature changes, inspect/drop obsolete overloads deliberately.
- For UPDATE problems, verify SELECT visibility before blaming triggers.
- Treat auth, assignment, payment, and admin changes as high-risk even when diff size is small.

## Completion report

Return findings by severity, affected object/path, exploit or failure condition, minimal safe remediation, tests performed, and residual risk. If no issue is found, state the scope actually inspected rather than claiming the system is fully secure.