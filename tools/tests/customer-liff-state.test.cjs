const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const sourcePath = path.resolve(__dirname, "../../src/lib/customerLiffState.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const stateModule = new Module(sourcePath, module);
stateModule.filename = sourcePath;
stateModule.paths = Module._nodeModulePaths(path.dirname(sourcePath));
stateModule._compile(compiled, sourcePath);
const { buildCanonicalMyTreeUrl, parseCustomerLiffStateDestination } = stateModule.exports;

test("restores Customer LIFF path, query, and fragment", () => {
  assert.equal(
    parseCustomerLiffStateDestination("?liff.state=%2Fhub%3Fcategory%3Dfood%23nearby", "https://mytree.cc"),
    "/hub?category=food#nearby",
  );
});

test("supports nested-encoded state while rejecting external destinations", () => {
  assert.equal(parseCustomerLiffStateDestination("?liff.state=%252Fmap", "https://mytree.cc"), "/map");
  assert.equal(parseCustomerLiffStateDestination("?liff.state=%2F%2Fevil.example%2Fmap", "https://mytree.cc"), null);
  assert.equal(parseCustomerLiffStateDestination("?other=%2Fhub", "https://mytree.cc"), null);
});

test("canonical URL construction cannot be redirected by crafted pathnames", () => {
  const craftedPathnames = [
    "//evil.example/phish",
    "/%2f%2fevil.example/phish",
    "/%2F%2Fevil.example/phish",
    "/%252f%252fevil.example/phish",
  ];

  for (const pathname of craftedPathnames) {
    const target = new URL(buildCanonicalMyTreeUrl(pathname, "?from=customer", "#section"));
    assert.equal(target.origin, "https://mytree.cc", pathname);
    assert.equal(target.search, "?from=customer", pathname);
    assert.equal(target.hash, "#section", pathname);
  }
});

test("canonical URL construction preserves normal route and query semantics", () => {
  for (const route of ["/", "/hub", "/map", "/shop/sonbaobao", "/cart"]) {
    const target = new URL(buildCanonicalMyTreeUrl(route));
    assert.equal(target.origin, "https://mytree.cc", route);
    assert.equal(target.pathname, route, route);
  }

  const hub = new URL(buildCanonicalMyTreeUrl("/hub", "?category=food", "#nearby"));
  assert.equal(hub.origin, "https://mytree.cc");
  assert.equal(hub.pathname, "/hub");
  assert.equal(hub.search, "?category=food");
  assert.equal(hub.hash, "#nearby");

  const map = new URL(buildCanonicalMyTreeUrl("/map"));
  assert.equal(map.origin, "https://mytree.cc");
  assert.equal(map.pathname, "/map");
});
