import { createFileRoute } from "@tanstack/react-router";
import { RiderDashboard } from "@/components/rider/RiderDashboard";

export const Route = createFileRoute("/rider/")({
  component: RiderHome,
});

function RiderHome() {
  // TODO(auth): resolve the real rider id from the LINE session:
  //   look up riders.id where customer_id = (JWT customer_id claim).
  // Until auth exists, this is a placeholder like the shop/pos routes.
  const riderId = "placeholder-rider-id";
  return <RiderDashboard riderId={riderId} />;
}
