import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RiderDashboard } from "@/components/rider/RiderDashboard";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";
import { linkRichMenu } from "@/lib/richmenu";

export const Route = createFileRoute("/rider/")({
  component: RiderHome,
});

function RiderHome() {
  const [riderId, setRiderId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "no-auth" | "not-a-rider" | "ready">("loading");

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const cid = await getCurrentCustomerId();
        if (!cid) {
          setState("no-auth");
          return;
        }
        // find this customer's rider row
        const { data } = await supabase
          .from("riders")
          .select("id")
          .eq("customer_id", cid)
          .maybeSingle();

        if (!data) {
          setState("not-a-rider");
          return;
        }
        setRiderId(data.id);
        setState("ready");
        void linkRichMenu("rider"); // keep menu synced no matter which menu they arrived from
      } catch {
        setState("no-auth");
      }
    })();
  }, []);

  if (state === "loading") return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;

  if (state === "no-auth")
    return (
      <div className="p-6 text-center space-y-2 max-w-md mx-auto">
        <p className="text-lg font-semibold">🔒 ต้องเข้าสู่ระบบ LINE ก่อน</p>
        <p className="text-xs text-gray-400 break-all">
          เปิดผ่าน: https://liff.line.me/2010936243-3kPykppE/rider
        </p>
      </div>
    );

  if (state === "not-a-rider")
    return (
      <div className="p-6 text-center space-y-2 max-w-md mx-auto">
        <p className="text-lg font-semibold">ยังไม่ได้สมัครเป็นวิน</p>
        <a href="/rider/signup" className="text-sm text-orange-500 underline">
          ไปหน้าสมัครเป็นวิน
        </a>
      </div>
    );

  return <RiderDashboard riderId={riderId!} />;
}
