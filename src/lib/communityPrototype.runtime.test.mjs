import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as community from "./communityPrototype.ts";
import {
  COMMUNITY_RC_PREVIEW_HOSTNAME,
  getCommunityFixturePreviewDecision,
  isLocalCommunityPrototypeAuthBypassLocation,
} from "./previewDebugRoute.ts";

const {
  COMMUNITY_PROTOTYPE_EVENTS,
  COMMUNITY_PROTOTYPE_GROUPS,
  COMMUNITY_PROTOTYPE_HELP_REQUESTS,
  COMMUNITY_PROTOTYPE_MAP_ENTRIES,
  COMMUNITY_PROTOTYPE_MARKETPLACE,
  COMMUNITY_PROTOTYPE_POSTS,
  getCommunityPrototypeDetail,
} = community;

test("keeps the six Community navigation items in the approved wireframe order", () => {
  assert.deepEqual(
    community.COMMUNITY_NAV_ITEMS?.map(({ id, label, href }) => ({ id, label, href })),
    [
      { id: "feed", label: "ฟีด", href: "/community/feed" },
      { id: "events", label: "กิจกรรม", href: "/community/events" },
      { id: "help", label: "ขอความช่วยเหลือ", href: "/community/help" },
      { id: "marketplace", label: "ซื้อ-ขาย-แจก", href: "/community/marketplace" },
      { id: "groups", label: "กลุ่ม", href: "/community/groups" },
      { id: "map", label: "แผนที่", href: "/community/map" },
    ],
  );
  assert.equal(community.COMMUNITY_NAV_ITEMS?.some(({ id }) => id === "home"), false);
});

test("uses the Feed experience for the /community landing route", async () => {
  const source = await readFile(new URL("../routes/community/index.tsx", import.meta.url), "utf8");
  assert.match(source, /CommunitySurfaceRoute surface="feed"/);
  assert.doesNotMatch(source, /surface="home"/);
});

test("keeps the Community chip navigation scrollable without a visible scrollbar", async () => {
  const shell = await readFile(new URL("../components/community/CommunityShell.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../index.css", import.meta.url), "utf8");
  assert.match(shell, /community-nav-scrollbar/);
  assert.match(shell, /overflow-x-auto/);
  assert.match(styles, /\.community-nav-scrollbar::\-webkit-scrollbar/);
  assert.match(styles, /scrollbar-width:\s*none/);
});

test("selects at most two upcoming events from the active community", () => {
  const otherCommunityEvent = { ...COMMUNITY_PROTOTYPE_EVENTS[0], id: "event-other", communityId: "office-rama9" };
  const selected = community.selectUpcomingCommunityEvents?.(
    [...COMMUNITY_PROTOTYPE_EVENTS, otherCommunityEvent],
    "sammakorn",
  );
  assert.equal(selected?.length, 2);
  assert.deepEqual(selected?.map(({ id }) => id), ["event-cleanup", "event-parents"]);
  assert.equal(selected?.every(({ communityId }) => communityId === "sammakorn"), true);
});

test("selects joined groups only from favorites in the active community", () => {
  const otherCommunityGroup = { ...COMMUNITY_PROTOTYPE_GROUPS[0], id: "group-other", communityId: "office-rama9" };
  const selected = community.selectJoinedCommunityGroups?.(
    [...COMMUNITY_PROTOTYPE_GROUPS, otherCommunityGroup],
    ["group-yoga", "group-parents", "group-other"],
    "sammakorn",
  );
  assert.deepEqual(selected?.map(({ id }) => id), ["group-yoga", "group-parents"]);
  assert.equal(selected?.every(({ communityId }) => communityId === "sammakorn"), true);
});

