import { Link, useRouterState } from "@tanstack/react-router";

const ITEMS = [
  { to: "/community/report", label: "แจ้งเหตุ", icon: "🚨" },
  { to: "/community/incidents", label: "เหตุการณ์ทั้งหมด", icon: "📋" },
  { to: "/community/my-incidents", label: "เหตุการณ์ที่ฉันแจ้ง", icon: "👤" },
] as const;

export function EmergencyNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav className="sticky top-0 z-40 border-b bg-white/95 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto">
        {ITEMS.map((item) => {
          const active = item.to === "/community/my-incidents"
            ? pathname.startsWith("/community/my-incidents")
            : pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                "shrink-0 rounded-full border px-3 py-2 text-xs font-black transition " +
                (active
                  ? "border-[#1f6a45] bg-[#eef7e9] text-[#1f6a45]"
                  : "border-gray-200 bg-white text-gray-700")
              }
            >
              <span className="mr-1">{item.icon}</span>{item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
