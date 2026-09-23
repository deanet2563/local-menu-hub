import { createFileRoute } from "@tanstack/react-router";
import { AdminConsole } from "@/components/admin/AdminConsole";
import { PlatformAdminGate } from "@/components/admin/PlatformAdminGate";

export const Route = createFileRoute("/sweet/admin")({
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <PlatformAdminGate requiredPermission="system.admin">
      <AdminConsole />
    </PlatformAdminGate>
  );
}
