type Props = {
  state: "required" | "recovering" | "failed";
  message?: string | null;
  onLogin: () => void;
  onRetry?: () => void;
};

export function LineSessionRecoveryPanel({ state, message, onLogin, onRetry }: Props) {
  const busy = state === "recovering";
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm shadow-sm">
      <p className="font-semibold text-amber-950">ต้องเข้าสู่ระบบ LINE อีกครั้ง</p>
      <p className="mt-1 leading-5 text-amber-900">
        LINE session หมดอายุหรือไม่พร้อมใช้งาน ตะกร้าและข้อมูลเช็คเอาท์ที่บันทึกไว้จะยังอยู่
      </p>
      {message && <p className="mt-2 rounded-md bg-white/80 px-2 py-1 text-xs text-amber-900">{message}</p>}
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          onClick={onLogin}
          disabled={busy}
          className="rounded-lg bg-green-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "กำลังเปิด LINE Login..." : "เข้าสู่ระบบ LINE ใหม่"}
        </button>
        {state === "failed" && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900"
          >
            ลองตรวจสอบ session อีกครั้ง
          </button>
        )}
      </div>
    </section>
  );
}
