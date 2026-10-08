import { defineConfig } from "vite";
import vinext from "vinext";

// Keep the existing Next/MUI application. Sites runs its server on Workers.
export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    define: { __WBSCOWORK_WORKER__: "true" },
    // NextAuth v4 publishes Babel-style CommonJS defaults. Match Next's CJS
    // interop without replacing its handler, provider, or security behavior.
    legacy: { inconsistentCjsInterop: true },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: {
          name: "wbscowork",
          main: "./sites/worker.ts",
          compatibility_date: "2026-05-15",
          compatibility_flags: ["nodejs_compat"],
        },
      }),
    ],
  };
});
