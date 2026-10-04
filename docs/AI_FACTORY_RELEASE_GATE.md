# MyTree AI Factory Release Gate

Use this checklist for every multi-agent release train.

## Gate A — Source and ownership
- [ ] Correct lane owns the change.
- [ ] No overlapping file ownership conflict with another active lane.
- [ ] Canonical Bible/addenda reviewed.
- [ ] Dependencies on other PRs/migrations explicitly listed.

## Gate B — Security and data
- [ ] No auth/RLS/security boundary weakened.
- [ ] No privileged secret exposed client-side.
- [ ] Server remains authoritative for pricing/order/assignment where applicable.
- [ ] DB changes are versioned migrations owned by Backend/DB lane.
- [ ] Destructive data behavior is explicitly justified and reviewed.

## Gate C — CI
- [ ] Type/static checks green.
- [ ] Build green.
- [ ] Unit/contract tests green.
- [ ] Worker dry-run green if applicable.
- [ ] Migration compatibility/preflight green if applicable.
- [ ] Shop CI green if applicable.
- [ ] Rider CI green if applicable.
- [ ] Security/RLS checks green if applicable.

## Gate D — Integration
- [ ] Customer → Shop flow verified for affected paths.
- [ ] Shop → Rider flow verified for affected paths.
- [ ] Rider First Accept remains atomic/race-safe.
- [ ] Feature flags are in the intended safe default state.
- [ ] Backward compatibility/legacy rows considered.

## Gate E — Manual / real device
- [ ] LIFF checkout tested when affected.
- [ ] Shop Native APK tested when affected.
- [ ] Rider Native APK tested when affected.
- [ ] Push/resume/offline/error behavior tested when affected.
- [ ] Camera/location/audio/navigation tested on device when affected.

## Gate F — Release
- [ ] Rollback/disable strategy recorded.
- [ ] QA/Release agent marks the slice `PRODUCTION_READY`.
- [ ] Production deploy/migration is explicitly authorized.
- [ ] Post-deploy smoke check passes.
- [ ] Status changed to `RELEASED` only after production evidence exists.
