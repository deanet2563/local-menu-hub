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
const { parseCustomerLiffStateDestination } = stateModule.exports;

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
