import { verifyBugLifecycleHttp } from "./verify-bug-lifecycle-http.mjs";
import { randomUUID } from "node:crypto";
import { encode } from "next-auth/jwt";
/** Actual Worker routes/actions; no live users, real Google credentials or sessions. */
export async function verifyBugHttp({
  request,
  db,
  actorCookies,
  actionOrigin,
  secret,
  check,
}) {
  await db
    .prepare(
      "INSERT INTO users(id,email,name,role) VALUES(6,'guest2@example.test','Guest Two','guest')",
    )
    .run();
  const guest2 = `__Secure-next-auth.session-token=${await encode({ secret, token: { email: "guest2@example.test", role: "admin", isSuperuser: true }, maxAge: 3600 })}`;
  const guest = actorCookies.guest,
    admin = actorCookies.admin;
  const html = async (route, cookie) => (await request(route, cookie)).text();
  const action = (page, name) => {
    const result = [...page.matchAll(/name="(\$ACTION_ID_[^"]+)"/g)]
      .map((m) => m[1])
      .find((id) => id.endsWith(`#${name}`));
    check(Boolean(result), `bug UI exposes ${name}`);
    return result;
  };
  async function submit(route, cookie, id, fields, origin = actionOrigin) {
    const boundary = "bug-http-fixture";
    let body = "";
    for (const [name, value] of [[id, ""], ...Object.entries(fields)])
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
    body += `--${boundary}--\r\n`;
    const response = await request(route, cookie, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    await response.text();
    return response;
  }
  const anon = await request("/bugs");
  check(
    anon.status >= 300 && anon.status < 400,
    "anonymous bug list redirects to Google authentication",
  );
  const page = await html("/bugs", guest),
    create = action(page, "createBugReportAction");
  const token = randomUUID(),
    fields = {
      requestToken: token,
      title: "BUG_PRIVATE_GUEST_ONE",
      reproduction: '<script>alert("BUGXSS")</script>\nSynthetic steps',
      expected: "Expected private result",
      actual: "Actual private result",
      pagePath: "/tasks?token=DO_NOT_STORE#fragment",
      reporterId: "4",
      status: "resolved",
      role: "admin",
    };
  await submit("/bugs", guest, create, fields);
  await submit("/bugs", guest, create, fields);
  const rows = (
    await db
      .prepare("SELECT * FROM bug_reports WHERE title='BUG_PRIVATE_GUEST_ONE'")
      .all()
  ).results;
  check(
    rows.length === 1 && rows[0].reporter_id === 1 && rows[0].status === "new",
    "guest can report; forged owner/status ignored; repeated create is idempotent",
  );
  const id = rows[0].id;
  check(
    rows[0].page_path === "/tasks",
    "bug action removes query/fragment before storage",
  );
  const own = await html(`/bugs/${id}`, guest);
  check(
    own.includes("BUG_PRIVATE_GUEST_ONE") &&
      own.includes("&lt;script&gt;") &&
      !own.includes('<script>alert("BUGXSS")</script>'),
    "report text is escaped and remains readable to author",
  );
  check(
    !own.includes("관리자 검토</h") && !own.includes("#reviewBugReportAction"),
    "guest detail omits review controls and action reference",
  );
  for (const [cookie, name] of [
    [guest2, "other guest"],
    [actorCookies.member1, "other member"],
    [actorCookies.member2, "second member"],
  ]) {
    const list = await html("/bugs?q=BUG_PRIVATE_GUEST_ONE", cookie),
      detail = await request(`/bugs/${id}`, cookie),
      missing = await request("/bugs/999999", cookie);
    check(
      !list.includes("BUG_PRIVATE_GUEST_ONE</") &&
        !list.includes("Synthetic steps") &&
        list.replace(/<!--.*?-->/g, "").includes("제보 0건"),
      `${name}: search/list/count does not leak private report`,
    );
    check(
      detail.status === missing.status &&
        detail.status === 404 &&
        !(await detail.text()).includes("Actual private result"),
      `${name}: missing and forbidden details share 404`,
    );
    check(
      (await request("/admin/bugs", cookie)).status === 404,
      `${name}: admin queue denied`,
    );
  }
  const otherFields = {
    ...fields,
    requestToken: randomUUID(),
    title: "BUG_PRIVATE_GUEST_TWO",
  };
  await submit("/bugs", guest2, create, otherFields);
  check(
    !(await html("/bugs", guest)).includes("BUG_PRIVATE_GUEST_TWO"),
    "first guest does not receive second guest report",
  );
  for (const cookie of [admin, actorCookies.superuser])
    check(
      (await html("/admin/bugs", cookie)).includes("BUG_PRIVATE_GUEST_ONE") &&
        (await html("/admin/bugs", cookie)).includes("BUG_PRIVATE_GUEST_TWO"),
      "admin/superuser can review both reports",
    );
  const adminDetail = await html(`/bugs/${id}`, admin),
    review = action(adminDetail, "reviewBugReportAction"),
    note = action(own, "appendBugNoteAction");
  await submit(`/bugs/${id}`, guest, review, {
    reportId: id,
    version: 1,
    requestToken: randomUUID(),
    status: "resolved",
    priority: "high",
    resolution: "forged",
    body: "forged",
    fixCommit: "",
  });
  check(
    (
      await db
        .prepare("SELECT version FROM bug_reports WHERE id=?")
        .bind(id)
        .first()
    ).version === 1,
    "forged direct guest review action is denied",
  );
  await submit(`/bugs/${id}`, guest2, note, {
    reportId: id,
    version: 1,
    requestToken: randomUUID(),
    body: "CROSS_USER_NOTE",
  });
  check(
    !(await db
      .prepare("SELECT id FROM bug_report_events WHERE body='CROSS_USER_NOTE'")
      .first()),
    "direct cross-user addendum is denied",
  );
  const noteFields = {
    reportId: id,
    version: 1,
    requestToken: randomUUID(),
    body: "Author correction preserved in history",
  };
  await submit(`/bugs/${id}`, guest, note, noteFields);
  await submit(`/bugs/${id}`, guest, note, noteFields);
  check(
    (
      await db
        .prepare("SELECT version FROM bug_reports WHERE id=?")
        .bind(id)
        .first()
    ).version === 2,
    "repeated note request changes version only once",
  );
  await submit(`/bugs/${id}`, admin, review, {
    reportId: id,
    version: 2,
    requestToken: randomUUID(),
    status: "resolved",
    priority: "high",
    resolution: "Synthetic resolution",
    body: "Reviewed",
    fixCommit: "8fc2cc6",
  });
  const updated = await db
    .prepare("SELECT * FROM bug_reports WHERE id=?")
    .bind(id)
    .first();
  check(
    updated.status === "resolved" &&
      updated.version === 3 &&
      updated.reproduction === fields.reproduction,
    "admin resolves while original report remains immutable",
  );
  check(
    (await html(`/bugs/${id}`, guest)).includes("Synthetic resolution") &&
      (await html(`/bugs/${id}`, guest)).includes(
        "Author correction preserved in history",
      ),
    "author sees resolution and preserved history",
  );
  await submit(`/bugs/${id}`, admin, review, {
    reportId: id,
    version: 1,
    requestToken: randomUUID(),
    status: "closed",
    priority: "low",
    resolution: "stale",
    body: "stale",
    fixCommit: "",
  });
  check(
    (
      await db
        .prepare("SELECT version FROM bug_reports WHERE id=?")
        .bind(id)
        .first()
    ).version === 3,
    "stale review cannot overwrite newer state",
  );
  for (const patch of [
    { title: "x".repeat(161) },
    { pagePath: "https://evil.invalid/" },
    { requestToken: "forged" },
    { actual: "" },
  ]) {
    const before = (
      await db.prepare("SELECT COUNT(*) AS n FROM bug_reports").first()
    ).n;
    await submit("/bugs", guest, create, {
      ...fields,
      requestToken: randomUUID(),
      ...patch,
    });
    check(
      (await db.prepare("SELECT COUNT(*) AS n FROM bug_reports").first()).n ===
        before,
      "invalid/overlong bug submission rejected without record",
    );
  }
  const excessive = await submit("/bugs", guest, create, {
    ...fields,
    requestToken: randomUUID(),
    actual: "x".repeat(70000),
  });
  check(excessive.status === 413, "bug request body has 64KiB Worker cap");
  const alternateBefore = (await db.prepare("SELECT COUNT(*) AS n FROM bug_reports").first()).n;
  await submit("/tasks",guest,create,{...fields,requestToken:randomUUID(),actual:"x".repeat(50000)});
  check((await db.prepare("SELECT COUNT(*) AS n FROM bug_reports").first()).n===alternateBefore,"alternate-route bug action still enforces envelope/input limits");
  const cross = await submit(
    "/bugs",
    guest,
    create,
    { ...fields, requestToken: randomUUID(), title: "CROSS_ORIGIN_BUG" },
    "https://evil.invalid",
  );
  check(
    cross.status >= 400 &&
      !(await db
        .prepare("SELECT id FROM bug_reports WHERE title='CROSS_ORIGIN_BUG'")
        .first()),
    "cross-origin action rejected",
  );
  await db.prepare("UPDATE users SET role='guest' WHERE id=4").run();
  check(
    (await request("/admin/bugs", admin)).status === 404,
    "same admin cookie loses bug-review access immediately after local role downgrade",
  );
  await submit(`/bugs/${id}`, admin, review, {
    reportId: id,
    version: 3,
    requestToken: randomUUID(),
    status: "closed",
    priority: "low",
    resolution: "downgraded",
    body: "forbidden",
    fixCommit: "",
  });
  check(
    (
      await db
        .prepare("SELECT version FROM bug_reports WHERE id=?")
        .bind(id)
        .first()
    ).version === 3,
    "downgraded session cannot mutate review through stale form",
  );
  await db.prepare("UPDATE users SET role='admin' WHERE id=4").run();
  check(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM bug_report_events WHERE report_id=?",
        )
        .bind(id)
        .first()
    ).n === 3,
    "invalid, cross-user and stale operations add no archive events",
  );
  await verifyBugLifecycleHttp({request,db,actorCookies,actionOrigin,check,id});
}
