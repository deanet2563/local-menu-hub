import { useEffect, useMemo, useRef, useState } from "react";
import { publicSupabase } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geolocation";

// ============================================================
// MyTree — shared customer catalog data.
// Extracted from HubHome.tsx so Home and the Food Hub page read the
// exact same shops/menu-items query and nearby-shop ranking instead
// of each running its own copy.
// ============================================================

export type CatalogShop = { shop_id: string; name: string; category: string | null; logo_url: string | null };
export type CatalogItem = { item_id: string; shop_id: string; name: string; price: number; image_url: string | null; category: string | null };
export type LocationState = "idle" | "loading" | "ready" | "error";

const LOCATION_REFRESH_MS = 2 * 60 * 1000;

export function useCustomerCatalog() {
  const [shops, setShops] = useState<CatalogShop[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nearOrder, setNearOrder] = useState<string[] | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const lastLocationAt = useRef(0);
  const locating = useRef(false);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: m }] = await Promise.all([
        publicSupabase.from("shops").select("shop_id,name,category,logo_url").eq("is_open", true).eq("is_approved", true).eq("is_banned", false),
        publicSupabase
          .from("menu_items")
          .select("item_id,shop_id,name,price,image_url,category, shops!inner(is_open,is_approved,is_banned)")
          .eq("is_available", true)
          .eq("shops.is_open", true)
          .eq("shops.is_approved", true)
          .eq("shops.is_banned", false),
      ]);
      setShops((s as CatalogShop[]) ?? []);
      setItems((m as CatalogItem[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    void refreshNearbyShops();

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLocationAt.current < LOCATION_REFRESH_MS) return;
      void refreshNearbyShops();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshNearbyShops() {
    if (locating.current) return;
    locating.current = true;
    setLocationState("loading");
    try {
      const loc = await getCurrentLocation();
      const { data, error } = await publicSupabase.rpc("fn_shops_near_location", { p_lat: loc.lat, p_lng: loc.lng });
      if (error) throw error;
      if (data) setNearOrder((data as { shop_id: string }[]).map((r) => r.shop_id));
      lastLocationAt.current = Date.now();
      setLocationState("ready");
    } catch {
      setLocationState("error");
    } finally {
      locating.current = false;
    }
  }

  const orderedShops = useMemo(() => {
    if (!nearOrder) return shops;
    const rank = new Map(nearOrder.map((shopId, index) => [shopId, index]));
    return [...shops].sort((a, b) => {
      const aRank = rank.get(a.shop_id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = rank.get(b.shop_id) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    });
  }, [shops, nearOrder]);

  const cats = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[],
    [items]
  );

  const shopName = (id: string) => shops.find((x) => x.shop_id === id)?.name ?? "";

  return { shops, items, loading, orderedShops, locationState, refreshNearbyShops, cats, shopName };
}
