# Local Supabase bootstrap harness

This directory is local/test-only. Its files are not production migrations and
must not be copied into `supabase/migrations` or applied to a remote project.

## Provenance

- `20260808_remote_schema.sql` is copied from
  `mytree-worker/supabase/baseline/20260808_remote_schema.sql` at commit
  `8e6918a9d1fbe2b3047c0377179cc28f905fb622`.
- `20260813_rider_candidate_flow.sql` is copied from the historical Worker
  migration with the same name. It supplies the Rider candidate tables and
  `fn_rider_nearby_delivery_jobs(numeric)` required by the local-menu Rider
  migrations.

The copies are retained here so local bootstrap does not depend on a sibling
checkout. Their contents must remain byte-for-byte historical copies unless a
new provenance review is approved.

## Command

From the repository root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\local-bootstrap\Bootstrap-Local.ps1
```

The harness creates a disposable local Supabase project, replays the complete
chain, verifies the current schema, runs the canonical Customize backfill
inside a transaction ending in `ROLLBACK`, runs parity and assertions, runs the
rollback/drift rehearsal, then removes the temporary local project and Docker
volumes. It never uses `--linked` and never contacts Production Supabase.

Storage API, Logflare, pg-meta, and Studio are excluded because they are not
required by this database rehearsal and are unhealthy or slow to become ready
in the current Windows Docker environment.
