import { defineConfig } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

const stagingSourcemapEnabled =
  process.env.CF_PAGES_BRANCH === "customer-staging"
  || process.env.VITE_CUSTOMER_STAGING_SOURCEMAP === "1";

export default defineConfig({
  plugins: [TanStackRouterVite()],
  build: {
    sourcemap: stagingSourcemapEnabled,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
