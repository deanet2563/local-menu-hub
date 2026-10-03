const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "../../src/lib/moderationAdmin.ts"),
  "utf8",
);
const declaration = source.match(/function dateBound\(value: string, endOfDay = false\) \{[\s\S]*?\n\}/);
assert.ok(declaration, "dateBound implementation should exist");
const dateBound = vm.runInNewContext(
  `(${declaration[0].replace("value: string", "value")})`,
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
