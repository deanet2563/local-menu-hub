import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outdir = await mkdtemp(path.join(tmpdir(), "customer-item-options-test-"));

const stubPlugin = {
  name: "customer-item-options-stubs",
  setup(build) {
    build.onResolve({ filter: /^@\/lib\/customer-item-options$/ }, () => ({
      path: path.join(repoRoot, "src/lib/customer-item-options.ts"),
    }));
    build.onResolve({ filter: /^@\/lib\/ordering-config$/ }, () => ({ path: "ordering-config-stub", namespace: "stub" }));
    build.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: "supabase-stub", namespace: "stub" }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export const publicSupabase = {}; export async function loadItemOptionGroups() { return []; }",
      loader: "js",
    }));
  },
};

try {
  const outfile = path.join(outdir, "customer-item-options.test.mjs");
  const entryPath = path.join(repoRoot, "src/lib/customer-item-options.test.ts");
  await esbuild.build({
    stdin: {
      contents: await readFile(entryPath, "utf8"),
      sourcefile: entryPath,
      resolveDir: path.dirname(entryPath),
      loader: "ts",
    },
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    define: {
      "import.meta.env.VITE_ENABLE_REUSABLE_SHOP_CUSTOMIZE": "undefined",
    },
    plugins: [stubPlugin],
  });
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(outdir, { recursive: true, force: true });
}
