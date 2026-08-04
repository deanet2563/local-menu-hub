import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RiderVerificationPanel } from "@/components/admin/RiderVerificationPanel";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";

export const Route = createFileRoute("/sweet/riders")({
  component: AdminRiders,
});

function AdminRiders() {
  const [state, setState] = useState<"loading" | "no-auth" | "not-admin" | "ok">("loading");

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const cid = await getCurrentCustomerId();
        if (!cid) {
          setState("no-auth");
          return;
        }
        // platform_admins RLS lets a customer read their OWN admin row if they are one
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
    return (
      <div className="p-6 text-center max-w-md mx-auto">
        <p className="text-lg font-semibold">🔒 ต้องเข้าสู่ระบบ LINE ก่อน</p>
      </div>
    );
  if (state === "not-admin")
    return (
      <div className="p-6 text-center max-w-md mx-auto">
        <p className="text-lg font-semibold">⛔ ไม่มีสิทธิ์เข้าถึง</p>
        <p className="text-sm text-gray-500">หน้านี้สำหรับแอดมินเท่านั้น</p>
      </div>
    );

  return <RiderVerificationPanel />;
}
