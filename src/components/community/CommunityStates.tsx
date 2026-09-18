import { useState } from "react";

type StateTone = "loading" | "empty" | "error" | "locked" | "not-found";

const STATE_MARKS: Record<StateTone, string> = {
  loading: "...",
  empty: "-",
  error: "!",
  locked: "x",
  "not-found": "?",
};

export function CommunityStatePanel({
  tone,
  title,
  detail,
  onRetry,
  headingLevel = 2,
}: {
  tone: StateTone;
  title: string;
  detail: string;
  onRetry?: () => void;
  headingLevel?: 2 | 3;
}) {
  const isLoading = tone === "loading";
  const isUrgent = tone === "error" || tone === "locked";
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section
      aria-live={isUrgent ? "assertive" : "polite"}
      aria-busy={isLoading || undefined}
      role={isUrgent ? "alert" : "status"}
      className="min-w-0 rounded-lg border border-dashed border-ink-faint bg-white p-5 text-center"
    >
      <span aria-hidden="true" className="mx-auto flex size-10 items-center justify-center rounded-full bg-moss-soft text-lg font-bold text-moss-deep">
        {STATE_MARKS[tone]}
      </span>
      <Heading className="mt-3 text-pretty text-lg font-bold text-ink">{title}</Heading>
      <p className="mt-2 break-words text-pretty text-sm leading-6 text-ink-soft">{detail}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-11 rounded-lg border border-moss bg-white px-4 py-2 text-sm font-semibold text-moss-deep focus:outline-none focus:ring-2 focus:ring-clay"
        >
          ลองใหม่ในหน้าทดลอง
        </button>
      ) : null}
    </section>
  );
}

export function CommunityPrototypeErrorState({ title, detail, headingLevel = 2 }: { title: string; detail: string; headingLevel?: 2 | 3 }) {
  const [retried, setRetried] = useState(false);
  if (retried) {
    return (
      <CommunityStatePanel
        tone="empty"
        title="รีเซ็ตสถานะตัวอย่างแล้ว"
        detail="ไม่มีการติดต่อเซิร์ฟเวอร์หรือบันทึกข้อมูล กรุณากลับมาดูอีกครั้งเมื่อข้อมูลพร้อม"
        headingLevel={headingLevel}
      />
    );
  }
  return <CommunityStatePanel tone="error" title={title} detail={detail} headingLevel={headingLevel} onRetry={() => setRetried(true)} />;
}

export function DisabledPrototypeAction({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="min-h-11 w-full rounded-lg border border-[#e7e4dc] bg-cream px-4 py-2 text-sm font-semibold text-ink-soft disabled:cursor-not-allowed"
    >
      {label} - ยังไม่เปิดใช้งานในหน้าทดลอง
    </button>
  );
}
