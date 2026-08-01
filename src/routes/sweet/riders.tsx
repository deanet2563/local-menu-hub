import { createFileRoute } from "@tanstack/react-router";
import { RiderVerificationPanel } from "@/components/admin/RiderVerificationPanel";

export const Route = createFileRoute("/sweet/riders")({
  component: RiderVerificationPanel,
});
