import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OrderManagement } from "@/components/shop/OrderManagement";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";

export const Route = createFileRoute("/sweet/orders")({
  component: ShopOrders,
});

function ShopOrders() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "no-auth" | "no-shop" | "ok">("loading");

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const cid = await getCurrentCustomerId();
        if (!cid) { setState("no-auth"); return; }
        // resolve the caller's shop (owner/staff)
        const { data } = await supabase
          .from("shop_staff")
          .select("shop_id")
          .eq("customer_id", cid)
          .limit(1)
          .maybeSingle();
        if (!data) { setState("no-shop"); return; }
        setShopId((data as { shop_id: string }).shop_id);
        setState("ok");
      } catch {
        setState("no-auth");
      }
    })();
  }, []);

  if (state === "loading") return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (state === "no-auth")
    return <div className="p-6 text-center max-w-md mx-auto"><p className="text-lg font-semibold">🔒 ต้องเข้าสู่ระบบ LINE ก่อน</p></div>;
  if (state === "no-shop")
    return <div className="p-6 text-center max-w-md mx-auto"><p className="text-lg font-semibold">⛔ บัญชีนี้ไม่ได้เป็นเจ้าของร้าน</p></div>;

  return <OrderManagement shopId={shopId!} />;
}
