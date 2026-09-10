import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = await mkdtemp(join(tmpdir(), "customer-bottom-nav-"));
const outfile = join(dir, "test.mjs");

try {
  await build({
    entryPoints: ["src/components/customer/CustomerBottomNav.test.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    alias: { "@": "./src" },
  });
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(dir, { recursive: true, force: true });
}
