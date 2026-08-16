-- Keep Rider Job V2 visible through the same security boundary as the proven V1 RPC.
-- Production was hot-fixed manually; this migration records the fix for future environments.

alter function public.fn_rider_nearby_delivery_jobs_v2(numeric)
security definer;

alter function public.fn_rider_nearby_delivery_jobs_v2(numeric)
set search_path = public, pg_temp;

grant execute
on function public.fn_rider_nearby_delivery_jobs_v2(numeric)
to authenticated;
