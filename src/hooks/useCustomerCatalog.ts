import { useEffect, useMemo, useRef, useState } from "react";
import { publicSupabase } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geolocation";

// ============================================================
// MyTree — shared customer catalog data.
// Extracted from HubHome.tsx so Home and the Food Hub page read the
// exact same shops/menu-items query and nearby-shop ranking instead
// of each running its own copy.
// ============================================================

export type CatalogShop = {
  shop_id: string;
  name: string;
  category: string | null;
  logo_url: string | null;
  is_open: boolean;
  distance_km: number | null;
};
export type CatalogItem = { item_id: string; shop_id: string; name: string; price: number; image_url: string | null; category: string | null };
export type HubCatalogItem = CatalogItem & { is_available: boolean; shop_is_open: boolean };
export type ShopPromotion = {
  id: string;
  shop_id: string;
  special_text: string;
  created_at: string;
  shop_name: string;
  shop_logo_url: string | null;
  shop_is_open: boolean;
};
type ListingKeyword = { id: string; shop_id: string; keyword: string };
export type LocationState = "idle" | "loading" | "ready" | "error";
export type CatalogState = "loading" | "ready" | "error";

const LOCATION_REFRESH_MS = 2 * 60 * 1000;

export function useCustomerCatalog() {
  const [allShops, setAllShops] = useState<CatalogShop[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [hubItems, setHubItems] = useState<HubCatalogItem[]>([]);
  const [promotions, setPromotions] = useState<ShopPromotion[]>([]);
  const [listingKeywords, setListingKeywords] = useState<ListingKeyword[]>([]);
  const [catalogState, setCatalogState] = useState<CatalogState>("loading");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [nearOrder, setNearOrder] = useState<string[] | null>(null);
  const [distanceByShop, setDistanceByShop] = useState<Map<string, number>>(new Map());
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const lastLocationAt = useRef(0);
  const locating = useRef(false);

  async function loadCatalog() {
    setCatalogState("loading");
    setCatalogError(null);
    try {
      const [{ data: s, error: shopError }, { data: m, error: itemError }, { data: hm, error: hubItemError }, { data: p, error: promotionError }, { data: k, error: keywordError }] = await Promise.all([
        publicSupabase.from("shops").select("shop_id,name,category,logo_url,is_open").eq("is_approved", true).eq("is_banned", false),
        publicSupabase
          .from("menu_items")
          .select("item_id,shop_id,name,price,image_url,category, shops!inner(is_open,is_approved,is_banned)")
          .eq("is_available", true)
          .eq("shops.is_open", true)
          .eq("shops.is_approved", true)
          .eq("shops.is_banned", false),
        publicSupabase
          .from("menu_items")
          .select("item_id,shop_id,name,price,image_url,category,is_available, shops!inner(is_open,is_approved,is_banned)")
          .eq("shops.is_approved", true)
          .eq("shops.is_banned", false),
        publicSupabase
          .from("daily_specials")
          .select("id,shop_id,special_text,created_at, shops!inner(name,logo_url,is_open,is_approved,is_banned)")
          .eq("shops.is_approved", true)
          .eq("shops.is_banned", false)
          .order("created_at", { ascending: false })
          .limit(8),
        publicSupabase
          .from("listing_keywords")
          .select("id,shop_id,keyword, shops!inner(is_approved,is_banned)")
          .eq("shops.is_approved", true)
          .eq("shops.is_banned", false),
      ]);
      if (shopError) throw shopError;
      if (itemError) throw itemError;
      if (hubItemError) throw hubItemError;
      setAllShops(((s as Omit<CatalogShop, "distance_km">[]) ?? []).map((shop) => ({ ...shop, distance_km: null })));
      setItems((m as CatalogItem[]) ?? []);
      type HubItemRow = CatalogItem & {
        is_available: boolean;
        shops: { is_open: boolean } | { is_open: boolean }[];
      };
      setHubItems(((hm as unknown as HubItemRow[]) ?? []).flatMap((item) => {
        const relatedShop = Array.isArray(item.shops) ? item.shops[0] : item.shops;
        if (!relatedShop) return [];
        return [{
          item_id: item.item_id,
          shop_id: item.shop_id,
          name: item.name,
          price: item.price,
          image_url: item.image_url,
          category: item.category,
          is_available: item.is_available,
          shop_is_open: relatedShop.is_open,
        }];
      }));
      if (promotionError) {
        // Promotions are optional home content. A promotion read must never
        // turn the whole ordering home into a blank/error screen.
        setPromotions([]);
      } else {
        type PromotionRow = {
          id: string;
          shop_id: string;
          special_text: string | null;
          created_at: string;
          shops: { name: string; logo_url: string | null; is_open: boolean } | { name: string; logo_url: string | null; is_open: boolean }[];
        };
        const rows = (p as unknown as PromotionRow[]) ?? [];
        setPromotions(rows.flatMap((promotion) => {
          const relatedShop = Array.isArray(promotion.shops) ? promotion.shops[0] : promotion.shops;
          const specialText = promotion.special_text?.trim();
          if (!relatedShop || !specialText) return [];
          return [{
            id: promotion.id,
            shop_id: promotion.shop_id,
            special_text: specialText,
            created_at: promotion.created_at,
            shop_name: relatedShop.name,
            shop_logo_url: relatedShop.logo_url,
            shop_is_open: relatedShop.is_open,
          }];
        }));
      }
      if (keywordError) {
        // Keyword metadata enriches search but must never block the public
        // catalog if the optional table or its policy is temporarily unavailable.
        setListingKeywords([]);
      } else {
        setListingKeywords(((k as unknown as ListingKeyword[]) ?? []).flatMap((entry) => {
          const keyword = entry.keyword?.trim();
          return keyword ? [{ id: entry.id, shop_id: entry.shop_id, keyword }] : [];
        }));
      }
      setCatalogState("ready");
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "โหลดข้อมูลร้านไม่สำเร็จ");
      setCatalogState("error");
    }
  }

  useEffect(() => {
    void loadCatalog();
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
      if (data) {
        const rows = data as { shop_id: string; distance_km?: number | string | null }[];
        setNearOrder(rows.map((r) => r.shop_id));
        setDistanceByShop(new Map(rows.flatMap((r) => {
          const distance = Number(r.distance_km);
          return Number.isFinite(distance) ? [[r.shop_id, distance] as const] : [];
        })));
      }
      lastLocationAt.current = Date.now();
      setLocationState("ready");
    } catch {
      setLocationState("error");
    } finally {
      locating.current = false;
    }
  }

  const allOrderedShops = useMemo(() => {
    const withDistance = allShops.map((shop) => ({ ...shop, distance_km: distanceByShop.get(shop.shop_id) ?? null }));
    if (!nearOrder) return withDistance;
    const rank = new Map(nearOrder.map((shopId, index) => [shopId, index]));
    return [...withDistance].sort((a, b) => {
      const aRank = rank.get(a.shop_id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = rank.get(b.shop_id) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    });
  }, [allShops, nearOrder, distanceByShop]);

  // Preserve the original shared-hook contract for FoodHub: its nearby list
  // contains only orderable/open shops. Home separately uses allOrderedShops
  // so closed shops can be labelled honestly instead of disappearing.
  const shops = useMemo(() => allShops.filter((shop) => shop.is_open), [allShops]);
  const orderedShops = useMemo(() => allOrderedShops.filter((shop) => shop.is_open), [allOrderedShops]);

  const cats = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[],
    [items]
  );

  const shopName = (id: string) => allShops.find((x) => x.shop_id === id)?.name ?? "";
  const shopKeywords = (id: string) => listingKeywords.filter((entry) => entry.shop_id === id).map((entry) => entry.keyword).join(" ");

  return {
    shops,
    items,
    hubItems,
    promotions,
    loading: catalogState === "loading",
    catalogState,
    catalogError,
    reloadCatalog: loadCatalog,
    orderedShops,
    allOrderedShops,
    locationState,
    refreshNearbyShops,
    cats,
    shopName,
    shopKeywords,
  };
}
