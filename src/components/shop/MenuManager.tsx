import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// MyTree — Menu management: open/close (gated by admin approval),
// shop settings (phone/address/logo — uploaded from phone, not a URL),
// menu items with full edit (name/price/category/photo) + availability
// toggle + delete, and self-service shop deletion request.
// ============================================================

type Shop = {
  shop_id: string; name: string; is_open: boolean;
  is_approved: boolean; is_banned: boolean; banned_reason: string | null;
  deletion_requested_at: string | null; deletion_reason: string | null;
  qr_code_url: string | null; logo_url: string | null;
  phone: string | null; address: string | null;
};
type Item = { item_id: string; name: string; price: number; category: string | null; image_url: string | null; is_available: boolean };

const SHOP_COLS = "shop_id, name, is_open, is_approved, is_banned, banned_reason, deletion_requested_at, deletion_reason, qr_code_url, logo_url, phone, address";

type ItemForm = { name: string; price: string; category: string };
const emptyForm: ItemForm = { name: "", price: "", category: "" };

export function MenuManager({ shopId, showWelcome }: { shopId: string; showWelcome?: boolean }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // shop settings (editable copy, separate from `shop` until saved)
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // add / edit item
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<ItemForm>(emptyForm);
  const [addPhoto, setAddPhoto] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ItemForm>(emptyForm);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const load = useCallback(async () => {
    const [{ data: s }, { data: m }] = await Promise.all([
      supabase.from("shops").select(SHOP_COLS).eq("shop_id", shopId).maybeSingle(),
      supabase.from("menu_items").select("item_id,name,price,category,image_url,is_available").eq("shop_id", shopId).order("category"),
    ]);
    const shopRow = s as Shop | null;
    setShop(shopRow);
    setPhone(shopRow?.phone ?? "");
    setAddress(shopRow?.address ?? "");
    setItems((m as Item[]) ?? []);
    setLoading(false);
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  // ---------- shop settings ----------
  async function saveSettings() {
    setSavingSettings(true);
    setError(null);
    const { error } = await supabase.from("shops").update({ phone: phone.trim() || null, address: address.trim() || null }).eq("shop_id", shopId);
    setSavingSettings(false);
    if (error) return setError(error.message);
    load();
  }

  async function uploadLogo(file: File) {
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${shopId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from("shop-assets").upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("shop-assets").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: updErr } = await supabase.from("shops").update({ logo_url: url }).eq("shop_id", shopId);
      if (updErr) throw updErr;
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดรูปร้านไม่สำเร็จ");
    }
  }

  async function uploadQr(file: File) {
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${shopId}/qr.${ext}`;
      const { error: upErr } = await supabase.storage.from("shop-qr-codes").upload(path, file, { contentType: file.type || "image/png", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("shop-qr-codes").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: updErr } = await supabase.from("shops").update({ qr_code_url: url }).eq("shop_id", shopId);
      if (updErr) throw updErr;
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลด QR ไม่สำเร็จ");
    }
  }

  async function toggleOpen() {
    if (!shop) return;
    if (!shop.is_approved) { setError("ร้านยังไม่ได้รับการอนุมัติจากแอดมิน"); return; }
    if (!shop.is_open && items.length === 0) { setError("เพิ่มเมนูอย่างน้อย 1 รายการก่อนเปิดร้าน"); return; }
    await supabase.from("shops").update({ is_open: !shop.is_open }).eq("shop_id", shopId);
    load();
  }

  // ---------- menu items ----------
  async function uploadItemPhoto(itemId: string, file: File): Promise<string | null> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${shopId}/items/${itemId}.${ext}`;
    const { error: upErr } = await supabase.storage.from("shop-assets").upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("shop-assets").getPublicUrl(path);
    return `${pub.publicUrl}?t=${Date.now()}`;
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
    const price = Number(addForm.price);
    if (!addForm.name.trim()) { setError("กรอกชื่อเมนู"); return; }
    if (!price || price <= 0) { setError("ใส่ราคาที่ถูกต้อง"); return; }
    setSavingItem(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("menu_items")
        .insert({ shop_id: shopId, name: addForm.name.trim(), price, category: addForm.category.trim() || null, is_available: true })
        .select("item_id")
        .single();
      if (err) throw err;
      if (addPhoto && data) {
        const url = await uploadItemPhoto((data as { item_id: string }).item_id, addPhoto);
        await supabase.from("menu_items").update({ image_url: url }).eq("item_id", (data as { item_id: string }).item_id);
      }
      setAddForm(emptyForm);
      setAddPhoto(null);
      setAdding(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มเมนูไม่สำเร็จ");
    } finally {
      setSavingItem(false);
    }
  }

  function startEdit(item: Item) {
    setEditingId(item.item_id);
    setEditForm({ name: item.name, price: String(item.price), category: item.category ?? "" });
    setEditPhoto(null);
  }

  async function saveEdit(item_id: string) {
    const price = Number(editForm.price);
    if (!editForm.name.trim()) { setError("กรอกชื่อเมนู"); return; }
    if (!price || price <= 0) { setError("ใส่ราคาที่ถูกต้อง"); return; }
    setSavingItem(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = { name: editForm.name.trim(), price, category: editForm.category.trim() || null };
      if (editPhoto) patch.image_url = await uploadItemPhoto(item_id, editPhoto);
      const { error: err } = await supabase.from("menu_items").update(patch).eq("item_id", item_id);
      if (err) throw err;
      setEditingId(null);
      setEditPhoto(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingItem(false);
    }
  }

  async function submitDeletionRequest() {
    if (!deleteReason.trim()) { setError("กรุณาระบุเหตุผลที่ต้องการปิด/ลบร้าน"); return; }
    setSubmittingDelete(true);
    setError(null);
    const { error } = await supabase
      .from("shops")
      .update({ deletion_requested_at: new Date().toISOString(), deletion_reason: deleteReason.trim(), is_open: false })
      .eq("shop_id", shopId);
    setSubmittingDelete(false);
    if (error) return setError(error.message);
    setShowDeleteForm(false);
    setDeleteReason("");
    load();
  }

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (!shop) return <p className="p-4 text-sm text-gray-400">ไม่พบร้าน</p>;

  if (shop.is_banned) {
    return (
      <div className="p-6 text-center space-y-2 max-w-md mx-auto">
        <p className="text-lg font-semibold">⛔ ร้านนี้ถูกระงับ</p>
        {shop.banned_reason && <p className="text-sm text-gray-500">เหตุผล: {shop.banned_reason}</p>}
        <p className="text-xs text-gray-400">ติดต่อแอดมินหากคิดว่านี่เป็นความผิดพลาด</p>
      </div>
    );
  }

  const cats = Array.from(new Set(items.map((i) => i.category || "อื่นๆ")));
  const settingsDirty = phone !== (shop.phone ?? "") || address !== (shop.address ?? "");

  return (
    <div className="p-4 pb-24 space-y-4 max-w-md mx-auto">
      {showWelcome && (
        <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm p-3">
          ✅ สมัครร้านสำเร็จ! รอแอดมินอนุมัติ แล้วเพิ่มเมนู + เปิดร้านได้เลย
        </div>
      )}

      {shop.deletion_requested_at ? (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          🗑️ ส่งคำขอปิด/ลบร้านแล้ว — รอแอดมินดำเนินการ
          {shop.deletion_reason && <p className="text-xs mt-1">เหตุผล: {shop.deletion_reason}</p>}
        </div>
      ) : !shop.is_approved ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          ⏳ ร้านนี้รอแอดมินอนุมัติ — ยังเปิดขายไม่ได้จนกว่าจะอนุมัติ (เพิ่มเมนูเตรียมไว้ก่อนได้)
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{shop.name}</h1>
          <p className="text-xs text-gray-400">{items.length} เมนู</p>
        </div>
        <button
          onClick={toggleOpen}
          disabled={!shop.is_approved || !!shop.deletion_requested_at}
          className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${shop.is_open ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"}`}
        >
          {shop.is_open ? "🟢 เปิดร้าน" : "⚪ ปิดร้าน"}
        </button>
      </div>

      {/* ---------- shop settings: logo + phone + address ---------- */}
      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">🏪 รูปร้าน / ข้อมูลติดต่อ</p>
        <div className="flex items-center gap-3">
          <img src={shop.logo_url ?? ""} alt="โลโก้ร้าน" className="w-16 h-16 rounded-lg object-cover bg-gray-100 shrink-0" />
          <label className="flex-1">
            <span className="sr-only">อัปโหลดรูปร้าน</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              className="w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs"
            />
          </label>
        </div>
        <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="เบอร์โทรร้าน" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ที่อยู่ร้าน" value={address} onChange={(e) => setAddress(e.target.value)} />
        {settingsDirty && (
          <button onClick={saveSettings} disabled={savingSettings} className="rounded-lg bg-orange-500 text-white text-xs px-3 py-1.5 disabled:opacity-50">
            {savingSettings ? "กำลังบันทึก..." : "บันทึกข้อมูลร้าน"}
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">💳 QR Code รับเงินโอน</p>
        {shop.qr_code_url ? (
          <img src={shop.qr_code_url} alt="QR code" className="w-40 h-40 object-contain rounded-lg border border-gray-100 mx-auto" />
        ) : (
          <p className="text-xs text-gray-400">ยังไม่ได้อัปโหลด QR — ลูกค้าจะเลือกจ่ายผ่าน QR ไม่ได้จนกว่าจะมี</p>
        )}
        <label className="block">
          <span className="sr-only">อัปโหลด QR</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && uploadQr(e.target.files[0])}
            className="w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* ---------- menu items ---------- */}
      {cats.map((cat) => (
        <div key={cat}>
          <p className="text-sm font-medium text-gray-700 mb-2">{cat}</p>
          <div className="space-y-2">
            {items.filter((i) => (i.category || "อื่นๆ") === cat).map((i) =>
              editingId === i.item_id ? (
                <div key={i.item_id} className="rounded-lg border border-orange-200 bg-orange-50/40 p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <img src={i.image_url ?? ""} alt={i.name} className="w-12 h-12 rounded-lg object-cover bg-gray-100 shrink-0" />
                    <input type="file" accept="image/*" onChange={(e) => setEditPhoto(e.target.files?.[0] ?? null)} className="flex-1 text-xs" />
                  </div>
                  <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ชื่อเมนู" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ราคา" inputMode="numeric" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                  <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="หมวด" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(i.item_id)} disabled={savingItem} className="flex-1 rounded-lg bg-orange-500 text-white py-1.5 text-sm disabled:opacity-50">
                      {savingItem ? "กำลังบันทึก..." : "บันทึก"}
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex-1 rounded-lg bg-gray-100 py-1.5 text-sm">ยกเลิก</button>
                  </div>
                </div>
              ) : (
                <div key={i.item_id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2">
                  <img src={i.image_url ?? ""} alt={i.name} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{i.name}</p>
                    <p className="text-xs text-orange-600">฿{i.price}</p>
                  </div>
                  <button onClick={() => startEdit(i)} className="text-xs rounded-full px-2 py-1 bg-blue-100 text-blue-700">แก้ไข</button>
                  <button onClick={() => toggleAvailable(i)} className={`text-xs rounded-full px-2 py-1 ${i.is_available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {i.is_available ? "พร้อมขาย" : "หมด"}
                  </button>
                  <button onClick={() => deleteItem(i.item_id)} className="text-gray-300 text-sm px-1">✕</button>
                </div>
              )
            )}
          </div>
        </div>
      ))}

      {items.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีเมนู — เพิ่มเมนูแรกด้านล่าง</p>}

      {adding ? (
        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
          <input type="file" accept="image/*" onChange={(e) => setAddPhoto(e.target.files?.[0] ?? null)} className="w-full text-xs" />
          <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ชื่อเมนู" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
          <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ราคา" inputMode="numeric" value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: e.target.value })} />
          <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="หมวด เช่น จานเดียว" value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={submitNew} disabled={savingItem} className="flex-1 rounded-lg bg-orange-500 text-white py-2 text-sm disabled:opacity-50">
              {savingItem ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button onClick={() => { setAdding(false); setAddPhoto(null); }} className="flex-1 rounded-lg bg-gray-100 py-2 text-sm">ยกเลิก</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full rounded-lg border-2 border-dashed border-gray-200 text-gray-500 py-3 text-sm">
          + เพิ่มเมนู
        </button>
      )}

      {!shop.deletion_requested_at && (
        <div className="pt-4 border-t border-gray-100">
          {!showDeleteForm ? (
            <button onClick={() => setShowDeleteForm(true)} className="text-xs text-red-400 underline">
              🗑️ ขอปิด/ลบร้านค้า
            </button>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2 mt-2">
              <p className="text-sm text-red-700 font-medium">ขอปิด/ลบร้านค้า</p>
              <p className="text-xs text-gray-500">คำขอนี้จะส่งให้แอดมินตรวจสอบก่อนดำเนินการ</p>
              <textarea className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="เหตุผล (จำเป็น)" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={2} />
              <div className="flex gap-2">
                <button onClick={submitDeletionRequest} disabled={submittingDelete} className="flex-1 rounded-lg bg-red-500 text-white py-2 text-sm disabled:opacity-50">
                  {submittingDelete ? "กำลังส่ง..." : "ส่งคำขอ"}
                </button>
                <button onClick={() => setShowDeleteForm(false)} className="flex-1 rounded-lg bg-gray-100 py-2 text-sm">ยกเลิก</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
