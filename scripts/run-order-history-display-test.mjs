import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outdir = await mkdtemp(path.join(tmpdir(), "order-history-display-test-"));

const aliasPlugin = {
  name: "order-history-display-alias",
  setup(build) {
    build.onResolve({ filter: /^@\/lib\/orderHistoryDisplay$/ }, () => ({
      path: path.join(repoRoot, "src/lib/orderHistoryDisplay.ts"),
    }));
  },
};

try {
  const outfile = path.join(outdir, "orderHistoryDisplay.test.mjs");
  const entryPath = path.join(repoRoot, "src/lib/orderHistoryDisplay.test.ts");
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
    plugins: [aliasPlugin],
  });
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(outdir, { recursive: true, force: true });
}
