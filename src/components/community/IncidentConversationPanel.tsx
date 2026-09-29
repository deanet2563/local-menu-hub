import { useEffect, useMemo, useState } from "react";
import {
  acceptSharedIncident,
  getMyEmergencyProfile,
  getReporterIncidentConversation,
  getSharedIncidentConversation,
  sendReporterIncidentMessage,
  sendResponderIncidentMessage,
  type IncidentConversation,
} from "@/lib/communityEmergency";

type Mode =
  | { kind: "reporter"; incidentId: string }
  | { kind: "responder"; token: string };

const ACTION_LABEL: Record<string, string> = {
  accepted: "รับเรื่องแล้ว",
  "request-info": "ขอข้อมูลเพิ่ม",
  "help-en-route": "กำลังเดินทาง",
  arrived: "ถึงจุดเกิดเหตุ",
  assisted: "ช่วยเหลือแล้ว",
  message: "ข้อความ",
};

export function IncidentConversationPanel({ mode }: { mode: Mode }) {
  const [conversation, setConversation] = useState<IncidentConversation | null>(null);
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<"message" | "request-info" | "help-en-route" | "arrived" | "assisted">("message");
  const [responderName, setResponderName] = useState("");
  const [responderPhone, setResponderPhone] = useState("");
  const [responderOrganization, setResponderOrganization] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const next = mode.kind === "reporter"
        ? await getReporterIncidentConversation(mode.incidentId)
        : await getSharedIncidentConversation(mode.token);
      setConversation(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อความไม่สำเร็จ");
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 7000);
    return () => window.clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.kind, mode.kind === "reporter" ? mode.incidentId : mode.token]);

  useEffect(() => {
    if (mode.kind !== "responder") return;
    void getMyEmergencyProfile()
      .then((profile) => {
        setResponderName(profile.name ?? "");
        setResponderPhone(profile.phone ?? "");
      })
      .catch(() => undefined);
  }, [mode.kind]);

  const accepted = mode.kind === "responder" && !!conversation?.viewer_responder;
  const responders = conversation?.responders ?? [];
  const messages = conversation?.messages ?? [];

  const reporterStatus = useMemo(() => {
    if (!conversation?.status) return null;
    const map: Record<string, string> = {
      reported: "รอผู้รับเรื่อง",
      verifying: "กำลังตรวจสอบ",
      coordinating: "มีผู้รับเรื่อง / กำลังประสานงาน",
      "help-en-route": "ผู้ช่วยกำลังเดินทาง",
      assisted: "ช่วยเหลือแล้ว",
      resolved: "เหตุได้รับการแก้ไขแล้ว",
      closed: "ปิดเหตุแล้ว",
    };
    return map[conversation.status] ?? conversation.status;
  }, [conversation?.status]);

  async function accept() {
    if (mode.kind !== "responder") return;
    if (!responderName.trim() || !responderPhone.trim()) {
      setError("กรุณากรอกชื่อและเบอร์โทรกลับ");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await acceptSharedIncident(mode.token, responderName, responderPhone, responderOrganization);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "รับเรื่องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (mode.kind === "reporter") {
        await sendReporterIncidentMessage(mode.incidentId, message);
      } else {
        await sendResponderIncidentMessage(mode.token, message, action);
      }
      setMessage("");
      setAction("message");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#1f6a45]">INCIDENT CONVERSATION</p>
          <h2 className="mt-1 text-lg font-black">ข้อความประสานความช่วยเหลือ</h2>
          {reporterStatus && <p className="mt-1 text-sm font-semibold text-gray-600">{reporterStatus}</p>}
        </div>
        <button type="button" onClick={() => void load()} className="rounded-xl border px-3 py-2 text-xs font-bold">รีเฟรช</button>
      </div>

      {mode.kind === "reporter" && responders.length > 0 && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-black text-emerald-800">มีผู้รับเรื่องแล้ว</p>
          <div className="mt-2 space-y-2">
            {responders.map((responder) => (
              <div key={responder.responder_id} className="rounded-xl bg-white p-3 text-sm">
                <p className="font-black">{responder.name}</p>
                {responder.organization && <p className="text-xs text-gray-500">{responder.organization}</p>}
                <a href={`tel:${responder.phone}`} className="mt-2 inline-block rounded-full bg-[#1f6a45] px-3 py-1.5 text-xs font-black text-white">
                  โทรกลับ {responder.phone}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode.kind === "responder" && !accepted && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3">
          <p className="font-black text-red-800">รับเรื่องนี้</p>
          <p className="mt-1 text-xs text-red-700">ชื่อและเบอร์โทรกลับเป็นข้อมูลบังคับ เพื่อให้ผู้แจ้งติดต่อกลับได้</p>
          <div className="mt-3 grid gap-2">
            <input value={responderName} onChange={(e) => setResponderName(e.target.value)} placeholder="ชื่อผู้รับเรื่อง" className="rounded-xl border bg-white p-3 text-sm" />
            <input value={responderPhone} onChange={(e) => setResponderPhone(e.target.value)} inputMode="tel" placeholder="เบอร์โทรกลับ" className="rounded-xl border bg-white p-3 text-sm" />
            <input value={responderOrganization} onChange={(e) => setResponderOrganization(e.target.value)} placeholder="หน่วยงาน / กลุ่ม / มูลนิธิ (ถ้ามี)" className="rounded-xl border bg-white p-3 text-sm" />
            <button type="button" disabled={busy || !responderName.trim() || !responderPhone.trim()} onClick={() => void accept()} className="rounded-xl bg-[#b42318] px-4 py-3 font-black text-white disabled:opacity-40">
              {busy ? "กำลังรับเรื่อง…" : "ยืนยันรับเรื่อง"}
            </button>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="mt-4 space-y-2">
          {messages.map((item) => {
            const mine = mode.kind === "reporter" ? item.sender_kind === "reporter" : item.sender_kind === "responder";
            return (
              <div key={item.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-[#1f6a45] text-white" : "bg-gray-100 text-gray-800"}`}>
                  <div className="flex items-center gap-2 text-[11px] font-bold opacity-80">
                    <span>{item.sender_name}</span>
                    <span>·</span>
                    <span>{ACTION_LABEL[item.action] ?? item.action}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap leading-5">{item.body}</p>
                  <p className="mt-1 text-[10px] opacity-70">{new Date(item.created_at).toLocaleString("th-TH")}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(mode.kind === "reporter" || accepted) && (
        <div className="mt-4 border-t pt-4">
          {mode.kind === "responder" && (
            <div className="mb-2 flex flex-wrap gap-2">
              {([
                ["message", "ข้อความ"],
                ["request-info", "ขอข้อมูลเพิ่ม"],
                ["help-en-route", "กำลังเดินทาง"],
                ["arrived", "ถึงจุดเกิดเหตุ"],
                ["assisted", "ช่วยเหลือแล้ว"],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setAction(key)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${action === key ? "border-[#1f6a45] bg-[#eef7e9] text-[#1f6a45]" : "border-gray-200"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder={mode.kind === "reporter" ? "ตอบกลับผู้ช่วยเหลือ…" : "ข้อความถึงผู้แจ้ง…"} className="w-full rounded-xl border p-3 text-sm" />
          <button type="button" disabled={busy || !message.trim()} onClick={() => void send()} className="mt-2 w-full rounded-xl bg-gray-900 px-4 py-3 font-black text-white disabled:opacity-40">
            {busy ? "กำลังส่ง…" : "ส่งข้อความ"}
          </button>
        </div>
      )}

      {error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <p className="mt-3 text-[11px] leading-5 text-gray-500">เมื่อมีการรับเรื่องหรือข้อความใหม่ MyTree จะพยายามส่ง LINE แจ้งเตือนให้คู่สนทนา หาก LINE push ใช้งานไม่ได้ ข้อความยังคงถูกบันทึกใน Incident Thread นี้</p>
    </section>
  );
}
