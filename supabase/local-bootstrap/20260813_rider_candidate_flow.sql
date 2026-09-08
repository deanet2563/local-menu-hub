-- MyTree Rider Phase 1 — Nearby Rider Offer candidate flow
-- Proposal only. Validate against the live Supabase schema before production apply.
-- Product invariant: Rider expresses interest; Shop performs final assignment.

CREATE TABLE IF NOT EXISTS public.delivery_candidate_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_id uuid NOT NULL REFERENCES public.sub_orders(sub_id),
  rider_id uuid NOT NULL REFERENCES public.riders(id),
  distance_to_shop_km numeric,
  status text NOT NULL DEFAULT 'interested'
    CHECK (status IN ('interested', 'selected', 'not_selected', 'withdrawn', 'expired')),
  interested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_id, rider_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_candidate_interests_sub_status
  ON public.delivery_candidate_interests (sub_id, status, interested_at);

ALTER TABLE public.delivery_candidate_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS candidate_rider_reads_own ON public.delivery_candidate_interests;
CREATE POLICY candidate_rider_reads_own
  ON public.delivery_candidate_interests
  FOR SELECT TO authenticated
  USING (rider_id = public.fn_my_rider_id());

DROP POLICY IF EXISTS candidate_shop_reads_own_orders ON public.delivery_candidate_interests;
CREATE POLICY candidate_shop_reads_own_orders
  ON public.delivery_candidate_interests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sub_orders so
      JOIN public.shop_staff ss ON ss.shop_id = so.shop_id
      WHERE so.sub_id = delivery_candidate_interests.sub_id
        AND ss.customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
  );

DROP POLICY IF EXISTS candidate_admin_reads_all ON public.delivery_candidate_interests;
CREATE POLICY candidate_admin_reads_all
  ON public.delivery_candidate_interests
  FOR SELECT TO authenticated
  USING (public.fn_is_platform_admin());

REVOKE ALL ON TABLE public.delivery_candidate_interests FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.delivery_candidate_interests FROM authenticated;
GRANT SELECT ON TABLE public.delivery_candidate_interests TO authenticated;
GRANT ALL ON TABLE public.delivery_candidate_interests TO service_role;

