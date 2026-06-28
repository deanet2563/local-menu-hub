import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <h1>Local Menu Hub</h1>
      <p>แพลตฟอร์มสั่งอาหารชุมชน</p>
    </div>
  );
}
