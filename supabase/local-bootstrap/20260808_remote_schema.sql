


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."admin_role_enum" AS ENUM (
    'super_admin',
    'support'
);


ALTER TYPE "public"."admin_role_enum" OWNER TO "postgres";


CREATE TYPE "public"."delivery_status_enum" AS ENUM (
    'not_needed',
    'needs_rider',
    'rider_called',
    'picked_up',
    'delivered',
    'failed'
);


ALTER TYPE "public"."delivery_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."fulfillment_type_enum" AS ENUM (
    'pickup',
    'delivery'
);


ALTER TYPE "public"."fulfillment_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."hub_order_status_enum" AS ENUM (
    'pending',
    'partially_confirmed',
    'confirmed',
    'preparing',
    'completed',
    'partially_cancelled',
    'cancelled'
);


ALTER TYPE "public"."hub_order_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."identity_provider_enum" AS ENUM (
    'line',
    'email',
    'phone_otp'
);


ALTER TYPE "public"."identity_provider_enum" OWNER TO "postgres";


CREATE TYPE "public"."listing_type_enum" AS ENUM (
    'free_rotation',
    'fixed_top'
);


ALTER TYPE "public"."listing_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."order_status_enum" AS ENUM (
    'pending',
    'confirmed',
    'preparing',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."order_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."payment_method_enum" AS ENUM (
    'cash',
    'qr_transfer'
);


ALTER TYPE "public"."payment_method_enum" OWNER TO "postgres";


CREATE TYPE "public"."payment_status_enum" AS ENUM (
    'unpaid',
    'pending',
    'paid',
    'refunded',
    'void'
);


ALTER TYPE "public"."payment_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."print_status_enum" AS ENUM (
    'not_printed',
    'printed',
    'reprinted'
);


ALTER TYPE "public"."print_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."rider_class_enum" AS ENUM (
    'public_win',
    'general'
);


ALTER TYPE "public"."rider_class_enum" OWNER TO "postgres";


CREATE TYPE "public"."sender_type_enum" AS ENUM (
    'customer',
    'shop',
    'system'
);


ALTER TYPE "public"."sender_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."staff_role_enum" AS ENUM (
    'owner',
    'staff'
);


ALTER TYPE "public"."staff_role_enum" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status_enum" AS ENUM (
    'paid',
    'failed',
    'refunded'
);


ALTER TYPE "public"."subscription_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."subscription_tier_enum" AS ENUM (
    'premium',
    'premium_fixed_top',
    'premium_lalamove'
);


ALTER TYPE "public"."subscription_tier_enum" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."riders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "vehicle_type" "text",
    "lat" numeric,
    "lng" numeric,
    "location_updated_at" timestamp with time zone,
    "is_online" boolean DEFAULT false NOT NULL,
    "is_approved" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "rider_class" "public"."rider_class_enum" DEFAULT 'public_win'::"public"."rider_class_enum" NOT NULL,
    "offers_delivery" boolean DEFAULT true NOT NULL,
    "offers_errand" boolean DEFAULT false NOT NULL,
    "offers_passenger" boolean DEFAULT false NOT NULL,
    "plate_number" "text",
    "win_registration_no" "text",
    "win_zone" "text",
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "is_banned" boolean DEFAULT false NOT NULL,
    "banned_reason" "text",
    "banned_at" timestamp with time zone,
    "banned_by" "uuid",
    "deletion_requested_at" timestamp with time zone,
    "deletion_reason" "text",
    CONSTRAINT "chk_passenger_requires_verified_win" CHECK ((("offers_passenger" = false) OR (("rider_class" = 'public_win'::"public"."rider_class_enum") AND ("verified_at" IS NOT NULL) AND ("plate_number" IS NOT NULL) AND ("win_registration_no" IS NOT NULL))))
);


ALTER TABLE "public"."riders" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_approve_rider"("p_rider_id" "uuid") RETURNS "public"."riders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_row riders;
BEGIN
  IF NOT fn_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized: platform admin only';
  END IF;
  PERFORM set_config('mytree.admin_action', 'true', true);
  UPDATE riders SET is_approved = true WHERE id = p_rider_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'rider % not found', p_rider_id; END IF;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_approve_rider"("p_rider_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shops" (
    "shop_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "phone" "text",
    "open_time" time without time zone,
    "close_time" time without time zone,
    "open_days" "text"[] DEFAULT ARRAY['mon'::"text", 'tue'::"text", 'wed'::"text", 'thu'::"text", 'fri'::"text", 'sat'::"text", 'sun'::"text"],
    "google_maps_link" "text",
    "logo_url" "text",
    "delivery_enabled" boolean DEFAULT false,
    "pickup_enabled" boolean DEFAULT true,
    "delivery_zone" "text",
    "delivery_note" "text",
    "rider_phone" "text",
    "last_active_at" timestamp with time zone,
    "is_open" boolean DEFAULT false,
    "skip_today" boolean DEFAULT false,
    "pending_state" "text",
    "pending_state_expires_at" timestamp with time zone,
    "is_premium" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "lat" numeric,
    "lng" numeric,
    "location_updated_at" timestamp with time zone,
    "is_approved" boolean DEFAULT false NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "is_banned" boolean DEFAULT false NOT NULL,
    "banned_reason" "text",
    "banned_at" timestamp with time zone,
    "banned_by" "uuid",
    "deletion_requested_at" timestamp with time zone,
    "deletion_reason" "text",
    "qr_code_url" "text",
    "address" "text"
);


ALTER TABLE "public"."shops" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_approve_shop"("p_shop_id" "text") RETURNS "public"."shops"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_admin UUID := (auth.jwt() ->> 'customer_id')::UUID; v_row shops;
BEGIN
  IF NOT fn_is_platform_admin() THEN RAISE EXCEPTION 'not authorized: platform admin only'; END IF;
  PERFORM set_config('mytree.admin_action', 'true', true);
  UPDATE shops SET is_approved = true, approved_at = now(), approved_by = v_admin
  WHERE shop_id = p_shop_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'shop % not found', p_shop_id; END IF;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_approve_shop"("p_shop_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_auto_mark_cod_paid_on_delivery"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.delivery_status = 'delivered'
     AND OLD.delivery_status IS DISTINCT FROM 'delivered'
     AND NEW.payment_method = 'cash'
     AND NEW.payment_status = 'unpaid' THEN
    NEW.payment_status := 'paid';
    NEW.paid_at := now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_auto_mark_cod_paid_on_delivery"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text",
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "default_address" "text",
    "is_banned" boolean DEFAULT false NOT NULL,
    "banned_reason" "text",
    "banned_at" timestamp with time zone,
    "banned_by" "uuid"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ban_customer"("p_customer_id" "uuid", "p_reason" "text") RETURNS "public"."customers"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_admin UUID := (auth.jwt() ->> 'customer_id')::UUID; v_row customers;
BEGIN
  IF NOT fn_is_platform_admin() THEN RAISE EXCEPTION 'not authorized: platform admin only'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN RAISE EXCEPTION 'a reason is required'; END IF;
  PERFORM set_config('mytree.admin_action', 'true', true);
  UPDATE customers
  SET is_banned = true, banned_reason = p_reason, banned_at = now(), banned_by = v_admin
  WHERE id = p_customer_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'customer % not found', p_customer_id; END IF;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_ban_customer"("p_customer_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ban_rider"("p_rider_id" "uuid", "p_reason" "text") RETURNS "public"."riders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_admin UUID := (auth.jwt() ->> 'customer_id')::UUID; v_row riders;
BEGIN
  IF NOT fn_is_platform_admin() THEN RAISE EXCEPTION 'not authorized: platform admin only'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN RAISE EXCEPTION 'a reason is required'; END IF;
  PERFORM set_config('mytree.admin_action', 'true', true);
  UPDATE riders
  SET is_banned = true, banned_reason = p_reason, banned_at = now(), banned_by = v_admin,
      is_online = false, offers_passenger = false
  WHERE id = p_rider_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'rider % not found', p_rider_id; END IF;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_ban_rider"("p_rider_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ban_shop"("p_shop_id" "text", "p_reason" "text") RETURNS "public"."shops"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_admin UUID := (auth.jwt() ->> 'customer_id')::UUID; v_row shops;
BEGIN
  IF NOT fn_is_platform_admin() THEN RAISE EXCEPTION 'not authorized: platform admin only'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN RAISE EXCEPTION 'a reason is required'; END IF;
  PERFORM set_config('mytree.admin_action', 'true', true);
  UPDATE shops
  SET is_banned = true, banned_reason = p_reason, banned_at = now(), banned_by = v_admin,
      is_open = false
  WHERE shop_id = p_shop_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'shop % not found', p_shop_id; END IF;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_ban_shop"("p_shop_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_block_banned_rider_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM customers WHERE id = NEW.customer_id AND is_banned = true) THEN
    RAISE EXCEPTION 'this account has been banned and cannot register';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_block_banned_rider_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_claim_delivery_reminders"() RETURNS TABLE("sub_id" "uuid", "shop_id" "text", "order_id" "uuid", "confirmed_at" timestamp with time zone)
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  UPDATE sub_orders
  SET delivery_reminder_sent_at = now()
  WHERE delivery_status = 'needs_rider'
    AND confirmed_at < now() - INTERVAL '10 minutes'
    AND delivery_reminder_sent_at IS NULL
  RETURNING sub_orders.sub_id, sub_orders.shop_id, sub_orders.order_id, sub_orders.confirmed_at;
$$;


