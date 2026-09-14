import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

// Minimal stub for the "แผนที่" (Map) bottom-nav tab.
// Intentionally does not touch existing delivery/checkout map runtime
// code (src/routes/debug/checkout-map.tsx, DeliveryLocationPicker, etc.)
// — this is a new, isolated placeholder destination only.
function MapPage() {
  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-bold">แผนที่</h1>
      <p className="mt-1 text-sm text-gray-500">เร็ว ๆ นี้</p>
    </div>
  );
}
