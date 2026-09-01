import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { cart, useCart, cartLineTotal, cartTotal } from "@/lib/cart";
import { publicSupabase, supabase, getCurrentCustomerId } from "@/lib/supabase";
import { submitOrder } from "@/lib/order";
import { getShopAvailability, type BusinessHours } from "@/lib/shopAvailability";
import {
  DeliveryAddressFields,
  formatDeliveryAddress,
  type DeliveryAddressFieldsValue,
} from "@/components/DeliveryAddressFields";
import {
  googleMapsPreviewUrl,
  quoteDeliveryRoute,
  resolveDeliveryLocation,
  type ConfirmedDeliveryPoint,
  type DeliveryRouteQuote,
} from "@/lib/deliveryLocation";
import {
  formatDeliveryAddressSummary,
  loadCustomerDeliveryAddresses,
  saveCustomerDeliveryAddresses,
  upsertUsedDeliveryAddress,
  type CustomerDeliveryAddress,
} from "@/lib/deliveryAddressBook";

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

function CartCheckout() {
  const c = useCart();
  const [shop, setShop] = useState<ShopCheckout | null>(null);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [payment, setPayment] = useState<"cash" | "qr_transfer">("cash");
  const [timing, setTiming] = useState<OrderTiming>("now");
  const [requestedForLocal, setRequestedForLocal] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressFieldsValue>({
    premises: "",
    locality: "",
    instructions: "",
  });
  const [deliveryPoint, setDeliveryPoint] = useState<ConfirmedDeliveryPoint | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [locating, setLocating] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [routeQuote, setRouteQuote] = useState<DeliveryRouteQuote | null>(null);
  const [quotingRoute, setQuotingRoute] = useState(false);
  const [note, setNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [deliveryAddresses, setDeliveryAddresses] = useState<CustomerDeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [saveAddressLabel, setSaveAddressLabel] = useState("บ้าน");
  const [makeDefaultAddress, setMakeDefaultAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CheckoutErrors>({});
  const [done, setDone] = useState(false);

  const availability = useMemo(
    () => shop ? getShopAvailability(shop.is_open, shop.business_hours) : null,
    [shop]
  );

  const groupedItems = useMemo(() => {
    const groups: Array<{
      key: string;
      name: string;
      isSet: boolean;
      items: typeof c.items;
      count: number;
      total: number;
    }> = [];
    const index = new Map<string, number>();

    for (const item of c.items) {
      const key = item.setId ? `set:${item.setId}` : "general";
      let groupIndex = index.get(key);
      if (groupIndex === undefined) {
        groupIndex = groups.length;
        index.set(key, groupIndex);
        groups.push({
          key,
          name: item.setName || "รายการทั่วไป",
          isSet: !!item.setId,
          items: [],
          count: 0,
          total: 0,
        });
      }
      const group = groups[groupIndex];
      if (!group) continue;
      group.items.push(item);
      group.count += item.qty;
      group.total += cartLineTotal(item);
    }

    return [
      ...groups.filter((g) => g.isSet),
      ...groups.filter((g) => !g.isSet),
    ];
  }, [c.items]);

  useEffect(() => {
    (async () => {
      if (!c.shopId) return;
      const { data } = await publicSupabase
        .from("shops")
        .select("name,delivery_enabled,pickup_enabled,payment_cash_enabled,payment_qr_enabled,qr_code_url,accepts_preorders,is_open,business_hours")
        .eq("shop_id", c.shopId)
        .maybeSingle();
      const row = data as ShopCheckout | null;
      setShop(row);
      if (row?.delivery_enabled === false && row.pickup_enabled !== false) setFulfillment("pickup");
      if (!row?.payment_cash_enabled && row?.payment_qr_enabled) setPayment("qr_transfer");
    })();
  }, [c.shopId]);

  useEffect(() => {
    if (!shop || !availability) return;
    if (availability.state === "schedule_closed" && shop.accepts_preorders && availability.nextOpeningAt) {
      setTiming("preorder");
      setRequestedForLocal(toBangkokInput(availability.nextOpeningAt));
    } else if (availability.state === "open") {
      setTiming("now");
    }
  }, [shop, availability]);

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

  function isSameDeliveryPoint(a: ConfirmedDeliveryPoint | null, b: Pick<ConfirmedDeliveryPoint, "lat" | "lng">): boolean {
    return Boolean(a && Math.abs(a.lat - b.lat) <= 0.000001 && Math.abs(a.lng - b.lng) <= 0.000001);
  }

  async function applyDeliveryPoint(point: ConfirmedDeliveryPoint) {
    setDeliveryPoint(point);
    setFieldErrors((current) => ({ ...current, deliveryPoint: undefined }));
    if (isSameDeliveryPoint(deliveryPoint, point) && routeQuote) return;
    setRouteQuote(null);
    if (!c.shopId) return;
    setQuotingRoute(true);
    setError(null);
    try {
      const quote = await quoteDeliveryRoute(c.shopId, point);
      setRouteQuote(quote);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "คำนวณเส้นทางไม่สำเร็จ");
    } finally {
      setQuotingRoute(false);
    }
  }

  async function selectDeliveryAddress(address: CustomerDeliveryAddress) {
    setSelectedAddressId(address.id);
    setSaveAddress(false);
    setMakeDefaultAddress(address.isDefault);
    setSaveAddressLabel(address.label ?? "บ้าน");
    setCustomerName(address.recipientName);
    setCustomerPhone(address.recipientPhone);
    setDeliveryAddress({
      premises: address.premises,
      locality: address.locality,
      instructions: address.riderNote,
    });
    setLocationInput(address.submittedMapUrl ?? "");
    setFieldErrors({});
    await applyDeliveryPoint({
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
    setDeliveryPoint(null);
    setRouteQuote(null);
    setLocationInput("");
    setSaveAddress(true);
    setMakeDefaultAddress(deliveryAddresses.length === 0);
    setFieldErrors({});
  }

  async function resolveLocationInput() {
    if (!locationInput.trim()) return setError("วาง Google Maps link หรือ latitude, longitude ก่อน");
    setResolvingLocation(true);
    setError(null);
    try {
      const point = await resolveDeliveryLocation(locationInput.trim(), c.shopId);
      setSelectedAddressId(null);
      await applyDeliveryPoint(point);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ตรวจจุดส่งไม่สำเร็จ");
    } finally {
      setResolvingLocation(false);
    }
  }

  function captureDeliveryPoint() {
    if (!("geolocation" in navigator)) {
      setError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }

    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: ConfirmedDeliveryPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          source: "device_gps",
        };
        setLocating(false);
        setSelectedAddressId(null);
        void applyDeliveryPoint(point);
      },
      (geoError) => {
        setLocating(false);
        setDeliveryPoint(null);
        setRouteQuote(null);
        setError(geoError.code === 1 ? "ไม่ได้อนุญาตตำแหน่ง — ใช้ Google Maps link หรือ latitude, longitude แทนได้" : "อ่านตำแหน่งปัจจุบันไม่สำเร็จ — ใช้ Google Maps link หรือ latitude, longitude แทนได้");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }

  async function confirm() {
    if (!c.shopId) return;
    const formattedAddress = formatDeliveryAddress(deliveryAddress);
    const nextFieldErrors: CheckoutErrors = {};
    if (!customerName.trim()) nextFieldErrors.customerName = "กรุณากรอกชื่อผู้รับ";
    if (!customerPhone.trim()) nextFieldErrors.customerPhone = "กรุณากรอกเบอร์โทรผู้รับ";
    if (fulfillment === "delivery" && !deliveryAddress.premises.trim()) nextFieldErrors.premises = "กรุณากรอกบ้านเลขที่ / หมู่บ้าน / อาคาร";
    if (fulfillment === "delivery" && !deliveryAddress.locality.trim()) nextFieldErrors.locality = "กรุณากรอกซอย / ถนน / แขวง-ตำบล / เขต-อำเภอ / จังหวัด";
    if (fulfillment === "delivery" && !deliveryPoint) nextFieldErrors.deliveryPoint = "กรุณายืนยันจุดส่งจริงสำหรับ Rider";
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setError("กรุณากรอกข้อมูลจำเป็นให้ครบ");
      return;
    }
    if (fulfillment === "delivery" && !routeQuote) return setError("กรุณารอให้ระบบคำนวณระยะทางและค่าส่งสำเร็จก่อนสั่ง");
    if (fulfillment === "delivery" && shop?.delivery_enabled === false) return setError("ร้านนี้ไม่เปิดบริการจัดส่ง");
    if (fulfillment === "pickup" && shop?.pickup_enabled === false) return setError("ร้านนี้ไม่เปิดบริการรับเอง");
    if (payment === "cash" && shop && !shop.payment_cash_enabled) return setError("ร้านนี้ไม่รับเงินสด");
    if (payment === "qr_transfer" && shop && !shop.payment_qr_enabled) return setError("ร้านนี้ไม่รับชำระผ่าน QR");
    if (availability?.state === "manual_closed") return setError("ร้านปิดรับออเดอร์ชั่วคราว");
    if (timing === "now" && availability && !availability.canOrder) return setError("ร้านยังไม่เปิดในขณะนี้ กรุณาเลือกสั่งล่วงหน้า");
    if (timing === "preorder" && !shop?.accepts_preorders) return setError("ร้านนี้ไม่เปิดรับสั่งล่วงหน้า");

    const requestedFor = timing === "preorder" ? bangkokInputToIso(requestedForLocal) : null;
    if (timing === "preorder" && !requestedFor) return setError("กรุณาเลือกวันและเวลารับ/ส่ง");

    setSubmitting(true);
    setError(null);

    const cid = await getCurrentCustomerId();
    if (cid) {
      await supabase.from("customers").update({ name: customerName.trim(), phone: customerPhone.trim() }).eq("id", cid);
    }

    const res = await submitOrder({
      shopId: c.shopId,
      items: c.items.map((i) => ({
        lineId: i.lineId,
        kind: i.kind,
        itemId: i.itemId,
        qty: i.qty,
        options: i.options,
        note: i.note,
        bundleSelections: i.bundleSelections,
      })),
      fulfillment,
      payment,
      address: fulfillment === "delivery" ? formattedAddress : null,
      destinationLat: fulfillment === "delivery" ? deliveryPoint?.lat ?? null : null,
      destinationLng: fulfillment === "delivery" ? deliveryPoint?.lng ?? null : null,
      locationSource: fulfillment === "delivery" ? deliveryPoint?.source ?? null : null,
      locationAccuracyM: fulfillment === "delivery" ? deliveryPoint?.accuracy ?? null : null,
      submittedMapUrl: fulfillment === "delivery" && deliveryPoint?.source === "google_maps_url" ? deliveryPoint.submittedValue ?? null : null,
      note: note.trim() || null,
      requestedFor,
    });

    setSubmitting(false);
    if (!res.ok) return setError(res.error ?? "สั่งไม่สำเร็จ");
    if (customerId && fulfillment === "delivery" && deliveryPoint) {
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
      }, {
        selectedAddressId,
        saveRequested: saveAddress,
        saveLabel: saveAddressLabel,
        makeDefault: makeDefaultAddress,
      });
      saveCustomerDeliveryAddresses(customerId, nextAddresses);
      setDeliveryAddresses(nextAddresses);
    }
    cart.clear();
    setDone(true);
  }

  if (done) return (
    <div className="p-6 text-center space-y-2 max-w-md mx-auto">
      <p className="text-2xl">✅</p>
      <p className="text-lg font-semibold">{timing === "preorder" ? "ส่งออเดอร์ล่วงหน้าแล้ว" : "ส่งคำสั่งซื้อแล้ว"}</p>
      <p className="text-sm text-gray-500">กำลังรอร้านยืนยันออเดอร์ ติดตามสถานะได้ที่ประวัติออเดอร์</p>
      <Link to="/orders" className="text-orange-500 underline block mt-2">ดูสถานะออเดอร์</Link>
      <Link to="/" className="text-gray-400 underline block text-sm">กลับหน้าแรก</Link>
    </div>
  );

  if (c.items.length === 0) return (
    <div className="p-6 text-center text-sm text-gray-400">
      ตะกร้าว่าง
      <Link to="/" className="text-orange-500 underline block mt-2">เลือกอาหาร</Link>
    </div>
  );

  return (
    <div className="p-4 pb-40 space-y-4 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        {c.shopId && (
          <Link
            to="/shop/$shopId"
            params={{ shopId: c.shopId }}
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-2 text-sm text-gray-700"
          >
            <span aria-hidden="true">←</span>
            <span>กลับไปเพิ่มสินค้า</span>
          </Link>
        )}
      </div>

      <div>
        <h1 className="text-lg font-bold">ตรวจสอบคำสั่งซื้อ</h1>
        {shop?.name && <p className="text-sm text-gray-500 mt-1">ร้าน {shop.name}</p>}
      </div>

      {availability?.state === "manual_closed" && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-600">ร้านปิดรับออเดอร์ชั่วคราว</div>
      )}
      {availability?.state === "schedule_closed" && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-700">
          <p className="font-medium">ร้านปิดตามเวลาทำการ</p>
          {availability.detail && <p className="text-xs mt-1">{availability.detail}</p>}
        </div>
      )}

      <div className="space-y-4 border-b border-gray-100 pb-4">
        {groupedItems.map((group) => (
          <section
            key={group.key}
            className={`rounded-2xl border p-3 ${group.isSet ? "border-orange-100 bg-orange-50/40" : "border-gray-100 bg-white"}`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 mb-2">
              <div>
                <p className={`font-semibold ${group.isSet ? "text-orange-700" : "text-gray-700"}`}>{group.name}</p>
                <p className="text-[11px] text-gray-400">{group.count} ชิ้น</p>
              </div>
              <p className="text-sm font-semibold text-gray-700">฿{group.total}</p>
            </div>

            <div className="divide-y divide-gray-100">
              {group.items.map((i) => (
                <div key={i.lineId} className="py-3 first:pt-1 last:pb-1 text-sm space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{i.name}</span>
                    <span className="text-gray-600 shrink-0">฿{cartLineTotal(i)}</span>
                  </div>
                  {i.options.length > 0 && <p className="text-xs text-gray-500">{i.options.map((o) => `${o.groupName}: ${o.optionName}`).join(" · ")}</p>}
                  {i.bundleSelections.length > 0 && (
                    <div className="text-xs text-gray-500 pl-2 border-l border-gray-200 space-y-0.5">
                      {i.bundleSelections.map((s, idx) => <p key={`${s.groupId}-${s.itemId}-${idx}`}>{s.itemName} × {s.qty}</p>)}
                    </div>
                  )}
                  {i.note && <p className="text-xs text-gray-400">📝 {i.note}</p>}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => cart.setQty(i.lineId, i.qty - 1)}
                      className="h-9 w-9 rounded-full border border-gray-200 bg-white text-lg text-gray-700"
                      aria-label={`ลดจำนวน ${i.name}`}
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-medium" aria-label={`จำนวน ${i.qty}`}>{i.qty}</span>
                    <button
                      type="button"
                      onClick={() => cart.setQty(i.lineId, i.qty + 1)}
                      className="h-9 w-9 rounded-full bg-orange-500 text-lg text-white"
                      aria-label={`เพิ่มจำนวน ${i.name}`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => cart.remove(i.lineId)}
                      className="ml-1 h-9 px-3 rounded-lg bg-red-50 text-red-500 text-xs font-medium"
                      aria-label={`ลบ ${i.name} ออกจากตะกร้า`}
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">ข้อมูลติดต่อ</p>
        <p className="text-[11px] leading-4 text-gray-500">
          ช่องที่มีเครื่องหมาย <span className="font-semibold text-red-600">*</span> เป็นข้อมูลจำเป็น กรุณากรอกให้ครบเพื่อให้ร้านและ Rider จัดส่งได้ถูกต้อง
        </p>
        <div className="space-y-1">
          <label htmlFor="recipient-name" className="text-xs font-medium text-gray-600">ชื่อผู้รับ <span className="text-red-600" aria-hidden="true">*</span></label>
          <input
            id="recipient-name"
            className="w-full rounded-lg border border-gray-200 p-2 text-sm"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              setFieldErrors((current) => ({ ...current, customerName: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.customerName)}
            aria-describedby={fieldErrors.customerName ? "recipient-name-error" : undefined}
          />
          {fieldErrors.customerName && <p id="recipient-name-error" className="text-xs text-red-600">{fieldErrors.customerName}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="recipient-phone" className="text-xs font-medium text-gray-600">เบอร์โทรผู้รับ <span className="text-red-600" aria-hidden="true">*</span></label>
          <input
            id="recipient-phone"
            className="w-full rounded-lg border border-gray-200 p-2 text-sm"
            value={customerPhone}
            onChange={(e) => {
              setCustomerPhone(e.target.value.replace(/[^0-9]/g, ""));
              setFieldErrors((current) => ({ ...current, customerPhone: undefined }));
            }}
            inputMode="numeric"
            type="tel"
            maxLength={10}
            aria-invalid={Boolean(fieldErrors.customerPhone)}
            aria-describedby={fieldErrors.customerPhone ? "recipient-phone-error" : undefined}
          />
          {fieldErrors.customerPhone && <p id="recipient-phone-error" className="text-xs text-red-600">{fieldErrors.customerPhone}</p>}
        </div>
      </div>

      {shop?.accepts_preorders && availability?.state !== "manual_closed" && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-3">
          <p className="text-sm font-medium text-gray-700">เวลารับ / ส่ง</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!availability?.canOrder} onClick={() => setTiming("now")} className={`rounded-lg py-2.5 text-sm disabled:opacity-40 ${timing === "now" ? "bg-orange-500 text-white" : "bg-gray-100"}`}>สั่งตอนนี้</button>
            <button type="button" onClick={() => setTiming("preorder")} className={`rounded-lg py-2.5 text-sm ${timing === "preorder" ? "bg-amber-500 text-white" : "bg-gray-100"}`}>สั่งล่วงหน้า</button>
          </div>
          {timing === "preorder" && (
            <div className="space-y-1">
              <label className="text-xs text-gray-500">เลือกวันและเวลา (เวลาไทย)</label>
              <input type="datetime-local" value={requestedForLocal} onChange={(e) => setRequestedForLocal(e.target.value)} className="w-full rounded-lg border border-gray-200 p-2.5 text-sm" />
              <p className="text-[11px] text-gray-400">ระบบจะตรวจอีกครั้งว่าเวลานี้อยู่ในเวลาทำการของร้าน</p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 p-3 space-y-3">
        <p className="text-sm font-medium text-gray-700">รับสินค้า</p>
        <div className="flex gap-2">
          {shop?.delivery_enabled !== false && <button onClick={() => setFulfillment("delivery")} className={`flex-1 rounded-lg py-2 text-sm ${fulfillment === "delivery" ? "bg-orange-500 text-white" : "bg-gray-100"}`}>ส่งถึงบ้าน</button>}
          {shop?.pickup_enabled !== false && <button onClick={() => setFulfillment("pickup")} className={`flex-1 rounded-lg py-2 text-sm ${fulfillment === "pickup" ? "bg-orange-500 text-white" : "bg-gray-100"}`}>รับเอง</button>}
        </div>
        {fulfillment === "delivery" && (
          <div className="space-y-3">
            {deliveryAddresses.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800">ที่อยู่ที่เคยใช้</p>
                  <button type="button" onClick={addNewDeliveryAddress} className="text-xs font-medium text-orange-600">+ เพิ่มที่อยู่ใหม่</button>
                </div>
                <div className="space-y-2">
                  {deliveryAddresses.map((address) => (
                    <div
                      key={address.id}
                      className={`rounded-lg border p-2.5 text-sm ${selectedAddressId === address.id ? "border-orange-300 bg-orange-50" : "border-gray-100 bg-gray-50"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800">{address.label || (address.kind === "saved" ? "ที่อยู่ที่บันทึกไว้" : "ที่อยู่ล่าสุด")}</p>
                          <p className="mt-1 text-xs leading-5 text-gray-600">{formatDeliveryAddressSummary(address)}</p>
                          <p className="mt-1 text-[11px] text-green-700">📍 จุดส่งเดิมที่ยืนยันแล้ว</p>
                          {address.lastUsedAt && (
                            <p className="mt-0.5 text-[11px] text-gray-400">
                              ใช้ล่าสุด {new Date(address.lastUsedAt).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" })}
                            </p>
                          )}
                        </div>
                        {address.isDefault && <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">หลัก</span>}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void selectDeliveryAddress(address)}
                          className="flex-1 rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white"
                        >
                          ใช้ที่อยู่นี้
                        </button>
                        <a
                          href={googleMapsPreviewUrl({ lat: address.deliveryPinLat, lng: address.deliveryPinLng, placeId: address.placeId })}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-blue-700"
                        >
                          เปิดแผนที่
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DeliveryAddressFields
              value={deliveryAddress}
              onChange={setDeliveryAddress}
              errors={{ premises: fieldErrors.premises, locality: fieldErrors.locality }}
              onFieldChange={(field) => {
                setSelectedAddressId(null);
                setFieldErrors((current) => ({ ...current, [field]: undefined }));
              }}
            />

            <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
              <label className="flex items-start gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(event) => setSaveAddress(event.target.checked)}
                  className="mt-0.5"
                />
                <span>บันทึกที่อยู่นี้ไว้ใช้ครั้งต่อไป</span>
              </label>
              {saveAddress && (
                <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                  <div className="space-y-1">
                    <label htmlFor="delivery-address-label" className="text-xs font-medium text-gray-600">ตั้งชื่อ เช่น บ้าน / ที่ทำงาน</label>
                    <input
                      id="delivery-address-label"
                      value={saveAddressLabel}
                      onChange={(event) => setSaveAddressLabel(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 p-2 text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-1 pb-2 text-[11px] text-gray-600">
                    <input type="checkbox" checked={makeDefaultAddress} onChange={(event) => setMakeDefaultAddress(event.target.checked)} />
                    หลัก
                  </label>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">📍 จุดส่งจริงสำหรับ Rider <span className="text-red-600" aria-hidden="true">*</span></p>
                <p className="text-xs text-gray-500 mt-1">วาง Google Maps Share Link หรือ latitude, longitude ของจุดส่งจริง ไม่จำเป็นต้องเป็นตำแหน่งโทรศัพท์ของผู้สั่ง</p>
              </div>
              <label htmlFor="delivery-pin-input" className="sr-only">จุดส่งจริงสำหรับ Rider</label>
              <textarea
                id="delivery-pin-input"
                rows={2}
                value={locationInput}
                onChange={(e) => {
                  setLocationInput(e.target.value);
                  setFieldErrors((current) => ({ ...current, deliveryPoint: undefined }));
                }}
                placeholder="https://maps.app.goo.gl/... หรือ 13.77314, 100.67611"
                className="w-full rounded-lg border border-blue-100 bg-white p-2.5 text-sm"
                aria-invalid={Boolean(fieldErrors.deliveryPoint)}
                aria-describedby={fieldErrors.deliveryPoint ? "delivery-pin-error" : undefined}
              />
              {fieldErrors.deliveryPoint && <p id="delivery-pin-error" className="text-xs text-red-600">{fieldErrors.deliveryPoint}</p>}
              <button
                type="button"
                onClick={() => void resolveLocationInput()}
                disabled={resolvingLocation || !locationInput.trim()}
                className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {resolvingLocation ? "กำลังตรวจ Google Maps..." : "ตรวจและยืนยันจุดส่ง"}
              </button>
              <div className="flex items-center gap-2 text-[11px] text-gray-400"><span className="h-px flex-1 bg-gray-200" /><span>หรือ</span><span className="h-px flex-1 bg-gray-200" /></div>
              <button
                type="button"
                onClick={captureDeliveryPoint}
                disabled={locating}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50"
              >
                {locating ? "กำลังหาตำแหน่ง..." : "ใช้ตำแหน่งปัจจุบันของโทรศัพท์"}
              </button>
            </div>

            {deliveryPoint && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-green-800">จุดส่งที่ยืนยันแล้ว ✅</p>
                    {deliveryPoint.displayName && (
                      <p className="mt-1 text-base font-bold leading-5 text-green-950">{deliveryPoint.displayName}</p>
                    )}
                    {deliveryPoint.formattedAddress && (
                      <p className="mt-1 text-xs leading-5 text-green-800">{deliveryPoint.formattedAddress}</p>
                    )}
                    <p className="mt-1 font-mono text-[11px] text-green-700">📍 {deliveryPoint.lat.toFixed(6)}, {deliveryPoint.lng.toFixed(6)}</p>
                    <p className="mt-1 text-[11px] text-green-700">
                      แหล่งที่มา: {deliveryPoint.resolutionMethod === "places_text_search" ? "Google Places (ยืนยันชื่อสถานที่)" : deliveryPoint.source === "google_maps_url" ? "Google Maps" : deliveryPoint.source === "latlng" ? "Latitude / Longitude" : "GPS โทรศัพท์"}
                    </p>
                  </div>
                  <a href={googleMapsPreviewUrl(deliveryPoint)} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-blue-700 underline">เปิดแผนที่</a>
                </div>

                {deliveryPoint.placeId && (
                  <div className="rounded-lg border border-green-200 bg-white/80 p-2 text-xs leading-5 text-green-900">
                    <p className="font-semibold">ตรวจสอบก่อนสั่ง</p>
                    <p>ชื่อสถานที่และหมุดนี้อ้างอิง Google Place เดียวกัน กรุณากด “เปิดแผนที่” เพื่อตรวจว่าจุดนี้คือทางเข้าหรือจุดรับสินค้าที่ต้องการให้ Rider ไปจริง</p>
                  </div>
                )}

                {!deliveryPoint.displayName && deliveryPoint.source !== "device_gps" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-800">
                    จุดนี้ไม่มีชื่อสถานที่จาก Google กรุณาตรวจหมุดบนแผนที่และที่อยู่ผู้รับให้ตรงก่อนยืนยันคำสั่งซื้อ
                  </div>
                )}

                {deliveryPoint.source === "device_gps" && deliveryPoint.accuracy != null && deliveryPoint.accuracy > 30 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    GPS เครื่องนี้คลาดเคลื่อนประมาณ {Math.round(deliveryPoint.accuracy)} ม. แนะนำให้วาง Google Maps Share Link หรือ latitude/longitude ของหมุดจริงเพื่อความแม่นยำสูงกว่า
                  </div>
                )}

                {quotingRoute && <p className="text-xs text-gray-500">กำลังคำนวณเส้นทางมอเตอร์ไซค์ร้าน → จุดส่ง...</p>}
                {routeQuote && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white p-2.5">
                      <p className="text-[11px] text-gray-500">ระยะทางตามถนน</p>
                      <p className="text-base font-bold text-gray-800">{(routeQuote.distanceMeters / 1000).toFixed(2)} กม.</p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5">
                      <p className="text-[11px] text-gray-500">ค่าขนส่ง · 10 บาท/กม.</p>
                      <p className="text-base font-bold text-green-700">฿{routeQuote.deliveryFee.toFixed(2)}</p>
                    </div>
                  </div>
                )}
                <p className="text-[10px] leading-4 text-gray-400">เส้นทางมอเตอร์ไซค์เป็นข้อมูลประมาณการจากผู้ให้บริการแผนที่ เส้นทางจริงอาจแตกต่างตามสภาพถนนและข้อจำกัดในพื้นที่</p>
                <button type="button" onClick={() => { setDeliveryPoint(null); setRouteQuote(null); }} className="text-xs text-gray-500 underline">เปลี่ยนจุดส่ง</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">ชำระเงินตรงกับร้าน</p>
        <div className="flex gap-2">
          {shop?.payment_cash_enabled !== false && <button onClick={() => setPayment("cash")} className={`flex-1 rounded-lg py-2 text-sm ${payment === "cash" ? "bg-orange-500 text-white" : "bg-gray-100"}`}>💵 เงินสด</button>}
          {shop?.payment_qr_enabled && <button onClick={() => setPayment("qr_transfer")} className={`flex-1 rounded-lg py-2 text-sm ${payment === "qr_transfer" ? "bg-purple-600 text-white" : "bg-gray-100"}`}>📱 QR</button>}
        </div>
        {payment === "qr_transfer" && shop?.qr_code_url && <img src={shop.qr_code_url} alt="QR Code ร้าน" className="w-44 h-44 object-contain mx-auto rounded-lg border border-gray-100" />}
        <p className="text-[11px] text-gray-400">MyTree ไม่ถือเงิน ลูกค้าชำระเงินให้ร้านโดยตรง</p>
      </div>

      <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="หมายเหตุถึงร้าน (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="fixed left-4 right-4 bottom-4">
        <button onClick={confirm} disabled={submitting || quotingRoute || availability?.state === "manual_closed"} className="w-full rounded-xl bg-orange-500 text-white px-4 py-3 flex justify-between text-sm font-medium disabled:opacity-50">
          <span>{submitting ? "กำลังส่ง..." : timing === "preorder" ? "ยืนยันสั่งล่วงหน้า" : "ยืนยันคำสั่งซื้อ"}</span>
          <span>{routeQuote && fulfillment === "delivery" ? `สินค้า ฿${cartTotal(c)} · ส่ง ฿${routeQuote.deliveryFee.toFixed(2)}` : `฿${cartTotal(c)}`}</span>
        </button>
      </div>
    </div>
  );
}