ALTER FUNCTION "public"."fn_claim_delivery_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_create_order"("p_shop_id" "text", "p_items" "jsonb", "p_customer_id" "uuid" DEFAULT NULL::"uuid", "p_fulfillment_type" "public"."fulfillment_type_enum" DEFAULT 'pickup'::"public"."fulfillment_type_enum", "p_payment_method" "public"."payment_method_enum" DEFAULT 'qr_transfer'::"public"."payment_method_enum", "p_delivery_address" "text" DEFAULT NULL::"text", "p_hub_order_id" "uuid" DEFAULT NULL::"uuid", "p_source" "text" DEFAULT 'liff_checkout'::"text", "p_note" "text" DEFAULT NULL::"text") RETURNS TABLE("out_hub_order_id" "uuid", "out_sub_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_hub_order_id UUID;
  v_sub_id UUID;
  v_amount NUMERIC := 0;
  v_item JSONB;
  v_order_status order_status_enum;
  v_payment_status payment_status_enum;
  v_confirmed_at TIMESTAMPTZ;
  v_paid_at TIMESTAMPTZ;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'p_items ต้องมีอย่างน้อย 1 รายการ';
  END IF;

  IF p_customer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM customers WHERE id = p_customer_id AND is_banned = true
  ) THEN
    RAISE EXCEPTION 'this account has been banned and cannot place orders';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM shops WHERE shop_id = p_shop_id AND is_approved = true AND is_banned = false
  ) THEN
    RAISE EXCEPTION 'this shop is not currently accepting orders';
  END IF;

  IF p_hub_order_id IS NULL THEN
    INSERT INTO hub_orders (customer_id) VALUES (p_customer_id)
    RETURNING order_id INTO v_hub_order_id;
  ELSE
    v_hub_order_id := p_hub_order_id;
  END IF;

  SELECT coalesce(sum((item->>'qty')::INT * (item->>'unit_price')::NUMERIC), 0)
  INTO v_amount
  FROM jsonb_array_elements(p_items) AS item;

  IF p_source = 'pos' THEN
    v_order_status := 'confirmed';
    v_confirmed_at := now();
  ELSE
    v_order_status := 'pending';
    v_confirmed_at := NULL;
  END IF;

  IF p_payment_method = 'cash' AND p_fulfillment_type = 'pickup' THEN
    v_payment_status := 'paid';
    v_paid_at := now();
  ELSE
    v_payment_status := 'unpaid';
    v_paid_at := NULL;
  END IF;

  INSERT INTO sub_orders (
    order_id, shop_id, items_json, amount,
    order_status, payment_status, payment_method, source,
    fulfillment_type, delivery_address, customer_note,
    confirmed_at, paid_at
  ) VALUES (
    v_hub_order_id, p_shop_id, p_items, v_amount,
    v_order_status, v_payment_status, p_payment_method, p_source,
    p_fulfillment_type, p_delivery_address, p_note,
    v_confirmed_at, v_paid_at
  ) RETURNING sub_id INTO v_sub_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (sub_id, shop_id, menu_item_id, item_name_snapshot, unit_price_snapshot, qty)
    VALUES (
      v_sub_id, p_shop_id,
      CASE WHEN v_item->>'menu_item_id' IS NULL THEN NULL ELSE (v_item->>'menu_item_id')::UUID END,
      v_item->>'item_name',
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'qty')::INT
    );
  END LOOP;

  UPDATE hub_orders SET total = (
    SELECT coalesce(sum(amount), 0) FROM sub_orders WHERE order_id = v_hub_order_id
  ) WHERE order_id = v_hub_order_id;

  RETURN QUERY SELECT v_hub_order_id, v_sub_id;
END;
$$;


ALTER FUNCTION "public"."fn_create_order"("p_shop_id" "text", "p_items" "jsonb", "p_customer_id" "uuid", "p_fulfillment_type" "public"."fulfillment_type_enum", "p_payment_method" "public"."payment_method_enum", "p_delivery_address" "text", "p_hub_order_id" "uuid", "p_source" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_customer_related_to_caller"("p_customer_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM hub_orders h JOIN sub_orders s ON s.order_id = h.order_id
    WHERE h.customer_id = p_customer_id
      AND (
        s.shop_id IN (SELECT shop_id FROM shop_staff WHERE customer_id = (auth.jwt() ->> 'customer_id')::uuid)
        OR s.assigned_rider_id IN (SELECT id FROM riders WHERE customer_id = (auth.jwt() ->> 'customer_id')::uuid)
      )
  );
$$;


