# MyTree AI Software Factory v1

Approved: 2026-09-09

## Mission
Build and operate MyTree Community Thailand with a small human team and a coordinated network of AI development and operations agents. Parallelism is encouraged only where ownership boundaries and release gates make the work safe.

## Development topology

```text
Owner / Product Decision
        ↓
ChatGPT — Product Architect / PM
        ↓
Task Router / Canonical Queue
        ↓
┌──────────┬────────┬────────┬──────────┬───────────┬──────────┐
Customer   Shop     Rider    Backend/DB Community   AI Ops
Codex      Codex    Codex    Codex      Codex       Codex
└──────────┴────────┴────────┴──────────┴───────────┴──────────┘
        ↓
QA / Security / Integration Agent
        ↓
CI + Staging + Real-device gates
        ↓
Production
```

## Roles

### AI-0 Product Architect / PM
Owns product architecture, priority, source-of-truth reconciliation, task boundaries, cross-lane dependencies, acceptance criteria, and final release recommendation. Does not silently redefine approved flows.

### AI-1 Customer Engineer
Owns customer web/LIFF UX including Home, browse/search/filter, cart, checkout, customer orders, reviews, points/favorites/history/notifications, and future Community entry surfaces.

### AI-2 Shop Engineer
Owns Shop Native UX and merchant operations. Current near-term objective is production readiness of Shop Native Phase 1 and its paired backend contracts.

### AI-3 Rider Engineer
Owns Rider Native UX and the client side of Rider Delivery V3. Current near-term objective is final real-device-safe offer/audio/push/pickup/delivery/history behavior while preserving atomic first accept.

### AI-4 Backend / Database Engineer
Sole owner for shared server contracts, Worker changes, Supabase migrations, RLS, SECURITY DEFINER functions, triggers, pricing authority, event contracts, and production schema sequencing.

### AI-5 Community Engineer
Owns community feed, neighborhood identity, groups, posts, events, lost/found, alerts, marketplace, local services, and the Community Map product layer. Must not invent auth/moderation/storage rules independently of Backend/DB and AI Ops.

### AI-6 AI Operations Engineer
Owns the 24/7 AI Co-worker platform: event bus/orchestrator, agent registry, policy engine, confidence thresholds, audit trail, exception queue, kill switches, model routing, and specialist agents for support/moderation/fraud/security/data/reliability/CRM/growth.

### AI-7 QA / Security / Release Agent
Independent reviewer. Owns cross-lane regression, CI interpretation, security review, migration compatibility, staging verification, native/LIFF release gates, and release checklists. Avoids normal feature ownership.

## Workstream ownership matrix

| Domain | Primary owner | Secondary/reviewer | Production DB write? |
|---|---|---|---|
| Customer LIFF/Web | Customer | QA | No |
| Shop Native | Shop | QA | No |
| Rider Native | Rider | QA | No |
| Worker/API | Backend/DB | QA/Security | Yes, via reviewed deployment |
| Supabase schema/RLS | Backend/DB | QA/Security | Yes, single owner |
| Community UX | Community | Customer/QA | No |
| Community shared schema | Backend/DB | Community/AI Ops | Yes, via migration |
| AI Orchestrator/agents | AI Ops | Backend/DB/QA | Shared contracts only |
| CI/release | QA/Release | relevant lane | No feature ownership |

## Branch and worktree policy

Naming convention:

- `codex/customer-<task>`
- `codex/shop-<task>`
- `codex/rider-<task>`
- `codex/backend-<task>`
- `codex/community-<task>`
- `codex/aiops-<task>`
- `codex/qa-<task>`

Rules:
1. One task, one branch/worktree.
2. Start from the current canonical base unless a task explicitly depends on another open branch.
3. If a feature depends on another PR, state the dependency and do not duplicate the other PR's changes.
4. Avoid long-lived integration branches except a deliberate release train.
5. No direct commits to the canonical branch for non-trivial work.

## Database and API change protocol

1. Feature agent writes a schema/API request in its issue/PR.
2. Backend/DB agent reviews ownership, compatibility, RLS, migration order, rollback, and existing live schema.
3. Backend/DB agent implements the migration/server contract in its own branch.
4. Feature agent consumes the contract after it is stable or behind a feature flag.
5. QA validates migration, RLS, API compatibility, and dependent UI.
6. Production application happens only after the release gate.

No feature lane independently runs production SQL.

## Merge policy

### Required before merge
- focused PR with explicit scope/non-goals,
- no unresolved canonical-rule conflict,
- all applicable CI checks green,
- no known RLS/auth/pricing/assignment regression,
- paired migration/backend dependency accounted for,
- QA/security review for high-risk changes,
- real-device gate recorded when the change affects native auth, push, location, delivery, camera/proof, audio, or LIFF checkout.

### Preferred merge method
Use squash for focused feature PRs unless preserving a multi-commit history is materially useful. Do not auto-merge high-risk backend/auth/payment/RLS/delivery changes merely because CI is green.

## CI gates

Minimum factory gate set:
1. TypeScript/static type checks
2. Build
3. Unit/contract tests
4. Worker `wrangler deploy --dry-run`
5. Migration syntax/compatibility checks
6. RLS/privilege/security checks
7. Rider V3 atomic assignment/state-machine checks
8. Shop Native CI
9. Rider Native CI
10. Cross-flow regression (Customer → Shop → Rider → Delivered)
11. Feature-flag/default-state check for incomplete integrations
12. Staging/preview verification
13. Real-device/LIFF/APK verification where applicable

## Parallelism rules

Safe to run concurrently when ownership is separated:
- Customer Home/Cart work
- Shop Native work
- Rider Native work
- Community foundation UX/spec work
- AI Ops foundation/spec/event-contract work
- QA/review work

Serialize or tightly coordinate:
- production Supabase migrations,
- shared order/delivery state-machine changes,
- auth/session changes,
- pricing/payment authority changes,
- shared event schema changes,
- changes to canonical Rider assignment semantics.

## AI-first operations target

Operational architecture should evolve toward:

```text
Platform Event
   ↓
Event Bus
   ↓
AI Operations Orchestrator
   ↓
Specialist Agent
   ↓
Policy / Risk / Confidence Gate
   ├─ Auto-act (low risk)
   ├─ Suggest only
   └─ Human Exception Queue (high risk)
   ↓
Audit Log + Metrics + Kill Switch
```

Initial specialist areas:
- Customer support
- Merchant support
- Rider support
- Community moderation
- Fraud/abuse detection
- Trust & Safety
- Listing/data quality
- Community Map enrichment
- Recommendation/ranking monitoring
- Ads operations
- CRM/retention
- Finance/reconciliation monitoring
- Security/SOC monitoring
- System reliability
- Growth/experiment monitoring
- Local business/supplier intelligence

## Human-required classes
Human review remains required for high-risk or legally sensitive actions such as permanent trust/safety sanctions when policy requires review, legal complaints, physical identity/document verification, serious disputes, destructive data operations, and major production incident decisions.

## Factory success metrics
Track over time:
- lead time from issue → merged PR,
- PR rework rate,
- CI failure rate,
- production regression rate,
- percent of tasks completed without human code intervention,
- percent of operational events handled automatically,
- exception rate sent to humans,
- mean time to detect/recover from incidents,
- cost per automated operational event.
