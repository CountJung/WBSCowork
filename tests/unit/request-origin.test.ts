import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { applyTestEnv } from "../helpers/test-env";
import { resetRuntimeEnvCache } from "../../src/shared/server/runtime-env/runtime-env.server";
import { assertBrowserOrigin, BrowserOriginError } from "../../src/shared/server/request-origin/index.server";
import { getHostedAttachments, getHostedDatabase, getHostedRequestContext, isHostedRuntime, runWithHostedBindings, type HostedBindings, type HostedRequestContextInput } from "../../src/shared/server/hosted-runtime/index.server";

const oldOrigin = "https://old.example.test", newOrigin = "https://current.example.test";
const projectId = "appgprj_synthetic123";
const context = (origin = newOrigin): HostedRequestContextInput => ({ requestUrl: origin + "/api/projects/1/teams/2/preparation", publicOrigin: newOrigin, projectId, expectedProjectId: projectId });
function request(origin: string | null = newOrigin, url = newOrigin + "/handler", extra: Record<string, string> = {}) {
  return new Request(url, { method: "PUT", headers: { ...(origin === null ? {} : { Origin: origin }), ...extra } });
}
function rejected(run: () => unknown, status: 403 | 503) {
  assert.throws(run, (error: unknown) => error instanceof BrowserOriginError && error.status === status && error.code === (status === 403 ? "INVALID_ORIGIN" : "INVALID_CONFIGURATION"));
}
beforeEach(() => { applyTestEnv(); process.env.NEXTAUTH_URL = oldOrigin; resetRuntimeEnvCache(); });

test("Native keeps explicit proxy canonical authoritative, including path/query configuration", () => {
  process.env.NEXTAUTH_URL = oldOrigin + "/api/auth?existing=value"; resetRuntimeEnvCache();
  assert.doesNotThrow(() => assertBrowserOrigin(request(oldOrigin, "http://localhost:3000/normalized")));
  rejected(() => assertBrowserOrigin(request("http://localhost:3000", "http://localhost:3000/normalized")), 403);
  rejected(() => assertBrowserOrigin(request(newOrigin, newOrigin + "/handler", { Host: "current.example.test", "X-Forwarded-Host": "current.example.test" })), 403);
});

test("Native unconfigured fallback and malformed canonical remain fail-closed", () => {
  delete process.env.NEXTAUTH_URL; resetRuntimeEnvCache();
  assert.doesNotThrow(() => assertBrowserOrigin(request()));
  rejected(() => assertBrowserOrigin(request(null)), 403);
  for (const url of ["not-a-url", "ftp://old.example.test", "https://user:pass@old.example.test"]) {
    process.env.NEXTAUTH_URL = url; resetRuntimeEnvCache(); rejected(() => assertBrowserOrigin(request()), 503);
  }
});

test("Hosted accepts each explicitly trusted alias only from its own browser origin", () => {
  for (const origin of [newOrigin, oldOrigin]) runWithHostedBindings({}, () => {
    assert.doesNotThrow(() => assertBrowserOrigin(request(origin)));
    rejected(() => assertBrowserOrigin(request(origin === newOrigin ? oldOrigin : newOrigin)), 403);
    for (const foreign of [null, "null", "https://other.example.test", newOrigin + "/", newOrigin + ":444"]) rejected(() => assertBrowserOrigin(request(foreign)), 403);
  }, context(origin));
});

test("Hosted ignores normalized handler URL and spoofed Host/forwarded/site headers", () => {
  runWithHostedBindings({}, () => {
    assert.doesNotThrow(() => assertBrowserOrigin(request(newOrigin, "http://localhost:3000/normalized", { Host: "attacker.example.test", "X-Forwarded-Host": "attacker.example.test" })));
    rejected(() => assertBrowserOrigin(request("https://attacker.example.test", undefined, { Host: "attacker.example.test", "X-Forwarded-Host": "attacker.example.test", "Sec-Fetch-Site": "same-origin" })), 403);
  }, context());
  runWithHostedBindings({}, () => rejected(() => assertBrowserOrigin(request("https://attacker.example.test", undefined, { Host: "attacker.example.test", "X-Forwarded-Host": "current.example.test" })), 403), context("https://attacker.example.test"));
});

