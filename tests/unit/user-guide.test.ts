import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  getGuideFeature, getGuideRole, guideFeatures, guideGettingStarted, guideGlossary, guideRoles,
  type GuideFeatureId, type GuideRoleId,
} from "../../src/entities/user-guide";

const roleIds: GuideRoleId[] = ["superuser", "project_admin", "team_leader", "member", "guest"];
const featureIds: GuideFeatureId[] = ["projects", "tasks", "completion", "submissions", "review", "attachments", "preparation", "reports", "personal", "bugs", "administration"];
const screenshotIds = new Set(["project-overview", "team-directory", "meal-summary", "meal-edit", "facility-preparation", "care-preparation", "recreation-preparation", "report-preview", "attachment-preview", "task-detail", "admin-project"]);

test("guide has distinct role and feature pages with complete references", () => {
  assert.deepEqual(guideRoles.map(role => role.id), roleIds);
  assert.deepEqual(guideFeatures.map(feature => feature.id), featureIds);
  for (const role of guideRoles) {
    assert.equal(new Set(role.featureIds).size, role.featureIds.length);
    for (const id of role.featureIds) assert(guideFeatures.some(feature => feature.id === id), `${role.id}: ${id}`);
  }
  for (const feature of guideFeatures) {
    assert.equal(new Set(feature.roles).size, feature.roles.length);
    assert.equal(new Set(feature.related).size, feature.related.length);
    for (const id of feature.roles) assert(guideRoles.some(role => role.id === id), id);
    for (const id of feature.related) assert(id !== feature.id && guideFeatures.some(related => related.id === id), id);
    for (const id of feature.screenshotIds) assert(screenshotIds.has(id), id);
  }
});

test("role-feature routing permits only the explicit two-sided intersection", () => {
  let validPages = 0;
  for (const role of guideRoles) for (const feature of guideFeatures) {
    const listed = role.featureIds.includes(feature.id), allowed = feature.roles.includes(role.id);
    assert.equal(listed, allowed, `${role.id}/${feature.id}`);
    const result = getGuideFeature(role.id, feature.id);
    assert.equal(result, listed && allowed ? feature : undefined);
    if (result) validPages++;
  }
  assert.equal(validPages, 45);
});

test("unknown role and feature segments cannot resolve prototype names or near matches", () => {
  for (const invalid of ["", "admin", "SUPERUSER", "superuser ", " team_leader", "toString", "constructor", "__proto__", "../superuser", "%73uperuser"]) {
    assert.equal(getGuideRole(invalid), undefined, invalid);
    assert.equal(getGuideFeature(invalid, "projects"), undefined, invalid);
  }
  for (const invalid of ["", "Projects", "tasks ", "toString", "constructor", "__proto__", "../tasks", "tasks?role=superuser"]) assert.equal(getGuideFeature("superuser", invalid), undefined, invalid);
});

test("guest work restrictions retain the separate bug and notification guidance", () => {
  for (const feature of ["completion", "review", "preparation", "reports", "administration"]) assert.equal(getGuideFeature("guest", feature), undefined);
  for (const feature of ["projects", "tasks", "submissions", "attachments", "personal", "bugs"]) assert(getGuideFeature("guest", feature));
  const guest = getGuideRole("guest")!;
  assert(guest.cannotDo.some(value => /업무·제출물·댓글/.test(value)));
  assert(guest.canDo.some(value => /버그.*스크린샷/.test(value)));
  assert(guest.canDo.some(value => /알림/.test(value)));
  assert(guest.canDo.some(value => /본인.*과거 비공개/.test(value)));
});

test("project administrator and contextual team leader do not gain global menus", () => {
  assert(getGuideFeature("project_admin", "reports"));
  assert.equal(getGuideFeature("project_admin", "administration"), undefined);
  assert.equal(getGuideFeature("team_leader", "reports"), undefined);
  assert.equal(getGuideFeature("member", "reports"), undefined);
  assert(getGuideFeature("superuser", "administration"));
  for (const feature of guideFeatures.filter(feature => feature.screenshotIds.includes("admin-project"))) assert.deepEqual(feature.roles, ["superuser"]);
  assert.match(getGuideRole("project_admin")!.meaning, /해당 프로젝트.*소속/);
  assert.match(getGuideRole("team_leader")!.meaning, /팀 안의 역할/);
});