test("community switching scopes feed selections and locks an open detail from another community", () => {
  const switchedCommunity = community.getCommunityPrototypeCommunity?.("office-rama9");
  const openPost = getCommunityPrototypeDetail("post", "post-pinned-safety", "sammakorn");
  assert.equal(switchedCommunity?.id, "office-rama9");
  assert.deepEqual(community.selectUpcomingCommunityEvents?.(COMMUNITY_PROTOTYPE_EVENTS, switchedCommunity.id), []);
  assert.deepEqual(community.selectJoinedCommunityGroups?.(COMMUNITY_PROTOTYPE_GROUPS, ["group-yoga"], switchedCommunity.id), []);
  assert.ok(openPost);
  assert.equal(community.isCommunityDetailScopeMismatch?.(openPost, switchedCommunity.id), true);
  assert.equal(community.isCommunityDetailScopeMismatch?.(openPost, "sammakorn"), false);
});

test("accepts valid detail IDs and rejects invalid or cross-community IDs", () => {
  assert.equal(getCommunityPrototypeDetail("post", "post-pinned-safety", "sammakorn")?.id, "post-pinned-safety");
  assert.equal(getCommunityPrototypeDetail("post", "missing", "sammakorn"), undefined);
  assert.equal(getCommunityPrototypeDetail("post", "post-pinned-safety", "office-rama9"), undefined);
});

test("locks private groups without fixture access", () => {
  const group = getCommunityPrototypeDetail("group", "group-parents", "sammakorn");
  assert.ok(group);
  assert.equal(community.canAccessCommunityPrototypeDetail?.("group", group), false);
});

test("does not return removed post content", () => {
  const post = getCommunityPrototypeDetail("post", "post-removed", "sammakorn");
  assert.ok(post);
  assert.equal(community.getCommunityPrototypeDetailDescription?.("post", post), "เนื้อหาเดิมไม่แสดง เนื่องจากรายการถูกนำออกตามกติกาชุมชน");
  assert.notEqual(community.getCommunityPrototypeDetailDescription?.("post", post), post.body);
});

test("keeps private map locations approximate and exact locations narrowly gated", () => {
  const privateEntry = COMMUNITY_PROTOTYPE_MAP_ENTRIES.find((entry) => entry.id === "map-member-note");
  const publicEntry = COMMUNITY_PROTOTYPE_MAP_ENTRIES.find((entry) => entry.id === "map-cafe");
  assert.ok(privateEntry);
  assert.ok(publicEntry);
  assert.equal(community.getCommunityPrototypeMapLocation?.(privateEntry)?.precision, "approximate");
  assert.equal(community.getCommunityPrototypeMapLocation?.(privateEntry)?.isExact, false);
  assert.equal(community.getCommunityPrototypeMapLocation?.(publicEntry)?.isExact, true);
  assert.equal(
    COMMUNITY_PROTOTYPE_MAP_ENTRIES
      .filter((entry) => community.getCommunityPrototypeMapLocation?.(entry)?.isExact)
      .every((entry) => entry.layer === "public-directory" && entry.status === "public-approved" && entry.exactLocationOptIn),
    true,
  );
});

test("covers every required lifecycle label", () => {
  const cases = [
    ...COMMUNITY_PROTOTYPE_POSTS.map((item) => ["post", item.status]),
    ...COMMUNITY_PROTOTYPE_GROUPS.map((item) => ["group", item.status]),
    ...COMMUNITY_PROTOTYPE_EVENTS.map((item) => ["event", item.status]),
    ...COMMUNITY_PROTOTYPE_HELP_REQUESTS.map((item) => ["help", item.status]),
    ...COMMUNITY_PROTOTYPE_MARKETPLACE.map((item) => ["marketplace", item.status]),
    ...COMMUNITY_PROTOTYPE_MAP_ENTRIES.map((item) => ["map", item.status]),
  ];
  for (const [kind, status] of cases) {
    assert.ok(community.getCommunityPrototypeStatusLabel?.(kind, status), `${kind}:${status} needs a label`);
  }
});

test("keeps Community marketplace separate from Food Order and cart", () => {
  assert.equal(community.COMMUNITY_MARKETPLACE_BOUNDARY, "separate-from-food-order-and-cart");
});

test("uses the approved fixture-only preview disclosure", () => {
  assert.equal(
    community.COMMUNITY_PREVIEW_BANNER,
    "หน้าทดลอง MyTree Community — ข้อมูลทั้งหมดเป็นตัวอย่างและไม่มีการบันทึกข้อมูลจริง",
  );
});

