# Historical MyTree migrations — frozen lineage

Effective 2026-08-21, this directory is **historical only** for production database changes.

Do not add new production migrations here.

The canonical location for all NEW MyTree Supabase/Postgres migrations is:

`deanet2563/mytree-worker/supabase/migrations/`

Existing SQL files in this directory are retained because they document migration history that may already be represented in the live production database. They must not be renamed, copied wholesale into the Worker migration directory, or replayed merely to unify filenames.

Any historical reconciliation must compare both repositories with the live database first. Use forward-only reviewed migrations from the Worker repository for new schema, RPC, RLS, trigger, policy, Delivery V3, audit/KPI, Community Map, and AI Co-worker database work.
