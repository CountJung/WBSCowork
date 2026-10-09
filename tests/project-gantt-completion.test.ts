import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeTaskCompletion } from "../src/widgets/project-gantt/model/task-completion";

test("only done leaves count as complete, independent of planned dates", () => {
  const statuses = ["planned", "in_progress", "blocked", "review_pending", "changes_requested", "done"];
  const tasks = statuses.flatMap((status, index) => [
    { id: index * 2, parentId: null, status, startDate: "2000-01-01", endDate: "2000-01-02" },
    { id: index * 2 + 1, parentId: null, status, startDate: "2100-01-01", endDate: "2100-01-01" },
  ]);
  const summary = summarizeTaskCompletion(tasks);

  for (const task of tasks) {
    assert.deepEqual(summary.byTaskId.get(task.id), {
      isContainer: false,
      completedLeafCount: task.status === "done" ? 1 : 0,
      leafCount: 1,
      percent: task.status === "done" ? 100 : 0,
    });
  }

  assert.equal(summary.leafCount, 12);
  assert.equal(summary.completedLeafCount, 2);
  assert.equal(summary.percent, 17);
});

test("nested containers aggregate leaves without counting container status or averaging groups", () => {
  const summary = summarizeTaskCompletion([
    { id: 0, parentId: null, status: "done" },
    { id: 1, parentId: 0, status: "done" },
    { id: 2, parentId: 0, status: "planned" },
    { id: 3, parentId: 2, status: "done" },
    { id: 4, parentId: 2, status: "blocked" },
    { id: 5, parentId: 2, status: "in_progress" },
    { id: 6, parentId: null, status: "done" },
  ]);

  assert.deepEqual(summary.byTaskId.get(0), {
    isContainer: true, completedLeafCount: 2, leafCount: 4, percent: 50,
  });
  assert.deepEqual(summary.byTaskId.get(2), {
    isContainer: true, completedLeafCount: 1, leafCount: 3, percent: 33,
  });
  assert.equal(summary.leafCount, 5);
  assert.equal(summary.completedLeafCount, 3);
  assert.equal(summary.percent, 60);
});

test("a done container with unfinished leaves stays incomplete", () => {
  const summary = summarizeTaskCompletion([
    { id: 1, parentId: null, status: "done" },
    { id: 2, parentId: 1, status: "blocked" },
  ]);

  assert.deepEqual(summary.byTaskId.get(1), {
    isContainer: true, completedLeafCount: 0, leafCount: 1, percent: 0,
  });
  assert.equal(summary.completedLeafCount, 0);
  assert.equal(summary.leafCount, 1);
});

test("status and remaining summaries count only leaves across nested containers", () => {
  const statuses = ["planned", "in_progress", "blocked", "review_pending", "changes_requested", "done"];
  const summary = summarizeTaskCompletion([
    { id: 0, parentId: null, status: "done" },
    { id: 1, parentId: 0, status: "blocked" },
    ...statuses.map((status, index) => ({ id: index + 2, parentId: 1, status })),
    { id: 8, parentId: 0, status: "done" },
  ]);

  assert.deepEqual(summary.statusCounts, new Map([
    ["planned", 1], ["in_progress", 1], ["blocked", 1],
    ["review_pending", 1], ["changes_requested", 1], ["done", 2],
  ]));
  assert.equal(summary.leafCount, 7);
  assert.equal(summary.completedLeafCount, 2);
  assert.equal(summary.remainingLeafCount, 5);
  assert.equal([...summary.statusCounts.values()].reduce((total, count) => total + count, 0), summary.leafCount);
});

test("rounding never displays 100 percent while any leaf is unfinished", () => {
  const summary = summarizeTaskCompletion([
    { id: 0, parentId: null, status: "done" },
    ...Array.from({ length: 200 }, (_, index) => ({
      id: index + 1, parentId: 0, status: index === 0 ? "blocked" : "done",
    })),
  ]);

  assert.equal(summary.completedLeafCount, 199);
  assert.equal(summary.leafCount, 200);
  assert.equal(summary.percent, 99);
  assert.equal(summary.byTaskId.get(0)?.percent, 99);
});

test("completion is order independent and includes leaves with missing parents", () => {
  const tasks = [
    { id: 1, parentId: 99, status: "done" },
    { id: 2, parentId: null, status: "planned" },
    { id: 3, parentId: 2, status: "done" },
  ];

  assert.deepEqual(summarizeTaskCompletion(tasks), summarizeTaskCompletion([...tasks].reverse()));
  assert.equal(summarizeTaskCompletion(tasks).percent, 100);
});

test("an empty project has zero completion without non-finite percentages", () => {
  assert.deepEqual(summarizeTaskCompletion([]), {
    byTaskId: new Map(), completedLeafCount: 0, leafCount: 0,
    remainingLeafCount: 0, statusCounts: new Map(), percent: 0,
  });
});

test("malformed hierarchy cycles terminate without inventing completed leaves", () => {
  const cycle = [
    { id: 1, parentId: 2, status: "done" },
    { id: 2, parentId: 1, status: "done" },
  ];
  const emptyCycle = summarizeTaskCompletion(cycle);
  assert.equal(emptyCycle.leafCount, 0);
  assert.equal(emptyCycle.percent, 0);
  assert.equal(emptyCycle.byTaskId.get(1)?.percent, 0);

  const cycleWithLeaf = summarizeTaskCompletion([...cycle, { id: 3, parentId: 2, status: "done" }]);
  assert.equal(cycleWithLeaf.leafCount, 1);
  assert.equal(cycleWithLeaf.byTaskId.get(1)?.leafCount, 1);
  assert.equal(cycleWithLeaf.byTaskId.get(2)?.leafCount, 1);
});
