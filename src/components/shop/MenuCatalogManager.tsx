import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { shopStorageFolder, safeImageExtension } from "@/lib/storageKey";
import { OptionGroupManager } from "@/components/shop/OptionGroupManager";

type Item = { item_id: string; name: string; price: number; category: string | null; image_url: string | null; is_available: boolean };
type Form = { name: string; price: string; category: string };
const emptyForm: Form = { name: "", price: "", category: "" };

export function MenuCatalogManager({ shopId, showWelcome }: { shopId: string; showWelcome?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<Form>(emptyForm);
  const [addPhoto, setAddPhoto] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Form>(emptyForm);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("menu_items")
      .select("item_id,name,price,category,image_url,is_available")
      .eq("shop_id", shopId).is("archived_at", null).order("category").order("name");
    if (error) return setError(error.message);
    setItems((data as Item[]) ?? []);
  }, [shopId]);
  useEffect(() => { void load(); }, [load]);

  async function uploadPhoto(itemId: string, file: File) {
    const ext = safeImageExtension(file.name, "jpg");
    const path = `${shopStorageFolder(shopId)}/items/${itemId}.${ext}`;
    const { error } = await supabase.storage.from("shop-assets").upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("shop-assets").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }

  async function submitNew() {
    const price = Number(addForm.price);
    if (!addForm.name.trim()) return setError("กรุณากรอกชื่อเมนู");
    if (!Number.isFinite(price) || price <= 0) return setError("กรุณาใส่ราคาที่ถูกต้อง");
    setSaving(true); setError(null);
    try {
      const { data, error } = await supabase.from("menu_items").insert({ shop_id: shopId, name: addForm.name.trim(), price, category: addForm.category.trim() || null, is_available: true }).select("item_id").single();
      if (error) throw error;
      const itemId = (data as { item_id: string }).item_id;
      if (addPhoto) {
        const image_url = await uploadPhoto(itemId, addPhoto);
        const { error: imageErr } = await supabase.from("menu_items").update({ image_url }).eq("item_id", itemId);
        if (imageErr) throw imageErr;
      }
      setAddForm(emptyForm); setAddPhoto(null); setAdding(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "เพิ่มเมนูไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  function startEdit(item: Item) {
    setEditingId(item.item_id);
    setEditForm({ name: item.name, price: String(item.price), category: item.category ?? "" });
    setEditPhoto(null);
  }

  async function saveEdit(itemId: string) {
    const price = Number(editForm.price);
    if (!editForm.name.trim()) return setError("กรุณากรอกชื่อเมนู");
    if (!Number.isFinite(price) || price <= 0) return setError("กรุณาใส่ราคาที่ถูกต้อง");
    setSaving(true); setError(null);
    try {
      const patch: Record<string, unknown> = { name: editForm.name.trim(), price, category: editForm.category.trim() || null };
      if (editPhoto) patch.image_url = await uploadPhoto(itemId, editPhoto);
      const { error } = await supabase.from("menu_items").update(patch).eq("item_id", itemId);
      if (error) throw error;
      setEditingId(null); setEditPhoto(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  async function toggleAvailable(item: Item) {
    const { error } = await supabase.from("menu_items").update({ is_available: !item.is_available }).eq("item_id", item.item_id);
    if (error) return setError(error.message);
    void load();
  }

  async function archiveItem(item: Item) {
    if (!confirm(`นำเมนู "${item.name}" ออกจากร้านใช่หรือไม่?`)) return;
    setError(null);
    const { error } = await supabase.from("menu_items").update({ archived_at: new Date().toISOString(), is_available: false }).eq("item_id", item.item_id);
    if (error) return setError(error.message);
    void load();
  }

  const cats = Array.from(new Set(items.map((i) => i.category || "อื่นๆ")));

  return <div className="mx-auto max-w-md space-y-4 p-4 pb-24">
    {showWelcome && <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">✅ สมัครร้านสำเร็จ เพิ่มรายการสินค้า/อาหารได้เลย</div>}
    <div className="flex items-center justify-between"><div><h1 className="text-xl font-bold">จัดการรายการ</h1><p className="text-sm text-gray-400">{items.length} รายการ</p></div><button onClick={() => setAdding(true)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">+ เพิ่มรายการ</button></div>
    <p className="text-xs text-gray-400">จัดการสินค้าและตัวเลือกเฉพาะของร้าน เช่น อุ่น/ไม่อุ่น/เย็น หรือ เผ็ด/ไม่เผ็ด</p>
    {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

    {adding && <div className="rounded-2xl border p-4 space-y-3">
      <input value={addForm.name} onChange={(e)=>setAddForm({...addForm,name:e.target.value})} placeholder="ชื่อเมนู" className="w-full rounded-xl border p-3" />
      <div className="grid grid-cols-2 gap-2"><input type="number" value={addForm.price} onChange={(e)=>setAddForm({...addForm,price:e.target.value})} placeholder="ราคา" className="rounded-xl border p-3"/><input value={addForm.category} onChange={(e)=>setAddForm({...addForm,category:e.target.value})} placeholder="หมวดหมู่" className="rounded-xl border p-3"/></div>
      <input type="file" accept="image/*" onChange={(e)=>setAddPhoto(e.target.files?.[0]??null)} className="w-full text-sm" />
      <div className="grid grid-cols-2 gap-2"><button disabled={saving} onClick={()=>void submitNew()} className="rounded-xl bg-blue-600 p-3 text-white">บันทึก</button><button onClick={()=>{setAdding(false);setAddPhoto(null)}} className="rounded-xl bg-gray-100 p-3">ยกเลิก</button></div>
    </div>}

    <OptionGroupManager shopId={shopId} items={items} />

    {cats.map(cat => <section key={cat} className="space-y-2"><h2 className="font-semibold">{cat}</h2>{items.filter(i=>(i.category||"อื่นๆ")===cat).map(item => <div key={item.item_id} className="rounded-2xl border p-3">
      {editingId===item.item_id ? <div className="space-y-2"><input value={editForm.name} onChange={(e)=>setEditForm({...editForm,name:e.target.value})} className="w-full rounded-xl border p-3"/><div className="grid grid-cols-2 gap-2"><input type="number" value={editForm.price} onChange={(e)=>setEditForm({...editForm,price:e.target.value})} className="rounded-xl border p-3"/><input value={editForm.category} onChange={(e)=>setEditForm({...editForm,category:e.target.value})} className="rounded-xl border p-3"/></div><input type="file" accept="image/*" onChange={(e)=>setEditPhoto(e.target.files?.[0]??null)} className="w-full text-sm"/><div className="grid grid-cols-2 gap-2"><button onClick={()=>void saveEdit(item.item_id)} className="rounded-xl bg-orange-500 p-2 text-white">บันทึก</button><button onClick={()=>setEditingId(null)} className="rounded-xl bg-gray-100 p-2">ยกเลิก</button></div></div>
      : <div className="flex gap-3"><img src={item.image_url??""} className="h-20 w-20 rounded-xl bg-gray-100 object-cover"/><div className="flex-1"><p className="font-medium">{item.name}</p><p className="text-sm text-gray-500">฿{item.price}</p><div className="mt-2 flex flex-wrap gap-2"><button onClick={()=>void toggleAvailable(item)} className="rounded-full bg-green-50 px-3 py-1 text-xs">{item.is_available?"พร้อมขาย":"ปิดขาย"}</button><button onClick={()=>startEdit(item)} className="rounded-full bg-blue-50 px-3 py-1 text-xs">แก้ไข</button><button onClick={() => void archiveItem(item)} className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-600">นำออก</button></div></div></div>}
    </div>)}</section>)}
  </div>;
}
