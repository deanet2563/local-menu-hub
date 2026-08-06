import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MenuManager } from "@/components/shop/MenuManager";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";
import { linkRichMenu } from "@/lib/richmenu";

type Search = { welcome?: number };

export const Route = createFileRoute("/sweet/menu")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    welcome: s.welcome ? Number(s.welcome) : undefined,
  }),
  component: ShopMenu,
});

function ShopMenu() {
  const { welcome } = Route.useSearch();
  const [shopId, setShopId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "no-auth" | "no-shop" | "ok">("loading");

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const cid = await getCurrentCustomerId();
        if (!cid) { setState("no-auth"); return; }
        const { data } = await supabase
          .from("shop_staff")
          .select("shop_id")
          .eq("customer_id", cid)
          .limit(1)
          .maybeSingle();
        if (!data) { setState("no-shop"); return; }
        setShopId((data as { shop_id: string }).shop_id);
        setState("ok");
        void linkRichMenu("shop"); // keep menu synced no matter which menu they arrived from
      } catch {
        setState("no-auth");
      }
    })();
  }, []);

  if (state === "loading") return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (state === "no-auth")
    return <div className="p-6 text-center max-w-md mx-auto"><p className="text-lg font-semibold">🔒 ต้องเข้าสู่ระบบ LINE ก่อน</p></div>;
  if (state === "no-shop")
    return (
      <div className="p-6 text-center max-w-md mx-auto space-y-2">
        <p className="text-lg font-semibold">ยังไม่มีร้านค้า</p>
        <a href="/sweet/signup" className="text-orange-500 underline text-sm">สมัครร้านค้าใหม่</a>
      </div>
    );

  return <MenuManager shopId={shopId!} showWelcome={!!welcome} />;
}
