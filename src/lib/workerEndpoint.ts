const DEFAULT_WORKER_URL = "https://mytree-worker.kompakorn-t.workers.dev";
const STAGING_HOST = "customer-staging.local-menu-hub.pages.dev";
const STAGING_WORKER_URL = "https://mytree-worker-staging.kompakorn-t.workers.dev";

function isCustomerStagingHost(): boolean {
  return typeof window !== "undefined" && window.location.hostname === STAGING_HOST;
}

export const MYTREE_WORKER_URL = (
  isCustomerStagingHost()
    ? STAGING_WORKER_URL
    : import.meta.env.VITE_MYTREE_WORKER_URL || DEFAULT_WORKER_URL
).replace(/\/+$/, "");