-- Discovery intentionally excludes customer delivery address/contact details.
CREATE OR REPLACE FUNCTION public.fn_rider_nearby_delivery_jobs(
  p_radius_km numeric DEFAULT 1
)
RETURNS TABLE (
  sub_id uuid,
  shop_id text,
  shop_name text,
  shop_address text,
  shop_lat numeric,
  shop_lng numeric,
  distance_to_shop_km numeric,
  confirmed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_rider public.riders%ROWTYPE;
  v_radius numeric := LEAST(GREATEST(COALESCE(p_radius_km, 1), 0.1), 5);
BEGIN
  SELECT * INTO v_rider
  FROM public.riders
  WHERE id = public.fn_my_rider_id();

  IF NOT FOUND
     OR NOT v_rider.is_approved
     OR v_rider.is_banned
     OR NOT v_rider.is_online
     OR NOT v_rider.offers_delivery
     OR v_rider.lat IS NULL
     OR v_rider.lng IS NULL
     OR v_rider.location_updated_at IS NULL
     OR v_rider.location_updated_at < now() - interval '15 minutes'
  THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    so.sub_id,
    so.shop_id,
    s.name,
    s.address,
    s.lat,
    s.lng,
    public.fn_haversine_km(s.lat, s.lng, v_rider.lat, v_rider.lng),
    so.confirmed_at
  FROM public.sub_orders so
  JOIN public.shops s ON s.shop_id = so.shop_id
  WHERE so.delivery_status = 'needs_rider'
    AND so.assigned_rider_id IS NULL
    AND s.lat IS NOT NULL
    AND s.lng IS NOT NULL
    AND public.fn_haversine_km(s.lat, s.lng, v_rider.lat, v_rider.lng) <= v_radius
  ORDER BY distance_to_shop_km, so.confirmed_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_rider_express_delivery_interest(
  p_sub_id uuid
)
RETURNS public.delivery_candidate_interests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_rider public.riders%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_shop_id text;
  v_delivery_status public.delivery_status_enum;
  v_assigned_rider_id uuid;
  v_distance numeric;
  v_interest public.delivery_candidate_interests%ROWTYPE;
BEGIN
  SELECT * INTO v_rider
  FROM public.riders
  WHERE id = public.fn_my_rider_id();

  IF NOT FOUND
     OR NOT v_rider.is_approved
     OR v_rider.is_banned
     OR NOT v_rider.is_online
     OR NOT v_rider.offers_delivery
  THEN
    RAISE EXCEPTION 'rider is not eligible for delivery offers';
  END IF;

  IF v_rider.lat IS NULL OR v_rider.lng IS NULL
     OR v_rider.location_updated_at IS NULL
     OR v_rider.location_updated_at < now() - interval '15 minutes'
  THEN
    RAISE EXCEPTION 'fresh rider location is required';
  END IF;

  SELECT shop_id, delivery_status, assigned_rider_id
    INTO v_shop_id, v_delivery_status, v_assigned_rider_id
  FROM public.sub_orders
  WHERE sub_id = p_sub_id;

  IF NOT FOUND
     OR v_delivery_status <> 'needs_rider'
     OR v_assigned_rider_id IS NOT NULL
  THEN
    RAISE EXCEPTION 'delivery is not accepting rider interest';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE shop_id = v_shop_id;
  IF NOT FOUND OR v_shop.lat IS NULL OR v_shop.lng IS NULL THEN
    RAISE EXCEPTION 'shop location is unavailable';
  END IF;

  v_distance := public.fn_haversine_km(v_shop.lat, v_shop.lng, v_rider.lat, v_rider.lng);
  IF v_distance > 5 THEN
    RAISE EXCEPTION 'delivery is outside the rider offer radius';
  END IF;

  INSERT INTO public.delivery_candidate_interests (
    sub_id, rider_id, distance_to_shop_km, status, interested_at, updated_at
  ) VALUES (
    p_sub_id, v_rider.id, v_distance, 'interested', now(), now()
  )
  ON CONFLICT (sub_id, rider_id) DO UPDATE
  SET distance_to_shop_km = EXCLUDED.distance_to_shop_km,
      status = 'interested',
      interested_at = now(),
      updated_at = now()
  WHERE public.delivery_candidate_interests.status <> 'selected'
  RETURNING * INTO v_interest;

  IF v_interest.id IS NULL THEN
    SELECT * INTO v_interest
    FROM public.delivery_candidate_interests
    WHERE sub_id = p_sub_id AND rider_id = v_rider.id;
  END IF;

  RETURN v_interest;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_shop_select_delivery_candidate(
  p_sub_id uuid,
  p_rider_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_shop_id text;
  v_delivery_status public.delivery_status_enum;
  v_assigned_rider_id uuid;
  v_rider public.riders%ROWTYPE;
BEGIN
  SELECT shop_id, delivery_status, assigned_rider_id
    INTO v_shop_id, v_delivery_status, v_assigned_rider_id
  FROM public.sub_orders
  WHERE sub_id = p_sub_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'delivery not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.shop_staff
    WHERE shop_id = v_shop_id
      AND customer_id = (auth.jwt() ->> 'customer_id')::uuid
  ) AND NOT public.fn_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized for this shop';
  END IF;

  IF v_delivery_status <> 'needs_rider' OR v_assigned_rider_id IS NOT NULL THEN
    RAISE EXCEPTION 'delivery is no longer available for assignment';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.delivery_candidate_interests
    WHERE sub_id = p_sub_id
      AND rider_id = p_rider_id
      AND status = 'interested'
  ) THEN
    RAISE EXCEPTION 'rider has not expressed active interest';
  END IF;

  SELECT * INTO v_rider
  FROM public.riders
  WHERE id = p_rider_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT v_rider.is_approved
     OR v_rider.is_banned
     OR NOT v_rider.is_online
     OR NOT v_rider.offers_delivery
     OR v_rider.location_updated_at IS NULL
     OR v_rider.location_updated_at < now() - interval '15 minutes'
  THEN
    RAISE EXCEPTION 'rider is no longer eligible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sub_orders
    WHERE assigned_rider_id = p_rider_id
      AND delivery_status IN ('rider_called', 'picked_up')
  ) THEN
    RAISE EXCEPTION 'rider already has an active delivery';
  END IF;

  UPDATE public.sub_orders
  SET assigned_rider_id = p_rider_id,
      delivery_status = 'rider_called'
  WHERE sub_id = p_sub_id;

  UPDATE public.delivery_candidate_interests
  SET status = CASE WHEN rider_id = p_rider_id THEN 'selected' ELSE 'not_selected' END,
      updated_at = now()
  WHERE sub_id = p_sub_id
    AND status = 'interested';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_rider_nearby_delivery_jobs(numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_rider_express_delivery_interest(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_shop_select_delivery_candidate(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fn_rider_nearby_delivery_jobs(numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_rider_express_delivery_interest(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_shop_select_delivery_candidate(uuid, uuid) TO authenticated, service_role;

COMMENT ON TABLE public.delivery_candidate_interests IS
  'Rider interest is separate from final assignment. Shop final selection is atomic and only one Rider can be assigned.';
