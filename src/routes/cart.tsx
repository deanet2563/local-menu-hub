import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeliveryAddressFields, formatDeliveryAddress, type DeliveryAddressFieldsValue } from "@/components/DeliveryAddressFields";
import { DeliveryLocationPicker } from "@/components/DeliveryLocationPicker";
import { cart, useCart, cartLineTotal, groupCartItemsByShop, type CartItem } from "@/lib/cart";
import {
  formatDeliveryAddressSummary,
  loadCustomerDeliveryAddresses,
  saveCustomerDeliveryAddresses,
  upsertUsedDeliveryAddress,
  type CustomerDeliveryAddress,
} from "@/lib/deliveryAddressBook";
import {
  googleMapsPreviewUrl,
  quoteDeliveryRoute,
  resolveDeliveryLocation,
  type ConfirmedDeliveryPoint,
  type DeliveryRouteQuote,
} from "@/lib/deliveryLocation";
import { submitOrder } from "@/lib/order";
import { getShopAvailability, type BusinessHours } from "@/lib/shopAvailability";
import { getCurrentCustomerId, publicSupabase, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/cart")({ component: CartCheckout });

type ShopCheckout = {
  name: string;
  delivery_enabled: boolean | null;
  pickup_enabled: boolean | null;
  payment_cash_enabled: boolean;
  payment_qr_enabled: boolean;
  qr_code_url: string | null;
  accepts_preorders: boolean;
  is_open: boolean | null;
  business_hours: BusinessHours | null;
};

type OrderTiming = "now" | "preorder";
type CheckoutErrors = Partial<Record<"customerName" | "customerPhone" | "premises" | "locality" | "deliveryPoint", string>>;

/** Per-shop checkout state. One shop's pay button only ever touches its own entry here. */
type ShopCartState = {
  shopInfo: ShopCheckout | null;
  fulfillment: "delivery" | "pickup";
  payment: "cash" | "qr_transfer";
  timing: OrderTiming;
  requestedForLocal: string;
  note: string;
  routeQuote: DeliveryRouteQuote | null;
  quotingRoute: boolean;
  quoteError: string | null;
  submitting: boolean;
  error: string | null;
  done: boolean;
};

/** Snapshot of a shop's cart lines, captured right before its items leave cart.ts on
 * successful submission — lets the paid card keep rendering after cart.clearShop(). */
type CompletedShopSnapshot = { shopName: string; items: CartItem[]; total: number };

const DEFAULT_SHOP_STATE: ShopCartState = {
  shopInfo: null,
  fulfillment: "delivery",
  payment: "cash",
  timing: "now",
  requestedForLocal: "",
  note: "",
  routeQuote: null,
  quotingRoute: false,
  quoteError: null,
  submitting: false,
  error: null,
  done: false,
};

function toBangkokInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function bangkokInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isSameDeliveryPoint(a: ConfirmedDeliveryPoint | null, b: Pick<ConfirmedDeliveryPoint, "lat" | "lng">): boolean {
  return Boolean(a && Math.abs(a.lat - b.lat) <= 0.000001 && Math.abs(a.lng - b.lng) <= 0.000001);
}

function sourceLabel(point: ConfirmedDeliveryPoint): string {
  if (point.resolutionMethod === "places_text_search") return "Google Places";
  if (point.source === "google_maps_url") return "Google Maps";
  if (point.source === "latlng") return "Latitude / Longitude";
  if (point.source === "device_gps") return "GPS โทรศัพท์";
  return "หมุดบนแผนที่";
}

function shopInitials(name: string | null | undefined): string {
  return (name ?? "?").trim().slice(0, 2).toUpperCase() || "?";
}

function CartCheckout() {
  const c = useCart();
  const groupedByShop = useMemo(() => groupCartItemsByShop(c.items), [c.items]);
  const shopIds = useMemo(() => [...groupedByShop.keys()], [groupedByShop]);

  const [shopStates, setShopStates] = useState<Record<string, ShopCartState>>({});
  const [completedShops, setCompletedShops] = useState<Record<string, CompletedShopSnapshot>>({});
  const addressSavedRef = useRef(false);

  // Shared, cart-wide checkout state (one destination/recipient for the whole order).
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressFieldsValue>({ premises: "", locality: "", instructions: "" });
  const [candidatePoint, setCandidatePoint] = useState<ConfirmedDeliveryPoint | null>(null);
  const [deliveryPoint, setDeliveryPoint] = useState<ConfirmedDeliveryPoint | null>(null);
  const [showDestinationChooser, setShowDestinationChooser] = useState(true);
  const [fallbackExpanded, setFallbackExpanded] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [locating, setLocating] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [deliveryAddresses, setDeliveryAddresses] = useState<CustomerDeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [saveAddressLabel, setSaveAddressLabel] = useState("บ้าน");
  const [makeDefaultAddress, setMakeDefaultAddress] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CheckoutErrors>({});
  const lastQuotedPointKeyRef = useRef<Record<string, string>>({});

  const hasDeliveryShop = shopIds.some((id) => (shopStates[id]?.fulfillment ?? "delivery") === "delivery");

  function updateShop(shopId: string, patch: Partial<ShopCartState>) {
    setShopStates((current) => ({ ...current, [shopId]: { ...(current[shopId] ?? DEFAULT_SHOP_STATE), ...patch } }));
  }

  // Initialise + fetch shop info for any shop newly present in the cart.
  useEffect(() => {
    const missing = shopIds.filter((id) => !(id in shopStates));
    if (missing.length === 0) return;
    setShopStates((current) => {
      const next = { ...current };
      for (const id of missing) next[id] = { ...DEFAULT_SHOP_STATE };
      return next;
    });
    (async () => {
      for (const shopId of missing) {
        const { data } = await publicSupabase
          .from("shops")
          .select("name,delivery_enabled,pickup_enabled,payment_cash_enabled,payment_qr_enabled,qr_code_url,accepts_preorders,is_open,business_hours")
          .eq("shop_id", shopId)
          .maybeSingle();
        const row = data as ShopCheckout | null;
        setShopStates((current) => {
          const existing = current[shopId] ?? DEFAULT_SHOP_STATE;
          const availability = row ? getShopAvailability(row.is_open, row.business_hours) : null;
          const fulfillment = row?.delivery_enabled === false && row.pickup_enabled !== false ? "pickup" : existing.fulfillment;
          const payment = !row?.payment_cash_enabled && row?.payment_qr_enabled ? "qr_transfer" : existing.payment;
          const timing = availability?.state === "schedule_closed" && row?.accepts_preorders && availability.nextOpeningAt ? "preorder" : existing.timing;
          const requestedForLocal = timing === "preorder" && availability?.nextOpeningAt ? toBangkokInput(availability.nextOpeningAt) : existing.requestedForLocal;
          return { ...current, [shopId]: { ...existing, shopInfo: row, fulfillment, payment, timing, requestedForLocal } };
        });
      }
    })();
  }, [shopIds, shopStates]);

  // Auth + saved-address book, once.
  useEffect(() => {
    (async () => {
      try {
        const cid = await getCurrentCustomerId();
        if (!cid) return;
        setCustomerId(cid);
        setDeliveryAddresses(loadCustomerDeliveryAddresses(cid));
        const { data } = await supabase.from("customers").select("name,phone").eq("id", cid).maybeSingle();
        const row = data as { name: string | null; phone: string | null } | null;
        if (row?.name) setCustomerName(row.name);
        if (row?.phone) setCustomerPhone(row.phone);
      } catch {
        // Preview/external browser: leave editable contact fields blank.
      }
    })();
  }, []);

  // Once the shared destination is confirmed, quote it independently for every shop
  // currently set to delivery — each shop has its own pickup point, so the fee differs.
  useEffect(() => {
    if (!deliveryPoint) return;
    const pointKey = `${deliveryPoint.lat.toFixed(6)},${deliveryPoint.lng.toFixed(6)}`;
    for (const shopId of shopIds) {
      const st = shopStates[shopId];
      if (!st || st.fulfillment !== "delivery" || st.done) continue;
      if (lastQuotedPointKeyRef.current[shopId] === pointKey) continue;
      lastQuotedPointKeyRef.current[shopId] = pointKey;
      updateShop(shopId, { quotingRoute: true, quoteError: null });
      quoteDeliveryRoute(shopId, deliveryPoint)
        .then((quote) => updateShop(shopId, { routeQuote: quote, quotingRoute: false }))
        .catch((cause: unknown) => {
          lastQuotedPointKeyRef.current[shopId] = "";
          updateShop(shopId, {
            routeQuote: null,
            quotingRoute: false,
            quoteError: cause instanceof Error ? cause.message : "คำนวณค่าส่งไม่สำเร็จ",
          });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryPoint, shopIds, shopStates]);

  const confirmDeliveryPoint = useCallback(async (point: ConfirmedDeliveryPoint) => {
    setCandidatePoint(point);
    setFieldErrors((current) => ({ ...current, deliveryPoint: undefined }));
    if (isSameDeliveryPoint(deliveryPoint, point)) {
      setShowDestinationChooser(false);
      return;
    }
    setDeliveryPoint(point);
    setShowDestinationChooser(false);
  }, [deliveryPoint]);

  const handleCandidateChange = useCallback((point: ConfirmedDeliveryPoint) => {
    setCandidatePoint(point);
    setDeliveryPoint(null);
    setSelectedAddressId(null);
    setFieldErrors((current) => ({ ...current, deliveryPoint: undefined }));
  }, []);

  function applyFormattedAddressSuggestion(formattedAddress: string) {
    setDeliveryAddress((current) => current.locality.trim() ? current : { ...current, locality: formattedAddress });
  }

  async function selectDeliveryAddress(address: CustomerDeliveryAddress) {
    setSelectedAddressId(address.id);
    setSaveAddress(false);
    setMakeDefaultAddress(address.isDefault);
    setSaveAddressLabel(address.label ?? "บ้าน");
    setCustomerName(address.recipientName);
    setCustomerPhone(address.recipientPhone);
    setDeliveryAddress({ premises: address.premises, locality: address.locality, instructions: address.riderNote });
    setLocationInput(address.submittedMapUrl ?? "");
    setFieldErrors({});
    await confirmDeliveryPoint({
      lat: address.deliveryPinLat,
      lng: address.deliveryPinLng,
      accuracy: address.locationAccuracyM,
      source: address.locationSource,
      submittedValue: address.submittedMapUrl,
      resolvedUrl: null,
      placeId: address.placeId,
      displayName: address.placeDisplayName,
      formattedAddress: address.formattedAddress,
      resolutionMethod: address.placeId ? "places_text_search" : null,
    });
  }

  function addNewDeliveryAddress() {
    setSelectedAddressId(null);
    setDeliveryAddress({ premises: "", locality: "", instructions: "" });
    setCandidatePoint(null);
    setDeliveryPoint(null);
    setLocationInput("");
    setSaveAddress(true);
    setMakeDefaultAddress(deliveryAddresses.length === 0);
    setShowDestinationChooser(true);
    setFieldErrors({});
  }

  async function resolveLocationInput() {
    if (!locationInput.trim()) { setFieldErrors((c) => ({ ...c, deliveryPoint: "วาง Google Maps link หรือ latitude, longitude ก่อน" })); return; }
    setResolvingLocation(true);
    try {
      const point = await resolveDeliveryLocation(locationInput.trim(), shopIds[0] ?? null);
      setCandidatePoint(point);
      setDeliveryPoint(null);
      setSelectedAddressId(null);
      if (point.formattedAddress) applyFormattedAddressSuggestion(point.formattedAddress);
    } catch (cause) {
      setFieldErrors((c) => ({ ...c, deliveryPoint: cause instanceof Error ? cause.message : "ตรวจจุดส่งไม่สำเร็จ" }));
    } finally {
      setResolvingLocation(false);
    }
  }

  function captureDeliveryPoint() {
    if (!("geolocation" in navigator)) {
      setFieldErrors((c) => ({ ...c, deliveryPoint: "อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง" }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: ConfirmedDeliveryPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          source: "device_gps",
        };
        setLocating(false);
        setLocationInput("");
        setSelectedAddressId(null);
        void confirmDeliveryPoint(point);
      },
      (geoError) => {
        setLocating(false);
        setDeliveryPoint(null);
        setFieldErrors((c) => ({
          ...c,
          deliveryPoint: geoError.code === 1
            ? "ไม่ได้อนุญาตตำแหน่ง - ใช้ Google Maps link หรือ latitude, longitude แทนได้"
            : "อ่านตำแหน่งปัจจุบันไม่สำเร็จ - ใช้ Google Maps link หรือ latitude, longitude แทนได้",
        }));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }

  function changeDestination() {
    setCandidatePoint(deliveryPoint);
    setDeliveryPoint(null);
    setShowDestinationChooser(true);
  }

  async function confirmShop(shopId: string) {
    const st = shopStates[shopId];
    if (!st) return;
    const items = groupedByShop.get(shopId) ?? [];
    if (items.length === 0) return;
    const shopInfo = st.shopInfo;
    const availability = shopInfo ? getShopAvailability(shopInfo.is_open, shopInfo.business_hours) : null;
    const formattedAddress = formatDeliveryAddress(deliveryAddress);

    if (st.fulfillment === "delivery" || hasDeliveryShop) {
      const nextFieldErrors: CheckoutErrors = {};
      if (st.fulfillment === "delivery" && !deliveryPoint) nextFieldErrors.deliveryPoint = "กรุณายืนยันจุดส่งจริงสำหรับ Rider";
      if (!customerName.trim()) nextFieldErrors.customerName = "กรุณากรอกชื่อผู้รับ";
      if (!customerPhone.trim()) nextFieldErrors.customerPhone = "กรุณากรอกเบอร์โทรผู้รับ";
      if (st.fulfillment === "delivery" && !deliveryAddress.premises.trim()) nextFieldErrors.premises = "กรุณากรอกบ้านเลขที่ / หมู่บ้าน / อาคาร";
      if (st.fulfillment === "delivery" && !deliveryAddress.locality.trim()) nextFieldErrors.locality = "กรุณากรอกซอย / ถนน / แขวง-ตำบล / เขต-อำเภอ / จังหวัด";
      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors((current) => ({ ...current, ...nextFieldErrors }));
        updateShop(shopId, { error: "กรุณากรอกข้อมูลจำเป็นให้ครบ" });
        return;
      }
    }
    if (st.fulfillment === "delivery" && !st.routeQuote) return updateShop(shopId, { error: "กรุณารอให้ระบบคำนวณค่าส่งของร้านนี้ก่อนสั่ง" });
    if (st.fulfillment === "delivery" && shopInfo?.delivery_enabled === false) return updateShop(shopId, { error: "ร้านนี้ไม่เปิดบริการจัดส่ง" });
    if (st.fulfillment === "pickup" && shopInfo?.pickup_enabled === false) return updateShop(shopId, { error: "ร้านนี้ไม่เปิดบริการรับเอง" });
    if (st.payment === "cash" && shopInfo && !shopInfo.payment_cash_enabled) return updateShop(shopId, { error: "ร้านนี้ไม่รับเงินสด" });
    if (st.payment === "qr_transfer" && shopInfo && !shopInfo.payment_qr_enabled) return updateShop(shopId, { error: "ร้านนี้ไม่รับชำระผ่าน QR" });
    if (availability?.state === "manual_closed") return updateShop(shopId, { error: "ร้านปิดรับออเดอร์ชั่วคราว" });
    if (st.timing === "now" && availability && !availability.canOrder) return updateShop(shopId, { error: "ร้านยังไม่เปิดในขณะนี้ กรุณาเลือกสั่งล่วงหน้า" });
    if (st.timing === "preorder" && !shopInfo?.accepts_preorders) return updateShop(shopId, { error: "ร้านนี้ไม่เปิดรับสั่งล่วงหน้า" });
    const requestedFor = st.timing === "preorder" ? bangkokInputToIso(st.requestedForLocal) : null;
    if (st.timing === "preorder" && !requestedFor) return updateShop(shopId, { error: "กรุณาเลือกวันและเวลารับ/ส่ง" });

    updateShop(shopId, { submitting: true, error: null });
    const cid = await getCurrentCustomerId();
    if (cid) await supabase.from("customers").update({ name: customerName.trim(), phone: customerPhone.trim() }).eq("id", cid);

    const res = await submitOrder({
      shopId,
      items: items.map((i) => ({
        lineId: i.lineId,
        kind: i.kind,
        itemId: i.itemId,
        qty: i.qty,
        options: i.options,
        note: i.note,
        bundleSelections: i.bundleSelections,
      })),
      fulfillment: st.fulfillment,
      payment: st.payment,
      address: st.fulfillment === "delivery" ? formattedAddress : null,
      destinationLat: st.fulfillment === "delivery" ? deliveryPoint?.lat ?? null : null,
      destinationLng: st.fulfillment === "delivery" ? deliveryPoint?.lng ?? null : null,
      locationSource: st.fulfillment === "delivery" ? deliveryPoint?.source ?? null : null,
      locationAccuracyM: st.fulfillment === "delivery" ? deliveryPoint?.accuracy ?? null : null,
      submittedMapUrl: st.fulfillment === "delivery" && deliveryPoint?.source === "google_maps_url" ? deliveryPoint.submittedValue ?? null : null,
      // Pass this shop's own quote token directly — quoteDeliveryRoute/getDeliveryQuoteToken
      // track only ONE global binding, which multi-shop quoting would otherwise stomp on.
      deliveryQuoteToken: st.fulfillment === "delivery" ? st.routeQuote?.quoteToken ?? null : null,
      note: st.note.trim() || null,
      requestedFor,
    });

    updateShop(shopId, { submitting: false });
    if (!res.ok) return updateShop(shopId, { error: res.error ?? "สั่งไม่สำเร็จ" });

    if (customerId && st.fulfillment === "delivery" && deliveryPoint && !addressSavedRef.current) {
      addressSavedRef.current = true;
      const nextAddresses = upsertUsedDeliveryAddress(deliveryAddresses, {
        recipientName: customerName.trim(),
        recipientPhone: customerPhone.trim(),
        premises: deliveryAddress.premises.trim(),
        locality: deliveryAddress.locality.trim(),
        riderNote: deliveryAddress.instructions.trim(),
        placeId: deliveryPoint.placeId ?? null,
        placeDisplayName: deliveryPoint.displayName ?? null,
        formattedAddress: deliveryPoint.formattedAddress ?? null,
        deliveryPinLat: deliveryPoint.lat,
        deliveryPinLng: deliveryPoint.lng,
        locationSource: deliveryPoint.source,
        submittedMapUrl: deliveryPoint.source === "google_maps_url" ? deliveryPoint.submittedValue ?? null : null,
        locationAccuracyM: deliveryPoint.accuracy ?? null,
      }, { selectedAddressId, saveRequested: saveAddress, saveLabel: saveAddressLabel, makeDefault: makeDefaultAddress });
      saveCustomerDeliveryAddresses(customerId, nextAddresses);
      setDeliveryAddresses(nextAddresses);
    }

    const shopName = st.shopInfo?.name ?? "ร้านค้า";
    const total = items.reduce((sum, i) => sum + cartLineTotal(i), 0);
    setCompletedShops((current) => ({ ...current, [shopId]: { shopName, items, total } }));
    cart.clearShop(shopId);
    updateShop(shopId, { done: true });
  }

  function clearAllCart() {
    const ok = window.confirm("ล้างตะกร้าทั้งหมด? สินค้าจากทุกร้านในตะกร้าจะถูกลบ");
    if (!ok) return;
    cart.clear();
  }

  const grandTotal = shopIds.reduce((total, shopId) => {
    const items = groupedByShop.get(shopId) ?? [];
    const subtotal = items.reduce((sum, i) => sum + cartLineTotal(i), 0);
    const st = shopStates[shopId];
    const deliveryFee = st?.fulfillment === "delivery" ? st.routeQuote?.deliveryFee ?? 0 : 0;
    return total + subtotal + deliveryFee;
  }, 0);
  const totalShopCount = shopIds.length;
  const totalItemCount = c.items.reduce((n, i) => n + i.qty, 0);
  const anyCompleted = Object.keys(completedShops).length > 0;

  if (c.items.length === 0 && !anyCompleted) return (
    <div className="p-6 text-center text-sm text-gray-400">
      ตะกร้าว่าง
      <Link to="/" className="text-[#3f6b4a] underline block mt-2">เลือกอาหาร</Link>
    </div>
  );

  if (c.items.length === 0 && anyCompleted) return (
    <div className="p-6 text-center space-y-2 max-w-md mx-auto">
      <p className="text-2xl">✅</p>
      <p className="text-lg font-semibold">ส่งคำสั่งซื้อครบทุกร้านแล้ว</p>
      <p className="text-sm text-gray-500">กำลังรอร้านยืนยันออเดอร์ ติดตามสถานะได้ที่ประวัติออเดอร์</p>
      <Link to="/orders" className="text-[#3f6b4a] underline block mt-2">ดูสถานะออเดอร์</Link>
      <Link to="/" className="text-gray-400 underline block text-sm">กลับหน้าแรก</Link>
    </div>
  );

  return (
    <div className="p-4 pb-32 space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">ตะกร้าของฉัน</h1>
          <p className="text-xs text-gray-500 mt-0.5">{totalItemCount} รายการ · {totalShopCount + Object.keys(completedShops).length} ร้าน</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <Link to="/" className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-2 text-sm text-gray-700">
            <span aria-hidden="true">←</span>
            <span>เพิ่มร้าน/สินค้า</span>
          </Link>
          {c.items.length > 0 && (
            <button type="button" onClick={clearAllCart} className="text-[11px] text-red-500 underline">
              ล้างตะกร้าทั้งหมด
            </button>
          )}
        </div>
      </div>

      {/* Paid shop cards — kept visible via snapshot even after cart.clearShop(). */}
      {Object.entries(completedShops).map(([shopId, snap]) => (
        <section key={`done-${shopId}`} className="rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-3.5 py-3 bg-[#e6ede4] flex items-center justify-between gap-2">
            <p className="font-bold text-sm text-[#28432f] flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-white border border-[#3f6b4a] text-[#28432f] flex items-center justify-center text-[10px] font-extrabold shrink-0">{shopInitials(snap.shopName)}</span>
              {snap.shopName}
            </p>
            <span className="text-[10.5px] rounded-full px-2.5 py-1 bg-[#3f6b4a] text-white font-medium">จ่ายแล้ว</span>
          </div>
          <div className="divide-y divide-gray-100">
            {snap.items.map((i) => (
              <div key={i.lineId} className="flex justify-between gap-3 px-3.5 py-2 text-xs">
                <span><span className="text-gray-400 mr-1">{i.qty}x</span>{i.name}</span>
                <span className="text-gray-600 shrink-0">฿{cartLineTotal(i)}</span>
              </div>
            ))}
          </div>
          <div className="px-3.5 py-2.5 flex justify-between text-xs font-semibold">
            <span>ยอดรวมร้านนี้</span><span className="text-[#a85f2c]">฿{snap.total}</span>
          </div>
        </section>
      ))}

      {/* One card per shop still in the cart. */}
      {shopIds.map((shopId) => {
        const items = groupedByShop.get(shopId) ?? [];
        const st = shopStates[shopId] ?? DEFAULT_SHOP_STATE;
        const shopInfo = st.shopInfo;
        const availability = shopInfo ? getShopAvailability(shopInfo.is_open, shopInfo.business_hours) : null;
        const subtotal = items.reduce((sum, i) => sum + cartLineTotal(i), 0);

        return (
          <section key={shopId} className="rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-3.5 py-3 bg-[#e6ede4] flex items-center justify-between gap-2">
              <p className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-white border border-[#3f6b4a] text-[#28432f] flex items-center justify-center text-[10px] font-extrabold shrink-0">{shopInitials(shopInfo?.name)}</span>
                {shopInfo?.name ?? "กำลังโหลด..."}
              </p>
              <span className="text-[10.5px] rounded-full px-2.5 py-1 border border-[#3f6b4a] text-[#28432f] bg-white font-medium">ยังไม่จ่าย</span>
            </div>

            {availability?.state === "manual_closed" && <div className="mx-3.5 mt-2 rounded-lg bg-red-50 border border-red-100 p-2 text-xs text-red-600">ร้านปิดรับออเดอร์ชั่วคราว</div>}
            {availability?.state === "schedule_closed" && (
              <div className="mx-3.5 mt-2 rounded-lg bg-amber-50 border border-amber-100 p-2 text-xs text-amber-700">
                <p className="font-medium">ร้านปิดตามเวลาทำการ</p>
                {availability.detail && <p className="mt-0.5">{availability.detail}</p>}
              </div>
            )}

            <div className="divide-y divide-gray-100">
              {items.map((i) => (
                <div key={i.lineId} className="px-3.5 py-3 text-sm space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{i.name}</span>
                    <span className="text-gray-600 shrink-0">฿{cartLineTotal(i)}</span>
                  </div>
                  {i.options.length > 0 && <p className="text-xs text-gray-500">{i.options.map((o) => `${o.groupName}: ${o.optionName}`).join(" · ")}</p>}
                  {i.bundleSelections.length > 0 && <div className="text-xs text-gray-500 pl-2 border-l border-gray-200 space-y-0.5">{i.bundleSelections.map((s, idx) => <p key={`${s.groupId}-${s.itemId}-${idx}`}>{s.itemName} × {s.qty}</p>)}</div>}
                  {i.note && <p className="text-xs text-gray-400">📝 {i.note}</p>}
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => cart.setQty(i.lineId, i.qty - 1)} className="h-8 w-8 rounded-full border border-gray-200 bg-white text-base text-gray-700" aria-label={`ลดจำนวน ${i.name}`}>−</button>
                    <span className="w-7 text-center text-sm font-medium" aria-label={`จำนวน ${i.qty}`}>{i.qty}</span>
                    <button type="button" onClick={() => cart.setQty(i.lineId, i.qty + 1)} className="h-8 w-8 rounded-full bg-[#3f6b4a] text-base text-white" aria-label={`เพิ่มจำนวน ${i.name}`}>+</button>
                    <button type="button" onClick={() => cart.remove(i.lineId)} className="ml-1 h-8 px-2.5 rounded-lg bg-red-50 text-red-500 text-[11px] font-medium" aria-label={`ลบ ${i.name} ออกจากตะกร้า`}>ลบ</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-3.5 py-3 space-y-3 border-t border-gray-100">
              <div className="flex justify-between text-sm font-semibold">
                <span>ยอดรวมร้านนี้</span>
                <span className="text-[#a85f2c]">
                  {st.fulfillment === "delivery" && st.routeQuote
                    ? `฿${subtotal} + ส่ง ฿${st.routeQuote.deliveryFee.toFixed(2)} = ฿${(subtotal + st.routeQuote.deliveryFee).toFixed(2)}`
                    : `฿${subtotal}`}
                </span>
              </div>

              <div className="flex gap-2">
                {shopInfo?.delivery_enabled !== false && <button type="button" onClick={() => updateShop(shopId, { fulfillment: "delivery" })} className={`flex-1 rounded-lg py-2 text-xs ${st.fulfillment === "delivery" ? "bg-[#3f6b4a] text-white" : "bg-gray-100 text-gray-700"}`}>ส่งถึงบ้าน</button>}
                {shopInfo?.pickup_enabled !== false && <button type="button" onClick={() => updateShop(shopId, { fulfillment: "pickup" })} className={`flex-1 rounded-lg py-2 text-xs ${st.fulfillment === "pickup" ? "bg-[#3f6b4a] text-white" : "bg-gray-100 text-gray-700"}`}>รับเอง</button>}
              </div>

              {st.fulfillment === "delivery" && (
                <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-2.5 text-xs">
                  {st.quotingRoute && <p className="text-gray-500">กำลังคำนวณค่าส่งของร้านนี้...</p>}
                  {!st.quotingRoute && st.routeQuote && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{(st.routeQuote.distanceMeters / 1000).toFixed(2)} กม.</span>
                      <span className="font-semibold text-[#a85f2c]">ค่าส่ง ฿{st.routeQuote.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  {!st.quotingRoute && !st.routeQuote && !deliveryPoint && <p className="text-gray-500">ยืนยันจุดส่งด้านล่างเพื่อคำนวณค่าส่งร้านนี้</p>}
                  {!st.quotingRoute && st.quoteError && <p className="text-red-600">{st.quoteError}</p>}
                </div>
              )}

              {shopInfo?.accepts_preorders && availability?.state !== "manual_closed" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={!availability?.canOrder} onClick={() => updateShop(shopId, { timing: "now" })} className={`rounded-lg py-2 text-xs disabled:opacity-40 ${st.timing === "now" ? "bg-[#3f6b4a] text-white" : "bg-gray-100 text-gray-700"}`}>สั่งตอนนี้</button>
                    <button type="button" onClick={() => updateShop(shopId, { timing: "preorder" })} className={`rounded-lg py-2 text-xs ${st.timing === "preorder" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-700"}`}>สั่งล่วงหน้า</button>
                  </div>
                  {st.timing === "preorder" && (
                    <input type="datetime-local" value={st.requestedForLocal} onChange={(e) => updateShop(shopId, { requestedForLocal: e.target.value })} className="w-full rounded-lg border border-gray-200 p-2 text-xs" />
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {shopInfo?.payment_cash_enabled !== false && <button type="button" onClick={() => updateShop(shopId, { payment: "cash" })} className={`flex-1 rounded-lg py-2 text-xs ${st.payment === "cash" ? "bg-[#3f6b4a] text-white" : "bg-gray-100 text-gray-700"}`}>💵 เงินสด</button>}
                {shopInfo?.payment_qr_enabled && <button type="button" onClick={() => updateShop(shopId, { payment: "qr_transfer" })} className={`flex-1 rounded-lg py-2 text-xs ${st.payment === "qr_transfer" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700"}`}>📱 QR</button>}
              </div>
              {st.payment === "qr_transfer" && shopInfo?.qr_code_url && <img src={shopInfo.qr_code_url} alt={`QR Code ${shopInfo.name}`} className="w-36 h-36 object-contain mx-auto rounded-lg border border-gray-100" />}

              <input className="w-full rounded-lg border border-gray-200 p-2 text-xs" placeholder="หมายเหตุถึงร้าน (ไม่บังคับ)" value={st.note} onChange={(e) => updateShop(shopId, { note: e.target.value })} />

              {st.error && <p className="text-xs text-red-600">{st.error}</p>}

              <button
                type="button"
                onClick={() => void confirmShop(shopId)}
                disabled={st.submitting || (st.fulfillment === "delivery" && st.quotingRoute) || availability?.state === "manual_closed"}
                className="w-full rounded-lg bg-[#3f6b4a] text-white py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {st.submitting ? "กำลังส่ง..." : "ชำระเงินร้านนี้"}
              </button>
            </div>
          </section>
        );
      })}

      {/* Shared delivery destination + recipient — reused by every shop currently set to delivery. */}
      {hasDeliveryShop && (
        <>
          <section className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">📍 จุดส่งสินค้า <span className="text-red-600" aria-hidden="true">*</span></p>
              <p className="mt-1 text-xs leading-5 text-gray-600">จุดส่งเดียวใช้ร่วมกันทุกร้านที่เลือกส่งถึงบ้าน แต่ละร้านคำนวณค่าส่งแยกกัน</p>
            </div>

            {deliveryAddresses.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800">ที่อยู่ที่เคยใช้</p>
                  <button type="button" onClick={addNewDeliveryAddress} className="text-xs font-medium text-[#3f6b4a]">+ เพิ่มที่อยู่ใหม่</button>
                </div>
                {deliveryAddresses.map((address) => (
                  <div key={address.id} className={`rounded-lg border p-2.5 text-sm ${selectedAddressId === address.id ? "border-[#3f6b4a] bg-[#e6ede4]" : "border-gray-100 bg-gray-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800">{address.label || (address.kind === "saved" ? "ที่อยู่ที่บันทึกไว้" : "ที่อยู่ล่าสุด")}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-600">{formatDeliveryAddressSummary(address)}</p>
                        <p className="mt-1 text-[11px] text-[#3f6b4a]">📍 มีหมุดจุดส่งที่ยืนยันแล้ว</p>
                        {address.lastUsedAt && <p className="mt-0.5 text-[11px] text-gray-400">ใช้ล่าสุด {new Date(address.lastUsedAt).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" })}</p>}
                      </div>
                      {address.isDefault && <span className="shrink-0 rounded-full bg-[#e6ede4] px-2 py-0.5 text-[10px] font-medium text-[#28432f]">หลัก</span>}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => void selectDeliveryAddress(address)} className="flex-1 rounded-lg bg-[#3f6b4a] px-3 py-2 text-xs font-medium text-white">ใช้ที่อยู่นี้</button>
                      <a href={googleMapsPreviewUrl({ lat: address.deliveryPinLat, lng: address.deliveryPinLng, placeId: address.placeId })} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-blue-700">เปิดแผนที่</a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {deliveryPoint && !showDestinationChooser ? (
              <div className="rounded-lg border border-[#3f6b4a]/25 bg-[#e6ede4] p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#28432f]">{deliveryPoint.source === "device_gps" ? "ใช้ตำแหน่งปัจจุบันเป็นจุดส่งแล้ว" : "จุดส่งยืนยันแล้ว"}</p>
                    {deliveryPoint.source === "device_gps" && <p className="mt-1 text-xs leading-5 text-[#3f6b4a]">ไม่จำเป็นต้องใส่ Google Maps link เพิ่ม</p>}
                    {deliveryPoint.displayName && <p className="mt-1 text-base font-bold leading-5 text-[#28432f]">{deliveryPoint.displayName}</p>}
                    {deliveryPoint.formattedAddress && <p className="mt-1 text-xs leading-5 text-[#28432f]">{deliveryPoint.formattedAddress}</p>}
                    <p className="mt-1 font-mono text-[11px] text-[#3f6b4a]">📍 {deliveryPoint.lat.toFixed(6)}, {deliveryPoint.lng.toFixed(6)}</p>
                    <p className="mt-1 text-[11px] text-[#3f6b4a]">แหล่งที่มา: {sourceLabel(deliveryPoint)}</p>
                  </div>
                  <a href={googleMapsPreviewUrl(deliveryPoint)} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-blue-700 underline">เปิดแผนที่</a>
                </div>
                {deliveryPoint.placeId && <div className="rounded-lg border border-[#3f6b4a]/25 bg-white/80 p-2 text-xs leading-5 text-[#28432f]">Place identity ใช้เป็นบริบทของสถานที่ ส่วนพิกัดหมุดนี้คือจุดที่ Rider ต้องไปจริง</div>}
                {deliveryPoint.source === "device_gps" && deliveryPoint.accuracy != null && deliveryPoint.accuracy > 30 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">GPS เครื่องนี้คลาดเคลื่อนประมาณ {Math.round(deliveryPoint.accuracy)} ม. ควรตรวจหมุดก่อนสั่ง</div>}
                <button type="button" onClick={changeDestination} className="text-xs text-gray-500 underline">เปลี่ยนจุดส่ง</button>
              </div>
            ) : (
              <div className="space-y-3">
                <DeliveryLocationPicker shopId={shopIds[0] ?? null} candidate={candidatePoint} onCandidateChange={handleCandidateChange} onSafeFormattedAddress={applyFormattedAddressSuggestion} />
                <button type="button" onClick={captureDeliveryPoint} disabled={locating} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 disabled:opacity-50">{locating ? "กำลังหาตำแหน่ง..." : "ใช้ตำแหน่งปัจจุบัน"}</button>
                <div className="rounded-lg border border-gray-200 bg-white">
                  <button type="button" onClick={() => setFallbackExpanded((current) => !current)} className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-medium text-gray-800">
                    <span>มี Google Maps link อยู่แล้ว?</span>
                    <span aria-hidden="true">{fallbackExpanded ? "−" : "+"}</span>
                  </button>
                  {fallbackExpanded && (
                    <div className="border-t border-gray-100 p-3 space-y-2">
                      <label htmlFor="delivery-pin-input" className="sr-only">Google Maps link หรือ latitude, longitude</label>
                      <textarea id="delivery-pin-input" rows={2} value={locationInput} onChange={(e) => { setLocationInput(e.target.value); setFieldErrors((current) => ({ ...current, deliveryPoint: undefined })); }} placeholder="https://maps.app.goo.gl/... หรือ 13.77314, 100.67611" className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm" aria-invalid={Boolean(fieldErrors.deliveryPoint)} aria-describedby={fieldErrors.deliveryPoint ? "delivery-pin-error" : undefined} />
                      <button type="button" onClick={() => void resolveLocationInput()} disabled={resolvingLocation || !locationInput.trim()} className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-40">{resolvingLocation ? "กำลังตรวจจุดส่ง..." : "ตรวจจุดส่งจากลิงก์/พิกัด"}</button>
                    </div>
                  )}
                </div>
                {fieldErrors.deliveryPoint && <p id="delivery-pin-error" className="text-xs text-red-600">{fieldErrors.deliveryPoint}</p>}
                {candidatePoint && <button type="button" onClick={() => void confirmDeliveryPoint(candidatePoint)} className="w-full rounded-lg bg-[#3f6b4a] px-3 py-3 text-sm font-semibold text-white">ยืนยันจุดส่งนี้</button>}
              </div>
            )}
          </section>

          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <p className="text-sm font-semibold text-gray-800">ข้อมูลผู้รับ</p>
            <div className="space-y-1">
              <label htmlFor="recipient-name" className="text-xs font-medium text-gray-600">ชื่อผู้รับ <span className="text-red-600" aria-hidden="true">*</span></label>
              <input id="recipient-name" className="w-full rounded-lg border border-gray-200 p-2 text-sm" value={customerName} onChange={(e) => { setCustomerName(e.target.value); setFieldErrors((current) => ({ ...current, customerName: undefined })); }} aria-invalid={Boolean(fieldErrors.customerName)} aria-describedby={fieldErrors.customerName ? "recipient-name-error" : undefined} />
              {fieldErrors.customerName && <p id="recipient-name-error" className="text-xs text-red-600">{fieldErrors.customerName}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="recipient-phone" className="text-xs font-medium text-gray-600">เบอร์โทรผู้รับ <span className="text-red-600" aria-hidden="true">*</span></label>
              <input id="recipient-phone" className="w-full rounded-lg border border-gray-200 p-2 text-sm" value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value.replace(/[^0-9]/g, "")); setFieldErrors((current) => ({ ...current, customerPhone: undefined })); }} inputMode="numeric" type="tel" maxLength={10} aria-invalid={Boolean(fieldErrors.customerPhone)} aria-describedby={fieldErrors.customerPhone ? "recipient-phone-error" : undefined} />
              {fieldErrors.customerPhone && <p id="recipient-phone-error" className="text-xs text-red-600">{fieldErrors.customerPhone}</p>}
            </div>
          </div>

          <DeliveryAddressFields value={deliveryAddress} onChange={setDeliveryAddress} errors={{ premises: fieldErrors.premises, locality: fieldErrors.locality }} onFieldChange={(field) => { setSelectedAddressId(null); setFieldErrors((current) => ({ ...current, [field]: undefined })); }} />
          <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
            <label className="flex items-start gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} className="mt-0.5" />
              <span>บันทึกที่อยู่นี้ไว้ใช้ครั้งต่อไป</span>
            </label>
            {saveAddress && (
              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                <div className="space-y-1">
                  <label htmlFor="delivery-address-label" className="text-xs font-medium text-gray-600">ตั้งชื่อ เช่น บ้าน / ที่ทำงาน</label>
                  <input id="delivery-address-label" value={saveAddressLabel} onChange={(event) => setSaveAddressLabel(event.target.value)} className="w-full rounded-lg border border-gray-200 p-2 text-sm" />
                </div>
                <label className="flex items-center gap-1 pb-2 text-[11px] text-gray-600"><input type="checkbox" checked={makeDefaultAddress} onChange={(event) => setMakeDefaultAddress(event.target.checked)} />หลัก</label>
              </div>
            )}
          </div>
        </>
      )}

      <div className="fixed left-4 right-4 bottom-4 z-20 rounded-xl bg-[#28432f] shadow-lg px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-white/70">ยอดรวมทั้งตะกร้า</span>
        <span className="text-base font-bold text-white">฿{grandTotal.toFixed(2)}</span>
      </div>
    </div>
  );
}
