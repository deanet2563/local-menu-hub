import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outdir = await mkdtemp(path.join(tmpdir(), "mytree-session-test-"));

const aliasPlugin = {
  name: "mytree-session-alias",
  setup(build) {
    build.onResolve({ filter: /^@\/lib\/mytreeSession$/ }, () => ({
      path: path.join(repoRoot, "src/lib/mytreeSession.ts"),
    }));
  },
};

try {
  const outfile = path.join(outdir, "mytree-session.test.mjs");
  const entryPath = path.join(repoRoot, "src/lib/mytreeSession.test.ts");
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
