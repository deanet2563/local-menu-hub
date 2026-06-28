// ============================================================
// Local Menu Hub — Step 16: POS Quick Order Mode
//
// Layout: grid เมนู (ซ้าย, group ตาม category) + ตะกร้าสรุป (ขวา)
// Submit → เรียก fn_create_order() ผ่าน supabase.rpc — ห้ามเขียน insert
// logic แยกที่นี่ เพราะต้อง share กับ LIFF checkout (ดู Step 16 SQL addon)
//
// วาง component นี้ที่: src/routes/sweet/pos.tsx (route /sweet/pos)
// ============================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { PaymentMethodEnum } from "@/types/database";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

type MenuItem = {
  item_id: string;
  shop_id: string;
  name: string;
  price: number;
  category: string | null;
  image_url: string | null;
  is_available: boolean;
};

type CartLine = {
  key: string; // menu_item_id หรือ "adhoc-<timestamp>" สำหรับรายการนอกเมนู
  menu_item_id: string | null;
  item_name: string;
  unit_price: number;
  qty: number;
};

// ----------------------------------------------------------------
// Main screen
// ----------------------------------------------------------------

export function POSOrderScreen({ shopId }: { shopId: string }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodEnum>("cash");
  const [showAdhocForm, setShowAdhocForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("ทั้งหมด");

  useEffect(() => {
    (async () => {
      setLoadingMenu(true);
      const { data, error } = await supabase
        .from("menu_items")
        .select("item_id, shop_id, name, price, category, image_url, is_available")
        .eq("shop_id", shopId)
        .eq("is_available", true)
        .order("category", { ascending: true });

      if (error) setError(error.message);
      setMenuItems(data ?? []);
      setLoadingMenu(false);
    })();
  }, [shopId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m) => set.add(m.category ?? "อื่นๆ"));
    return ["ทั้งหมด", ...Array.from(set)];
  }, [menuItems]);

  const visibleItems = useMemo(() => {
    if (activeCategory === "ทั้งหมด") return menuItems;
    return menuItems.filter((m) => (m.category ?? "อื่นๆ") === activeCategory);
  }, [menuItems, activeCategory]);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.unit_price * line.qty, 0),
    [cart]
  );

  // ----------------------------------------------------------------
  // Cart mutations
  // ----------------------------------------------------------------

  function addMenuItemToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((l) => l.menu_item_id === item.item_id);
      if (existing) {
        return prev.map((l) =>
          l.menu_item_id === item.item_id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [
        ...prev,
        {
          key: item.item_id,
          menu_item_id: item.item_id,
          item_name: item.name,
          unit_price: item.price,
          qty: 1,
        },
      ];
    });
  }

  function addAdhocItem(name: string, price: number) {
    if (!name.trim() || price <= 0) return;
    setCart((prev) => [
      ...prev,
      {
        key: `adhoc-${Date.now()}`,
        menu_item_id: null,
        item_name: name.trim(),
        unit_price: price,
        qty: 1,
      },
    ]);
    setShowAdhocForm(false);
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  // ----------------------------------------------------------------
  // Submit order — เรียก shared service fn_create_order ผ่าน RPC
  // ----------------------------------------------------------------

  async function handleSubmit() {
    if (cart.length === 0) {
      setError("ยังไม่มีรายการในตะกร้า");
      return;
    }
    setSubmitting(true);
    setError(null);

    const items = cart.map((l) => ({
      menu_item_id: l.menu_item_id,
      item_name: l.item_name,
      unit_price: l.unit_price,
      qty: l.qty,
    }));

    const { data, error } = await supabase.rpc("fn_create_order", {
      p_shop_id: shopId,
      p_items: items,
      p_payment_method: paymentMethod,
      p_fulfillment_type: "pickup", // POS = ลูกค้าหน้าร้าน ไม่มี delivery
      p_source: "pos",
    });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setLastOrderId(result?.out_sub_id ?? null);
    setCart([]);
  }

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="flex h-full gap-4 p-4">
      {/* ฝั่งซ้าย: grid เมนู */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
                activeCategory === cat
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loadingMenu ? (
          <p className="text-sm text-gray-400">กำลังโหลดเมนู...</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleItems.map((item) => (
              <button
                key={item.item_id}
                onClick={() => addMenuItemToCart(item)}
                className="rounded-xl border border-gray-200 p-3 text-left hover:border-orange-400 hover:bg-orange-50"
              >
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="mb-2 h-20 w-full rounded-lg object-cover"
                  />
                )}
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-sm text-orange-600">฿{item.price}</p>
              </button>
            ))}
          </div>
        )}

        {/* เพิ่มรายการนอกเมนู */}
        {showAdhocForm ? (
          <AdhocItemForm onAdd={addAdhocItem} onCancel={() => setShowAdhocForm(false)} />
        ) : (
          <button
            onClick={() => setShowAdhocForm(true)}
            className="mt-2 text-sm text-blue-600 underline"
          >
            + เพิ่มรายการนอกเมนู
          </button>
        )}
      </div>

      {/* ฝั่งขวา: ตะกร้าสรุป */}
      <div className="w-80 flex-shrink-0 space-y-3 rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800">🧾 รายการที่สั่ง</h3>

        {cart.length === 0 ? (
          <p className="text-sm text-gray-400">แตะเมนูด้านซ้ายเพื่อเพิ่ม</p>
        ) : (
          <div className="space-y-2">
            {cart.map((line) => (
              <div key={line.key} className="flex items-center justify-between text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{line.item_name}</p>
                  <p className="text-xs text-gray-400">฿{line.unit_price}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => changeQty(line.key, -1)}
                    className="h-6 w-6 rounded-full bg-gray-100 text-gray-600"
                  >
                    −
                  </button>
                  <span className="w-6 text-center">{line.qty}</span>
                  <button
                    onClick={() => changeQty(line.key, 1)}
                    className="h-6 w-6 rounded-full bg-gray-100 text-gray-600"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeLine(line.key)}
                    className="ml-1 text-gray-300 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold">
          <span>รวม</span>
          <span>฿{total}</span>
        </div>

        {/* วิธีจ่าย */}
        <div className="flex gap-2">
          <PaymentMethodButton
            label="💵 เงินสด"
            active={paymentMethod === "cash"}
            onClick={() => setPaymentMethod("cash")}
          />
          <PaymentMethodButton
            label="📱 โอน/QR"
            active={paymentMethod === "qr_transfer"}
            onClick={() => setPaymentMethod("qr_transfer")}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {lastOrderId && (
          <p className="text-sm text-green-600">
            ✅ สร้างออเดอร์แล้ว ({lastOrderId.slice(0, 6)})
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || cart.length === 0}
          className="w-full rounded-lg bg-orange-500 py-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "กำลังบันทึก..." : "✅ ยืนยันออเดอร์"}
        </button>
        {paymentMethod === "cash" && (
          <p className="text-xs text-gray-400">
            เลือกเงินสด → ระบบจะบันทึกว่า "จ่ายแล้ว" ทันที (เก็บเงินจริงหน้าร้าน)
          </p>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Small shared bits
// ----------------------------------------------------------------

function PaymentMethodButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-sm font-medium ${
        active ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}

function AdhocItemForm({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, price: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const submit = useCallback(() => {
    onAdd(name, Number(price));
  }, [name, price, onAdd]);

  return (
    <div className="mt-2 flex gap-2 rounded-lg border border-gray-200 p-2">
      <input
        className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
        placeholder="ชื่อรายการ"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="w-20 rounded border border-gray-200 px-2 py-1 text-sm"
        placeholder="ราคา"
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <button onClick={submit} className="rounded bg-orange-500 px-3 py-1 text-sm text-white">
        เพิ่ม
      </button>
      <button onClick={onCancel} className="text-sm text-gray-400">
        ยกเลิก
      </button>
    </div>
  );
}
