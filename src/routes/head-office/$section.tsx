import { createFileRoute } from "@tanstack/react-router";
import { PlatformAdminGate } from "@/components/admin/PlatformAdminGate";
import { HeadOfficeShell } from "@/components/head-office/HeadOfficeShell";
import { CommunityManagement } from "@/components/head-office/CommunityManagement";
import { isHeadOfficeSection } from "@/components/head-office/headOfficeNav";

export const Route = createFileRoute("/head-office/$section")({
  component: HeadOfficeSectionRoute,
});

function HeadOfficeSectionRoute() {
  const { section } = Route.useParams();

  return (
    <PlatformAdminGate requiredPermission={section === "communities" ? "communities.read" : undefined}>
      {isHeadOfficeSection(section) && section !== "overview" ? (
        <HeadOfficeShell section={section}>
          {section === "communities" ? <CommunityManagement /> : undefined}
        </HeadOfficeShell>
      ) : (
        <HeadOfficeNotFound />
      )}
    </PlatformAdminGate>
  );
}

function HeadOfficeNotFound() {
  return (
    <HeadOfficeShell section="overview">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-400">404</p>
        <h2 className="mt-2 text-xl font-semibold">ไม่พบ Head Office module นี้</h2>
        <p className="mt-2 text-sm text-gray-500">เลือกเมนูจาก sidebar เพื่อไปยัง route ที่รองรับ</p>
      </div>
    </HeadOfficeShell>
  );
}
