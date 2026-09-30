import { supabase } from "@/lib/supabase";
import { normalizeLocalMapLocation, type LocalMapLocation, type LocalMapLocationRow } from "@/lib/localMap";

export type MapCorrection = {
  correction_id: string;
  shop_id: string;
  shop_name: string;
  proposed_lat: number | null;
  proposed_lng: number | null;
  proposed_address: string | null;
  source: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  proposed_at: string;
  proposed_by: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  decision_reason: string | null;
};

export type AdminMapData = { locations: LocalMapLocation[]; corrections: MapCorrection[] };

function assertNoError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function listAdminMapLocations(search: string): Promise<AdminMapData> {
  const { data, error } = await supabase.rpc("fn_admin_list_map_locations", {
    p_search: search.trim() || null,
  });
  assertNoError(error);
  const payload = data as { locations?: LocalMapLocationRow[]; corrections?: MapCorrection[] };
  return {
    locations: (payload.locations ?? []).map(normalizeLocalMapLocation),
    corrections: payload.corrections ?? [],
  };
}

export async function setShopMapVisibility(shopId: string, visible: boolean, reason: string): Promise<void> {
  const { error } = await supabase.rpc("fn_admin_set_shop_map_visibility", {
    p_shop_id: shopId,
    p_visible: visible,
    p_reason: reason.trim(),
  });
  assertNoError(error);
}

export async function proposeShopLocationCorrection(input: {
  shopId: string;
  lat: number;
  lng: number;
  address: string;
  source: string;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc("fn_admin_propose_shop_location_correction", {
    p_shop_id: input.shopId,
    p_lat: input.lat,
    p_lng: input.lng,
    p_address: input.address.trim() || null,
    p_source: input.source,
    p_reason: input.reason.trim(),
  });
  assertNoError(error);
}

export async function reviewShopLocationCorrection(input: {
  correctionId: string;
  decision: "approved" | "rejected";
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc("fn_admin_review_shop_location_correction", {
    p_correction_id: input.correctionId,
    p_decision: input.decision,
    p_reason: input.reason.trim(),
  });
  assertNoError(error);
}
