import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outdir = await mkdtemp(path.join(tmpdir(), "customer-liff-auth-parity-test-"));

try {
  const outfile = path.join(outdir, "customer-liff-auth-parity.test.mjs");
  const entryPath = path.join(repoRoot, "src/lib/customerLiffAuthParity.test.ts");
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
    platform: "browser",
    target: "es2022",
    define: {
      "import.meta.env.VITE_LIFF_ID": '"test-liff-id"',
      "import.meta.env.VITE_SUPABASE_URL": '"https://test.supabase.co"',
      "import.meta.env.VITE_SUPABASE_ANON_KEY": '"test-anon-key"',
      "import.meta.env.VITE_MYTREE_WORKER_URL": '"https://test-worker.example.com"',
    },
    plugins: [{
      name: "customer-liff-auth-parity-stubs",
      setup(build) {
        build.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({
          path: path.join(repoRoot, "src/lib/supabase.ts"),
        }));
        build.onResolve({ filter: /^@line\/liff$/ }, () => ({ path: "liff", namespace: "stub" }));
        build.onLoad({ filter: /^liff$/, namespace: "stub" }, () => ({
          contents: "export default {};",
          loader: "js",
        }));
        build.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: "supabase-js", namespace: "stub" }));
        build.onLoad({ filter: /^supabase-js$/, namespace: "stub" }, () => ({
          contents: `
            export function createClient() {
              return { storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({}) }) } };
            }
          `,
          loader: "js",
        }));
      },
    }],
  });
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(outdir, { recursive: true, force: true });
}
