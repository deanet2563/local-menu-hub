import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sweet/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <div>
      <h1>Admin / POS</h1>
      <p>แดชบอร์ดแอดมิน</p>
    </div>
  );
}
