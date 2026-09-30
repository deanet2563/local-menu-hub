import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { LocalMapCanvas } from "@/components/maps/LocalMapCanvas";
import {
  duplicateLocationIds,
  hasValidLocalMapPin,
  localMapQuality,
  type LocalMapLocation,
} from "@/lib/localMap";
import {
  listAdminMapLocations,
  proposeShopLocationCorrection,
  reviewShopLocationCorrection,
  setShopMapVisibility,
  type AdminMapData,
  type MapCorrection,
} from "@/lib/mapAdmin";
import { getAdminAccessContext, hasAdminPermission, type AdminAccessContext } from "@/lib/adminAccess";

type Filter = "all" | "visible" | "hidden" | "missing" | "stale" | "unverified" | "duplicates";

const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "ไม่มีข้อมูล";

export function MapManagement() {
  const [access, setAccess] = useState<AdminAccessContext | null>(null);
  const [data, setData] = useState<AdminMapData>({ locations: [], corrections: [] });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);
  const [revision, setRevision] = useState(0);

  const canUpdate = !!access && hasAdminPermission(access, "map.update");
  const canVerify = !!access && hasAdminPermission(access, "map.action");
  const duplicateIds = useMemo(() => duplicateLocationIds(data.locations), [data.locations]);
  const filtered = data.locations.filter((location) => {
    switch (filter) {
      case "visible": return location.mapVisible && location.approved && !location.banned && hasValidLocalMapPin(location);
      case "hidden": return !location.mapVisible || !location.approved || location.banned;
      case "missing": return localMapQuality(location) === "missing" || localMapQuality(location) === "invalid";
      case "stale": return localMapQuality(location) === "stale";
      case "unverified": return localMapQuality(location) === "unverified";
      case "duplicates": return duplicateIds.has(location.id);
      default: return true;
    }
  });
  const selectable = filtered.filter((location) => hasValidLocalMapPin(location) && (location.kind === "community" || location.approved && !location.banned && location.mapVisible));
  const selected = data.locations.find((location) => location.id === selectedId) ?? null;
  const pendingCorrections = data.corrections.filter((item) => item.status === "pending");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminMapLocations(search);
      setData(result);
      if (selectedId && !result.locations.some((item) => item.id === selectedId)) setSelectedId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดข้อมูลแผนที่ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [search, selectedId]);

  useEffect(() => { void getAdminAccessContext().then(setAccess); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, revision]);

  const refresh = () => setRevision((value) => value + 1);
  const updateVisibility = async (location: LocalMapLocation) => {
    const reason = window.prompt(location.mapVisible ? "ระบุเหตุผลที่ซ่อนพิกัดร้านนี้" : "ระบุเหตุผลที่เปิดการแสดงพิกัดร้านนี้");
    if (!reason?.trim()) return;
    try {
      await setShopMapVisibility(location.id, !location.mapVisible, reason);
      setNotice("บันทึกการแสดงผลแผนที่และ audit แล้ว");
      refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เปลี่ยนการแสดงผลไม่สำเร็จ"); }
  };

  const selectLocation = useCallback((location: LocalMapLocation) => setSelectedId(location.id), []);
  const closeSelection = useCallback(() => setSelectedId(null), []);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Map & Local Address Management</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">จัดการพิกัดร้านและข้อมูลภูมิศาสตร์ MyTree จากแหล่งจริง ระบบไม่แสดงตำแหน่งบ้านลูกค้าบนแผนที่สาธารณะ</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">รีเฟรช</button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="ตำแหน่งในรายการ" value={String(data.locations.length)} />
        <Metric label="แสดงบนแผนที่สาธารณะ" value={String(data.locations.filter((x) => x.kind === "shop" && x.approved && !x.banned && x.mapVisible && hasValidLocalMapPin(x)).length)} />
        <Metric label="พิกัดขาด/ไม่ถูกต้อง" value={String(data.locations.filter((x) => localMapQuality(x) === "missing" || localMapQuality(x) === "invalid").length)} />
        <Metric label="ข้อเสนอแก้พิกัดรอตรวจ" value={String(pendingCorrections.length)} />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="min-w-[220px] flex-1">
            <span className="sr-only">ค้นหาร้านหรือสถานที่</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาร้าน ชุมชน หรือที่อยู่" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
          </label>
          <select aria-label="ตัวกรองตำแหน่ง" value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm">
            <option value="all">ทั้งหมด</option><option value="visible">แสดงบนแผนที่</option><option value="hidden">ซ่อน / ยังไม่อนุมัติ</option><option value="missing">พิกัดขาด / ไม่ถูกต้อง</option><option value="stale">ไม่ได้ตรวจเกิน 1 ปี</option><option value="unverified">ยังไม่ยืนยัน</option><option value="duplicates">พิกัดซ้ำ</option>
          </select>
          <button type="button" onClick={() => setShowList((value) => !value)} className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-semibold lg:hidden">{showList ? "ซ่อนรายการ" : "แสดงรายการ"}</button>
        </div>

        {error && <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{error}</p><button type="button" onClick={refresh} className="mt-2 font-semibold underline">ลองโหลดอีกครั้ง</button></div>}
        {notice && <p role="status" className="mb-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <div className="min-w-0">
            <LocalMapCanvas locations={selectable} selectedId={selectedId} onSelect={selectLocation} onCloseSelection={closeSelection} />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span>● ร้านค้า MyTree</span><span>● สถานที่ชุมชนที่อนุมัติ</span><span>ฐานแผนที่: Google Maps</span></div>
          </div>
          <div className={`${showList ? "block" : "hidden"} min-w-0`}>
            <div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-semibold">ตำแหน่ง ({filtered.length})</h3>{loading && <span role="status" className="text-xs text-gray-500">กำลังโหลด…</span>}</div>
            {!loading && filtered.length === 0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">ไม่พบข้อมูลตามตัวกรอง</p> : (
              <ul className="max-h-[520px] space-y-2 overflow-auto pr-1">
                {filtered.map((location) => <LocationRow key={`${location.kind}:${location.id}`} location={location} selected={selectedId === location.id} duplicate={duplicateIds.has(location.id)} onSelect={() => setSelectedId(location.id)} />)}
              </ul>
            )}
          </div>
        </div>
      </section>

      {selected && <LocationDetail location={selected} duplicate={duplicateIds.has(selected.id)} canUpdate={canUpdate} onVisibility={() => void updateVisibility(selected)} onProposed={() => { setSelectedId(selected.id); refresh(); }} />}

      <CorrectionQueue items={pendingCorrections} canVerify={canVerify} onReview={async (input) => {
        await reviewShopLocationCorrection(input);
        setNotice(input.decision === "approved" ? "ยืนยันและเผยแพร่พิกัดใหม่แล้ว" : "ปฏิเสธข้อเสนอและบันทึก audit แล้ว");
        refresh();
      }} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p></div>;
}

