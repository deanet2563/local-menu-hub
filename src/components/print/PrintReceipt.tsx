// ============================================================
// Local Menu Hub — Step 17: Kitchen Print Receipt (refactored, generic)
//
// แทนที่ของเดิมที่ hardcode "Demo Shop" + isSalapao logic — ตัวนี้ใช้ได้
// กับทุกร้าน เพราะ group ตาม order_items.menu_item.category จริง ไม่เช็ค
// ชื่อสินค้าเป็นภาษาไทยเฉพาะร้านอีกต่อไป
//
// วิธีพิมพ์: หน้านี้ format เป็นใบเสร็จ 80mm ด้วย CSS แล้วเรียก
// window.print() อัตโนมัติตอนโหลด — browser ส่งไปเครื่องพิมพ์จริงที่ผูกกับ
// OS ของ PC/Tablet หน้าร้านอยู่แล้ว (ไม่ต้องเชื่อม ESC/POS ตรง)
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

type OrderItemRow = {
  id: string;
  item_name_snapshot: string;
  unit_price_snapshot: number;
  qty: number;
  line_total: number;
  menu_item_id: string | null;
};

type MenuItemCategory = {
  item_id: string;
  category: string | null;
};

type SubOrderForPrint = {
  sub_id: string;
  shop_id: string;
  amount: number;
  fulfillment_type: "pickup" | "delivery";
  delivery_address: string | null;
  payment_method: "cash" | "qr_transfer";
  payment_status: string;
  print_status: "not_printed" | "printed" | "reprinted";
  print_count: number;
  created_at: string;
  shops: { name: string } | null;
};

// ----------------------------------------------------------------
// Helper: group order_items ตาม category แบบ generic (ไม่ hardcode ชื่อสินค้า)
// ----------------------------------------------------------------

function groupByCategory(
  items: OrderItemRow[],
  categoryByMenuItemId: Map<string, string>
): { category: string; lines: OrderItemRow[] }[] {
  const groups = new Map<string, OrderItemRow[]>();

  for (const item of items) {
    const category =
      (item.menu_item_id && categoryByMenuItemId.get(item.menu_item_id)) || "อื่นๆ";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(item);
  }

  // เรียง "อื่นๆ" ไว้ท้ายสุดเสมอ ส่วนอื่นเรียงตามตัวอักษร
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === "อื่นๆ") return 1;
      if (b === "อื่นๆ") return -1;
      return a.localeCompare(b, "th");
    })
    .map(([category, lines]) => ({ category, lines }));
}

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------

export function PrintReceipt({ subId }: { subId: string }) {
  const [order, setOrder] = useState<SubOrderForPrint | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: orderData, error: orderError } = await supabase
        .from("sub_orders")
        .select(
          "sub_id, shop_id, amount, fulfillment_type, delivery_address, payment_method, payment_status, print_status, print_count, created_at, shops(name)"
        )
        .eq("sub_id", subId)
        .single();

      if (orderError) {
        setError(orderError.message);
        setLoading(false);
        return;
      }

      const { data: itemRows } = await supabase
        .from("order_items")
        .select("id, item_name_snapshot, unit_price_snapshot, qty, line_total, menu_item_id")
        .eq("sub_id", subId);

      const menuItemIds = (itemRows ?? [])
        .map((i) => i.menu_item_id)
        .filter((id): id is string => id !== null);

      let catMap = new Map<string, string>();
      if (menuItemIds.length > 0) {
        const { data: menuRows } = await supabase
          .from("menu_items")
          .select("item_id, category")
          .in("item_id", menuItemIds);

        catMap = new Map(
          (menuRows as MenuItemCategory[] | null ?? []).map((m) => [
            m.item_id,
            m.category ?? "อื่นๆ",
          ])
        );
      }

      setOrder(orderData as unknown as SubOrderForPrint);
      setItems(itemRows ?? []);
      setCategoryMap(catMap);
      setLoading(false);
    })();
  }, [subId]);

  // พิมพ์อัตโนมัติพอข้อมูลพร้อม แล้ว mark print_status
  useEffect(() => {
    if (!order || loading) return;

    const nextStatus = order.print_status === "not_printed" ? "printed" : "reprinted";

    const timer = setTimeout(() => {
      window.print();
      supabase
        .from("sub_orders")
        .update({ print_status: nextStatus })
        .eq("sub_id", subId)
        .then();
    }, 300); // เผื่อเวลา render ก่อนเปิด print dialog

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const grouped = useMemo(() => groupByCategory(items, categoryMap), [items, categoryMap]);

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (error) return <p className="p-4 text-sm text-red-500">{error}</p>;
  if (!order) return <p className="p-4 text-sm text-gray-400">ไม่พบออเดอร์</p>;

  return (
    <div className="receipt mx-auto bg-white p-2 text-black">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 2mm; }
          body { margin: 0; }
        }
        .receipt {
          width: 80mm;
          font-family: "Courier New", monospace;
          font-size: 12px;
          line-height: 1.4;
        }
        .receipt .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .receipt .row {
          display: flex;
          justify-content: space-between;
        }
        .receipt .category-title {
          font-weight: bold;
          margin-top: 6px;
        }
      `}</style>

      <p className="text-center text-base font-bold">{order.shops?.name ?? "ร้าน"}</p>
      <p className="text-center text-xs">
        #{order.sub_id.slice(0, 6)} —{" "}
        {new Date(order.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
      </p>
      <p className="text-center text-xs">
        {order.fulfillment_type === "delivery" ? "🚚 เดลิเวอรี" : "🏠 รับที่ร้าน"}
        {order.print_status !== "not_printed" && (
          <span className="ml-1 font-bold">(พิมพ์ซ้ำครั้งที่ {order.print_count})</span>
        )}
      </p>

      {order.fulfillment_type === "delivery" && order.delivery_address && (
        <p className="text-xs">ที่อยู่: {order.delivery_address}</p>
      )}

      <div className="divider" />

      {grouped.map((group) => (
        <div key={group.category}>
          <p className="category-title">{group.category}</p>
          {group.lines.map((line) => (
            <div key={line.id} className="row">
              <span>
                {line.qty}x {line.item_name_snapshot}
              </span>
              <span>฿{line.line_total}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="divider" />

      <div className="row font-bold">
        <span>รวม</span>
        <span>฿{order.amount}</span>
      </div>
      <p className="text-xs">
        วิธีจ่าย: {order.payment_method === "cash" ? "เงินสด" : "โอน/QR"} (
        {order.payment_status === "paid" ? "จ่ายแล้ว" : "ยังไม่จ่าย"})
      </p>
    </div>
  );
}
