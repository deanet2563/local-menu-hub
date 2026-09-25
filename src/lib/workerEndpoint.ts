const DEFAULT_WORKER_URL = "https://mytree-worker.kompakorn-t.workers.dev";

export const MYTREE_WORKER_URL = (import.meta.env.VITE_MYTREE_WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, "");
