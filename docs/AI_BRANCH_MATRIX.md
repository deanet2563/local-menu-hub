# MyTree AI Branch Matrix

Updated: 2026-09-09

| Lane | Repository | Branch / existing PR | Purpose |
|---|---|---|---|
| L0 PM/Factory | local-menu-hub | `codex/ai-software-factory-v1` | Factory rules, ownership, queue, release gates |
| L1 Shop | local-menu-hub | existing PR #76 `codex/shop-native-modern-phase1` | Finish Shop Native Phase 1 |
| L2 Backend/DB current | mytree-worker | existing PR #53 `codex/customer-delivery-pricing` | Current pricing/customize backend hardening |
| L2 Backend/DB next | mytree-worker | `codex/backend-platform` | Future serialized shared backend/DB work after current PR dependency is handled |
| L2 DB coordination mirror | local-menu-hub | `codex/backend-platform` | Migration/docs/integration coordination where repository-local migration ownership requires it |
| L3 Rider | local-menu-hub | `codex/rider-final-pilot` | Rider Native pilot finalization |
| L4 Customer | local-menu-hub | `codex/customer-next` | Multi-store cart and customer Home continuation |
| L5 Community | local-menu-hub | `codex/community-foundation` | Community Thailand foundation |
| L6 AI Ops | local-menu-hub | `codex/aiops-foundation` | AI Co-worker operations foundation |
| L7 QA/Release | local-menu-hub | `codex/qa-release-gates` | Independent QA/security/release verification |

## Important
Do not start new work on an empty “next” branch if an existing open PR already owns the same contract. Finish/reconcile the existing PR first, then rebase or recreate the next branch from the new canonical head.
