import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("ordered preload links auth-dependent test modules before any SQL", () => {
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      new URL("./helpers/preload.mjs", import.meta.url).href,
      "--experimental-test-module-mocks",
      "--input-type=module",
      "--eval",
      'await import("./src/features/bug-report-manage/index.server.ts"); console.log("ordered-preload-ok")',
    ],
    { cwd: process.cwd(), encoding: "utf8", timeout: 30000 },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /ordered-preload-ok/);
});

for (const configured of [true, false]) {
  test(`real Google provider initializes with Node ESM (configured=${configured})`, () => {
    const child = spawnSync(
      process.execPath,
      [
        "--import",
        new URL("./helpers/preload.mjs", import.meta.url).href,
        "--experimental-test-module-mocks",
        "--input-type=module",
        "--eval",
        `
          import assert from "node:assert/strict";
          process.env.GOOGLE_CLIENT_ID = ${JSON.stringify(configured ? "synthetic-google-client-id" : "")};
          process.env.GOOGLE_CLIENT_SECRET = ${JSON.stringify(configured ? "synthetic-google-client-secret" : "")};
          const { authOptions, getAuthSession } = await import("./src/entities/user/api/auth.server.ts");
          assert.equal(authOptions.providers.length, ${configured ? 1 : 0});
          ${configured ? `
            const provider = authOptions.providers[0];
            assert.equal(provider.id, "google");
            assert.equal(provider.type, "oauth");
            assert.deepEqual(provider.checks, ["pkce", "state"]);
            assert.equal(provider.idToken, true);
          ` : ""}
          assert.equal(await getAuthSession(), null);
          console.log("real-google-provider-ok");
        `,
      ],
      { cwd: process.cwd(), encoding: "utf8", timeout: 30000 },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /real-google-provider-ok/);
  });
}
