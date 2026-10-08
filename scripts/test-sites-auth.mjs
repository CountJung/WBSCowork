/** Runs the built app in workerd. All auth values are synthetic and local-only. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const canonicalOrigin = "https://wbscowork.cometgnome.chatgpt.site";
const temporary = await mkdtemp(path.join(tmpdir(), "wbscowork-auth-test-"));
const secret = randomBytes(32).toString("hex");
let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions++;
  console.log(`PASS ${message}`);
}
async function runScenario(name, bindings, verify) {
  let output = "";
  const server = spawn(process.execPath, [
    "node_modules/wrangler/bin/wrangler.js", "dev", "--config", "dist/server/wrangler.json",
    "--local", "--ip", "127.0.0.1", "--port", "8792", "--inspector-port", "0",
    "--persist-to", path.join(temporary, name),
    ...Object.entries(bindings).flatMap(([key, value]) => ["--var", `${key}:${value}`]),
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env, XDG_CONFIG_HOME: path.join(temporary, "config"),
      WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: path.join(temporary, "logs"),
      WRANGLER_REGISTRY_PATH: path.join(temporary, "registry"),
      MINIFLARE_REGISTRY_PATH: path.join(temporary, "miniflare"),
      CLOUDFLARE_CF_FETCH_ENABLED: "false",
    },
  });
  server.stdout.on("data", (chunk) => { output = (output + chunk).slice(-40000); });
  server.stderr.on("data", (chunk) => { output = (output + chunk).slice(-40000); });
  const stopped = new Promise((resolve) => server.once("exit", resolve));
  try {
    const deadline = Date.now() + 60000;
    while (!output.includes("Ready on")) {
      if (server.exitCode !== null || Date.now() > deadline) throw new Error(`${name}: Worker did not start. ${output.slice(-5000)}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await verify(async (pathname, init) => fetch(`http://127.0.0.1:8792${pathname}`, {
      ...init, redirect: "manual", signal: AbortSignal.timeout(25000),
    }));
  } catch (error) {
    console.error(output.slice(-6500).replaceAll(secret, "[synthetic-secret]"));
    throw error;
  } finally {
    server.kill("SIGTERM");
    await stopped;
  }
}

try {
  await runScenario("missing-config", {}, async (request) => {
    for (const pathname of ["/api/auth/session", "/api/auth/providers", "/api/auth/callback/google"]) {
      const response = await request(pathname);
      check(response.status >= 400 && response.status < 600, `${pathname}: missing secret fails closed`);
      check(!(await response.text()).includes('"role":"admin"'), `${pathname}: no privileged identity`);
    }
    const privacy = await request("/privacy");
    check(privacy.status === 200, "public privacy page renders in workerd");
  });
  await runScenario("secret-only", { NEXTAUTH_SECRET: secret, NEXTAUTH_URL: canonicalOrigin }, async (request) => {
    const providers = await request("/api/auth/providers");
    const providerBody = await providers.text();
    check(providers.status === 200 && Object.keys(JSON.parse(providerBody)).length === 0, `unconfigured Google provider is absent (${providers.status}: ${providerBody.slice(0, 250)})`);
    const session = await request("/api/auth/session");
    check(session.status === 200 && Object.keys(await session.json()).length === 0, "anonymous session has no identity");
    const csrf = await request("/api/auth/csrf");
    const cookies = csrf.headers.getSetCookie();
    check(csrf.status === 200 && Boolean((await csrf.json()).csrfToken), "CSRF endpoint executes actual NextAuth");
    check(cookies.some((cookie) => cookie.startsWith("__Host-next-auth.csrf-token=") && /; Secure/i.test(cookie) && /; HttpOnly/i.test(cookie) && /; SameSite=Lax/i.test(cookie)), "canonical HTTPS produces secure host-only CSRF cookie");
    const tasks = await request("/tasks");
    check(tasks.status >= 300 && tasks.status < 400 && tasks.headers.get("Location")?.includes("/api/auth/signin"), "anonymous task access redirects to existing Google sign-in route");
    for (const route of ["/api/submission-attachments/1", "/api/submissions/1/attachment"]) {
      const denied = await request(route);
      check([401, 403, 404].includes(denied.status), `${route}: anonymous download denied`);
    }
  });
  await runScenario("synthetic-provider", {
    NEXTAUTH_SECRET: secret, NEXTAUTH_URL: canonicalOrigin,
    GOOGLE_CLIENT_ID: "synthetic.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "synthetic-test-only",
  }, async (request) => {
    const providers = await request("/api/auth/providers");
    const provider = (await providers.json()).google;
    check(providers.status === 200 && provider?.callbackUrl === `${canonicalOrigin}/api/auth/callback/google`, "Google provider retains exact callback path");
    const csrf = await request("/api/auth/csrf");
    const { csrfToken } = await csrf.json();
    const cookie = csrf.headers.getSetCookie().map((entry) => entry.split(";")[0]).join("; ");
    const signout = await request("/api/auth/signout", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
      body: new URLSearchParams({ csrfToken, callbackUrl: "https://attacker.invalid/path", json: "true" }),
    });
    check((await signout.json()).url === canonicalOrigin, "external callback redirect is rejected");
    const callback = await request("/api/auth/callback/google?code=synthetic-invalid-code");
    check(callback.status >= 300 && callback.status < 400 && callback.headers.get("Location")?.includes("/api/auth/error"), "Google callback without state cannot create a session");
    check(!callback.headers.getSetCookie().some((entry) => entry.startsWith("__Secure-next-auth.session-token=") && !entry.includes("Max-Age=0")), "invalid Google callback emits no authenticated session");
  });
  console.log(`Worker auth contract checks passed: ${assertions}. Actual Google login was not attempted.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
