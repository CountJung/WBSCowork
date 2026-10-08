import { randomUUID } from "node:crypto";
/** Small ordinary requests only. All data and session keys are isolated synthetic fixtures. */
export async function verifyBugLifecycleHttp({
  request,
  db,
  actorCookies,
  actionOrigin,
  check,
  id,
}) {
  const admin = actorCookies.admin,
    su = actorCookies.superuser,
    guest = actorCookies.guest;
  const row = () =>
    db.prepare("SELECT * FROM bug_reports WHERE id=?").bind(id).first();
  const html = async (route, cookie) => (await request(route, cookie)).text();
  const findAction = (page, name) =>
    [...page.matchAll(/name="(\$ACTION_ID_[^"]+)"/g)]
      .map((m) => m[1])
      .find((id) => id.endsWith(`#${name}`));
  async function submit(route, cookie, action, fields, origin = actionOrigin) {
    const boundary = "bug-lifecycle-http";
    let body = "";
    for (const [name, value] of [[action, ""], ...Object.entries(fields)])
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
    const response = await request(route, cookie, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body + `--${boundary}--\r\n`,
    });
    await response.text();
    return response;
  }
  const active = `/bugs/${id}`,
    trash = `/admin/bugs/trash/${id}`;
  const lifecycle = findAction(
    await html(active, admin),
    "changeBugLifecycleAction",
  );
  check(
    Boolean(lifecycle),
    "resolved admin UI exposes verification lifecycle form",
  );
  const fields = () => ({
    reportId: id,
    version: 3,
    requestToken: randomUUID(),
    lifecycleAction: "verify",
    body: "Synthetic verification",
    canPurge: "true",
    role: "superuser",
  });
  for (const [name, cookie] of [
    ["guest", guest],
    ["member", actorCookies.member1],
    ["anonymous", undefined],
  ]) {
    await submit(active, cookie, lifecycle, fields());
    check(
      (await row()).version === 3,
      `${name}: direct lifecycle action denied despite forged privilege fields`,
    );
  }
  await submit(active, admin, lifecycle, {
    ...fields(),
    lifecycleAction: "purge",
  });
  check((await row()).version === 3, "invalid lifecycle operation rejected");
  await submit(active, admin, lifecycle, {
    ...fields(),
    body: "x".repeat(4001),
  });
  check((await row()).version === 3, "overlong verification note rejected");
  await submit(
    active,
    admin,
    lifecycle,
    fields(),
    "https://cross-origin.invalid",
  );
  check((await row()).version === 3, "cross-origin verification rejected");
  const verifyFields = fields();
  await submit(active, admin, lifecycle, verifyFields);
  await submit(active, admin, lifecycle, verifyFields);
  check(
    (await row()).version === 4 && Boolean((await row()).verified_at),
    "normal admin verifies once with idempotent repeat",
  );
  check(
    (await html(active, guest)).includes("Synthetic verification"),
    "author sees preserved verification result",
  );
  await submit(active, admin, lifecycle, {
    ...fields(),
    version: 4,
    lifecycleAction: "trash",
    body: "Synthetic archive",
  });
  check(
    (await row()).version === 5 && Boolean((await row()).trashed_at),
    "normal admin moves verified report to recoverable trash",
  );
  for (const [name, cookie] of [
    ["guest", guest],
    ["member1", actorCookies.member1],
    ["member2", actorCookies.member2],
  ]) {
    check(
      (await request(active, cookie)).status === 404 &&
        (await request(trash, cookie)).status === 404 &&
        (await request("/admin/bugs/trash", cookie)).status === 404,
      `${name}: active detail and all trash routes deny access`,
    );
    const list = await html("/bugs?q=BUG_PRIVATE_GUEST_ONE", cookie);
    check(
      !list.includes("Actual private result") &&
        list.replace(/<!--.*?-->/g, "").includes("제보 0건"),
      `${name}: trash cannot leak in search/count/SSR`,
    );
  }
  check(
    (await request("/admin/bugs/trash")).status >= 300,
    "anonymous trash route requires login",
  );
  check(
    !(await html("/admin/bugs?q=BUG_PRIVATE_GUEST_ONE", admin)).includes(
      "BUG_PRIVATE_GUEST_ONE</",
    ),
    "admin active queue excludes trash",
  );
  const adminTrash = await html(trash, admin),
    suTrash = await html(trash, su),
    purge = findAction(suTrash, "purgeBugReportAction");
  check(
    adminTrash.includes("Actual private result") &&
      !findAction(adminTrash, "purgeBugReportAction"),
    "normal admin can inspect/restore trash but receives no purge action form",
  );
  check(
    Boolean(purge) && suTrash.includes("앱에서 복구할 수 없습니다"),
    "superuser receives explicit permanent-deletion warning and form",
  );
  const formField = (name) =>
    suTrash.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`))?.[1];
  const purgeFields = {
    reportId: id,
    version: 5,
    requestToken: randomUUID(),
    fingerprint: formField("fingerprint"),
    eventCount: formField("eventCount"),
    lastEventId: formField("lastEventId"),
    confirmationTitle: (await row()).title,
  };
  for (const [name, cookie] of [
    ["admin", admin],
    ["guest", guest],
    ["anonymous", undefined],
  ]) {
    await submit(trash, cookie, purge, purgeFields);
    check(Boolean(await row()), `${name}: direct permanent purge denied`);
  }
  await submit(trash, su, purge, {
    ...purgeFields,
    confirmationTitle: "not exact",
  });
  check(Boolean(await row()), "superuser purge rejects incorrect typed title");
  await submit(trash, su, purge, {
    ...purgeFields,
    fingerprint: "0".repeat(64),
  });
  check(
    Boolean(await row()),
    "superuser purge rejects forged content fingerprint",
  );
  await submit(trash, su, purge, purgeFields, "https://cross-origin.invalid");
  check(Boolean(await row()), "cross-origin permanent purge rejected");
  await db.prepare("UPDATE users SET role='guest' WHERE id=4").run();
  await submit(trash, admin, lifecycle, {
    ...fields(),
    version: 5,
    lifecycleAction: "restore",
    body: "downgraded",
  });
  check(
    (await row()).version === 5,
    "same admin cookie cannot restore after role downgrade",
  );
  await db.prepare("UPDATE users SET role='admin' WHERE id=4").run();
  await submit(trash, admin, lifecycle, {
    ...fields(),
    version: 5,
    lifecycleAction: "restore",
    body: "Synthetic restore",
  });
  check(
    (await row()).version === 6 &&
      (await row()).trashed_at === null &&
      (await html(active, guest)).includes("Synthetic restore"),
    "admin restore returns unchanged original and preserved history to author",
  );
  await submit(trash, su, purge, purgeFields);
  check(
    (await row()).version === 6,
    "pre-restore purge confirmation cannot delete restored record",
  );
  await submit(active, admin, lifecycle, {
    ...fields(),
    version: 6,
    lifecycleAction: "trash",
    body: "Synthetic final archive",
  });
  const fresh = await html(trash, su),
    freshField = (name) =>
      fresh.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`))?.[1];
  const finalFields = {
    ...purgeFields,
    version: 7,
    requestToken: randomUUID(),
    fingerprint: freshField("fingerprint"),
    eventCount: freshField("eventCount"),
    lastEventId: freshField("lastEventId"),
  };
  await submit(trash, su, purge, finalFields);
  await submit(trash, su, purge, finalFields);
  check(
    (await row()) === null &&
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS n FROM bug_report_events WHERE report_id=?",
          )
          .bind(id)
          .first()
      ).n === 0,
    "actual Worker SU action atomically purges synthetic report and history",
  );
  check(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM bug_report_purge_receipts WHERE report_id=?",
        )
        .bind(id)
        .first()
    ).n === 1,
    "Worker repeated purge retains exactly one receipt",
  );
  check(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM bug_reports WHERE title='BUG_PRIVATE_GUEST_TWO'",
        )
        .first()
    ).n === 1,
    "exact-target purge preserves other author's report",
  );
}