test("Hosted missing or invalid context never falls back to Native canonical", () => {
  runWithHostedBindings({}, () => rejected(() => assertBrowserOrigin(request(oldOrigin)), 503));
  const invalid: Partial<HostedRequestContextInput>[] = [
    { expectedProjectId: "appgprj_other" }, { projectId: projectId + "\n", expectedProjectId: projectId + "\n" },
    { publicOrigin: newOrigin + "/" }, { publicOrigin: newOrigin + "/path" }, { publicOrigin: newOrigin + "?query" }, { publicOrigin: newOrigin + "#hash" },
    { publicOrigin: "https://user:pass@current.example.test" }, { publicOrigin: "http://current.example.test" }, { publicOrigin: "ftp://current.example.test" },
    { publicOrigin: "not-a-url" }, { requestUrl: "https://user:pass@current.example.test/path" }, { requestUrl: "file:///path" },
  ];
  for (const patch of invalid) runWithHostedBindings({}, () => { assert.equal(getHostedRequestContext(), undefined); rejected(() => assertBrowserOrigin(request(oldOrigin)), 503); }, { ...context(), ...patch });
});

test("Hosted loopback HTTP is restricted to synthetic local origin and absent canonical adds no alias", () => {
  delete process.env.NEXTAUTH_URL; resetRuntimeEnvCache();
  for (const local of ["http://localhost:3456", "http://127.0.0.1:3456", "http://[::1]:3456"]) runWithHostedBindings({}, () => assert.doesNotThrow(() => assertBrowserOrigin(request(local))), { ...context(local), publicOrigin: local });
  runWithHostedBindings({}, () => rejected(() => assertBrowserOrigin(request(oldOrigin)), 403), context(oldOrigin));
  process.env.NEXTAUTH_URL = "file:///invalid"; resetRuntimeEnvCache();
  runWithHostedBindings({}, () => rejected(() => assertBrowserOrigin(request()), 503), context());
});

test("Context is copied/frozen and does not mutate the existing binding object", () => {
  const db = {} as NonNullable<HostedBindings["DB"]>, bucket = {} as NonNullable<HostedBindings["ATTACHMENTS"]>;
  const bindings = Object.freeze({ DB: db, ATTACHMENTS: bucket }), input = context();
  runWithHostedBindings(bindings, () => {
    input.requestUrl = "https://attacker.example.test/"; input.publicOrigin = "https://attacker.example.test";
    assert.equal(getHostedDatabase(), db); assert.equal(getHostedAttachments(), bucket);
    const saved = getHostedRequestContext()!; assert.equal(Object.isFrozen(saved), true); assert.equal(saved.ingressOrigin, newOrigin);
    assert.deepEqual(Object.keys(saved).sort(), ["ingressOrigin", "projectId", "publicOrigin"]);
    assert.doesNotThrow(() => assertBrowserOrigin(request()));
  }, input);
  assert.equal(getHostedRequestContext(), undefined); assert.equal(isHostedRuntime(), false);
  runWithHostedBindings(bindings, () => { assert.equal(getHostedDatabase(), db); assert.equal(getHostedAttachments(), bucket); assert.equal(getHostedRequestContext(), undefined); });
});

test("Concurrent and nested async requests preserve their own ingress and restore outer scope", async () => {
  const origins = [newOrigin, oldOrigin];
  await Promise.all(origins.map(origin => runWithHostedBindings({}, async () => {
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(getHostedRequestContext()?.ingressOrigin, origin); assertBrowserOrigin(request(origin));
    await runWithHostedBindings({}, async () => { await Promise.resolve(); assert.equal(getHostedRequestContext(), undefined); rejected(() => assertBrowserOrigin(request(origin)), 503); });
    assert.equal(getHostedRequestContext()?.ingressOrigin, origin); assertBrowserOrigin(request(origin));
  }, context(origin))));
  assert.equal(getHostedRequestContext(), undefined);
});
