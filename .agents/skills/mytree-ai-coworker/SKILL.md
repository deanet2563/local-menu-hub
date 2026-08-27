---
name: mytree-ai-coworker
description: Use for MyTree AI Co-worker architecture, AI Gateway/Orchestrator, model routing, rules-vs-model decisions, agent permissions, automation, cost controls, privacy, evaluation, or any AI feature that can act on MyTree data or workflows.
---

# MyTree AI Co-worker

## Architecture boundary

AI assists MyTree; it is not the source of truth for deterministic business state.

Preferred routing model:

`MyTree -> AI Gateway/Orchestrator -> Rules/SQL | routine/self-hosted model | economical hosted model | advanced reasoning/coding model`

Use the current Bible for the approved provider/model choices. Do not hard-code a provider assumption from this skill.

## Non-negotiable rules

- Deterministic authorization, pricing, assignment, order state, payment state, RLS, and security decisions stay in Rules/SQL/backend logic.
- AI must not bypass RLS, service boundaries, approval gates, or audit requirements.
- Give each AI worker least-privilege tools and data access.
- Separate read, draft/recommend, and write/execute permissions.
- High-impact writes require explicit guardrails and, where defined by the Bible, human approval.
- Never expose secrets, service-role keys, refresh credentials, or unnecessary personal data to model context.
- Prefer structured outputs and validation before executing downstream actions.
- Keep cost/latency routing observable and reversible.

## Design workflow

1. Read the Bible and latest AI Co-worker addendum.
2. Classify the task: deterministic rule, retrieval/research, generation, reasoning, coding, or autonomous action.
3. Define allowed tools/data and prohibited actions.
4. Define success metric, failure mode, fallback, timeout/retry, and cost ceiling where relevant.
5. Keep model/provider choice behind the orchestrator when practical.
6. Add evaluation cases before granting write capability.
7. Log enough for audit/debugging without logging secrets or sensitive payloads unnecessarily.

## Stop conditions

Stop if an AI proposal would become the authoritative security/business rule, if permissions are broader than needed, if output is executed without validation, or if failure could silently corrupt orders/payments/delivery state.

## Completion report

State task class, chosen execution layer, permissions, validation/fallback, cost/privacy implications, evaluation evidence, and any human gate.