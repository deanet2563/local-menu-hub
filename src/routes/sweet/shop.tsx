import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShopProfileManager } from "@/components/shop/ShopProfileManager";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";
import { linkRichMenu } from "@/lib/richmenu";

export const Route = createFileRoute("/sweet/shop")({ component: ShopProfile });

type OwnedShop = { shop_id: string; name: string };

function ShopProfile() {
  const [shops, setShops] = useState<OwnedShop[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "no-auth" | "no-shop" | "ok">("loading");

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const cid = await getCurrentCustomerId();
        if (!cid) return setState("no-auth");

        const { data: staff, error: staffError } = await supabase
          .from("shop_staff")
          .select("shop_id")
          .eq("customer_id", cid)
          .eq("role", "owner");
        if (staffError) throw staffError;

        const ids = (staff ?? []).map((row) => (row as { shop_id: string }).shop_id);
        if (!ids.length) return setState("no-shop");

        const { data: shopRows, error: shopError } = await supabase
          .from("shops")
          .select("shop_id,name")
          .in("shop_id", ids)
          .order("name");
        if (shopError) throw shopError;

        const owned = (shopRows ?? []) as OwnedShop[];
        if (!owned.length) return setState("no-shop");

        setShops(owned);
        setShopId(owned[0].shop_id);
        setState("ok");
        void linkRichMenu("shop");
      } catch {
        setState("no-auth");
      }
    })();
  }, []);

  if (state === "loading") return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (state === "no-auth") return <div className="p-6 text-center">🔒 ต้องเข้าสู่ระบบ LINE ก่อน</div>;
  if (state === "no-shop") {
    return (
      <div className="p-6 text-center">
        <a className="text-orange-500 underline" href="/sweet/signup">สมัครร้านค้าใหม่</a>
      </div>
    );
  }

  return (
    <>
      {shops.length > 1 && (
        <div className="mx-auto max-w-md px-4 pt-4">
          <label className="block rounded-2xl border bg-white p-3">
            <span className="text-xs font-medium text-gray-500">เลือกร้านที่ต้องการจัดการ</span>
            <select
              value={shopId ?? ""}
              onChange={(event) => setShopId(event.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"
            >
              {shops.map((shop) => (
                <option key={shop.shop_id} value={shop.shop_id}>{shop.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {shopId && <ShopProfileManager key={shopId} shopId={shopId} />}
    </>
  );
}
