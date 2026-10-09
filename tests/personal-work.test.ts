import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildPersonalWorkPath, getPersonalWorkLinks, parsePersonalWorkFilters, parsePersonalWorkReturnTo,
  parsePersonalWorkSelectedTaskId, type PersonalWorkItem,
} from "../src/entities/task/model/personal-work";

describe("personal work filters", () => {
  test("defaults to incomplete assigned work and reads repeated query values deterministically", () => {
    assert.deepEqual(parsePersonalWorkFilters({}), { scope: "mine", status: "open", overdue: false, page: 1 });
    assert.deepEqual(parsePersonalWorkFilters({ scope: ["contributed", "review"], status: "changes_requested", overdue: "1", page: "2" }), { scope: "contributed", status: "changes_requested", overdue: true, page: 2 });
  });

  test("bounds pagination and rejects prototype keys, malformed numbers, and unknown filters", () => {
    assert.equal(parsePersonalWorkFilters({ page: "1001" }).page, 1000);
    for (const page of ["0", "-1", "1.5", "1e3", "Infinity", "NaN", "9007199254740992"]) assert.equal(parsePersonalWorkFilters({ page }).page, 1);
    assert.deepEqual(parsePersonalWorkFilters({ scope: "__proto__", status: "constructor", overdue: "true" }), { scope: "mine", status: "open", overdue: false, page: 1 });
    for (const id of ["0", "01", "-1", "1.2", "9007199254740992"]) assert.equal(parsePersonalWorkSelectedTaskId(id), null);
  });
});

describe("personal work return navigation", () => {
  const filters = { scope: "review", status: "review_pending", overdue: true, page: 3 } as const;

  test("roundtrips the complete filter and selected card without accepting an arbitrary redirect", () => {
    const path = buildPersonalWorkPath(filters, 42);
    assert.equal(path, "/my-work?scope=review&status=review_pending&overdue=1&page=3&taskId=42#work-42");
    assert.equal(parsePersonalWorkReturnTo(path), path);
    assert.equal(parsePersonalWorkReturnTo("/my-work"), "/my-work?scope=mine&status=open&overdue=0&page=1");
    assert.equal(parsePersonalWorkReturnTo("/my-work?taskId=42"), "/my-work?scope=mine&status=open&overdue=0&page=1&taskId=42#work-42");
  });

  test("rejects external, normalized traversal, encoded path, nested redirects, and control input", () => {
    for (const input of [
      undefined, null, 42, ["/my-work"], { toString: () => "/my-work" },
      "https://example.test/my-work", "//example.test/my-work", "/tasks", "/my-work/", "/my-work/../my-work",
      "/%6Dy-work", "/my-work\\@example.test", "/my-work\n", "/my-work?returnTo=https://example.test",
      "/my-work?unknown=1", "/my-work?scope=mine&scope=review", "/my-work?status=constructor",
      "/my-work?page=0", "/my-work?page=1001", "/my-work?overdue=true", "/my-work?taskId=0",
      "/my-work#work-42", "/my-work?taskId=42#work-43", "/my-work?taskId=42#other", `/my-work?${"a".repeat(513)}`,
    ]) assert.equal(parsePersonalWorkReturnTo(input), null, String(input));
  });

  test("task and authorized review links carry exact destinations and the same return context", () => {
    const item: PersonalWorkItem = { taskId: 42, projectId: 7, projectName: "Synthetic project", title: "Review draft", status: "review_pending", endDate: "2026-10-09", reviewTarget: { submissionId: 12, revisionNumber: 3 } };
    const links = getPersonalWorkLinks(item, filters);
    const task = new URL(links.taskHref, "https://example.test");
    const review = new URL(links.reviewHref!, "https://example.test");
    assert.equal(task.pathname, "/tasks");
    assert.equal(task.searchParams.get("projectId"), "7");
    assert.equal(task.searchParams.get("taskId"), "42");
    assert.equal(review.pathname, "/submissions/12");
    assert.equal(review.searchParams.get("revision"), "3");
    assert.equal(task.searchParams.get("returnTo"), buildPersonalWorkPath(filters, 42));
    assert.equal(review.searchParams.get("returnTo"), task.searchParams.get("returnTo"));
    assert.equal(getPersonalWorkLinks({ ...item, reviewTarget: null }, filters).reviewHref, null);
  });
});
