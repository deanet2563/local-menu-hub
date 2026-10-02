import { createFileRoute } from "@tanstack/react-router";
import { PlatformAdminGate } from "@/components/admin/PlatformAdminGate";
import { HeadOfficeShell } from "@/components/head-office/HeadOfficeShell";
import { CommunityManagement } from "@/components/head-office/CommunityManagement";
import { MemberManagement } from "@/components/head-office/MemberManagement";
import { ShopManagement } from "@/components/head-office/ShopManagement";
import { RiderManagement } from "@/components/head-office/RiderManagement";
import { OrderManagement } from "@/components/head-office/OrderManagement";
import { MapManagement } from "@/components/head-office/MapManagement";
import { ModerationCenter } from "@/components/head-office/ModerationCenter";
import { isHeadOfficeSection } from "@/components/head-office/headOfficeNav";

export const Route = createFileRoute("/head-office/$section")({ component: HeadOfficeSectionRoute });

function HeadOfficeSectionRoute() {
  const { section } = Route.useParams();
  const requiredPermission = section === "communities" ? "communities.read" : section === "members" ? "members.read" : section === "shops" ? "shops.read" : section === "riders" ? "riders.read" : section === "orders" ? "orders.read" : section === "map" ? "map.read" : section === "moderation" ? "moderation.read" : undefined;
  return (
    <PlatformAdminGate requiredPermission={requiredPermission}>
      {isHeadOfficeSection(section) && section !== "overview" ? (
        <HeadOfficeShell section={section}>
          {section === "communities" ? <CommunityManagement /> : section === "members" ? <MemberManagement /> : section === "shops" ? <ShopManagement /> : section === "riders" ? <RiderManagement /> : section === "orders" ? <OrderManagement /> : section === "map" ? <MapManagement /> : section === "moderation" ? <ModerationCenter /> : undefined}
        </HeadOfficeShell>
      ) : <HeadOfficeNotFound />}
    </PlatformAdminGate>
  );
}
function HeadOfficeNotFound() {
  return <HeadOfficeShell section="overview"><div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-medium text-gray-400">404</p><h2 className="mt-2 text-xl font-semibold">ไม่พบ Head Office module นี้</h2><p className="mt-2 text-sm text-gray-500">เลือกเมนูจาก sidebar เพื่อไปยัง route ที่รองรับ</p></div></HeadOfficeShell>;
}
