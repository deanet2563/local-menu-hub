import { createFileRoute } from "@tanstack/react-router";
import { MyTreeMap } from "@/components/customer/MyTreeMap";

export const Route = createFileRoute("/map")({
  component: MyTreeMap,
});
