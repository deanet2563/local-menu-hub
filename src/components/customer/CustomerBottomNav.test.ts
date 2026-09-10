import { CUSTOMER_BOTTOM_NAV_DESTINATIONS, shouldShowCustomerBottomNav } from "@/components/customer/CustomerBottomNav";

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