ALTER FUNCTION "public"."fn_customer_related_to_caller"("p_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_enforce_max_rider_contacts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF (SELECT count(*) FROM shop_rider_contacts WHERE shop_id = NEW.shop_id) >= 5 THEN
    RAISE EXCEPTION 'ร้าน % มีเบอร์วินครบ 5 เบอร์แล้ว ลบเบอร์เก่าก่อนเพิ่มใหม่', NEW.shop_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_enforce_max_rider_contacts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_enforce_single_default_rider"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE shop_rider_contacts
    SET is_default = false
    WHERE shop_id = NEW.shop_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_enforce_single_default_rider"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generate_daily_shop_sales_summary"("p_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  DELETE FROM daily_shop_sales_summary WHERE sales_date = p_date;

  INSERT INTO daily_shop_sales_summary (
    shop_id, sales_date, order_count, cancelled_count,
    gross_sales, refunded_amount, net_sales,
    new_customer_count, returning_customer_count, avg_prep_minutes
  )
  WITH day_orders AS (
    SELECT so.shop_id, so.sub_id, so.amount, so.order_status, so.payment_status,
           so.confirmed_at, so.completed_at, ho.customer_id, ho.created_at
    FROM sub_orders so
    JOIN hub_orders ho ON ho.order_id = so.order_id
    WHERE (ho.created_at AT TIME ZONE 'Asia/Bangkok')::DATE = p_date
  ),
  customer_first_order AS (
    SELECT shop_id, customer_id,
           MIN((created_at AT TIME ZONE 'Asia/Bangkok')::DATE) AS first_order_date
    FROM sub_orders so2
    JOIN hub_orders ho2 ON ho2.order_id = so2.order_id
    GROUP BY shop_id, customer_id
  )
  SELECT
    d.shop_id, p_date,
    count(*),
    count(*) FILTER (WHERE d.order_status = 'cancelled'),
    coalesce(sum(d.amount) FILTER (WHERE d.payment_status = 'paid'), 0),
    coalesce(sum(d.amount) FILTER (WHERE d.payment_status = 'refunded'), 0),
    coalesce(sum(d.amount) FILTER (WHERE d.payment_status = 'paid'), 0)
      - coalesce(sum(d.amount) FILTER (WHERE d.payment_status = 'refunded'), 0),
    count(DISTINCT d.customer_id) FILTER (WHERE EXISTS (
      SELECT 1 FROM customer_first_order cfo
      WHERE cfo.shop_id = d.shop_id AND cfo.customer_id = d.customer_id AND cfo.first_order_date = p_date
    )),
    count(DISTINCT d.customer_id) FILTER (WHERE EXISTS (
      SELECT 1 FROM customer_first_order cfo
      WHERE cfo.shop_id = d.shop_id AND cfo.customer_id = d.customer_id AND cfo.first_order_date < p_date
    )),
    avg(EXTRACT(EPOCH FROM (d.completed_at - d.confirmed_at)) / 60.0)
      FILTER (WHERE d.completed_at IS NOT NULL AND d.confirmed_at IS NOT NULL)
  FROM day_orders d
  GROUP BY d.shop_id;
END;
$$;


ALTER FUNCTION "public"."fn_generate_daily_shop_sales_summary"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_guard_admin_only_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF current_setting('mytree.admin_action', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'shops' THEN
    IF NEW.is_approved IS DISTINCT FROM OLD.is_approved
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
       OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
       OR NEW.banned_by IS DISTINCT FROM OLD.banned_by
    THEN
      RAISE EXCEPTION 'only admins can change approval/ban fields';
    END IF;
  ELSIF TG_TABLE_NAME = 'riders' THEN
    IF NEW.is_approved IS DISTINCT FROM OLD.is_approved
       OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
       OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
       OR NEW.banned_by IS DISTINCT FROM OLD.banned_by
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
       OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
    THEN
      RAISE EXCEPTION 'only admins can change approval/verification/ban fields';
    END IF;
  ELSIF TG_TABLE_NAME = 'customers' THEN
    IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
       OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
       OR NEW.banned_by IS DISTINCT FROM OLD.banned_by
    THEN
      RAISE EXCEPTION 'only admins can change ban fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_guard_admin_only_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_guard_refund_after_pickup"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.payment_status = 'refunded'
     AND OLD.delivery_status IN ('picked_up', 'delivered')
     AND (NEW.cancelled_reason IS NULL OR length(trim(NEW.cancelled_reason)) = 0) THEN
    RAISE EXCEPTION 'ต้องระบุ cancelled_reason ก่อน refund order ที่วินรับของไปแล้ว (policy: ร้านรับผิดชอบ ต้องมีบันทึกเหตุผลเสมอ)';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_guard_refund_after_pickup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_guard_rider_delivery_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_is_staff BOOLEAN; v_is_rider BOOLEAN; v_is_customer BOOLEAN;
BEGIN
  IF current_setting('mytree.admin_action', true) = 'true' THEN RETURN NEW; END IF;

  SELECT EXISTS(SELECT 1 FROM shop_staff WHERE shop_id = OLD.shop_id AND customer_id = (auth.jwt() ->> 'customer_id')::uuid)
      OR EXISTS(SELECT 1 FROM platform_admins WHERE customer_id = (auth.jwt() ->> 'customer_id')::uuid)
  INTO v_is_staff;
  IF v_is_staff THEN RETURN NEW; END IF;

  v_is_rider := (OLD.assigned_rider_id IS NOT NULL AND OLD.assigned_rider_id = fn_my_rider_id());

  IF v_is_rider THEN
    IF NEW.order_id IS DISTINCT FROM OLD.order_id
       OR NEW.shop_id IS DISTINCT FROM OLD.shop_id
       OR NEW.items_json IS DISTINCT FROM OLD.items_json
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.order_status IS DISTINCT FROM OLD.order_status
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.assigned_rider_id IS DISTINCT FROM OLD.assigned_rider_id
       OR NEW.delivery_address IS DISTINCT FROM OLD.delivery_address
       OR NEW.payment_slip_url IS DISTINCT FROM OLD.payment_slip_url
    THEN
      RAISE EXCEPTION 'riders may only update delivery_status and delivery_photo_url';
    END IF;
    IF NEW.delivery_status IS DISTINCT FROM OLD.delivery_status THEN
      IF NOT ((OLD.delivery_status = 'rider_called' AND NEW.delivery_status = 'picked_up')
              OR (OLD.delivery_status = 'picked_up' AND NEW.delivery_status = 'delivered')) THEN
        RAISE EXCEPTION 'invalid delivery status transition for rider';
      END IF;
      IF NEW.delivery_status = 'delivered' AND NEW.delivery_photo_url IS NULL THEN
        RAISE EXCEPTION 'a delivery photo is required to mark as delivered';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  v_is_customer := (OLD.order_id IN (SELECT fn_my_hub_order_ids()));
  IF v_is_customer THEN
    IF NEW.order_id IS DISTINCT FROM OLD.order_id
       OR NEW.shop_id IS DISTINCT FROM OLD.shop_id
       OR NEW.items_json IS DISTINCT FROM OLD.items_json
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.order_status IS DISTINCT FROM OLD.order_status
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.assigned_rider_id IS DISTINCT FROM OLD.assigned_rider_id
       OR NEW.delivery_address IS DISTINCT FROM OLD.delivery_address
       OR NEW.delivery_status IS DISTINCT FROM OLD.delivery_status
       OR NEW.delivery_photo_url IS DISTINCT FROM OLD.delivery_photo_url
    THEN
      RAISE EXCEPTION 'customers may only attach a payment_slip_url to their own order';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not authorized to update this order';
END;
$$;


ALTER FUNCTION "public"."fn_guard_rider_delivery_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_haversine_km"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  r CONSTANT NUMERIC := 6371;
  dlat NUMERIC; dlng NUMERIC; a NUMERIC;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)^2;
  RETURN r * 2 * atan2(sqrt(a), sqrt(1-a));
END;
$$;


ALTER FUNCTION "public"."fn_haversine_km"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_my_assigned_delivery"("p_sub_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS(
    SELECT 1 FROM sub_orders s
    WHERE s.sub_id = p_sub_id AND s.assigned_rider_id = fn_my_rider_id()
  );
$$;


ALTER FUNCTION "public"."fn_is_my_assigned_delivery"("p_sub_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_my_order_sub"("p_sub_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS(
    SELECT 1 FROM sub_orders s
    WHERE s.sub_id = p_sub_id AND s.order_id IN (SELECT fn_my_hub_order_ids())
  );
$$;


ALTER FUNCTION "public"."fn_is_my_order_sub"("p_sub_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins
    WHERE customer_id = (auth.jwt() ->> 'customer_id')::UUID
  );
$$;


ALTER FUNCTION "public"."fn_is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_my_hub_order_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT order_id FROM hub_orders WHERE customer_id = (auth.jwt() ->> 'customer_id')::uuid;
$$;


ALTER FUNCTION "public"."fn_my_hub_order_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_my_rider_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT id FROM riders WHERE customer_id = (auth.jwt() ->> 'customer_id')::uuid;
$$;


ALTER FUNCTION "public"."fn_my_rider_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_owned_shop_ids"() RETURNS SETOF "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT shop_id FROM shop_staff WHERE customer_id = (auth.jwt() ->> 'customer_id')::uuid AND role = 'owner';
$$;


ALTER FUNCTION "public"."fn_owned_shop_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_recompute_hub_order_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_order_id UUID;
  v_total INT; v_completed INT; v_cancelled INT; v_confirmed INT; v_preparing INT;
  v_new_status hub_order_status_enum;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT count(*),
    count(*) FILTER (WHERE order_status = 'completed'),
    count(*) FILTER (WHERE order_status = 'cancelled'),
    count(*) FILTER (WHERE order_status = 'confirmed'),
    count(*) FILTER (WHERE order_status = 'preparing')
  INTO v_total, v_completed, v_cancelled, v_confirmed, v_preparing
  FROM sub_orders WHERE order_id = v_order_id;

  IF v_total = 0 THEN RETURN NULL;
  ELSIF v_cancelled = v_total THEN v_new_status := 'cancelled';
  ELSIF v_completed = v_total THEN v_new_status := 'completed';
  ELSIF v_cancelled > 0 AND (v_completed + v_cancelled) = v_total THEN v_new_status := 'partially_cancelled';
  ELSIF v_preparing > 0 THEN v_new_status := 'preparing';
  ELSIF v_confirmed = v_total THEN v_new_status := 'confirmed';
  ELSIF v_confirmed > 0 THEN v_new_status := 'partially_confirmed';
  ELSE v_new_status := 'pending';
  END IF;

  UPDATE hub_orders SET status = v_new_status WHERE order_id = v_order_id;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."fn_recompute_hub_order_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_register_shop"("p_name" "text", "p_category" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_open_time" "text" DEFAULT NULL::"text", "p_close_time" "text" DEFAULT NULL::"text", "p_open_days" "text"[] DEFAULT ARRAY['mon'::"text", 'tue'::"text", 'wed'::"text", 'thu'::"text", 'fri'::"text", 'sat'::"text", 'sun'::"text"], "p_google_maps_link" "text" DEFAULT NULL::"text", "p_delivery_zone" "text" DEFAULT NULL::"text", "p_logo_url" "text" DEFAULT NULL::"text", "p_lat" numeric DEFAULT NULL::numeric, "p_lng" numeric DEFAULT NULL::numeric) RETURNS TABLE("shop_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_customer UUID := (auth.jwt() ->> 'customer_id')::UUID;
  v_base TEXT; v_slug TEXT; v_suffix TEXT; v_tries INT := 0;
BEGIN
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'must be logged in via LINE to register a shop';
  END IF;
  IF EXISTS (SELECT 1 FROM customers WHERE id = v_customer AND is_banned = true) THEN
    RAISE EXCEPTION 'this account has been banned and cannot register a shop';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'shop name is required';
  END IF;

  v_base := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9ก-๙]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  IF v_base = '' OR v_base IS NULL THEN v_base := 'shop'; END IF;
  v_base := left(v_base, 40);

  LOOP
    v_suffix := substr(md5(random()::text), 1, 4);
    v_slug := v_base || '-' || v_suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM shops s WHERE s.shop_id = v_slug);
    v_tries := v_tries + 1;
    IF v_tries > 10 THEN RAISE EXCEPTION 'could not generate a unique shop_id, try again'; END IF;
  END LOOP;

  INSERT INTO shops (
    shop_id, name, category, phone, open_time, close_time, open_days,
    google_maps_link, delivery_zone, logo_url, lat, lng,
    location_updated_at, delivery_enabled, pickup_enabled, is_open
  ) VALUES (
    v_slug, trim(p_name), p_category, p_phone,
    NULLIF(p_open_time,'')::TIME, NULLIF(p_close_time,'')::TIME, p_open_days,
    p_google_maps_link, p_delivery_zone, p_logo_url, p_lat, p_lng,
    CASE WHEN p_lat IS NOT NULL THEN now() ELSE NULL END,
    true, true, false
  );

  INSERT INTO shop_staff (shop_id, customer_id, role) VALUES (v_slug, v_customer, 'owner');
  RETURN QUERY SELECT v_slug;
END;
$$;


ALTER FUNCTION "public"."fn_register_shop"("p_name" "text", "p_category" "text", "p_phone" "text", "p_open_time" "text", "p_close_time" "text", "p_open_days" "text"[], "p_google_maps_link" "text", "p_delivery_zone" "text", "p_logo_url" "text", "p_lat" numeric, "p_lng" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_reject_rider_deletion"("p_rider_id" "uuid") RETURNS "public"."riders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_row riders;
BEGIN
  IF NOT fn_is_platform_admin() THEN RAISE EXCEPTION 'not authorized: platform admin only'; END IF;
  UPDATE riders SET deletion_requested_at = NULL, deletion_reason = NULL
  WHERE id = p_rider_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'rider % not found', p_rider_id; END IF;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_reject_rider_deletion"("p_rider_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_reject_shop_deletion"("p_shop_id" "text") RETURNS "public"."shops"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_row shops;
BEGIN
  IF NOT fn_is_platform_admin() THEN RAISE EXCEPTION 'not authorized: platform admin only'; END IF;
  UPDATE shops SET deletion_requested_at = NULL, deletion_reason = NULL
  WHERE shop_id = p_shop_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'shop % not found', p_shop_id; END IF;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_reject_shop_deletion"("p_shop_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_require_delivery_address"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.fulfillment_type = 'delivery'
     AND (NEW.delivery_address IS NULL OR length(trim(NEW.delivery_address)) = 0) THEN
    RAISE EXCEPTION 'fulfillment_type = delivery ต้องมี delivery_address เสมอ (sub_id: %)', NEW.sub_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_require_delivery_address"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_resolve_line_customer"("p_line_user_id" "text", "p_name" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text") RETURNS TABLE("customer_id" "uuid", "is_new" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_existing UUID;
  v_new_customer UUID;
  v_inserted UUID;
BEGIN
  IF p_line_user_id IS NULL OR length(trim(p_line_user_id)) = 0 THEN
    RAISE EXCEPTION 'p_line_user_id is required';
  END IF;

  -- 1) fast path: identity already exists
  SELECT ci.customer_id INTO v_existing
  FROM customer_identities ci
  WHERE ci.provider = 'line' AND ci.provider_user_id = p_line_user_id;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, false;
    RETURN;
  END IF;

  -- 2) first login: create customer, then claim the identity atomically
  INSERT INTO customers(name, phone)
    VALUES (p_name, NULLIF(trim(p_phone), ''))
    RETURNING id INTO v_new_customer;

  INSERT INTO customer_identities(customer_id, provider, provider_user_id)
    VALUES (v_new_customer, 'line', p_line_user_id)
    ON CONFLICT (provider, provider_user_id) DO NOTHING
    RETURNING customer_identities.customer_id INTO v_inserted;

  IF v_inserted IS NOT NULL THEN
    -- we won the race
    RETURN QUERY SELECT v_new_customer, true;
    RETURN;
  END IF;

  -- 3) lost the race: another tx created the identity. drop our orphan customer,
  --    return the winner's customer_id.
  DELETE FROM customers WHERE id = v_new_customer;

  SELECT ci.customer_id INTO v_existing
  FROM customer_identities ci
  WHERE ci.provider = 'line' AND ci.provider_user_id = p_line_user_id;

  RETURN QUERY SELECT v_existing, false;
END;
$$;


ALTER FUNCTION "public"."fn_resolve_line_customer"("p_line_user_id" "text", "p_name" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_revoke_rider"("p_rider_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "public"."riders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_row riders;
BEGIN
  IF NOT fn_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized: platform admin only';
  END IF;
  PERFORM set_config('mytree.admin_action', 'true', true);
  UPDATE riders
  SET is_approved = false, is_online = false, verified_at = NULL, verified_by = NULL,
      offers_passenger = false
  WHERE id = p_rider_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'rider % not found', p_rider_id; END IF;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_revoke_rider"("p_rider_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_riders_near_shop"("p_shop_id" "text", "p_service" "text" DEFAULT 'delivery'::"text") RETURNS TABLE("rider_id" "uuid", "name" "text", "phone" "text", "vehicle_type" "text", "distance_km" numeric, "is_busy" boolean, "location_age_min" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    r.id, r.name, r.phone, r.vehicle_type,
    fn_haversine_km(s.lat, s.lng, r.lat, r.lng),
    EXISTS (SELECT 1 FROM sub_orders so WHERE so.assigned_rider_id = r.id AND so.delivery_status IN ('rider_called','picked_up')),
    round(extract(epoch FROM (now() - r.location_updated_at)) / 60)::numeric
  FROM riders r
  JOIN shops s ON s.shop_id = p_shop_id
  WHERE r.is_online = true AND r.is_approved = true AND r.is_banned = false
    AND r.lat IS NOT NULL AND r.lng IS NOT NULL
    AND (
      (p_service = 'delivery'  AND r.offers_delivery  = true) OR
      (p_service = 'errand'    AND r.offers_errand    = true) OR
      (p_service = 'passenger' AND r.offers_passenger = true)
    )
  ORDER BY EXISTS (SELECT 1 FROM sub_orders so WHERE so.assigned_rider_id = r.id AND so.delivery_status IN ('rider_called','picked_up')) ASC,
           fn_haversine_km(s.lat, s.lng, r.lat, r.lng) ASC NULLS LAST;
$$;


ALTER FUNCTION "public"."fn_riders_near_shop"("p_shop_id" "text", "p_service" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_set_initial_delivery_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.fulfillment_type = 'delivery' AND NEW.delivery_status = 'not_needed' THEN
    NEW.delivery_status := 'needs_rider';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_set_initial_delivery_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_shops_near_location"("p_lat" numeric, "p_lng" numeric) RETURNS TABLE("shop_id" "text", "name" "text", "category" "text", "distance_km" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT s.shop_id, s.name, s.category, fn_haversine_km(p_lat, p_lng, s.lat, s.lng)
  FROM shops s
  WHERE s.is_open = true AND s.is_approved = true AND s.is_banned = false
  ORDER BY fn_haversine_km(p_lat, p_lng, s.lat, s.lng) ASC NULLS LAST;
$$;


ALTER FUNCTION "public"."fn_shops_near_location"("p_lat" numeric, "p_lng" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_staff_shop_ids"() RETURNS SETOF "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT shop_id FROM shop_staff WHERE customer_id = (auth.jwt() ->> 'customer_id')::uuid;
$$;


ALTER FUNCTION "public"."fn_staff_shop_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_sub_orders_status_stamps"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
    CASE NEW.order_status
      WHEN 'confirmed' THEN NEW.confirmed_at := now();
      WHEN 'preparing' THEN NEW.preparing_at := now();
      WHEN 'completed' THEN NEW.completed_at := now();
      WHEN 'cancelled' THEN NEW.cancelled_at := now();
      ELSE NULL;
    END CASE;
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    CASE NEW.payment_status
      WHEN 'paid' THEN NEW.paid_at := now();
      WHEN 'refunded' THEN NEW.refunded_at := now();
      ELSE NULL;
    END CASE;
  END IF;

  IF NEW.print_status IS DISTINCT FROM OLD.print_status THEN
    CASE NEW.print_status
      WHEN 'printed' THEN NEW.printed_at := now();
      WHEN 'reprinted' THEN NEW.reprinted_at := now();
      ELSE NULL;
    END CASE;
  END IF;

  IF NEW.delivery_status IS DISTINCT FROM OLD.delivery_status THEN
    CASE NEW.delivery_status
      WHEN 'rider_called' THEN NEW.rider_called_at := now();
      WHEN 'picked_up' THEN NEW.picked_up_at := now();
      WHEN 'delivered' THEN NEW.delivered_at := now();
      WHEN 'failed' THEN NEW.delivery_failed_at := now();
      ELSE NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_sub_orders_status_stamps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_top_items_by_shop"("p_shop_id" "text", "p_start_date" "date", "p_end_date" "date", "p_limit" integer DEFAULT 10) RETURNS TABLE("item_name" "text", "total_qty" bigint, "total_revenue" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT oi.item_name_snapshot, sum(oi.qty)::BIGINT, sum(oi.line_total)
  FROM order_items oi
  JOIN sub_orders so ON so.sub_id = oi.sub_id
  WHERE oi.shop_id = p_shop_id
    AND so.payment_status = 'paid'
    AND (oi.created_at AT TIME ZONE 'Asia/Bangkok')::DATE BETWEEN p_start_date AND p_end_date
  GROUP BY oi.item_name_snapshot
  ORDER BY sum(oi.qty) DESC
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."fn_top_items_by_shop"("p_shop_id" "text", "p_start_date" "date", "p_end_date" "date", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_track_print_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.print_status IN ('printed', 'reprinted')
     AND NEW.print_status IS DISTINCT FROM OLD.print_status THEN
    NEW.print_count := OLD.print_count + 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_track_print_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_track_rider_retry"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.delivery_status = 'needs_rider' AND OLD.delivery_status = 'failed' THEN
    NEW.rider_retry_count := OLD.rider_retry_count + 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_track_rider_retry"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_unban_customer"("p_customer_id" "uuid") RETURNS "public"."customers"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_row customers;
BEGIN
  IF NOT fn_is_platform_admin() THEN RAISE EXCEPTION 'not authorized: platform admin only'; END IF;
  PERFORM set_config('mytree.admin_action', 'true', true);
  UPDATE customers
  SET is_banned = false, banned_reason = NULL, banned_at = NULL, banned_by = NULL
  WHERE id = p_customer_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'customer % not found', p_customer_id; END IF;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_unban_customer"("p_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_unban_rider"("p_rider_id" "uuid") RETURNS "public"."riders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_row riders;
BEGIN
  IF NOT fn_is_platform_admin() THEN RAISE EXCEPTION 'not authorized: platform admin only'; END IF;
  PERFORM set_config('mytree.admin_action', 'true', true);
  UPDATE riders
  SET is_banned = false, banned_reason = NULL, banned_at = NULL, banned_by = NULL
  WHERE id = p_rider_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'rider % not found', p_rider_id; END IF;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_unban_rider"("p_rider_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_unban_shop"("p_shop_id" "text") RETURNS "public"."shops"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_row shops;
BEGIN
  IF NOT fn_is_platform_admin() THEN RAISE EXCEPTION 'not authorized: platform admin only'; END IF;
  PERFORM set_config('mytree.admin_action', 'true', true);
  UPDATE shops
  SET is_banned = false, banned_reason = NULL, banned_at = NULL, banned_by = NULL
  WHERE shop_id = p_shop_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'shop % not found', p_shop_id; END IF;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_unban_shop"("p_shop_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_verify_rider_document"("p_rider_id" "uuid") RETURNS "public"."riders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_admin UUID := (auth.jwt() ->> 'customer_id')::UUID;
  v_row riders;
BEGIN
  IF NOT fn_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized: platform admin only';
  END IF;
  SELECT * INTO v_row FROM riders WHERE id = p_rider_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'rider % not found', p_rider_id; END IF;
  IF v_row.rider_class <> 'public_win' THEN
    RAISE EXCEPTION 'only public_win (yellow-plate) riders require document verification';
  END IF;
  IF v_row.plate_number IS NULL OR v_row.win_registration_no IS NULL THEN
    RAISE EXCEPTION 'cannot verify: plate_number and win_registration_no must be submitted first';
  END IF;
  PERFORM set_config('mytree.admin_action', 'true', true);
  UPDATE riders
  SET verified_at = now(), verified_by = v_admin, is_approved = true
  WHERE id = p_rider_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."fn_verify_rider_document"("p_rider_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_shop_sales_summary" (
    "shop_id" "text" NOT NULL,
    "sales_date" "date" NOT NULL,
    "order_count" integer DEFAULT 0 NOT NULL,
    "cancelled_count" integer DEFAULT 0 NOT NULL,
    "gross_sales" numeric DEFAULT 0 NOT NULL,
    "refunded_amount" numeric DEFAULT 0 NOT NULL,
    "net_sales" numeric DEFAULT 0 NOT NULL,
    "new_customer_count" integer DEFAULT 0 NOT NULL,
    "returning_customer_count" integer DEFAULT 0 NOT NULL,
    "avg_prep_minutes" numeric,
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_shop_sales_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_orders" (
    "order_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "total" numeric DEFAULT 0 NOT NULL,
    "status" "public"."hub_order_status_enum" DEFAULT 'pending'::"public"."hub_order_status_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hub_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sub_orders" (
    "sub_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "shop_id" "text" NOT NULL,
    "items_json" "jsonb",
    "amount" numeric DEFAULT 0 NOT NULL,
    "order_status" "public"."order_status_enum" DEFAULT 'pending'::"public"."order_status_enum" NOT NULL,
    "payment_status" "public"."payment_status_enum" DEFAULT 'unpaid'::"public"."payment_status_enum" NOT NULL,
    "print_status" "public"."print_status_enum" DEFAULT 'not_printed'::"public"."print_status_enum" NOT NULL,
    "delivery_status" "public"."delivery_status_enum" DEFAULT 'not_needed'::"public"."delivery_status_enum" NOT NULL,
    "fulfillment_type" "public"."fulfillment_type_enum" DEFAULT 'pickup'::"public"."fulfillment_type_enum" NOT NULL,
    "payment_pending_at" timestamp with time zone,
    "payment_reminded_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "preparing_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancelled_reason" "text",
    "paid_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    "printed_at" timestamp with time zone,
    "reprinted_at" timestamp with time zone,
    "rider_called_at" timestamp with time zone,
    "picked_up_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "delivery_failed_at" timestamp with time zone,
    "delivery_failed_reason" "text",
    "rider_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "rider_contact_id" "uuid",
    "rider_retry_count" integer DEFAULT 0 NOT NULL,
    "delivery_reminder_sent_at" timestamp with time zone,
    "delivery_address" "text",
    "payment_method" "public"."payment_method_enum" DEFAULT 'qr_transfer'::"public"."payment_method_enum" NOT NULL,
    "source" "text" DEFAULT 'liff_checkout'::"text" NOT NULL,
    "print_count" integer DEFAULT 0 NOT NULL,
    "assigned_rider_id" "uuid",
    "delivery_photo_url" "text",
    "payment_slip_url" "text",
    "customer_note" "text",
    CONSTRAINT "sub_orders_source_check" CHECK (("source" = ANY (ARRAY['pos'::"text", 'liff_checkout'::"text"])))
);


ALTER TABLE "public"."sub_orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."shop_sales_today_live" WITH ("security_invoker"='true') AS
 SELECT "so"."shop_id",
    "count"(*) AS "order_count",
    "count"(*) FILTER (WHERE ("so"."order_status" = 'cancelled'::"public"."order_status_enum")) AS "cancelled_count",
    COALESCE("sum"("so"."amount") FILTER (WHERE ("so"."payment_status" = 'paid'::"public"."payment_status_enum")), (0)::numeric) AS "gross_sales",
    COALESCE("sum"("so"."amount") FILTER (WHERE ("so"."payment_status" = 'refunded'::"public"."payment_status_enum")), (0)::numeric) AS "refunded_amount",
    (COALESCE("sum"("so"."amount") FILTER (WHERE ("so"."payment_status" = 'paid'::"public"."payment_status_enum")), (0)::numeric) - COALESCE("sum"("so"."amount") FILTER (WHERE ("so"."payment_status" = 'refunded'::"public"."payment_status_enum")), (0)::numeric)) AS "net_sales"
   FROM ("public"."sub_orders" "so"
     JOIN "public"."hub_orders" "ho" ON (("ho"."order_id" = "so"."order_id")))
  WHERE ((("ho"."created_at" AT TIME ZONE 'Asia/Bangkok'::"text"))::"date" = (("now"() AT TIME ZONE 'Asia/Bangkok'::"text"))::"date")
  GROUP BY "so"."shop_id";


ALTER VIEW "public"."shop_sales_today_live" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "tier" "public"."subscription_tier_enum" NOT NULL,
    "amount" numeric NOT NULL,
    "billing_period_start" "date" NOT NULL,
    "billing_period_end" "date" NOT NULL,
    "payment_method" "text",
    "status" "public"."subscription_status_enum" DEFAULT 'paid'::"public"."subscription_status_enum" NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_payments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_overview" WITH ("security_invoker"='true') AS
 WITH "gmv_today" AS (
         SELECT COALESCE("sum"("shop_sales_today_live"."net_sales"), (0)::numeric) AS "v"
           FROM "public"."shop_sales_today_live"
        ), "gmv_this_month" AS (
         SELECT COALESCE("sum"("daily_shop_sales_summary"."net_sales"), (0)::numeric) AS "v"
           FROM "public"."daily_shop_sales_summary"
          WHERE ("date_trunc"('month'::"text", ("daily_shop_sales_summary"."sales_date")::timestamp with time zone) = "date_trunc"('month'::"text", ((("now"() AT TIME ZONE 'Asia/Bangkok'::"text"))::"date")::timestamp with time zone))
        ), "gmv_this_year" AS (
         SELECT COALESCE("sum"("daily_shop_sales_summary"."net_sales"), (0)::numeric) AS "v"
           FROM "public"."daily_shop_sales_summary"
          WHERE ("date_trunc"('year'::"text", ("daily_shop_sales_summary"."sales_date")::timestamp with time zone) = "date_trunc"('year'::"text", ((("now"() AT TIME ZONE 'Asia/Bangkok'::"text"))::"date")::timestamp with time zone))
        ), "platform_revenue_this_month" AS (
         SELECT COALESCE("sum"("subscription_payments"."amount"), (0)::numeric) AS "v"
           FROM "public"."subscription_payments"
          WHERE (("subscription_payments"."status" = 'paid'::"public"."subscription_status_enum") AND ("date_trunc"('month'::"text", ("subscription_payments"."paid_at" AT TIME ZONE 'Asia/Bangkok'::"text")) = "date_trunc"('month'::"text", ("now"() AT TIME ZONE 'Asia/Bangkok'::"text"))))
        ), "shop_activity" AS (
         SELECT "count"(*) AS "total_shops",
            "count"(*) FILTER (WHERE ("shops"."last_active_at" >= ("now"() - '7 days'::interval))) AS "active_shops",
            "count"(*) FILTER (WHERE (("shops"."last_active_at" < ("now"() - '7 days'::interval)) OR ("shops"."last_active_at" IS NULL))) AS "churned_shops",
            "count"(*) FILTER (WHERE "shops"."is_premium") AS "premium_shops",
            "count"(*) FILTER (WHERE ("date_trunc"('month'::"text", ("shops"."created_at" AT TIME ZONE 'Asia/Bangkok'::"text")) = "date_trunc"('month'::"text", ("now"() AT TIME ZONE 'Asia/Bangkok'::"text")))) AS "new_shops_this_month"
           FROM "public"."shops"
        ), "avg_prep" AS (
         SELECT "avg"("daily_shop_sales_summary"."avg_prep_minutes") AS "v"
           FROM "public"."daily_shop_sales_summary"
          WHERE ("daily_shop_sales_summary"."sales_date" >= ((("now"() AT TIME ZONE 'Asia/Bangkok'::"text"))::"date" - 30))
        )
 SELECT ( SELECT "gmv_today"."v"
           FROM "gmv_today") AS "gmv_today",
    ( SELECT "gmv_this_month"."v"
           FROM "gmv_this_month") AS "gmv_this_month",
    ( SELECT "gmv_this_year"."v"
           FROM "gmv_this_year") AS "gmv_this_year",
    ( SELECT "platform_revenue_this_month"."v"
           FROM "platform_revenue_this_month") AS "platform_revenue_this_month",
    ( SELECT "shop_activity"."total_shops"
           FROM "shop_activity") AS "total_shops",
    ( SELECT "shop_activity"."active_shops"
           FROM "shop_activity") AS "active_shops",
    ( SELECT "shop_activity"."churned_shops"
           FROM "shop_activity") AS "churned_shops",
    ( SELECT "shop_activity"."premium_shops"
           FROM "shop_activity") AS "premium_shops",
    ( SELECT "shop_activity"."new_shops_this_month"
           FROM "shop_activity") AS "new_shops_this_month",
    ( SELECT "avg_prep"."v"
           FROM "avg_prep") AS "avg_prep_minutes_last_30d";


ALTER VIEW "public"."admin_overview" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text",
    "customer_id" "uuid",
    "sender_type" "public"."sender_type_enum" NOT NULL,
    "message_text" "text",
    "order_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_identities" (
    "customer_id" "uuid" NOT NULL,
    "provider" "public"."identity_provider_enum" NOT NULL,
    "provider_user_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_specials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text",
    "special_text" "text" NOT NULL,
    "valid_date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_specials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_top_rotation" (
    "keyword" "text" NOT NULL,
    "shop_id" "text",
    "rotation_date" "date" NOT NULL
);


ALTER TABLE "public"."daily_top_rotation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "customer_id" "uuid" NOT NULL,
    "shop_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listing_keywords" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text",
    "keyword" "text" NOT NULL,
    "listing_type" "public"."listing_type_enum" NOT NULL,
    "fixed_position" integer,
    "is_premium_member" boolean DEFAULT false
);


ALTER TABLE "public"."listing_keywords" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "item_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric NOT NULL,
    "category" "text",
    "image_url" "text",
    "is_available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sub_id" "uuid" NOT NULL,
    "shop_id" "text" NOT NULL,
    "menu_item_id" "uuid",
    "item_name_snapshot" "text" NOT NULL,
    "unit_price_snapshot" numeric NOT NULL,
    "qty" integer NOT NULL,
    "line_total" numeric GENERATED ALWAYS AS ((("qty")::numeric * "unit_price_snapshot")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_items_qty_check" CHECK (("qty" > 0))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "customer_id" "uuid" NOT NULL,
    "role" "public"."admin_role_enum" DEFAULT 'support'::"public"."admin_role_enum",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_rider_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "rider_name" "text",
    "phone" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_rider_contacts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."shop_delivery_queue" WITH ("security_invoker"='true') AS
 SELECT "so"."sub_id",
    "so"."order_id",
    "so"."shop_id",
    "s"."name" AS "shop_name",
    "so"."delivery_status",
    "so"."fulfillment_type",
    "so"."confirmed_at",
    "so"."rider_called_at",
    "so"."picked_up_at",
    "so"."delivered_at",
    "so"."delivery_failed_at",
    "so"."delivery_failed_reason",
    "so"."rider_retry_count",
    "so"."rider_note",
    "rc"."rider_name" AS "used_rider_name",
    "rc"."phone" AS "used_rider_phone"
   FROM (("public"."sub_orders" "so"
     JOIN "public"."shops" "s" ON (("s"."shop_id" = "so"."shop_id")))
     LEFT JOIN "public"."shop_rider_contacts" "rc" ON (("rc"."id" = "so"."rider_contact_id")))
  WHERE ("so"."delivery_status" = ANY (ARRAY['needs_rider'::"public"."delivery_status_enum", 'rider_called'::"public"."delivery_status_enum", 'picked_up'::"public"."delivery_status_enum"]))
  ORDER BY "so"."confirmed_at";


ALTER VIEW "public"."shop_delivery_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_faq_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text",
    "keyword_pattern" "text" NOT NULL,
    "response_template" "text" NOT NULL,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."shop_faq_rules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."shop_order_view" WITH ("security_invoker"='true') AS
 SELECT "so"."sub_id",
    "so"."order_id",
    "so"."shop_id",
    "s"."name" AS "shop_name",
    "ho"."customer_id",
    "so"."items_json",
    "so"."amount",
    "so"."fulfillment_type",
    "so"."order_status",
    "so"."payment_status",
    "so"."print_status",
    "so"."delivery_status",
    "so"."confirmed_at",
    "so"."preparing_at",
    "so"."completed_at",
    "so"."cancelled_at",
    "so"."paid_at",
    "so"."printed_at",
    "so"."rider_called_at",
    "so"."delivered_at",
    "ho"."created_at" AS "order_created_at"
   FROM (("public"."sub_orders" "so"
     JOIN "public"."shops" "s" ON (("s"."shop_id" = "so"."shop_id")))
     JOIN "public"."hub_orders" "ho" ON (("ho"."order_id" = "so"."order_id")));


ALTER VIEW "public"."shop_order_view" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."shop_sales_monthly" WITH ("security_invoker"='true') AS
 SELECT "shop_id",
    ("date_trunc"('month'::"text", ("sales_date")::timestamp with time zone))::"date" AS "month",
    "sum"("order_count") AS "order_count",
    "sum"("cancelled_count") AS "cancelled_count",
    "sum"("gross_sales") AS "gross_sales",
    "sum"("refunded_amount") AS "refunded_amount",
    "sum"("net_sales") AS "net_sales",
    "sum"("new_customer_count") AS "new_customer_count",
    "sum"("returning_customer_count") AS "returning_customer_count",
    "avg"("avg_prep_minutes") AS "avg_prep_minutes"
   FROM "public"."daily_shop_sales_summary"
  GROUP BY "shop_id", ("date_trunc"('month'::"text", ("sales_date")::timestamp with time zone));


ALTER VIEW "public"."shop_sales_monthly" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."shop_sales_yearly" WITH ("security_invoker"='true') AS
 SELECT "shop_id",
    ("date_trunc"('year'::"text", ("sales_date")::timestamp with time zone))::"date" AS "year",
    "sum"("order_count") AS "order_count",
    "sum"("cancelled_count") AS "cancelled_count",
    "sum"("gross_sales") AS "gross_sales",
    "sum"("refunded_amount") AS "refunded_amount",
    "sum"("net_sales") AS "net_sales",
    "sum"("new_customer_count") AS "new_customer_count",
    "sum"("returning_customer_count") AS "returning_customer_count",
    "avg"("avg_prep_minutes") AS "avg_prep_minutes"
   FROM "public"."daily_shop_sales_summary"
  GROUP BY "shop_id", ("date_trunc"('year'::"text", ("sales_date")::timestamp with time zone));


ALTER VIEW "public"."shop_sales_yearly" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_staff" (
    "shop_id" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "role" "public"."staff_role_enum" DEFAULT 'owner'::"public"."staff_role_enum",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_staff" OWNER TO "postgres";


ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_identities"
    ADD CONSTRAINT "customer_identities_pkey" PRIMARY KEY ("provider", "provider_user_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_shop_sales_summary"
    ADD CONSTRAINT "daily_shop_sales_summary_pkey" PRIMARY KEY ("shop_id", "sales_date");



ALTER TABLE ONLY "public"."daily_specials"
    ADD CONSTRAINT "daily_specials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_top_rotation"
    ADD CONSTRAINT "daily_top_rotation_pkey" PRIMARY KEY ("keyword", "rotation_date");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("customer_id", "shop_id");



ALTER TABLE ONLY "public"."hub_orders"
    ADD CONSTRAINT "hub_orders_pkey" PRIMARY KEY ("order_id");



ALTER TABLE ONLY "public"."listing_keywords"
    ADD CONSTRAINT "listing_keywords_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("item_id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("customer_id");



ALTER TABLE ONLY "public"."riders"
    ADD CONSTRAINT "riders_customer_id_key" UNIQUE ("customer_id");



ALTER TABLE ONLY "public"."riders"
    ADD CONSTRAINT "riders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_faq_rules"
    ADD CONSTRAINT "shop_faq_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_rider_contacts"
    ADD CONSTRAINT "shop_rider_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_staff"
    ADD CONSTRAINT "shop_staff_pkey" PRIMARY KEY ("shop_id", "customer_id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_pkey" PRIMARY KEY ("shop_id");



ALTER TABLE ONLY "public"."sub_orders"
    ADD CONSTRAINT "sub_orders_pkey" PRIMARY KEY ("sub_id");



ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_chat_messages_shop_customer" ON "public"."chat_messages" USING "btree" ("shop_id", "customer_id", "created_at");



CREATE INDEX "idx_customer_identities_customer" ON "public"."customer_identities" USING "btree" ("customer_id");



CREATE INDEX "idx_daily_sales_date" ON "public"."daily_shop_sales_summary" USING "btree" ("sales_date");



CREATE INDEX "idx_hub_orders_customer" ON "public"."hub_orders" USING "btree" ("customer_id", "created_at" DESC);



CREATE INDEX "idx_menu_items_shop" ON "public"."menu_items" USING "btree" ("shop_id", "is_available");



CREATE INDEX "idx_order_items_shop_menu_item" ON "public"."order_items" USING "btree" ("shop_id", "menu_item_id", "created_at");



CREATE INDEX "idx_order_items_sub_id" ON "public"."order_items" USING "btree" ("sub_id");



CREATE INDEX "idx_riders_online_approved" ON "public"."riders" USING "btree" ("is_online", "is_approved");



CREATE INDEX "idx_riders_verified_by" ON "public"."riders" USING "btree" ("verified_by");



CREATE INDEX "idx_shop_rider_contacts_shop" ON "public"."shop_rider_contacts" USING "btree" ("shop_id", "sort_order");



CREATE INDEX "idx_sub_orders_assigned_rider" ON "public"."sub_orders" USING "btree" ("assigned_rider_id");



CREATE INDEX "idx_sub_orders_needs_rider" ON "public"."sub_orders" USING "btree" ("shop_id", "delivery_status") WHERE ("delivery_status" = ANY (ARRAY['needs_rider'::"public"."delivery_status_enum", 'rider_called'::"public"."delivery_status_enum"]));



CREATE INDEX "idx_sub_orders_order_id" ON "public"."sub_orders" USING "btree" ("order_id");



CREATE INDEX "idx_sub_orders_payment_pending" ON "public"."sub_orders" USING "btree" ("payment_status", "payment_pending_at") WHERE ("payment_status" = ANY (ARRAY['unpaid'::"public"."payment_status_enum", 'pending'::"public"."payment_status_enum"]));



CREATE INDEX "idx_sub_orders_print_queue" ON "public"."sub_orders" USING "btree" ("shop_id", "print_status") WHERE ("print_status" = 'not_printed'::"public"."print_status_enum");



CREATE INDEX "idx_sub_orders_shop_status" ON "public"."sub_orders" USING "btree" ("shop_id", "order_status");



CREATE INDEX "idx_sub_orders_source" ON "public"."sub_orders" USING "btree" ("shop_id", "source");



CREATE INDEX "idx_subscription_payments_period" ON "public"."subscription_payments" USING "btree" ("status", "paid_at") WHERE ("status" = 'paid'::"public"."subscription_status_enum");



CREATE INDEX "idx_subscription_payments_shop" ON "public"."subscription_payments" USING "btree" ("shop_id", "billing_period_start");



CREATE OR REPLACE TRIGGER "trg_0_guard_rider_delivery_update" BEFORE UPDATE ON "public"."sub_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_guard_rider_delivery_update"();



CREATE OR REPLACE TRIGGER "trg_auto_mark_cod_paid" BEFORE UPDATE OF "delivery_status" ON "public"."sub_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auto_mark_cod_paid_on_delivery"();



CREATE OR REPLACE TRIGGER "trg_block_banned_rider_signup" BEFORE INSERT ON "public"."riders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_block_banned_rider_signup"();



CREATE OR REPLACE TRIGGER "trg_enforce_max_rider_contacts" BEFORE INSERT ON "public"."shop_rider_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."fn_enforce_max_rider_contacts"();



CREATE OR REPLACE TRIGGER "trg_enforce_single_default_rider" BEFORE INSERT OR UPDATE OF "is_default" ON "public"."shop_rider_contacts" FOR EACH ROW WHEN (("new"."is_default" = true)) EXECUTE FUNCTION "public"."fn_enforce_single_default_rider"();



CREATE OR REPLACE TRIGGER "trg_guard_customers" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."fn_guard_admin_only_columns"();



CREATE OR REPLACE TRIGGER "trg_guard_refund_after_pickup" BEFORE UPDATE OF "payment_status" ON "public"."sub_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_guard_refund_after_pickup"();



CREATE OR REPLACE TRIGGER "trg_guard_riders" BEFORE UPDATE ON "public"."riders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_guard_admin_only_columns"();



CREATE OR REPLACE TRIGGER "trg_guard_shops" BEFORE UPDATE ON "public"."shops" FOR EACH ROW EXECUTE FUNCTION "public"."fn_guard_admin_only_columns"();



CREATE OR REPLACE TRIGGER "trg_recompute_hub_order_status" AFTER INSERT OR DELETE OR UPDATE OF "order_status" ON "public"."sub_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_recompute_hub_order_status"();



CREATE OR REPLACE TRIGGER "trg_require_delivery_address" BEFORE INSERT ON "public"."sub_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_require_delivery_address"();



CREATE OR REPLACE TRIGGER "trg_set_initial_delivery_status" BEFORE INSERT ON "public"."sub_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_initial_delivery_status"();



CREATE OR REPLACE TRIGGER "trg_sub_orders_status_stamps" BEFORE UPDATE ON "public"."sub_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_sub_orders_status_stamps"();



CREATE OR REPLACE TRIGGER "trg_track_print_count" BEFORE UPDATE OF "print_status" ON "public"."sub_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_track_print_count"();



CREATE OR REPLACE TRIGGER "trg_track_rider_retry" BEFORE UPDATE OF "delivery_status" ON "public"."sub_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_track_rider_retry"();



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."hub_orders"("order_id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id");



ALTER TABLE ONLY "public"."customer_identities"
    ADD CONSTRAINT "customer_identities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_banned_by_fkey" FOREIGN KEY ("banned_by") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."daily_shop_sales_summary"
    ADD CONSTRAINT "daily_shop_sales_summary_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id");



ALTER TABLE ONLY "public"."daily_specials"
    ADD CONSTRAINT "daily_specials_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_top_rotation"
    ADD CONSTRAINT "daily_top_rotation_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_orders"
    ADD CONSTRAINT "hub_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."listing_keywords"
    ADD CONSTRAINT "listing_keywords_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("item_id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_sub_id_fkey" FOREIGN KEY ("sub_id") REFERENCES "public"."sub_orders"("sub_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."riders"
    ADD CONSTRAINT "riders_banned_by_fkey" FOREIGN KEY ("banned_by") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."riders"
    ADD CONSTRAINT "riders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."riders"
    ADD CONSTRAINT "riders_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."shop_faq_rules"
    ADD CONSTRAINT "shop_faq_rules_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_rider_contacts"
    ADD CONSTRAINT "shop_rider_contacts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_staff"
    ADD CONSTRAINT "shop_staff_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_staff"
    ADD CONSTRAINT "shop_staff_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_banned_by_fkey" FOREIGN KEY ("banned_by") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."sub_orders"
    ADD CONSTRAINT "sub_orders_assigned_rider_id_fkey" FOREIGN KEY ("assigned_rider_id") REFERENCES "public"."riders"("id");



ALTER TABLE ONLY "public"."sub_orders"
    ADD CONSTRAINT "sub_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."hub_orders"("order_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_orders"
    ADD CONSTRAINT "sub_orders_rider_contact_id_fkey" FOREIGN KEY ("rider_contact_id") REFERENCES "public"."shop_rider_contacts"("id");



ALTER TABLE ONLY "public"."sub_orders"
    ADD CONSTRAINT "sub_orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id");



ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("shop_id");



CREATE POLICY "admin_only_subscription_payments" ON "public"."subscription_payments" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid"))));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_scoped_to_shop_or_customer" ON "public"."chat_messages" USING ((("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")) OR ("customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid")));



ALTER TABLE "public"."customer_identities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_reads_own_order_items" ON "public"."order_items" FOR SELECT USING (("sub_id" IN ( SELECT "s"."sub_id"
   FROM "public"."sub_orders" "s"
  WHERE ("s"."order_id" IN ( SELECT "public"."fn_my_hub_order_ids"() AS "fn_my_hub_order_ids")))));



CREATE POLICY "customer_reads_own_sub_orders" ON "public"."sub_orders" FOR SELECT USING (("order_id" IN ( SELECT "public"."fn_my_hub_order_ids"() AS "fn_my_hub_order_ids")));



CREATE POLICY "customer_reads_own_sub_orders_for_slip" ON "public"."sub_orders" FOR UPDATE USING (("order_id" IN ( SELECT "public"."fn_my_hub_order_ids"() AS "fn_my_hub_order_ids"))) WITH CHECK (("order_id" IN ( SELECT "public"."fn_my_hub_order_ids"() AS "fn_my_hub_order_ids")));



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_shop_sales_summary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_specials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_top_rotation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_hub_orders" ON "public"."hub_orders" FOR INSERT WITH CHECK ((("customer_id" IS NULL) OR ("customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid") OR (EXISTS ( SELECT 1
   FROM "public"."fn_staff_shop_ids"() "fn_staff_shop_ids"("fn_staff_shop_ids"))) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid")))));



CREATE POLICY "insert_new_customer" ON "public"."customers" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."listing_keywords" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_owner_delete" ON "public"."menu_items" FOR DELETE USING (("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")));



CREATE POLICY "menu_owner_insert" ON "public"."menu_items" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")));



CREATE POLICY "menu_owner_update" ON "public"."menu_items" FOR UPDATE USING (("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids"))) WITH CHECK (("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")));



CREATE POLICY "menu_public_read" ON "public"."menu_items" FOR SELECT USING ((("is_available" = true) OR ("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids"))));



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own_favorites" ON "public"."favorites" USING (("customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid"));



CREATE POLICY "owner_deletes_staff" ON "public"."shop_staff" FOR DELETE USING (("shop_id" IN ( SELECT "public"."fn_owned_shop_ids"() AS "fn_owned_shop_ids")));



CREATE POLICY "owner_inserts_staff" ON "public"."shop_staff" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "public"."fn_owned_shop_ids"() AS "fn_owned_shop_ids")));



