import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentCustomerId, supabase } from "@/lib/supabase";
import { ensureAiOfficeLineLogin } from "@/lib/aiOfficeAuth";

export const Route = createFileRoute("/sweet/ai-office")({ component: AiOfficeRoute });

type AuthState = "loading" | "no-auth" | "not-admin" | "ok";
type GhIssue = { number: number; title: string; state: "open" | "closed"; updated_at: string; html_url: string; pull_request?: unknown };
type GhPull = { number: number; title: string; state: "open" | "closed"; merged_at: string | null; updated_at: string; html_url: string; head: { ref: string } };
type GhRun = { id: number; name: string; status: string; conclusion: string | null; html_url: string; updated_at: string; head_branch: string | null };

type Telemetry = { issues: GhIssue[]; pulls: GhPull[]; workerPull: GhPull | null; runs: GhRun[]; fetchedAt: string };

type Lane = {
  id: string;
  icon: string;
  name: string;
  role: string;
  issue: number;
  branch?: string;
  pr?: number;
  repo?: "app" | "worker";
};

const LANES: Lane[] = [
  { id: "AI-0", icon: "🧠", name: "Architect / PM", role: "Factory coordination", issue: 84 },
  { id: "AI-2", icon: "🏪", name: "Shop AI", role: "Shop Native", issue: 77, pr: 76, branch: "codex/shop-native-modern-phase1" },
  { id: "AI-4", icon: "🗄️", name: "Backend AI", role: "Worker / DB contracts", issue: 78, pr: 53, branch: "codex/customer-delivery-pricing", repo: "worker" },
  { id: "AI-3", icon: "🛵", name: "Rider AI", role: "Rider Native pilot", issue: 79, branch: "codex/rider-final-pilot" },
  { id: "AI-1", icon: "👤", name: "Customer AI", role: "Cart / Home", issue: 80, branch: "codex/customer-next" },
  { id: "AI-5", icon: "🏘️", name: "Community AI", role: "Community Thailand", issue: 81, branch: "codex/community-foundation" },
  { id: "AI-6", icon: "🤖", name: "AI Ops", role: "24/7 operations", issue: 82, branch: "codex/aiops-foundation" },
  { id: "AI-7", icon: "🛡️", name: "QA / Security", role: "Release gates", issue: 83, branch: "codex/qa-release-gates" },
  { id: "AI-8", icon: "🖥️", name: "Control Center", role: "AI Office dashboard", issue: 86, branch: "codex/ai-control-center-v1" },
];

const APP_API = "https://api.github.com/repos/deanet2563/local-menu-hub";
const WORKER_API = "https://api.github.com/repos/deanet2563/mytree-worker";

async function jsonFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return (await res.json()) as T;
}

async function loadTelemetry(): Promise<Telemetry> {
  const [issues, pulls, runsResponse, workerPull] = await Promise.all([
    jsonFetch<GhIssue[]>(`${APP_API}/issues?state=all&per_page=100&sort=updated&direction=desc`),
    jsonFetch<GhPull[]>(`${APP_API}/pulls?state=all&per_page=50&sort=updated&direction=desc`),
    jsonFetch<{ workflow_runs: GhRun[] }>(`${APP_API}/actions/runs?per_page=40`),
    jsonFetch<GhPull>(`${WORKER_API}/pulls/53`).catch(() => null),
  ]);
  return { issues, pulls, workerPull, runs: runsResponse.workflow_runs, fetchedAt: new Date().toISOString() };
}

