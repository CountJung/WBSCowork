import "./helpers/bootstrap";
import { test } from "node:test";
import assert from "node:assert/strict";
import { clearSession, setSession } from "./helpers/bootstrap";
import { sessionFor, testActors } from "./helpers/session";
import { formDataFrom, runAction } from "./helpers/redirect";
import {
  createProjectAdminAction,
  updateProjectAdminAction,
  deleteProjectAdminAction,
} from "@/app/admin/projects/actions";

const actions = { create: createProjectAdminAction, update: updateProjectAdminAction, delete: deleteProjectAdminAction };
for (const actor of ["anonymous", "guest", "member1"] as const) {
  for (const [operation, action] of Object.entries(actions)) {
    test(`canonical project ${operation} rejects ${actor} before repository access`, async () => {
      if (actor === "anonymous") clearSession(); else setSession(sessionFor(testActors[actor]));
      const result = await runAction(() => action(formDataFrom({ projectId: 999, name: "fixture", startDate: "2026-01-01", endDate: "2026-01-02", confirmDestruction: "yes" })));
      assert.equal(result.path, actor === "anonymous" ? "/api/auth/signin" : "/admin/projects");
      if (actor !== "anonymous") {
        assert.equal(result.status, "error");
        assert.match(result.message ?? "", /관리자 이상/);
      }
    });
  }
}
for (const actor of ["admin", "superuser"] as const) {
  test(`canonical project deletion requires explicit confirmation even for ${actor}`, async () => {
    setSession(sessionFor(testActors[actor]));
    const result = await runAction(() => deleteProjectAdminAction(formDataFrom({ projectId: 999 })));
    assert.equal(result.status, "error");
    assert.match(result.message ?? "", /동의해야/);
  });
}
