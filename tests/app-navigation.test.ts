import assert from "node:assert/strict";
import test from "node:test";
import { isActiveNavigationPath } from "../src/widgets/app-shell/model/navigation";

const adminLinks = ["/admin", "/admin/projects", "/admin/bugs", "/admin/logs", "/admin/settings", "/admin/users", "/admin/database"];
for (const [path, expected] of [["/admin", "/admin"], ["/admin/projects", "/admin/projects"], ["/admin/projects/17/reports", "/admin/projects"], ["/admin/bugs/trash/5", "/admin/bugs"]]) {
  test(`admin navigation has one selected item at ${path}`, () => {
    assert.deepEqual(adminLinks.filter(href => isActiveNavigationPath(path, href)), [expected]);
  });
}
test("root and path-segment boundaries do not overmatch", () => {
  assert.equal(isActiveNavigationPath("/projects", "/"), false);
  assert.equal(isActiveNavigationPath("/", "/"), true);
  assert.equal(isActiveNavigationPath("/administrator", "/admin"), false);
  assert.equal(isActiveNavigationPath("/admin/projects-old", "/admin/projects"), false);
  assert.equal(isActiveNavigationPath("/guide/member", "/guide"), true);
});