function laneEvidence(lane: Lane, data: Telemetry) {
  const issue = data.issues.find((x) => x.number === lane.issue && !x.pull_request);
  const pr = lane.repo === "worker" ? data.workerPull : lane.pr ? data.pulls.find((x) => x.number === lane.pr) ?? null : data.pulls.find((x) => x.head.ref === lane.branch) ?? null;
  const runs = lane.branch ? data.runs.filter((x) => x.head_branch === lane.branch).slice(0, 3) : [];
  const latestRun = runs[0];
  const latestAt = [issue?.updated_at, pr?.updated_at, latestRun?.updated_at].filter(Boolean).sort().reverse()[0] ?? data.fetchedAt;
  const ageHours = Math.max(0, (Date.now() - new Date(latestAt).getTime()) / 3_600_000);

  let status = "PLANNED";
  let progress = 15;
  if (issue?.state === "closed") { status = "DONE"; progress = 100; }
  else if (pr?.merged_at) { status = "MERGED"; progress = 90; }
  else if (latestRun?.status === "in_progress" || latestRun?.status === "queued") { status = "CI"; progress = 72; }
  else if (latestRun?.conclusion === "failure") { status = "BLOCKED"; progress = 65; }
  else if (pr?.state === "open") { status = "REVIEW"; progress = 65; }
  else if (ageHours < 24) { status = "WORKING"; progress = 35; }
  if (lane.id === "AI-8" && status === "WORKING") progress = 45;

  return { issue, pr, latestRun, latestAt, ageHours, status, progress };
}

