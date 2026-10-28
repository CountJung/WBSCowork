import { defineConfig } from "vite";
import vinext from "vinext";
import { readFileSync } from "node:fs";
import publicOrigin from "./sites/public-origin.json";

// Keep the existing Next/MUI application. Sites runs its server on Workers.
export default defineConfig(async () => {
  const hosting: unknown = JSON.parse(readFileSync(new URL("./.openai/hosting.json", import.meta.url), "utf8"));
  const projectId = hosting && typeof hosting === "object" && "project_id" in hosting ? hosting.project_id : undefined;
  const published = new URL(publicOrigin.origin);
  if (typeof projectId !== "string" || projectId.trim() !== projectId || !/^appgprj_[a-zA-Z0-9]+$/.test(projectId) || publicOrigin.project_id !== projectId || publicOrigin.origin !== published.origin || published.protocol !== "https:" || published.username || published.password) throw new Error("Sites public origin metadata is invalid or belongs to a different project.");
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    define: { __WBSCOWORK_WORKER__: "true", __WBSCOWORK_SITE_PROJECT_ID__: JSON.stringify(projectId) },
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
          d1_databases: [{ binding: "DB", database_name: "wbscowork-local", database_id: "00000000-0000-4000-8000-000000000000", migrations_dir: "drizzle" }],
          r2_buckets: [{ binding: "ATTACHMENTS", bucket_name: "wbscowork-attachments-local" }],
        },
      }),
    ],
  };
});
