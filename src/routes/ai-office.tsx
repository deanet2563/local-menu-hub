import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/ai-office")({ component: AiOfficePublic });

type GhIssue = { number: number; title: string; state: "open" | "closed"; updated_at: string; html_url: string; pull_request?: unknown };
type GhPull = { number: number; title: string; state: "open" | "closed"; merged_at: string | null; updated_at: string; html_url: string; head: { ref: string } };
type GhRun = { id: number; name: string; status: string; conclusion: string | null; html_url: string; updated_at: string; head_branch: string | null };
type Telemetry = { issues: GhIssue[]; pulls: GhPull[]; runs: GhRun[]; fetchedAt: string };
type Lane = { id: string; icon: string; name: string; role: string; issue: number; branch?: string; pr?: number };

const API = "https://api.github.com/repos/deanet2563/local-menu-hub";
const LANES: Lane[] = [
  { id: "AI-0", icon: "🧠", name: "Architect / PM", role: "Factory coordination", issue: 84 },
  { id: "AI-2", icon: "🏪", name: "Shop AI", role: "Shop Native", issue: 77, pr: 76, branch: "codex/shop-native-modern-phase1" },
  { id: "AI-4", icon: "🗄️", name: "Backend AI", role: "Worker / DB contracts", issue: 78, branch: "codex/customer-delivery-pricing" },
  { id: "AI-3", icon: "🛵", name: "Rider AI", role: "Rider Native pilot", issue: 79, branch: "codex/rider-final-pilot" },
  { id: "AI-1", icon: "👤", name: "Customer AI", role: "Cart / Home", issue: 80, branch: "codex/customer-next" },
  { id: "AI-5", icon: "🏘️", name: "Community AI", role: "Community Thailand", issue: 81, branch: "codex/community-foundation" },
  { id: "AI-6", icon: "🤖", name: "AI Ops", role: "24/7 operations", issue: 82, branch: "codex/aiops-foundation" },
  { id: "AI-7", icon: "🛡️", name: "QA / Security", role: "Release gates", issue: 83, branch: "codex/qa-release-gates" },
  { id: "AI-8", icon: "🖥️", name: "Control Center", role: "AI Office dashboard", issue: 86, branch: "codex/ai-control-center-v1" },
];

async function jsonFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return (await res.json()) as T;
}

async function loadTelemetry(): Promise<Telemetry> {
  const [issues, pulls, runs] = await Promise.all([
    jsonFetch<GhIssue[]>(`${API}/issues?state=all&per_page=100&sort=updated&direction=desc`),
    jsonFetch<GhPull[]>(`${API}/pulls?state=all&per_page=60&sort=updated&direction=desc`),
    jsonFetch<{ workflow_runs: GhRun[] }>(`${API}/actions/runs?per_page=50`),
  ]);
  return { issues, pulls, runs: runs.workflow_runs, fetchedAt: new Date().toISOString() };
}

function evidence(lane: Lane, data: Telemetry) {
  const issue = data.issues.find((x) => x.number === lane.issue && !x.pull_request);
  const pr = lane.pr ? data.pulls.find((x) => x.number === lane.pr) ?? null : lane.branch ? data.pulls.find((x) => x.head.ref === lane.branch) ?? null : null;
  const run = lane.branch ? data.runs.find((x) => x.head_branch === lane.branch) : undefined;
  const latest = [issue?.updated_at, pr?.updated_at, run?.updated_at].filter(Boolean).sort().reverse()[0] ?? data.fetchedAt;
  const ageHours = Math.max(0, (Date.now() - new Date(latest).getTime()) / 3_600_000);
  let status = "PLANNED";
  let progress = 15;
  if (issue?.state === "closed") { status = "DONE"; progress = 100; }
  else if (pr?.merged_at) { status = "MERGED"; progress = 90; }
  else if (run?.status === "in_progress" || run?.status === "queued") { status = "CI"; progress = 72; }
  else if (run?.conclusion === "failure") { status = "BLOCKED"; progress = 60; }
  else if (pr?.state === "open") { status = "REVIEW"; progress = 65; }
  else if (ageHours < 24) { status = "WORKING"; progress = 35; }
  return { issue, pr, run, latest, ageHours, status, progress };
}