function LocationRow({ location, selected, duplicate, onSelect }: { location: LocalMapLocation; selected: boolean; duplicate: boolean; onSelect: () => void }) {
  const status = location.kind === "community" ? "ชุมชน" : location.banned ? "ปิดใช้งาน" : !location.approved ? "รออนุมัติ" : location.mapVisible ? "แสดง" : "ซ่อน";
  const quality = localMapQuality(location);
  return <li><button type="button" onClick={onSelect} aria-pressed={selected} className={`w-full rounded-xl border p-3 text-left transition ${selected ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-400"}`}>
    <span className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-900">{location.name}</span><span className="mt-0.5 block truncate text-xs text-gray-500">{location.address ?? location.communityName ?? location.category ?? "ไม่มีที่อยู่"}</span></span><span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">{status}</span></span>
    <span className="mt-2 flex flex-wrap gap-1.5 text-[11px]"><Badge tone={quality === "verified" ? "green" : quality === "missing" || quality === "invalid" ? "red" : "amber"}>{quality === "verified" ? "พิกัดยืนยันแล้ว" : quality === "missing" ? "ไม่มีพิกัด" : quality === "invalid" ? "พิกัดไม่ถูกต้อง" : quality === "stale" ? "ไม่ได้ตรวจเกิน 1 ปี" : "ยังไม่ยืนยัน"}</Badge>{location.kind === "shop" && location.isOpen === false && <Badge tone="amber">ร้านปิด</Badge>}{duplicate && <Badge tone="red">พิกัดซ้ำ</Badge>}</span>
  </button></li>;
}

