import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShopProfileManager } from "@/components/shop/ShopProfileManager";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";
import { linkRichMenu } from "@/lib/richmenu";

export const Route = createFileRoute("/sweet/shop")({ component: ShopProfile });

function ShopProfile() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "no-auth" | "no-shop" | "ok">("loading");

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const cid = await getCurrentCustomerId();
        if (!cid) return setState("no-auth");
        const { data } = await supabase.from("shop_staff").select("shop_id").eq("customer_id", cid).limit(1).maybeSingle();
        if (!data) return setState("no-shop");
        setShopId((data as { shop_id: string }).shop_id);
        setState("ok");
        void linkRichMenu("shop");
      } catch { setState("no-auth"); }
    })();
  }, []);

  if (state === "loading") return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (state === "no-auth") return <div className="p-6 text-center">🔒 ต้องเข้าสู่ระบบ LINE ก่อน</div>;
  if (state === "no-shop") return <div className="p-6 text-center"><a className="text-orange-500 underline" href="/sweet/signup">สมัครร้านค้าใหม่</a></div>;
  return <ShopProfileManager shopId={shopId!} />;
}
