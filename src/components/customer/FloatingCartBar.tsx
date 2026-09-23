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
      className="fixed left-4 right-4 z-[55] mx-auto flex max-w-lg justify-between rounded-2xl bg-[#173D27] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_28px_rgba(9,47,25,0.24)]"
      style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <span>ตะกร้า ({cartCount(cart)})</span>
      <span>฿{cartTotal(cart)}</span>
    </Link>
  );
}