const tone: Record<string, string> = {
  WORKING: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REVIEW: "bg-blue-100 text-blue-800 border-blue-200",
  CI: "bg-amber-100 text-amber-800 border-amber-200",
  BLOCKED: "bg-red-100 text-red-800 border-red-200",
  MERGED: "bg-violet-100 text-violet-800 border-violet-200",
  DONE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PLANNED: "bg-slate-100 text-slate-700 border-slate-200",
};

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function AiOfficeRoute() {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [data, setData] = useState<Telemetry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const loginState = await ensureAiOfficeLineLogin();
        if (loginState === "redirecting") return;
        const cid = await getCurrentCustomerId();
        if (!cid) return setAuth("no-auth");
        const { data: admin } = await supabase.from("platform_admins").select("customer_id").eq("customer_id", cid).maybeSingle();
        setAuth(admin ? "ok" : "not-admin");
      } catch { setAuth("no-auth"); }
    })();
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { setData(await loadTelemetry()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "โหลด GitHub ไม่สำเร็จ"); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    if (auth !== "ok") return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 300_000);
    return () => window.clearInterval(timer);
  }, [auth, refresh]);

  const laneRows = useMemo(() => data ? LANES.map((lane) => ({ lane, ev: laneEvidence(lane, data) })) : [], [data]);
  const overall = laneRows.length ? Math.round(laneRows.reduce((s, x) => s + x.ev.progress, 0) / laneRows.length) : 0;
  const attention = laneRows.filter((x) => x.ev.status === "BLOCKED" || x.ev.ageHours > 48);

  if (auth === "loading") return <div className="min-h-screen bg-slate-950 p-8 text-slate-300">กำลังเปิด MyTree AI Office…</div>;
  if (auth === "no-auth") return <div className="min-h-screen bg-slate-950 p-8 text-white"><div className="mx-auto mt-24 max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center"><div className="text-4xl">🔒</div><h1 className="mt-4 text-xl font-bold">ไม่พบ LINE session</h1><p className="mt-2 text-sm text-slate-400">กรุณาเปิด AI Office ผ่าน LIFF link ของ MyTree</p></div></div>;
  if (auth === "not-admin") return <div className="min-h-screen bg-slate-950 p-8 text-white"><div className="mx-auto mt-24 max-w-md rounded-3xl border border-red-900/40 bg-slate-900 p-8 text-center"><div className="text-4xl">⛔</div><h1 className="mt-4 text-xl font-bold">ไม่มีสิทธิ์เข้าถึง AI Office</h1></div></div>;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400">MyTree Community Thailand</div><h1 className="mt-1 text-3xl font-black tracking-tight">AI Office <span className="text-slate-500">/ Control Center</span></h1><p className="mt-2 text-sm text-slate-400">สถานะจาก GitHub Issues, Pull Requests และ Actions จริง • refresh อัตโนมัติทุก 5 นาที</p></div>
          <button onClick={() => void refresh()} disabled={refreshing} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">{refreshing ? "กำลังอัปเดต…" : "↻ Refresh"}</button>
        </header>

        {error && <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-200">GitHub telemetry: {error} — ระบบจะแสดงข้อมูลล่าสุดที่โหลดสำเร็จ</div>}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Factory readiness" value={`${overall}%`} sub="evidence-weighted" />
          <Metric label="Active lanes" value={`${laneRows.filter((x) => !["DONE", "MERGED", "PLANNED"].includes(x.ev.status)).length}`} sub={`จาก ${LANES.length} AI lanes`} />
          <Metric label="Need attention" value={`${attention.length}`} sub="blocked / stale >48h" danger={attention.length > 0} />
          <Metric label="Last sync" value={data ? new Date(data.fetchedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "—"} sub="GitHub public telemetry" />
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">🏢 Virtual AI Office</h2><span className="text-xs text-slate-500">WORKING ≠ CI GREEN ≠ DEVICE VERIFIED ≠ RELEASED</span></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {laneRows.map(({ lane, ev }) => <AgentCard key={lane.id} lane={lane} ev={ev} />)}
            {!data && <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">กำลังโหลดสถานะทีม AI…</div>}
          </div>
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="font-bold">📡 Recent engineering activity</h2>
            <div className="mt-3 space-y-2">
              {data?.issues.filter((x) => x.number >= 77 && x.number <= 86 && !x.pull_request).slice(0, 8).map((x) => <a key={x.number} href={x.html_url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3 hover:border-slate-700"><div><div className="text-sm font-semibold">#{x.number} {x.title}</div><div className="mt-1 text-xs text-slate-500">updated {fmtTime(x.updated_at)}</div></div><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${x.state === "open" ? "bg-emerald-950 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>{x.state.toUpperCase()}</span></a>)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="font-bold">🚨 Owner attention</h2>
            <div className="mt-3 space-y-2">
              {attention.length === 0 ? <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm text-emerald-300">ไม่มี blocker/stale lane ที่ตรวจพบใน telemetry ล่าสุด</div> : attention.map(({ lane, ev }) => <div key={lane.id} className="rounded-xl border border-red-900/50 bg-red-950/20 p-3"><div className="font-semibold text-red-200">{lane.icon} {lane.name}</div><div className="mt-1 text-xs text-red-300/70">{ev.status === "BLOCKED" ? "CI/งานมีสัญญาณ blocker" : `ไม่มี update ประมาณ ${Math.floor(ev.ageHours)} ชม.`}</div></div>)}
            </div>
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-500">V1 แสดงหลักฐาน engineering จาก GitHub เท่านั้น ยังไม่ตีความว่า Codex กำลังประมวลผลอยู่ หากไม่มี commit/PR/CI/heartbeat จริง</div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, sub, danger = false }: { label: string; value: string; sub: string; danger?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${danger ? "border-red-900/60 bg-red-950/20" : "border-slate-800 bg-slate-900/70"}`}><div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div><div className={`mt-1 text-3xl font-black ${danger ? "text-red-300" : "text-white"}`}>{value}</div><div className="mt-1 text-xs text-slate-500">{sub}</div></div>;
}

function AgentCard({ lane, ev }: { lane: Lane; ev: ReturnType<typeof laneEvidence> }) {
  const href = ev.pr?.html_url ?? ev.issue?.html_url;
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-black/10"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="text-3xl">{lane.icon}</div><div><div className="text-xs font-semibold text-slate-500">{lane.id}</div><h3 className="font-bold">{lane.name}</h3><div className="text-xs text-slate-400">{lane.role}</div></div></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${tone[ev.status]}`}>{ev.status}</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${ev.progress}%` }} /></div><div className="mt-2 flex justify-between text-xs"><span className="font-semibold text-slate-300">{ev.progress}%</span><span className="text-slate-500">{fmtTime(ev.latestAt)}</span></div><div className="mt-3 rounded-xl bg-slate-950/80 p-3 text-xs text-slate-400"><div>Task #{lane.issue}{ev.issue ? ` • ${ev.issue.state}` : " • not fetched"}</div><div className="mt-1">{ev.pr ? `PR #${ev.pr.number} • ${ev.pr.merged_at ? "merged" : ev.pr.state}` : lane.branch ? `branch: ${lane.branch}` : "coordination lane"}</div>{ev.latestRun && <div className="mt-1">CI: {ev.latestRun.name} • {ev.latestRun.status}{ev.latestRun.conclusion ? `/${ev.latestRun.conclusion}` : ""}</div>}</div>{href && <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-bold text-emerald-400 hover:text-emerald-300">ดูหลักฐาน ↗</a>}</div>;
}
