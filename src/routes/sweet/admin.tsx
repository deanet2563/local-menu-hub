import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminConsole } from "@/components/admin/AdminConsole";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";

export const Route = createFileRoute("/sweet/admin")({
  component: AdminRoute,
});

function AdminRoute() {
  const [state, setState] = useState<"loading" | "no-auth" | "not-admin" | "ok">("loading");

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const cid = await getCurrentCustomerId();
        if (!cid) { setState("no-auth"); return; }
        const { data } = await supabase
          .from("platform_admins")
          .select("customer_id")
          .eq("customer_id", cid)
          .maybeSingle();
        setState(data ? "ok" : "not-admin");
      } catch {
        setState("no-auth");
      }
    })();
  }, []);

  if (state === "loading") return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (state === "no-auth")
    return <div className="p-6 text-center max-w-md mx-auto"><p className="text-lg font-semibold">🔒 ต้องเข้าสู่ระบบ LINE ก่อน</p></div>;
  if (state === "not-admin")
    return (
      <div className="p-6 text-center max-w-md mx-auto">
        <p className="text-lg font-semibold">⛔ ไม่มีสิทธิ์เข้าถึง</p>
        <p className="text-sm text-gray-500">หน้านี้สำหรับแอดมินเท่านั้น</p>
      </div>
    );

  return <AdminConsole />;
}