test("beginner guidance includes steps, examples, outcome checks and recovery paths", () => {
  assert(guideGettingStarted.length >= 3);
  for (const role of guideRoles) {
    assert(role.label.trim() && role.subtitle.trim() && role.meaning.trim());
    assert(role.firstSteps.length >= 3);
    assert(role.canDo.length >= 3 && role.cannotDo.length >= 3);
    for (const step of role.firstSteps) assert(step.title.trim() && step.body.trim());
  }
  for (const feature of guideFeatures) {
    assert(feature.title.trim() && feature.summary.trim() && feature.menu.trim());
    assert(feature.steps.length >= 4 && feature.steps.length <= 6, feature.id);
    for (const step of feature.steps) assert(step.title.trim() && step.body.trim());
    assert(feature.example.title.trim() && feature.example.values.length >= 3, feature.id);
    for (const example of feature.example.values) assert(example.field.trim() && example.value.trim());
    assert(feature.checks.length >= 3 && feature.limits.length >= 2, feature.id);
    assert(feature.troubleshooting.length >= 2, feature.id);
    for (const issue of feature.troubleshooting) assert(issue.issue.trim() && issue.action.trim());
  }
});

test("static menu links target real local pages and never bind a real project", () => {
  for (const feature of guideFeatures) if (feature.href) {
    assert.match(feature.href, /^\/(?:tasks|my-work|bugs|admin(?:\/projects)?)$/);
    assert(existsSync(new URL(`../../app${feature.href}/page.tsx`, import.meta.url)), feature.href);
  }
  const serialized = JSON.stringify([guideRoles, guideFeatures, guideGettingStarted, guideGlossary]);
  assert.doesNotMatch(serialized, /https?:\/\/|projectId=\d|taskId=\d|submissionId=\d|\/submissions\/\d/);
  assert.doesNotMatch(serialized, /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
});

test("selectors are informational and pure without session, environment or database imports", () => {
  const before = JSON.stringify([guideRoles, guideFeatures]);
  for (const role of roleIds) {
    getGuideRole(role);
    for (const feature of featureIds) getGuideFeature(role, feature);
  }
  assert.equal(JSON.stringify([guideRoles, guideFeatures]), before);
  const source = readFileSync(new URL("../../src/entities/user-guide/model/guide.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /^\s*import\b/m);
  assert.doesNotMatch(source, /\b(?:fetch|process|window|document|localStorage|sessionStorage)\s*[.(]/);
});

test("high-risk guidance preserves private, review, optional-completion and report boundaries", () => {
  const submissions = JSON.stringify(getGuideFeature("member", "submissions"));
  assert.match(submissions, /같은 팀·담당자·검토자.*비공개 열람권/);
  assert.match(submissions, /소속.*해제|탈퇴/);
  const review = JSON.stringify(getGuideFeature("superuser", "review"));
  assert.match(review, /작성자·업무 담당자·해당 버전 편집자.*슈퍼관리자여도.*승인할 수 없/);
  const completion = JSON.stringify(getGuideFeature("member", "completion"));
  assert.match(completion, /기존 업무.*제출 필수/);
  assert.match(completion, /새 봉사활동 업무.*제출 선택/);
  assert.match(completion, /직접 완료의 메모는 선택/);
  assert.match(completion, /한 번이라도 진행한 업무.*예정으로 되돌려도/);
  const reports = JSON.stringify(getGuideFeature("project_admin", "reports"));
  assert.match(reports, /UTC.*9시간/);
  assert.match(reports, /자신이 요청한 실행·파일/);
  assert.match(reports, /운영 자동 실행·메일·외부 전송이 켜지지 않/);
});

test("preparation, attachments and bug screenshots explain distinct limits and privacy", () => {
  const prep = JSON.stringify(getGuideFeature("team_leader", "preparation"));
  for (const limit of ["50행", "20개", "64 KiB", "개인 건강정보", "아동 개별정보"]) assert(prep.includes(limit), limit);
  assert.match(prep, /준비표.*완료 상태를 변경하지 않/);
  const attachments = JSON.stringify(getGuideFeature("guest", "attachments"));
  assert.match(attachments, /UTF-8.*256 KiB/);
  assert.match(attachments, /HTML·SVG·Markdown·코드는 실행하지 않/);
  assert.match(attachments, /외부 뷰어 서비스로 전송하지 않/);
  assert.match(attachments, /개별 파일과 선택한 파일 합계/);
  const bugs = JSON.stringify(getGuideFeature("guest", "bugs"));
  assert.match(bugs, /2 MiB.*3개/);
  assert.match(bugs, /개인정보.*가린/);
});

test("glossary explains the activity concepts without changing actual permissions", () => {
  assert.equal(new Set(guideGlossary.map(item => item.term)).size, guideGlossary.length);
  for (const term of ["프로젝트", "WBS", "소속과 계정 등급", "팀장", "제출 필수·제출 선택", "직접 완료", "비공개", "검토자", "버전", "준비표", "보고서"]) assert(guideGlossary.some(item => item.term === term));
  for (const item of guideGlossary) assert(item.description.trim() && item.example.trim());
  assert.match(JSON.stringify(guideGettingStarted), /역할 선택.*권한은 바뀌지 않/);
});
