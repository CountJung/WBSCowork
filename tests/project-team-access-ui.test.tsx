/** Real component SSR contracts only; authorization is exercised by isolated D1/Worker tests. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ProjectMediaGallery from "../src/widgets/project-media/ui/ProjectMediaGallery";
import ProjectWorkspaceAdmin from "../src/widgets/project-workspace/ui/ProjectWorkspaceAdmin";
import type { ProjectWorkspace } from "../src/entities/project";
import { activityKinds } from "../src/shared/config/activity-kinds";

test("empty media directory distinguishes manager setup from upload permission", () => {
  const manager = renderToStaticMarkup(<ProjectMediaGallery projectId={1001} canManageTeams teams={[]} />);
  assert.match(manager, /등록된 미디어팀이 없어 업로드할 위치가 없습니다/);
  assert.match(manager, /관리자·슈퍼관리자는 팀장으로 배정하지 않아도 업로드할 수 있습니다/);
  assert.match(manager, /href="\/admin\/projects#project-1001"/);
  assert.doesNotMatch(manager, /type="file"/);
  const member = renderToStaticMarkup(<ProjectMediaGallery projectId={1001} teams={[]} />);
  assert.match(member, /해당 프로젝트 관리자에게 미디어팀 구성을 요청하세요/);
  assert.doesNotMatch(member, /href="\/admin\/projects/);
  assert.doesNotMatch(member, /type="file"/);
});

test("server upload capability exposes the form for leaders or managers without a client role check", () => {
  for (const canManageTeams of [false, true]) {
    const html = renderToStaticMarkup(<ProjectMediaGallery projectId={1001} canManageTeams={canManageTeams} teams={[{ id: 1101, name: "Synthetic media", canUpload: true }]} />);
    assert.match(html, /사진·영상 올리기/);
    assert.match(html, /type="file"/);
    assert.match(html, /미디어 저장/);
    assert.doesNotMatch(html, /현재 이 팀은 읽기 전용입니다/);
  }
});

test("read-only capability never exposes upload controls even with a management navigation hint", () => {
  for (const canManageTeams of [false, true]) {
    const html = renderToStaticMarkup(<ProjectMediaGallery projectId={1001} canManageTeams={canManageTeams} teams={[{ id: 1101, name: "Synthetic media", canUpload: false }]} />);
    assert.match(html, /현재 이 팀은 읽기 전용입니다/);
    assert.doesNotMatch(html, /type="file"/);
    assert.doesNotMatch(html, /미디어 저장/);
  }
});

test("project management links media to the gallery and every preparation kind to its own editor", () => {
  const workspace: ProjectWorkspace = {
    projectId: 1001, projectType: "volunteering", version: 0, members: [], teamMembers: [],
    teams: activityKinds.map((kind, index) => ({ id: 1101 + index, name: `Synthetic ${kind}`, activityKind: kind, leaderUserId: null })),
  };
  const html = renderToStaticMarkup(<ProjectWorkspaceAdmin workspace={workspace} users={[]} accessPreview={null} action={async () => { throw new Error("SSR must not submit"); }} />);
  for (const team of workspace.teams) {
    const preparation = `/projects/1001/teams/${team.id}/preparation`;
    if (team.activityKind === "media") {
      assert.ok(html.includes(`href="/projects/1001/media?teamId=${team.id}"`));
      assert.ok(!html.includes(`href="${preparation}"`));
      assert.match(html, /사진첩·영상 관리/);
    } else assert.ok(html.includes(`href="${preparation}"`));
  }
});
