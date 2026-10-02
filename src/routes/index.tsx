import { createFileRoute } from "@tanstack/react-router";
import { MyTreeHome } from "@/components/customer/MyTreeHome";

export const Route = createFileRoute("/")({
  component: MyTreeHome,
});
