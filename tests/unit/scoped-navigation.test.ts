import assert from "node:assert/strict";
import { test } from "node:test";
import { isNavigationScopeActive } from "../../src/shared/ui/scoped-navigation";

test("project navigation stays active for its exact root and nested project tools", () => {
  for (const pathname of ["/projects/6", "/projects/6/activities", "/projects/6/activities/61", "/projects/6/media", "/projects/6/settings"]) {
    assert.equal(isNavigationScopeActive(pathname, "/projects/6"), true, pathname);
  }
});

test("numeric project prefixes never activate a different project's menu", () => {
  for (const pathname of ["/projects/60", "/projects/60/activities", "/projects/61/media", "/projects/600/settings"]) {
    assert.equal(isNavigationScopeActive(pathname, "/projects/6"), false, pathname);
  }
});

test("leaving a project clears the scope on common and protected site routes", () => {
  for (const pathname of ["/", "/projects", "/privacy", "/guide", "/tasks", "/admin/projects/6/reports", "/projects/7"]) {
    assert.equal(isNavigationScopeActive(pathname, "/projects/6"), false, pathname);
  }
});

test("returning to another project cannot reuse the previous project's registered links", () => {
  assert.equal(isNavigationScopeActive("/projects/60", "/projects/6"), false);
  assert.equal(isNavigationScopeActive("/projects/60", "/projects/60"), true);
  assert.equal(isNavigationScopeActive("/projects/6/activities", "/projects/60"), false);
  assert.equal(isNavigationScopeActive("/projects/6/activities", "/projects/6"), true);
});
