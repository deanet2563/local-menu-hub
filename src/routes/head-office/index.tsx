import { createFileRoute } from "@tanstack/react-router";
import { PlatformAdminGate } from "@/components/admin/PlatformAdminGate";
import { HeadOfficeShell } from "@/components/head-office/HeadOfficeShell";

export const Route = createFileRoute("/head-office/")({
  component: HeadOfficeIndexRoute,
});

function HeadOfficeIndexRoute() {
  return (
    <PlatformAdminGate>
      <HeadOfficeShell section="overview" />
    </PlatformAdminGate>
  );
}
