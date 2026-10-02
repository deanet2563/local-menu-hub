import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LocalMapCanvas } from "@/components/maps/LocalMapCanvas";
import { isPublicMapLocation, normalizeLocalMapLocation, type LocalMapLocationRow, type LocalMapLocation } from "@/lib/localMap";
import { publicSupabase } from "@/lib/supabase";

export function CustomerMap({ initialShopId = null }: { initialShopId?: string | null }) {
  const [locations, setLocations] = useState<LocalMapLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("th-TH");
    return locations.filter(isPublicMapLocation).filter((location) => !q || `${location.name} ${location.address ?? ""} ${location.category ?? ""}`.toLocaleLowerCase("th-TH").includes(q));
  }, [locations, search]);
  const selected = visible.find((location) => location.id === selectedId) ?? null;
  const select = useCallback((location: LocalMapLocation) => setSelectedId(location.id), []);
  const close = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    void (async () => {
      try {
        const { data, error: queryError } = await publicSupabase.rpc("fn_public_map_locations");
        if (queryError) throw queryError;
        if (!active) return;
        const rows = (data ?? []) as LocalMapLocationRow[];
        const nextLocations = rows.map(normalizeLocalMapLocation).filter(isPublicMapLocation);
        setLocations(nextLocations);
        if (initialShopId && nextLocations.some((location) => location.id === initialShopId)) setSelectedId(initialShopId);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "โหลดตำแหน่งสาธารณะไม่สำเร็จ");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [initialShopId, retry]);

  return <main className="mx-auto min-h-screen max-w-7xl space-y-4 bg-gray-50 px-3 py-4 pb-24 sm:px-6 sm:py-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-green-800">MyTree Local Map</p><h1 className="mt-1 text-2xl font-bold">ร้านใกล้บ้านและสถานที่ชุมชน</h1><p className="mt-1 text-sm text-gray-600">พิกัดสาธารณะจากข้อมูล MyTree ที่ผ่านเกณฑ์การแสดงผล</p></div><Link to="/" className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold">กลับหน้าแรก</Link></header>
    <label className="block"><span className="sr-only">ค้นหาตำแหน่ง</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาร้าน ชุมชน หรือที่อยู่" className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm" /></label>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>โหลดข้อมูลแผนที่ไม่สำเร็จ</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 font-semibold underline">ลองอีกครั้ง</button></div>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.8fr)]">
      <LocalMapCanvas locations={visible} selectedId={selectedId} onSelect={select} onCloseSelection={close} heightClass="h-[min(68vh,680px)]" />
      <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3 sm:p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">ผลลัพธ์ ({visible.length})</h2>{loading && <span role="status" className="text-xs text-gray-500">กำลังโหลด…</span>}</div>
        {!loading && !visible.length ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">ยังไม่มีตำแหน่งสาธารณะที่ตรงกับคำค้น</p> : <ul className="max-h-[68vh] space-y-2 overflow-auto pr-1">{visible.map((location) => <li key={`${location.kind}:${location.id}`}><button type="button" onClick={() => setSelectedId(location.id)} aria-pressed={selectedId === location.id} className={`w-full rounded-xl border p-3 text-left ${selectedId === location.id ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-400"}`}><span className="block truncate text-sm font-semibold">{location.name}</span><span className="mt-1 block truncate text-xs text-gray-500">{location.address ?? location.communityName ?? (location.kind === "community" ? "สถานที่ชุมชน" : "ร้านค้า")}</span><span className="mt-2 inline-flex flex-wrap gap-1.5"><span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-800">{location.kind === "community" ? "สถานที่ชุมชน" : location.category ?? "ร้าน MyTree"}</span>{location.kind === "shop" && location.verificationStatus !== "verified" && <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">พิกัดยังไม่ยืนยัน</span>}{location.kind === "shop" && location.isOpen === false && <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">ปิดอยู่</span>}</span></button></li>)}</ul>}
      </section>
    </div>
    {selected && <section className="rounded-2xl border border-gray-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-gray-500">{selected.kind === "community" ? "สถานที่ชุมชน" : "ร้านค้า MyTree"}</p><h2 className="mt-1 text-lg font-bold">{selected.name}</h2><p className="mt-1 text-sm text-gray-600">{selected.address ?? selected.communityName ?? ""}</p>{selected.kind === "shop" && selected.verificationStatus !== "verified" && <p className="mt-2 text-sm font-medium text-amber-800">พิกัดร้านนี้ยังไม่ผ่านการยืนยัน</p>}{selected.kind === "shop" && selected.isOpen === false && <p className="mt-2 text-sm font-medium text-gray-600">ขณะนี้ร้านปิด</p>}</div><button type="button" aria-label="ปิดรายละเอียดตำแหน่ง" onClick={close} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gray-300 text-xl">×</button></div>{selected.kind === "shop" && <Link to="/shop/$shopId" params={{ shopId: selected.id }} className="mt-4 inline-flex rounded-xl bg-green-800 px-4 py-2.5 text-sm font-semibold text-white">ดูร้าน</Link>}</section>}
    <p className="text-xs text-gray-500">ตำแหน่งบ้านและที่อยู่ส่วนตัวของลูกค้าไม่แสดงบนแผนที่สาธารณะ</p>
  </main>;
}