const tone: Record<string, string> = {
  WORKING: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  REVIEW: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  CI: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  BLOCKED: "bg-red-500/15 text-red-300 border-red-500/30",
  MERGED: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  DONE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PLANNED: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

function AiOfficePublic() {
  const [data, setData] = useState<Telemetry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { setData(await loadTelemetry()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 300_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const rows = useMemo(() => data ? LANES.map((lane) => ({ lane, ev: evidence(lane, data) })) : [], [data]);
  const overall = rows.length ? Math.round(rows.reduce((sum, x) => sum + x.ev.progress, 0) / rows.length) : 0;
  const attention = rows.filter((x) => x.ev.status === "BLOCKED" || x.ev.ageHours > 48);

  return <main className="min-h-screen bg-slate-950 text-slate-100">
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-xs font-semibold uppercase tracking-[.24em] text-emerald-400">MyTree Community Thailand</div><h1 className="mt-1 text-3xl font-black">AI Office <span className="text-slate-500">/ Control Center</span></h1><p className="mt-2 text-sm text-slate-400">External read-only dashboard • GitHub telemetry • refresh ทุก 5 นาที</p></div>
        <button onClick={() => void refresh()} disabled={refreshing} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">{refreshing ? "กำลังอัปเดต…" : "↻ Refresh"}</button>
      </header>

      <div className="mt-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3 text-xs text-emerald-200">V1 นี้เปิดจาก Chrome / Safari / Desktop ได้โดยตรงและไม่ใช้ LINE. เป็น read-only เท่านั้น ไม่มีปุ่ม deploy, approve หรือแก้ข้อมูล production.</div>
      {error && <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Factory readiness" value={`${overall}%`} sub="evidence-weighted" />
        <Metric label="Active lanes" value={`${rows.filter((x) => !["DONE","MERGED","PLANNED"].includes(x.ev.status)).length}`} sub={`จาก ${LANES.length} AI lanes`} />
        <Metric label="Need attention" value={`${attention.length}`} sub="blocked / stale >48h" danger={attention.length > 0} />
        <Metric label="Last sync" value={data ? new Date(data.fetchedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "—"} sub="GitHub telemetry" />
      </section>

      <section className="mt-6"><h2 className="mb-3 text-lg font-bold">🏢 Virtual AI Office</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ lane, ev }) => <div key={lane.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold text-slate-500">{lane.id}</div><div className="mt-1 text-lg font-bold">{lane.icon} {lane.name}</div><div className="text-sm text-slate-400">{lane.role}</div></div><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${tone[ev.status]}`}>{ev.status}</span></div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${ev.progress}%` }} /></div>
          <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{ev.progress}%</span><span>{Math.floor(ev.ageHours)}h since evidence</span></div>
          <div className="mt-3 flex gap-3 text-xs">{ev.issue && <a className="text-emerald-300 hover:underline" href={ev.issue.html_url} target="_blank" rel="noreferrer">Issue #{ev.issue.number}</a>}{ev.pr && <a className="text-blue-300 hover:underline" href={ev.pr.html_url} target="_blank" rel="noreferrer">PR #{ev.pr.number}</a>}{ev.run && <a className="text-amber-300 hover:underline" href={ev.run.html_url} target="_blank" rel="noreferrer">CI</a>}</div>
        </div>)}
        {!data && <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">กำลังโหลดสถานะทีม AI…</div>}
      </div></section>

      <section className="mt-7 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><h2 className="font-bold">📡 Recent activity</h2><div className="mt-3 space-y-2">{data?.issues.filter((x) => x.number >= 77 && x.number <= 86 && !x.pull_request).slice(0,8).map((x) => <a key={x.number} href={x.html_url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-800 bg-slate-950/60 p-3 hover:border-slate-700"><div className="text-sm font-semibold">#{x.number} {x.title}</div><div className="mt-1 text-xs text-slate-500">{new Date(x.updated_at).toLocaleString("th-TH")}</div></a>)}</div></div><div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><h2 className="font-bold">🚨 Owner attention</h2><div className="mt-3 space-y-2">{attention.length === 0 ? <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm text-emerald-300">ไม่มี blocker/stale lane ที่ตรวจพบ</div> : attention.map(({lane,ev}) => <div key={lane.id} className="rounded-xl border border-red-900/40 bg-red-950/20 p-3"><div className="font-semibold text-red-200">{lane.icon} {lane.name}</div><div className="mt-1 text-xs text-red-300/70">{ev.status === "BLOCKED" ? "CI/งานมี blocker" : `ไม่มี update ประมาณ ${Math.floor(ev.ageHours)} ชม.`}</div></div>)}</div></div></section>
    </div>
  </main>;
}

function Metric({ label, value, sub, danger = false }: { label: string; value: string; sub: string; danger?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${danger ? "border-red-900/50 bg-red-950/20" : "border-slate-800 bg-slate-900/70"}`}><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className={`mt-2 text-3xl font-black ${danger ? "text-red-300" : "text-white"}`}>{value}</div><div className="mt-1 text-xs text-slate-500">{sub}</div></div>;
}
