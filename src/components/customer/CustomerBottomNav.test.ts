import { CUSTOMER_BOTTOM_NAV_DESTINATIONS, shouldShowCustomerBottomNav } from "@/components/customer/CustomerBottomNav";
import { readFileSync } from "node:fs";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

assertEqual(CUSTOMER_BOTTOM_NAV_DESTINATIONS.join("/"), "หน้าแรก/อาหาร/ชุมชน/แผนที่/บัญชี", "bottom navigation destinations are frozen");
assertEqual(shouldShowCustomerBottomNav("/"), true, "home shows customer nav");
assertEqual(shouldShowCustomerBottomNav("/food"), true, "food shows customer nav");
assertEqual(shouldShowCustomerBottomNav("/community"), true, "community shows customer nav");
assertEqual(shouldShowCustomerBottomNav("/map"), true, "map shows customer nav");
assertEqual(shouldShowCustomerBottomNav("/favorites"), true, "favorites shell shows customer nav");
assertEqual(shouldShowCustomerBottomNav("/notifications"), true, "notifications shell shows customer nav");
assertEqual(shouldShowCustomerBottomNav("/account"), true, "account shows customer nav");
assertEqual(shouldShowCustomerBottomNav("/cart"), true, "cart keeps customer nav outside tab set");
assertEqual(shouldShowCustomerBottomNav("/orders"), true, "orders remain reachable outside tab set");
assertEqual(shouldShowCustomerBottomNav("/sweet/orders"), false, "shop admin routes do not show customer nav");

const css = readFileSync("src/index.css", "utf8");
assertEqual(css.includes("--customer-bottom-nav-clearance"), true, "shared bottom nav clearance token exists");

const productConfigurator = readFileSync("src/components/customer/ProductConfigurator.tsx", "utf8");
assertEqual(productConfigurator.includes("customer-bottom-safe-padding fixed inset-0"), true, "product sheet uses shared nav clearance");
assertEqual(productConfigurator.includes("z-[70]"), true, "product sheet renders above fixed bottom nav");

const cartRoute = readFileSync("src/routes/cart.tsx", "utf8");
assertEqual(cartRoute.includes("customer-floating-above-nav fixed left-4 right-4"), true, "checkout CTA uses shared nav clearance");
assertEqual(cartRoute.includes("pb-[calc(var(--customer-bottom-nav-clearance)+88px)]"), true, "checkout content scrolls above CTA and nav");
