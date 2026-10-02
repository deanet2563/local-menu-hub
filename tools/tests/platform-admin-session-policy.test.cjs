const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const sourcePath = path.resolve(__dirname, "../../src/lib/platformAdminSessionPolicy.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const policyModule = new Module(sourcePath, module);
policyModule.filename = sourcePath;
policyModule.paths = Module._nodeModulePaths(path.dirname(sourcePath));
policyModule._compile(compiled, sourcePath);
const { getPlatformAdminIdTokenStatus, mayStartPlatformAdminReauthentication } = policyModule.exports;

test("accepts only a fresh Admin-channel ID token", () => {
  assert.equal(getPlatformAdminIdTokenStatus({ aud: "2010936243", exp: 2_000 }, "2010936243", 1_000), "valid");
  assert.equal(getPlatformAdminIdTokenStatus({ aud: "2010936243", exp: 1_020 }, "2010936243", 1_000), "expired");
  assert.equal(getPlatformAdminIdTokenStatus({ aud: "2010936243" }, "2010936243", 1_000), "missing");
  assert.equal(getPlatformAdminIdTokenStatus(null, "2010936243", 1_000), "missing");
  assert.equal(getPlatformAdminIdTokenStatus({ aud: "customer-channel", exp: 2_000 }, "2010936243", 1_000), "wrong_audience");
});

test("allows a controlled recovery once and then fails closed", () => {
  assert.equal(mayStartPlatformAdminReauthentication(false), true);
  assert.equal(mayStartPlatformAdminReauthentication(true), false);
});
