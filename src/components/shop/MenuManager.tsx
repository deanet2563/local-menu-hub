import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// MyTree — Menu management (owner CRUD, relies on existing RLS:
// menu_owner_insert/update/delete require shop_id in fn_staff_shop_ids()).
// Also includes the shop open/closed toggle, since a shop with no items
// visible or left "closed" won't show up in the customer hub.
// ============================================================

type Shop = { shop_id: string; name: string; is_open: boolean };
type Item = { item_id: string; name: string; price: number; category: string | null; image_url: string | null; is_available: boolean };

export function MenuManager({ shopId, showWelcome }: { shopId: string; showWelcome?: boolean }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", category: "", image_url: "" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: s }, { data: m }] = await Promise.all([
      supabase.from("shops").select("shop_id,name,is_open").eq("shop_id", shopId).maybeSingle(),
      supabase.from("menu_items").select("item_id,name,price,category,image_url,is_available").eq("shop_id", shopId).order("category"),
    ]);
    setShop(s as Shop);
    setItems((m as Item[]) ?? []);
    setLoading(false);
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  async function toggleOpen() {
    if (!shop) return;
    if (!shop.is_open && items.length === 0) {
      setError("เพิ่มเมนูอย่างน้อย 1 รายการก่อนเปิดร้าน");
      return;
    }
    await supabase.from("shops").update({ is_open: !shop.is_open }).eq("shop_id", shopId);
    load();
  }

  async function toggleAvailable(item: Item) {
    await supabase.from("menu_items").update({ is_available: !item.is_available }).eq("item_id", item.item_id);
    load();
  }

  async function deleteItem(item_id: string) {
    await supabase.from("menu_items").delete().eq("item_id", item_id);
    load();
  }

  async function submitNew() {
    const price = Number(form.price);
    if (!form.name.trim()) { setError("กรอกชื่อเมนู"); return; }
    if (!price || price <= 0) { setError("ใส่ราคาที่ถูกต้อง"); return; }
    setError(null);
    const { error: err } = await supabase.from("menu_items").insert({
      shop_id: shopId,
      name: form.name.trim(),
      price,
      category: form.category.trim() || null,
      image_url: form.image_url.trim() || null,
      is_available: true,
    });
    if (err) { setError(err.message); return; }
    setForm({ name: "", price: "", category: "", image_url: "" });
    setAdding(false);
    load();
  }

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (!shop) return <p className="p-4 text-sm text-gray-400">ไม่พบร้าน</p>;

  const cats = Array.from(new Set(items.map((i) => i.category || "อื่นๆ")));

  return (
    <div className="p-4 pb-24 space-y-4 max-w-md mx-auto">
      {showWelcome && (
        <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm p-3">
          ✅ สมัครร้านสำเร็จ! เพิ่มเมนูอย่างน้อย 1 รายการ แล้วกด "เปิดร้าน" เพื่อให้ลูกค้าเห็น
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{shop.name}</h1>
          <p className="text-xs text-gray-400">{items.length} เมนู</p>
        </div>
        <button onClick={toggleOpen} className={`rounded-full px-4 py-2 text-sm font-medium ${shop.is_open ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"}`}>
          {shop.is_open ? "🟢 เปิดร้าน" : "⚪ ปิดร้าน"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {cats.map((cat) => (
        <div key={cat}>
          <p className="text-sm font-medium text-gray-700 mb-2">{cat}</p>
          <div className="space-y-2">
            {items.filter((i) => (i.category || "อื่นๆ") === cat).map((i) => (
              <div key={i.item_id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2">
                <img src={i.image_url ?? ""} alt={i.name} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{i.name}</p>
                  <p className="text-xs text-orange-600">฿{i.price}</p>
                </div>
                <button onClick={() => toggleAvailable(i)} className={`text-xs rounded-full px-2 py-1 ${i.is_available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {i.is_available ? "พร้อมขาย" : "หมด"}
                </button>
                <button onClick={() => deleteItem(i.item_id)} className="text-gray-300 text-sm px-1">✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {items.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีเมนู — เพิ่มเมนูแรกด้านล่าง</p>}

      {adding ? (
        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
          <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ชื่อเมนู" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ราคา" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="หมวด เช่น จานเดียว" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ลิงก์รูป (ไม่บังคับ)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={submitNew} className="flex-1 rounded-lg bg-orange-500 text-white py-2 text-sm">บันทึก</button>
            <button onClick={() => setAdding(false)} className="flex-1 rounded-lg bg-gray-100 py-2 text-sm">ยกเลิก</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full rounded-lg border-2 border-dashed border-gray-200 text-gray-500 py-3 text-sm">
          + เพิ่มเมนู
        </button>
      )}
    </div>
  );
}
