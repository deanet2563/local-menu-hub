import { Link } from "@tanstack/react-router";
import { cartCount, cartTotal, type CartState } from "@/lib/cart";

// ============================================================
// MyTree — floating cart bar shown above BottomNav on catalog-browsing
// pages (Home, Food Hub). Extracted from HubHome.tsx so both pages
// render the exact same bar instead of duplicating it.
// ============================================================

export function FloatingCartBar({ cart }: { cart: CartState }) {
  if (cartCount(cart) <= 0) return null;
  return (
    <Link
      to="/cart"
      className="fixed left-4 right-4 bottom-20 rounded-xl bg-[#28432f] text-white px-4 py-3 flex justify-between text-sm font-medium"
    >
      <span>ตะกร้า ({cartCount(cart)})</span>
      <span>฿{cartTotal(cart)}</span>
    </Link>
  );
}
