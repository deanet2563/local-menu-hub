import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getCurrentCustomerId, supabase } from "@/lib/supabase";
import { ensurePlatformAdminLineLogin } from "@/lib/aiOfficeAuth";

type AccessState = "loading" | "no-auth" | "not-admin" | "error" | "ok";

export function PlatformAdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const verify = useCallback(async () => {
    setState("loading");
    setErrorMessage(null);

    try {
      const loginState = await ensurePlatformAdminLineLogin();
      if (loginState === "redirecting") return;

      const customerId = await getCurrentCustomerId();

      if (!customerId) {
        setState("no-auth");
        return;
      }

      const { data, error } = await supabase
        .from("platform_admins")
        .select("customer_id")
        .eq("customer_id", customerId)
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message);
        setState("error");
        return;
      }

      setState(data ? "ok" : "not-admin");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถตรวจสอบสิทธิ์ได้");
      setState("no-auth");
    }
  }, []);

  useEffect(() => {
    void verify();
  }, [verify]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          <p className="mt-3 text-sm text-gray-500">กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...</p>
        </div>
      </div>
    );
  }

  if (state === "no-auth") {
    return (
      <AccessMessage
        title="ต้องเข้าสู่ระบบก่อน"
        description="Head Office ใช้สิทธิ์ Platform Admin เดียวกับระบบ Admin ปัจจุบัน"
        actionLabel="ลองอีกครั้ง"
        onAction={() => void verify()}
      />
    );
  }

  if (state === "not-admin") {
    return (
      <AccessMessage
        title="ไม่มีสิทธิ์เข้าถึง"
        description="บัญชีนี้ไม่ได้อยู่ในรายชื่อ Platform Admin"
      />
    );
  }

  if (state === "error") {
    return (
      <AccessMessage
        title="ตรวจสอบสิทธิ์ไม่สำเร็จ"
        description={errorMessage || "เกิดข้อผิดพลาดในการเชื่อมต่อ"}
        actionLabel="ลองอีกครั้ง"
        onAction={() => void verify()}
      />
    );
  }

  return <>{children}</>;
}

function AccessMessage({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg items-center justify-center p-6">
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
