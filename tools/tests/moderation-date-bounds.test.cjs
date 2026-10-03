const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "../../src/lib/moderationAdmin.ts"),
  "utf8",
);
const boundDeclaration = source.match(/function dateBound\(value: string, endOfDay = false\) \{[\s\S]*?\n\}/);
assert.ok(boundDeclaration, "dateBound implementation should exist");
const dateBound = vm.runInNewContext(
  `(${boundDeclaration[0].replace("value: string", "value")})`,
);
const formatterDeclaration = source.match(/export function formatModerationTimestamp\(value: string \| null \| undefined\) \{[\s\S]*?\n\}/);
assert.ok(formatterDeclaration, "shared moderation timestamp formatter should exist");
const formatModerationTimestamp = vm.runInNewContext(
  `(${formatterDeclaration[0].replace("export function", "function").replace("value: string | null | undefined", "value")})`,
);

test("moderation date bounds use Bangkok calendar days under a non-Bangkok device timezone", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.equal(dateBound("2026-10-03"), "2026-10-02T17:00:00.000Z");
    assert.equal(dateBound("2026-10-03", true), "2026-10-03T16:59:59.999Z");
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("moderation timestamps display Bangkok time under a non-Bangkok device timezone", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const storedUtc = "2026-10-02T17:00:00.000Z";
    const expected = new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(storedUtc));
    const deviceLocal = new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Los_Angeles",
    }).format(new Date(storedUtc));

    assert.equal(formatModerationTimestamp(storedUtc), expected);
    assert.notEqual(expected, deviceLocal);
    assert.equal(storedUtc, "2026-10-02T17:00:00.000Z");
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