CREATE POLICY "owner_updates_staff" ON "public"."shop_staff" FOR UPDATE USING (("shop_id" IN ( SELECT "public"."fn_owned_shop_ids"() AS "fn_owned_shop_ids"))) WITH CHECK (("shop_id" IN ( SELECT "public"."fn_owned_shop_ids"() AS "fn_owned_shop_ids")));



ALTER TABLE "public"."platform_admins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_read_daily_specials" ON "public"."daily_specials" FOR SELECT USING (true);



CREATE POLICY "public_read_daily_top_rotation" ON "public"."daily_top_rotation" FOR SELECT USING (true);



CREATE POLICY "public_read_listing_keywords" ON "public"."listing_keywords" FOR SELECT USING (true);



CREATE POLICY "public_read_shops" ON "public"."shops" FOR SELECT USING (true);



CREATE POLICY "read_own_or_related_customers" ON "public"."customers" FOR SELECT USING ((("id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid") OR (EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid"))) OR "public"."fn_customer_related_to_caller"("id")));



CREATE POLICY "read_own_or_related_hub_orders" ON "public"."hub_orders" FOR SELECT USING ((("customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid") OR (EXISTS ( SELECT 1
   FROM "public"."sub_orders" "so"
  WHERE (("so"."order_id" = "hub_orders"."order_id") AND ("so"."shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids"))))) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid")))));



CREATE POLICY "rider_deletes_own_row" ON "public"."riders" FOR DELETE USING (("customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid"));



CREATE POLICY "rider_inserts_own_row" ON "public"."riders" FOR INSERT WITH CHECK (("customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid"));



CREATE POLICY "rider_reads_assigned_delivery" ON "public"."sub_orders" FOR SELECT USING (("assigned_rider_id" = "public"."fn_my_rider_id"()));



CREATE POLICY "rider_reads_assigned_order_items" ON "public"."order_items" FOR SELECT USING (("sub_id" IN ( SELECT "s"."sub_id"
   FROM "public"."sub_orders" "s"
  WHERE ("s"."assigned_rider_id" = "public"."fn_my_rider_id"()))));



CREATE POLICY "rider_updates_assigned_delivery" ON "public"."sub_orders" FOR UPDATE USING (("assigned_rider_id" = "public"."fn_my_rider_id"())) WITH CHECK (("assigned_rider_id" = "public"."fn_my_rider_id"()));



CREATE POLICY "rider_updates_own_row" ON "public"."riders" FOR UPDATE USING (("customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid")) WITH CHECK (("customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid"));



ALTER TABLE "public"."riders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "self_reads_own_admin_row" ON "public"."platform_admins" FOR SELECT USING (("customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid"));



ALTER TABLE "public"."shop_faq_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shop_manages_own_faq" ON "public"."shop_faq_rules" USING (("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")));



CREATE POLICY "shop_manages_own_listing" ON "public"."listing_keywords" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")));



CREATE POLICY "shop_manages_own_specials" ON "public"."daily_specials" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")));



CREATE POLICY "shop_or_admin_inserts_order_items" ON "public"."order_items" FOR INSERT WITH CHECK ((("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid")))));



CREATE POLICY "shop_or_admin_reads_active_riders" ON "public"."riders" FOR SELECT USING ((("is_online" AND "is_approved") OR ("customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid") OR (EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid"))) OR (EXISTS ( SELECT 1
   FROM "public"."sub_orders" "s"
  WHERE (("s"."assigned_rider_id" = "riders"."id") AND ("s"."order_id" IN ( SELECT "public"."fn_my_hub_order_ids"() AS "fn_my_hub_order_ids")))))));



