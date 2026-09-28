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
