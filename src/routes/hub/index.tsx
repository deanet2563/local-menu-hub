import { createFileRoute } from "@tanstack/react-router";
import { HubHome } from "@/components/customer/HubHome";

export const Route = createFileRoute("/hub/")({
	component: HubHome,
});
