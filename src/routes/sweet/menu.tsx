import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MenuCatalogManager } from "@/components/shop/MenuCatalogManager";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";
import { linkRichMenu } from "@/lib/richmenu";

type Search = { welcome?: number };
export const Route = createFileRoute("/sweet/menu")({
  validateSearch: (s: Record<string, unknown>): Search => ({ welcome: s.welcome ? Number(s.welcome) : undefined }),
  component: ShopMenu,
});

function AdminEntry() {
  return (
    <a
      href="/sweet/admin"
      className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700"
    >
      <span>🛡️ Admin Dashboard</span>
      <span aria-hidden>→</span>
    </a>
  );
}

function ShopMenu() {
  const { welcome } = Route.useSearch();
  const [shopId, setShopId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [state, setState] = useState<"loading" | "no-auth" | "no-shop" | "ok">("loading");

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const cid = await getCurrentCustomerId();
        if (!cid) return setState("no-auth");

        const [{ data: adminRow }, { data: shopRow }] = await Promise.all([
          supabase.from("platform_admins").select("customer_id").eq("customer_id", cid).maybeSingle(),
          supabase.from("shop_staff").select("shop_id").eq("customer_id", cid).limit(1).maybeSingle(),
        ]);

        setIsAdmin(!!adminRow);
        if (!shopRow) return setState("no-shop");
        setShopId((shopRow as { shop_id: string }).shop_id);
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
      <div className="max-w-md mx-auto">
        {isAdmin && <AdminEntry />}
        <div className="p-6 text-center">
          <a className="text-orange-500 underline" href="/sweet/signup">สมัครร้านค้าใหม่</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      {isAdmin && <AdminEntry />}
      <MenuCatalogManager shopId={shopId!} showWelcome={!!welcome} />
    </div>
  );
}
