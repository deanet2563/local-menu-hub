import { createFileRoute, Link } from "@tanstack/react-router";
import { cart, useCart, cartTotal } from "@/lib/cart";

export const Route = createFileRoute("/cart")({
  component: CartView,
});

function CartView() {
  const c = useCart();
  if (c.items.length === 0)
    return (
      <div className="p-6 text-center text-sm text-gray-400">
        ตะกร้าว่าง
        <Link to="/" className="text-orange-500 underline block mt-2">เลือกอาหาร</Link>
      </div>
    );
  return (
    <div className="p-4 pb-24 space-y-3">
      <h1 className="text-lg font-bold">ตะกร้า</h1>
      {c.items.map((i) => (
        <div key={i.itemId} className="flex gap-3 items-center">
          <img src={i.imageUrl ?? ""} alt={i.name} className="w-14 h-14 rounded-lg object-cover bg-gray-100" />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{i.name}</p>
            <p className="text-xs text-orange-600">฿{i.price} × {i.qty}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => cart.setQty(i.itemId, i.qty - 1)} className="w-7 h-7 rounded-full bg-gray-100">−</button>
            <span className="text-sm w-4 text-center">{i.qty}</span>
            <button onClick={() => cart.setQty(i.itemId, i.qty + 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white">+</button>
          </div>
        </div>
      ))}
      <div className="flex justify-between border-t border-gray-100 pt-3 text-sm font-medium">
        <span>รวม</span>
        <span>฿{cartTotal(c)}</span>
      </div>
      <button disabled className="w-full rounded-lg bg-gray-200 text-gray-500 py-3 text-sm font-medium">
        ยืนยันสั่ง (ขั้นถัดไป — checkout + ส่งเข้า order)
      </button>
    </div>
  );
}
