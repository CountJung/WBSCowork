/** Production Worker + isolated synthetic D1. Never connects to an account or hosted Site. */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { Miniflare, Log, LogLevel } from "miniflare";
import { encode } from "next-auth/jwt";

async function moduleFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await moduleFiles(file));
    else if (entry.name.endsWith(".js")) files.push(file);
  }
  return files;
}

const origin = "https://layout.example.test";
const secret = randomBytes(32).toString("hex");
const entry = path.resolve("dist/server/index.js");
const mf = new Miniflare({
  cf: false,
  name: "wbs-layout-test",
  modules: [entry, ...(await moduleFiles(path.resolve("dist/server"))).filter(file => file !== entry)]
    .map(file => ({ type: "ESModule", path: file })),
  modulesRoot: path.resolve("dist/server"),
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: { DB: "wbs-layout-test" },
  r2Buckets: { ATTACHMENTS: "wbs-layout-files" },
  assets: { directory: path.resolve("dist/client"), binding: "ASSETS", routerConfig: { invoke_user_worker_ahead_of_assets: false, has_user_worker: true } },
  bindings: {
    NEXT_PUBLIC_APP_NAME: "WBSCowork",
    NEXTAUTH_SECRET: secret,
    NEXTAUTH_URL: origin,
    GOOGLE_CLIENT_ID: "synthetic.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "synthetic-not-a-credential",
    SUPERUSER_EMAIL: "superuser@example.test",
  },
  log: new Log(LogLevel.ERROR),
});
// Keep the request URL's HTTPS scheme consistent for NextAuth's cookie choice.
// The browser talks only to this loopback gateway; production remains untouched.
const server = createServer(async (incoming, outgoing) => {
  try {
    if (!["GET", "HEAD"].includes(incoming.method)) {
      outgoing.writeHead(405); outgoing.end(); return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (value && !["host", "connection"].includes(key)) headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    const token = incoming.headers.cookie?.match(/(?:^|;\s*)next-auth.session-token=([^;]+)/)?.[1];
    if (token) headers.set("Cookie", `__Secure-next-auth.session-token=${token}`);
    const response = await mf.dispatchFetch(origin + incoming.url, { headers, method: incoming.method, redirect: "manual" });
    const responseHeaders = {};
    for (const [key, value] of response.headers) {
      if (!["set-cookie", "content-length", "content-encoding", "transfer-encoding"].includes(key)) responseHeaders[key] = value;
    }
    outgoing.writeHead(response.status, responseHeaders);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.writeHead(500); outgoing.end("Synthetic gateway error");
    console.error(error.message);
  }
});

try {
  const db = await mf.getD1Database("DB");
  for (const file of (await readdir("drizzle")).filter(file => file.endsWith(".sql")).sort()) {
    for (const sql of (await readFile(`drizzle/${file}`, "utf8")).split("--> statement-breakpoint").map(sql => sql.trim()).filter(Boolean)) {
      await db.prepare(sql).run();
    }
  }
  const cookies = {};
  for (const [index, actor] of ["guest", "member", "admin", "superuser", "long"].entries()) {
    const name = actor === "long" ? "아주긴사용자이름".repeat(12) : `합성 ${actor}`;
    const email = actor === "long" ? "long@example.test" : `${actor}@example.test`;
    const role = ["admin", "superuser", "long"].includes(actor) ? "admin" : actor;
    await db.prepare("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)").bind(index + 1, email, name, role).run();
    const token = await encode({ secret, token: { email, name }, maxAge: 3600 });
    // dispatchFetch uses HTTPS; the local browser uses HTTP loopback. Supply only
    // synthetic tokens under each transport's standard NextAuth cookie name.
    cookies[actor] = `__Secure-next-auth.session-token=${token}; next-auth.session-token=${token}`;
  }
  // Capture the screenshot's no-project state before creating the populated case.
  const session = await mf.dispatchFetch(origin + "/api/auth/session", { headers: { Cookie: cookies.superuser } });
  const identity = await session.json();
  if (!identity.user?.isSuperuser) throw new Error("Synthetic superuser session was not established");
  const empty = await mf.dispatchFetch(origin + "/tasks", { headers: { Cookie: cookies.superuser } });
  if (empty.status !== 200) throw new Error(`Empty workspace HTTP ${empty.status}`);
  const emptyHtml = await empty.text();
  await db.prepare("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'합성 레이아웃 검증 프로젝트','2026-01-01','2026-12-31')").run();
  await db.prepare("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(1,1,'합성 업무','2026-01-01','2026-12-31')").run();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = spawn("python3", ["scripts/test-ui-layout.py", ...process.argv.slice(2)], { stdio: ["pipe", "inherit", "inherit"] });
  browser.stdin.end(JSON.stringify({ url: `http://127.0.0.1:${server.address().port}`, cookies, emptyHtml }));
  const code = await new Promise((resolve, reject) => {
    browser.once("error", reject);
    browser.once("exit", resolve);
  });
  process.exitCode = code ?? 1;
} finally {
  await new Promise(resolve => server.close(resolve));
  await mf.dispose();
}
