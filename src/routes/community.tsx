import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/community")({
  component: CommunityPage,
});

// Minimal stub for the "ชุมชน" (Community) bottom-nav tab.
// Full Community Map feature is tracked separately in the Bible; this
// placeholder exists only so the nav layer has a real destination.
function CommunityPage() {
  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-bold">ชุมชน</h1>
      <p className="mt-1 text-sm text-gray-500">เร็ว ๆ นี้</p>
    </div>
  );
}
