import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MenuItem = { item_id: string; name: string; category: string | null };
type OptionGroup = {
  option_group_id: string;
  name: string;
  description: string | null;
  min_select: number;
  max_select: number;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
};
type Option = {
  option_id: string;
  option_group_id: string;
  name: string;
  price_delta: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};
type LinkRow = { item_id: string; option_group_id: string };

type GroupDraft = {
  name: string;
  description: string;
  required: boolean;
  multi: boolean;
};

const emptyDraft: GroupDraft = { name: "", description: "", required: true, multi: false };

export function OptionGroupManager({ shopId, items }: { shopId: string; items: MenuItem[] }) {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<GroupDraft>(emptyDraft);
  const [newOptionName, setNewOptionName] = useState<Record<string, string>>({});
  const [newOptionPrice, setNewOptionPrice] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemIds = useMemo(() => new Set(items.map((i) => i.item_id)), [items]);

  const load = useCallback(async () => {
    setError(null);
    const { data: groupData, error: groupErr } = await supabase
      .from("menu_option_groups")
      .select("option_group_id,name,description,min_select,max_select,is_required,is_active,sort_order")
      .eq("shop_id", shopId)
      .order("sort_order")
      .order("created_at");
    if (groupErr) return setError(groupErr.message);

    const nextGroups = (groupData as OptionGroup[]) ?? [];
    setGroups(nextGroups);
    const ids = nextGroups.map((g) => g.option_group_id);
    if (!ids.length) {
      setOptions([]);
      setLinks([]);
      return;
    }

    const [{ data: optionData, error: optionErr }, { data: linkData, error: linkErr }] = await Promise.all([
      supabase
        .from("menu_options")
        .select("option_id,option_group_id,name,price_delta,is_default,is_active,sort_order")
        .in("option_group_id", ids)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("menu_item_option_groups")
        .select("item_id,option_group_id")
        .in("option_group_id", ids),
    ]);
    if (optionErr) return setError(optionErr.message);
    if (linkErr) return setError(linkErr.message);
    setOptions(((optionData as Option[]) ?? []).filter((o) => ids.includes(o.option_group_id)));
    setLinks(((linkData as LinkRow[]) ?? []).filter((l) => itemIds.has(l.item_id)));
  }, [shopId, itemIds]);

  useEffect(() => { void load(); }, [load]);

  async function createGroup() {
    if (!draft.name.trim()) return setError("กรุณาใส่ชื่อกลุ่มตัวเลือก");
    setSaving(true); setError(null);
    try {
      const { error } = await supabase.from("menu_option_groups").insert({
        shop_id: shopId,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        is_required: draft.required,
        min_select: draft.required ? 1 : 0,
        max_select: draft.multi ? 10 : 1,
        is_active: true,
        sort_order: groups.length,
      });
      if (error) throw error;
      setDraft(emptyDraft); setCreating(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "สร้างกลุ่มตัวเลือกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  async function updateGroup(group: OptionGroup, patch: Partial<OptionGroup>) {
    setError(null);
    const next = { ...group, ...patch };
    const normalized = {
      name: next.name.trim(),
      description: next.description?.trim() || null,
      is_required: next.is_required,
      min_select: next.is_required ? Math.max(1, next.min_select || 1) : 0,
      max_select: Math.max(1, next.max_select),
      is_active: next.is_active,
    };
    const { error } = await supabase.from("menu_option_groups").update(normalized).eq("option_group_id", group.option_group_id);
    if (error) return setError(error.message);
    void load();
  }

  async function addOption(groupId: string) {
    const name = (newOptionName[groupId] ?? "").trim();
    const price = Number(newOptionPrice[groupId] ?? "0");
    if (!name) return setError("กรุณาใส่ชื่อตัวเลือก");
    if (!Number.isFinite(price) || price < 0) return setError("ราคาเพิ่มต้องเป็น 0 หรือมากกว่า");
    setSaving(true); setError(null);
    try {
      const count = options.filter((o) => o.option_group_id === groupId).length;
      const { error } = await supabase.from("menu_options").insert({
        option_group_id: groupId,
        name,
        price_delta: price,
        is_active: true,
        is_default: false,
        sort_order: count,
      });
      if (error) throw error;
      setNewOptionName((s) => ({ ...s, [groupId]: "" }));
      setNewOptionPrice((s) => ({ ...s, [groupId]: "" }));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "เพิ่มตัวเลือกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  async function toggleOption(option: Option) {
    const { error } = await supabase.from("menu_options").update({ is_active: !option.is_active }).eq("option_id", option.option_id);
    if (error) return setError(error.message);
    void load();
  }

  async function setDefault(group: OptionGroup, option: Option) {
    setError(null);
    if (group.max_select === 1) {
      const groupOptionIds = options.filter((o) => o.option_group_id === group.option_group_id).map((o) => o.option_id);
      if (groupOptionIds.length) {
        const { error } = await supabase.from("menu_options").update({ is_default: false }).in("option_id", groupOptionIds);
        if (error) return setError(error.message);
      }
    }
    const { error } = await supabase.from("menu_options").update({ is_default: !option.is_default }).eq("option_id", option.option_id);
    if (error) return setError(error.message);
    void load();
  }

  async function toggleItemLink(groupId: string, itemId: string) {
    const exists = links.some((l) => l.option_group_id === groupId && l.item_id === itemId);
    setError(null);
    if (exists) {
      const { error } = await supabase.from("menu_item_option_groups").delete().eq("option_group_id", groupId).eq("item_id", itemId);
      if (error) return setError(error.message);
    } else {
      const { error } = await supabase.from("menu_item_option_groups").insert({ option_group_id: groupId, item_id: itemId, sort_order: 0 });
      if (error) return setError(error.message);
    }
    void load();
  }

  async function applyToAll(groupId: string) {
    const missing = items.filter((i) => !links.some((l) => l.option_group_id === groupId && l.item_id === i.item_id));
    if (!missing.length) return;
    const { error } = await supabase.from("menu_item_option_groups").insert(missing.map((i, idx) => ({ item_id: i.item_id, option_group_id: groupId, sort_order: idx })));
    if (error) return setError(error.message);
    void load();
  }

  async function deactivateGroup(group: OptionGroup) {
    if (!confirm(`ปิดกลุ่มตัวเลือก “${group.name}” ใช่หรือไม่? ลูกค้าจะไม่เห็นกลุ่มนี้จนกว่าจะเปิดใหม่`)) return;
    await updateGroup(group, { is_active: false });
  }

  return (
    <section className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900">ตัวเลือกสินค้า</h2>
          <p className="text-xs text-gray-500 mt-1">สร้างครั้งเดียว แล้วเลือกใช้กับหลายเมนูได้ เช่น อุ่น/ไม่อุ่น/เย็น หรือ เผ็ด/ไม่เผ็ด</p>
        </div>
        <button onClick={() => setCreating(true)} className="shrink-0 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white">+ กลุ่มตัวเลือก</button>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600">{error}</div>}

      {creating && (
        <div className="rounded-2xl border bg-white p-3 space-y-3">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ชื่อกลุ่ม เช่น ความร้อน / ระดับความเผ็ด" className="w-full rounded-xl border p-3 text-sm" />
          <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="คำอธิบาย (ไม่บังคับ)" className="w-full rounded-xl border p-3 text-sm" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button onClick={() => setDraft({ ...draft, required: !draft.required })} className={`rounded-xl border p-2 ${draft.required ? "border-orange-400 bg-orange-50 text-orange-700" : "bg-white"}`}>{draft.required ? "✓ บังคับเลือก" : "ไม่บังคับ"}</button>
            <button onClick={() => setDraft({ ...draft, multi: !draft.multi })} className={`rounded-xl border p-2 ${draft.multi ? "border-orange-400 bg-orange-50 text-orange-700" : "bg-white"}`}>{draft.multi ? "✓ เลือกหลายข้อได้" : "เลือกได้ 1 ข้อ"}</button>
          </div>
          <div className="grid grid-cols-2 gap-2"><button disabled={saving} onClick={() => void createGroup()} className="rounded-xl bg-orange-500 p-2.5 text-sm text-white disabled:opacity-50">สร้างกลุ่ม</button><button onClick={() => { setCreating(false); setDraft(emptyDraft); }} className="rounded-xl bg-gray-100 p-2.5 text-sm">ยกเลิก</button></div>
        </div>
      )}

      {groups.length === 0 && !creating && <p className="rounded-xl bg-white p-3 text-xs text-gray-400">ยังไม่มีกลุ่มตัวเลือก</p>}

      {groups.map((group) => {
        const groupOptions = options.filter((o) => o.option_group_id === group.option_group_id);
        const attached = items.filter((i) => links.some((l) => l.option_group_id === group.option_group_id && l.item_id === i.item_id));
        return (
          <div key={group.option_group_id} className={`rounded-2xl border bg-white p-3 space-y-3 ${!group.is_active ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="font-semibold truncate">{group.name}</p>{group.description && <p className="text-xs text-gray-400">{group.description}</p>}<p className="text-[11px] text-gray-400 mt-1">{group.is_required ? "บังคับเลือก" : "ไม่บังคับ"} · {group.max_select === 1 ? "เลือกได้ 1 ข้อ" : `เลือกได้สูงสุด ${group.max_select} ข้อ`}</p></div>
              <button onClick={() => void updateGroup(group, { is_active: !group.is_active })} className="rounded-full bg-gray-100 px-3 py-1 text-[11px]">{group.is_active ? "เปิดใช้งาน" : "ปิดอยู่"}</button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600">ตัวเลือก</p>
              {groupOptions.map((o) => <div key={o.option_id} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2"><div><p className={`text-sm ${!o.is_active ? "line-through text-gray-400" : ""}`}>{o.name}</p><p className="text-[11px] text-gray-400">{Number(o.price_delta) > 0 ? `+฿${Number(o.price_delta)}` : "ไม่เพิ่มราคา"}{o.is_default ? " · ค่าเริ่มต้น" : ""}</p></div><div className="flex gap-1"><button onClick={() => void setDefault(group, o)} className="rounded-lg bg-white px-2 py-1 text-[10px] border">{o.is_default ? "ยกเลิกค่าเริ่มต้น" : "ตั้งค่าเริ่มต้น"}</button><button onClick={() => void toggleOption(o)} className="rounded-lg bg-white px-2 py-1 text-[10px] border">{o.is_active ? "ปิด" : "เปิด"}</button></div></div>)}
              <div className="grid grid-cols-[1fr_90px_auto] gap-2"><input value={newOptionName[group.option_group_id] ?? ""} onChange={(e) => setNewOptionName((s) => ({ ...s, [group.option_group_id]: e.target.value }))} placeholder="เช่น อุ่น" className="rounded-xl border p-2.5 text-sm"/><input type="number" min="0" value={newOptionPrice[group.option_group_id] ?? ""} onChange={(e) => setNewOptionPrice((s) => ({ ...s, [group.option_group_id]: e.target.value }))} placeholder="+ราคา" className="rounded-xl border p-2.5 text-sm"/><button disabled={saving} onClick={() => void addOption(group.option_group_id)} className="rounded-xl bg-blue-600 px-3 text-sm text-white">เพิ่ม</button></div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-gray-600">ใช้กับเมนู</p><p className="text-[11px] text-gray-400">เลือกได้หลายรายการ</p></div><button onClick={() => void applyToAll(group.option_group_id)} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-700">ใช้กับทั้งหมด</button></div>
              <div className="flex flex-wrap gap-2">{items.map((item) => { const checked = attached.some((a) => a.item_id === item.item_id); return <button key={item.item_id} onClick={() => void toggleItemLink(group.option_group_id, item.item_id)} className={`rounded-full border px-3 py-1.5 text-[11px] ${checked ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 bg-white text-gray-500"}`}>{checked ? "✓ " : ""}{item.name}</button>; })}</div>
            </div>

            <div className="flex justify-end"><button onClick={() => void deactivateGroup(group)} className="text-[11px] text-red-500">ปิดกลุ่มนี้</button></div>
          </div>
        );
      })}
    </section>
  );
}
