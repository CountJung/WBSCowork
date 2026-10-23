import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWorkspaceCommand, workspaceId, type WorkspaceCommand } from "../src/entities/project/model/workspace";

test("workspace identifiers reject coercion and unsafe integers", () => {
  for (const id of ["1", 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, null]) {
    assert.throws(() => workspaceId(id));
  }
  assert.equal(workspaceId(42), 42);
});
test("activity kind is separate from an editable real team name", () => {
  assert.deepEqual(normalizeWorkspaceCommand({kind:"create_team",activityKind:"meal",name:" 오전 식사팀 "}), {kind:"create_team",activityKind:"meal",name:"오전 식사팀"});
  for (const name of [" ", "x".repeat(256), "hidden\u0000name", "multi\nline"]) {
    assert.throws(() => normalizeWorkspaceCommand({kind:"create_team",activityKind:"meal",name}));
  }
});
test("workspace commands reject unexpected enums, missing scope and non-boolean activity", () => {
  const invalid = [
    {kind:"project_type",projectType:"admin"}, {kind:"create_team",activityKind:"new arbitrary",name:"team"},
    {kind:"team_member",teamId:1,userId:2,role:"admin",active:true},
    {kind:"project_member",userId:2,active:"false"},
    {kind:"task_team",taskId:1,taskVersion:0,teamId:2}, {kind:"task_team",taskId:1,taskVersion:1},
    {kind:"unknown"},
  ];
  for (const command of invalid) assert.throws(() => normalizeWorkspaceCommand(command as WorkspaceCommand));
});
test("canonical commands discard extra client claims and preserve explicit detach", () => {
  assert.deepEqual(normalizeWorkspaceCommand({kind:"project_member",userId:2,active:true,isAdmin:true} as WorkspaceCommand), {kind:"project_member",userId:2,active:true});
  assert.deepEqual(normalizeWorkspaceCommand({kind:"task_team",taskId:1,taskVersion:3,teamId:null}), {kind:"task_team",taskId:1,taskVersion:3,teamId:null});
});