CREATE POLICY "shop_or_admin_reads_daily_summary" ON "public"."daily_shop_sales_summary" FOR SELECT USING ((("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid")))));



CREATE POLICY "shop_or_admin_reads_order_items" ON "public"."order_items" FOR SELECT USING ((("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid")))));



CREATE POLICY "shop_owns_rider_contacts" ON "public"."shop_rider_contacts" USING (("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")));



CREATE POLICY "shop_owns_shop_row" ON "public"."shops" FOR UPDATE USING (("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")));



CREATE POLICY "shop_owns_sub_orders" ON "public"."sub_orders" USING ((("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid")))));



ALTER TABLE "public"."shop_rider_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_staff" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shop_updates_own_specials" ON "public"."daily_specials" FOR UPDATE USING (("shop_id" IN ( SELECT "public"."fn_staff_shop_ids"() AS "fn_staff_shop_ids")));



ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_reads_own_or_owned" ON "public"."shop_staff" FOR SELECT USING ((("customer_id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid") OR ("shop_id" IN ( SELECT "public"."fn_owned_shop_ids"() AS "fn_owned_shop_ids"))));



ALTER TABLE "public"."sub_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update_own_customer_row" ON "public"."customers" FOR UPDATE USING (("id" = ((( SELECT "auth"."jwt"() AS "jwt") ->> 'customer_id'::"text"))::"uuid"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON TABLE "public"."riders" TO "anon";
GRANT ALL ON TABLE "public"."riders" TO "authenticated";
GRANT ALL ON TABLE "public"."riders" TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_approve_rider"("p_rider_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_approve_rider"("p_rider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_approve_rider"("p_rider_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."shops" TO "anon";
GRANT ALL ON TABLE "public"."shops" TO "authenticated";
GRANT ALL ON TABLE "public"."shops" TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_approve_shop"("p_shop_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_approve_shop"("p_shop_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_approve_shop"("p_shop_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_auto_mark_cod_paid_on_delivery"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_auto_mark_cod_paid_on_delivery"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_auto_mark_cod_paid_on_delivery"() TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_ban_customer"("p_customer_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_ban_customer"("p_customer_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ban_customer"("p_customer_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_ban_rider"("p_rider_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_ban_rider"("p_rider_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ban_rider"("p_rider_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_ban_shop"("p_shop_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_ban_shop"("p_shop_id" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ban_shop"("p_shop_id" "text", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_block_banned_rider_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_block_banned_rider_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_block_banned_rider_signup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_claim_delivery_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_claim_delivery_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_claim_delivery_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_create_order"("p_shop_id" "text", "p_items" "jsonb", "p_customer_id" "uuid", "p_fulfillment_type" "public"."fulfillment_type_enum", "p_payment_method" "public"."payment_method_enum", "p_delivery_address" "text", "p_hub_order_id" "uuid", "p_source" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_create_order"("p_shop_id" "text", "p_items" "jsonb", "p_customer_id" "uuid", "p_fulfillment_type" "public"."fulfillment_type_enum", "p_payment_method" "public"."payment_method_enum", "p_delivery_address" "text", "p_hub_order_id" "uuid", "p_source" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_create_order"("p_shop_id" "text", "p_items" "jsonb", "p_customer_id" "uuid", "p_fulfillment_type" "public"."fulfillment_type_enum", "p_payment_method" "public"."payment_method_enum", "p_delivery_address" "text", "p_hub_order_id" "uuid", "p_source" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_customer_related_to_caller"("p_customer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_customer_related_to_caller"("p_customer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_customer_related_to_caller"("p_customer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_enforce_max_rider_contacts"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_enforce_max_rider_contacts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_enforce_max_rider_contacts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_enforce_single_default_rider"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_enforce_single_default_rider"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_enforce_single_default_rider"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generate_daily_shop_sales_summary"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generate_daily_shop_sales_summary"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generate_daily_shop_sales_summary"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_guard_admin_only_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_guard_admin_only_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_guard_admin_only_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_guard_refund_after_pickup"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_guard_refund_after_pickup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_guard_refund_after_pickup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_guard_rider_delivery_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_guard_rider_delivery_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_guard_rider_delivery_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_haversine_km"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_haversine_km"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_haversine_km"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_my_assigned_delivery"("p_sub_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_my_assigned_delivery"("p_sub_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_my_assigned_delivery"("p_sub_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_my_order_sub"("p_sub_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_my_order_sub"("p_sub_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_my_order_sub"("p_sub_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_is_platform_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_is_platform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_my_hub_order_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_my_hub_order_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_my_hub_order_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_my_rider_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_my_rider_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_my_rider_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_owned_shop_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_owned_shop_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_owned_shop_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recompute_hub_order_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recompute_hub_order_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recompute_hub_order_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_register_shop"("p_name" "text", "p_category" "text", "p_phone" "text", "p_open_time" "text", "p_close_time" "text", "p_open_days" "text"[], "p_google_maps_link" "text", "p_delivery_zone" "text", "p_logo_url" "text", "p_lat" numeric, "p_lng" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_register_shop"("p_name" "text", "p_category" "text", "p_phone" "text", "p_open_time" "text", "p_close_time" "text", "p_open_days" "text"[], "p_google_maps_link" "text", "p_delivery_zone" "text", "p_logo_url" "text", "p_lat" numeric, "p_lng" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_register_shop"("p_name" "text", "p_category" "text", "p_phone" "text", "p_open_time" "text", "p_close_time" "text", "p_open_days" "text"[], "p_google_maps_link" "text", "p_delivery_zone" "text", "p_logo_url" "text", "p_lat" numeric, "p_lng" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_reject_rider_deletion"("p_rider_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_reject_rider_deletion"("p_rider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reject_rider_deletion"("p_rider_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_reject_shop_deletion"("p_shop_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_reject_shop_deletion"("p_shop_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reject_shop_deletion"("p_shop_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_require_delivery_address"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_require_delivery_address"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_require_delivery_address"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_resolve_line_customer"("p_line_user_id" "text", "p_name" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_resolve_line_customer"("p_line_user_id" "text", "p_name" "text", "p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_revoke_rider"("p_rider_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_revoke_rider"("p_rider_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_revoke_rider"("p_rider_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_riders_near_shop"("p_shop_id" "text", "p_service" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_riders_near_shop"("p_shop_id" "text", "p_service" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_riders_near_shop"("p_shop_id" "text", "p_service" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_set_initial_delivery_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_set_initial_delivery_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_initial_delivery_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_shops_near_location"("p_lat" numeric, "p_lng" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_shops_near_location"("p_lat" numeric, "p_lng" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_shops_near_location"("p_lat" numeric, "p_lng" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_staff_shop_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_staff_shop_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_staff_shop_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_sub_orders_status_stamps"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_sub_orders_status_stamps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_sub_orders_status_stamps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_top_items_by_shop"("p_shop_id" "text", "p_start_date" "date", "p_end_date" "date", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_top_items_by_shop"("p_shop_id" "text", "p_start_date" "date", "p_end_date" "date", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_top_items_by_shop"("p_shop_id" "text", "p_start_date" "date", "p_end_date" "date", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_track_print_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_track_print_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_track_print_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_track_rider_retry"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_track_rider_retry"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_track_rider_retry"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_unban_customer"("p_customer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_unban_customer"("p_customer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_unban_customer"("p_customer_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_unban_rider"("p_rider_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_unban_rider"("p_rider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_unban_rider"("p_rider_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_unban_shop"("p_shop_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_unban_shop"("p_shop_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_unban_shop"("p_shop_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_verify_rider_document"("p_rider_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_verify_rider_document"("p_rider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_verify_rider_document"("p_rider_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


















GRANT ALL ON TABLE "public"."daily_shop_sales_summary" TO "anon";
GRANT ALL ON TABLE "public"."daily_shop_sales_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_shop_sales_summary" TO "service_role";



GRANT ALL ON TABLE "public"."hub_orders" TO "anon";
GRANT ALL ON TABLE "public"."hub_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_orders" TO "service_role";



GRANT ALL ON TABLE "public"."sub_orders" TO "anon";
GRANT ALL ON TABLE "public"."sub_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_orders" TO "service_role";



GRANT ALL ON TABLE "public"."shop_sales_today_live" TO "anon";
GRANT ALL ON TABLE "public"."shop_sales_today_live" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_sales_today_live" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_payments" TO "anon";
GRANT ALL ON TABLE "public"."subscription_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_payments" TO "service_role";



GRANT ALL ON TABLE "public"."admin_overview" TO "anon";
GRANT ALL ON TABLE "public"."admin_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_overview" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."customer_identities" TO "anon";
GRANT ALL ON TABLE "public"."customer_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_identities" TO "service_role";



GRANT ALL ON TABLE "public"."daily_specials" TO "anon";
GRANT ALL ON TABLE "public"."daily_specials" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_specials" TO "service_role";



GRANT ALL ON TABLE "public"."daily_top_rotation" TO "anon";
GRANT ALL ON TABLE "public"."daily_top_rotation" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_top_rotation" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."listing_keywords" TO "anon";
GRANT ALL ON TABLE "public"."listing_keywords" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_keywords" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admins" TO "anon";
GRANT ALL ON TABLE "public"."platform_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admins" TO "service_role";



GRANT ALL ON TABLE "public"."shop_rider_contacts" TO "anon";
GRANT ALL ON TABLE "public"."shop_rider_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_rider_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."shop_delivery_queue" TO "anon";
GRANT ALL ON TABLE "public"."shop_delivery_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_delivery_queue" TO "service_role";



GRANT ALL ON TABLE "public"."shop_faq_rules" TO "anon";
GRANT ALL ON TABLE "public"."shop_faq_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_faq_rules" TO "service_role";



GRANT ALL ON TABLE "public"."shop_order_view" TO "anon";
GRANT ALL ON TABLE "public"."shop_order_view" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_order_view" TO "service_role";



GRANT ALL ON TABLE "public"."shop_sales_monthly" TO "anon";
GRANT ALL ON TABLE "public"."shop_sales_monthly" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_sales_monthly" TO "service_role";



GRANT ALL ON TABLE "public"."shop_sales_yearly" TO "anon";
GRANT ALL ON TABLE "public"."shop_sales_yearly" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_sales_yearly" TO "service_role";



GRANT ALL ON TABLE "public"."shop_staff" TO "anon";
GRANT ALL ON TABLE "public"."shop_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_staff" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