function LocationDetail({ location, duplicate, canUpdate, onVisibility, onProposed }: { location: LocalMapLocation; duplicate: boolean; canUpdate: boolean; onVisibility: () => void; onProposed: () => void }) {
  const [lat, setLat] = useState(location.lat == null ? "" : String(location.lat));
  const [lng, setLng] = useState(location.lng == null ? "" : String(location.lng));
  const [address, setAddress] = useState(location.address ?? "");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("field_visit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setLat(location.lat == null ? "" : String(location.lat)); setLng(location.lng == null ? "" : String(location.lng)); setAddress(location.address ?? ""); setReason(""); setError(null); }, [location]);

  async function propose(event: FormEvent) {
    event.preventDefault();
    const nextLat = Number(lat), nextLng = Number(lng);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng) || nextLat < -90 || nextLat > 90 || nextLng < -180 || nextLng > 180) return setError("กรุณาระบุพิกัด latitude/longitude ที่ถูกต้อง");
    if (reason.trim().length < 8) return setError("กรุณาระบุเหตุผลอย่างน้อย 8 ตัวอักษร");
    setSaving(true); setError(null);
    try {
      await proposeShopLocationCorrection({ shopId: location.id, lat: nextLat, lng: nextLng, address, source, reason });
      setReason("");
      onProposed();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ส่งข้อเสนอไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  return <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">รายละเอียดตำแหน่งที่เลือก</p><h3 className="mt-1 text-lg font-bold">{location.name}</h3></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">{location.verificationStatus === "verified" ? "ยืนยันพิกัดแล้ว" : location.verificationStatus === "correction_pending" ? "มีข้อเสนอรอตรวจ" : location.verificationStatus === "rejected" ? "ข้อเสนอล่าสุดถูกปฏิเสธ" : "ยังไม่ยืนยัน"}</span></div>
    <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4"><Detail label="ที่อยู่" value={location.address ?? "ไม่มีข้อมูล"} /><Detail label="Latitude / Longitude" value={hasValidLocalMapPin(location) ? `${location.lat!.toFixed(6)}, ${location.lng!.toFixed(6)}` : "ไม่มีพิกัดที่ถูกต้อง"} /><Detail label="แสดงบนแผนที่" value={location.mapVisible ? "เปิด" : "ซ่อน"} /><Detail label="สถานะธุรกิจ" value={location.kind === "shop" && location.isOpen === false ? "ร้านปิด" : location.banned ? "ปิดใช้งาน" : location.approved ? "อนุมัติแล้ว" : "รออนุมัติ"} /><Detail label="พิกัดอัปเดตล่าสุด" value={dateLabel(location.locationUpdatedAt)} /><Detail label="ยืนยันพิกัดล่าสุด" value={dateLabel(location.locationVerifiedAt)} /><Detail label="แหล่งข้อมูล" value={location.locationSource ?? "ยังไม่บันทึก"} /><Detail label="ชุมชน" value={location.communityName ?? "ไม่มีความสัมพันธ์ในข้อมูล"} />
    </dl>
    {duplicate && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">พบตำแหน่งเดียวกันกับรายการอื่น ตรวจสอบก่อนเผยแพร่</p>}
    <div className="mt-4 flex flex-wrap gap-2">{canUpdate && location.kind === "shop" && <button type="button" onClick={onVisibility} className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold">{location.mapVisible ? "ซ่อนจากแผนที่สาธารณะ" : "แสดงบนแผนที่สาธารณะ"}</button>}</div>
    {canUpdate && location.kind === "shop" && <form onSubmit={(event) => void propose(event)} className="mt-5 grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2 sm:p-4">
      <div className="sm:col-span-2"><h4 className="font-semibold">เสนอแก้ไขพิกัดร้าน</h4><p className="mt-1 text-xs text-gray-500">พิกัดเดิมจะยังเป็น canonical จนกว่าผู้มีสิทธิ์ตรวจสอบจะอนุมัติ</p></div>
      <label className="text-xs font-medium text-gray-600">Latitude<input required inputMode="decimal" value={lat} onChange={(event) => setLat(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium text-gray-600">Longitude<input required inputMode="decimal" value={lng} onChange={(event) => setLng(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium text-gray-600 sm:col-span-2">ที่อยู่<label className="sr-only">ที่อยู่ใหม่</label><input value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium text-gray-600">แหล่งหลักฐาน<select value={source} onChange={(event) => setSource(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="field_visit">ตรวจสถานที่จริง</option><option value="owner_confirmed">เจ้าของร้านยืนยัน</option><option value="admin_verified">ตรวจสอบโดยแอดมิน</option><option value="other">อื่น ๆ</option></select></label>
      <label className="text-xs font-medium text-gray-600">เหตุผล / รายละเอียดหลักฐาน<textarea required minLength={8} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" rows={2} /></label>
      {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><button type="submit" disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "กำลังส่ง…" : "ส่งเข้าคิวตรวจสอบ"}</button></div>
    </form>}
  </section>;
}

function CorrectionQueue({ items, canVerify, onReview }: { items: MapCorrection[]; canVerify: boolean; onReview: (input: { correctionId: string; decision: "approved" | "rejected"; reason: string }) => Promise<void> }) {
  const [decision, setDecision] = useState<{ item: MapCorrection; value: "approved" | "rejected" } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!decision || reason.trim().length < 8) return setError("กรุณาระบุเหตุผลอย่างน้อย 8 ตัวอักษร");
    setSaving(true); setError(null);
    try { await onReview({ correctionId: decision.item.correction_id, decision: decision.value, reason }); setDecision(null); setReason(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ตรวจสอบรายการไม่สำเร็จ"); }
    finally { setSaving(false); }
  }
  return <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><div><h3 className="text-lg font-bold">คิวแก้ไขพิกัด</h3><p className="mt-1 text-sm text-gray-500">ข้อเสนอจะไม่เปลี่ยนพิกัด canonical ก่อนผ่านการตรวจสอบ</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{items.length} รอตรวจ</span></div>
    {!items.length ? <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">ไม่มีข้อเสนอรอตรวจสอบ</p> : <ul className="mt-4 divide-y divide-gray-100">{items.map((item) => <li key={item.correction_id} className="py-3 first:pt-0"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{item.shop_name}</p><p className="mt-1 font-mono text-xs text-gray-600">{item.proposed_lat?.toFixed(6)}, {item.proposed_lng?.toFixed(6)}</p><p className="mt-1 text-xs text-gray-500">หลักฐาน: {item.source} · {item.reason}</p><p className="mt-1 text-xs text-gray-400">เสนอเมื่อ {dateLabel(item.proposed_at)}</p></div>{canVerify && <div className="flex gap-2"><button type="button" onClick={() => { setDecision({ item, value: "approved" }); setReason(""); }} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white">อนุมัติ</button><button type="button" onClick={() => { setDecision({ item, value: "rejected" }); setReason(""); }} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold">ปฏิเสธ</button></div>}</div></li>)}</ul>}
    {decision && <form onSubmit={(event) => void submit(event)} className="mt-4 rounded-xl border border-gray-200 p-3"><p className="text-sm font-semibold">{decision.value === "approved" ? "ยืนยันพิกัดใหม่และเผยแพร่" : "ปฏิเสธข้อเสนอ"} · {decision.item.shop_name}</p><label className="mt-2 block text-xs font-medium text-gray-600">เหตุผลการตัดสิน<textarea required minLength={8} value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}<div className="mt-3 flex gap-2"><button disabled={saving} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "กำลังบันทึก…" : "ยืนยันการตัดสินใจ"}</button><button type="button" onClick={() => setDecision(null)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">ยกเลิก</button></div></form>}
    </section>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-0.5 break-words font-medium text-gray-900">{value}</dd></div>; }
function Badge({ children, tone }: { children: ReactNode; tone: "green" | "amber" | "red" }) { const cls = tone === "green" ? "bg-green-50 text-green-800" : tone === "red" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"; return <span className={`rounded-full px-2 py-1 font-semibold ${cls}`}>{children}</span>; }
