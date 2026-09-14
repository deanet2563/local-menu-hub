import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/hub/")({
  component: HubPage,
});

function HubPage() {
  return (
    <div className="p-4 pb-24">
      <h1>Hub — Customer LIFF</h1>
      <p>หน้าสั่งอาหาร</p>
    </div>
  );
}
