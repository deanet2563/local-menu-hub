# Community Emergency & Early Warning — Domain Contract

Status: foundation contract for the 2026-09-28 approved Bible addendum.

## Provenance
Every safety signal must declare one source class: `official`, `forecast`, or `community-report`. UI must never collapse these into one truth state.

## Incident
Required identity: incident_id, community_id, reporter_customer_id, category, severity, status, created_at, updated_at.

Location is split into private exact coordinates and public display coordinates/precision. Public payloads must never expose private coordinates by inference or serialization.

Initial categories: medical, flood, fire, accident, road-obstruction, utility-infrastructure, missing-person, evacuation-rescue, supplies, other.

Need tags are multi-select and extensible: medical-help, rescue, evacuation, transport, food, drinking-water, medicine, power, shelter, volunteers, other.

Road impact: unknown | passable | difficult | closed.

Status: reported | verifying | coordinating | help-en-route | assisted | resolved | closed | duplicate | invalid.

## Evidence and timeline
Incident creation and every later update are immutable timeline events. Photos/evidence are separate records linked to an incident/update. Verification, duplicate linkage, road-impact changes and status changes create events; they do not rewrite historical evidence.

## Forecast / risk
Required identity: risk_id, provenance, community_id/area reference, hazard, window_start, window_end, level, confidence/quality metadata, source references, generated_at, updated_at, expires_at.

Presentation levels: advisory | watch | warning | emergency. A level alone does not imply official authority; provenance is always displayed alongside it.

A forecast expires. Expired forecasts must not remain active merely because no replacement arrived.

## Response points
Community response points are scoped to a community and may contain public contact channels, operating state and approximate/exact location according to policy. Official emergency contacts and community/volunteer contacts are different contact types.

## Permissions
Residents may create reports within allowed community/public reporting policy. Reporter access to sensitive details, community moderator access, responder access and Head Office access are separate scopes. Cross-community reads are deny-by-default except explicitly approved nearby/public safety projections.

## AI boundary
AI receives minimum necessary data. It may classify/summarize and draft preparation guidance. It cannot create authoritative source observations, declare a road safe, issue an official evacuation order, expose private coordinates, or perform privileged incident lifecycle actions without the relevant deterministic permission/tool gate.

## Map/routing contract
Google remains the geographic/traffic/navigation provider. MyTree adds incident/risk/road-impact overlays. Route handoff may avoid reported closures where routing support permits, but UI must show freshness and verification and must not promise safety.

## Notification contract
Warnings are deduplicated by risk/incident identity + material change. Notifications include community/area, hazard/incident, level, provenance, freshness/window and one clear action. Emergency presentation is reserved for official emergency alerts or confirmed active incidents under the approved escalation rules.


## Customer staging trigger — 2026-09-28
Cloudflare Pages Preview is configured with `mytree-staging` public Supabase credentials and `VITE_MYTREE_WORKER_URL` pointing to the isolated staging Worker. This documentation-only commit triggers Preview deployment only; it does not authorize a Production deployment or merge.


## Customer staging retrigger — 2026-09-28
Cloudflare Git access was re-authorized. This documentation-only commit retriggers the Emergency Preview deployment from the staging feature branch; Production branch/configuration remains unchanged.

## Emergency UX v2 — Location-first reporting and accountability

Approved 2026-09-28.

Emergency reporting is location-first, not membership-first. An authenticated MyTree user may report an incident they encounter even when they are not an active member of the detected community. Community membership is a trust/verification signal, not a reporting gate.

The client requests device location on Emergency entry and resolves the best available MyTree coverage area automatically. When the point is outside configured MyTree coverage, reporting remains allowed with no community_id; the incident keeps private exact coordinates and a public-safe approximate location. Current staging coverage uses an explicit radius fallback; production-grade community polygons/boundaries may replace that resolver later without changing the reporting contract.

After the reporter selects incident type and at least one need, the UI surfaces verified emergency call actions before MyTree submission. Safety-critical phone numbers come from a reviewed registry with source provenance and verification timestamps. Generative AI may classify/rank which verified contacts are most relevant, but must never invent, rewrite, or hallucinate an emergency phone number.

Initial verified registry includes national medical emergency 1669, police emergency 191, DDPM 1784, and Bangkok fire emergency 199 when the detected area is Bangkok. Contact scope is location-aware and may later include verified community response centers.

Emergency abuse controls are identity-bound and audited. Every report remains attributable to the authenticated customer/session. Automatic protection includes a short-window submission rate limit. Privileged operators may issue a warning, temporary reporting restriction, or indefinite MyTree Emergency ban only with a reason code and free-text reason; every enforcement action is written to the incident timeline and admin audit log. Permanent/indefinite enforcement requires a human privileged action; AI may flag suspicious patterns but does not autonomously ban a user.

The reporter UI must disclose that deliberately false reports, prank submissions, or spam may result in warning, restriction, or Emergency ban. This notice must not block or materially slow legitimate emergency reporting.
