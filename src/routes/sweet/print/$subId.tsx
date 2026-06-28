import { createFileRoute } from "@tanstack/react-router";
import { PrintReceipt } from "@/components/print/PrintReceipt";

export const Route = createFileRoute("/sweet/print/$subId")({
  component: PrintPage,
});

function PrintPage() {
  const { subId } = Route.useParams();
  return <PrintReceipt subId={subId} />;
}