test("denies the public Community preview when its build flag is off", () => {
  assert.equal(
    getCommunityFixturePreviewDecision({
      fixturePreviewEnabled: false,
      hostname: COMMUNITY_RC_PREVIEW_HOSTNAME,
      pathname: "/community",
    }),
    "deny",
  );
});

test("denies wrong, production, and custom production hostnames", () => {
  for (const hostname of ["other.local-menu-hub.pages.dev", "local-menu-hub.pages.dev", "mytree.cc", "www.mytree.cc"]) {
    assert.equal(
      getCommunityFixturePreviewDecision({ fixturePreviewEnabled: true, hostname, pathname: "/community" }),
      "deny",
    );
  }
});

test("allows only Community paths on the exact RC preview hostname", () => {
  assert.equal(
    getCommunityFixturePreviewDecision({
      fixturePreviewEnabled: true,
      hostname: COMMUNITY_RC_PREVIEW_HOSTNAME,
      pathname: "/community/feed/post-pinned-safety",
    }),
    "allow",
  );
  assert.equal(
    getCommunityFixturePreviewDecision({
      fixturePreviewEnabled: true,
      hostname: COMMUNITY_RC_PREVIEW_HOSTNAME,
      pathname: "/",
    }),
    "redirect-community",
  );
  assert.equal(
    getCommunityFixturePreviewDecision({
      fixturePreviewEnabled: true,
      hostname: COMMUNITY_RC_PREVIEW_HOSTNAME,
      pathname: "/sweet/admin",
    }),
    "redirect-community",
  );
});

test("preserves localhost and private-LAN Community DEV bypasses", () => {
  for (const hostname of ["localhost", "127.0.0.1", "192.168.1.20", "10.0.0.8", "172.16.0.4", "172.31.255.9"]) {
    assert.equal(
      isLocalCommunityPrototypeAuthBypassLocation({ hostname, pathname: "/community/map" }, true),
      true,
    );
  }
  assert.equal(
    isLocalCommunityPrototypeAuthBypassLocation({ hostname: "192.168.1.20", pathname: "/account" }, true),
    false,
  );
  assert.equal(
    isLocalCommunityPrototypeAuthBypassLocation({ hostname: "192.168.1.20", pathname: "/community" }, false),
    false,
  );
});

test("loads Community screens lazily from every Community route", async () => {
  const routeFiles = [
    "index.tsx",
    "feed.tsx",
    "groups.tsx",
    "events.tsx",
    "help.tsx",
    "marketplace.tsx",
    "map.tsx",
    "feed_.$postId.tsx",
    "groups_.$groupId.tsx",
    "events_.$eventId.tsx",
    "help_.$requestId.tsx",
    "marketplace_.$listingId.tsx",
    "map_.$entryId.tsx",
  ];
  for (const file of routeFiles) {
    const source = await readFile(new URL(`../routes/community/${file}`, import.meta.url), "utf8");
    assert.match(source, /CommunityLazyRoute/, `${file} must use the lazy Community route wrapper`);
    assert.doesNotMatch(source, /from "@\/components\/community\/(CommunityPrototype|CommunityDetail)"/);
  }
});

test("keeps implementation language and ordering contracts out of visible Community copy", async () => {
  const files = [
    "../components/community/CommunityCards.tsx",
    "../components/community/CommunityDetail.tsx",
    "../components/community/CommunityLazyRoute.tsx",
    "../components/community/CommunityShell.tsx",
    "../components/community/CommunityStates.tsx",
    "./communityPrototype.ts",
  ];
  const banned = /\b(fixture|prototype|contract|api|supabase|debug)\b/i;
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const stringValues = [...source.matchAll(/"([^"\n]*)"/g)]
      .map((match) => match[1])
      .filter((value) => !value.startsWith("@/") && !value.startsWith("./"));
    assert.deepEqual(stringValues.filter((value) => banned.test(value)), [], `${file} contains banned visible copy`);
    assert.doesNotMatch(source, /from "@\/lib\/(cart|order)"/);
  }
});
