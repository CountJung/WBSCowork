import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { createHash } from "node:crypto";
import reviewed from "../../public/guide/screenshots/reviewed-manifest.json";
import { guideScreenshots } from "../../src/widgets/user-guide/model/screenshots";
import {
  getGuideFeature, getGuideRole, guideFeatures, guideGettingStarted, guideGlossary, guideRoles,
  type GuideFeatureId, type GuideRoleId,
} from "../../src/entities/user-guide";

const roleIds: GuideRoleId[] = ["superuser", "project_admin", "team_leader", "member", "guest"];
const featureIds: GuideFeatureId[] = ["media", "projects", "tasks", "completion", "submissions", "review", "attachments", "preparation", "reports", "personal", "bugs", "administration"];
const screenshotIds = new Set(reviewed.screenshots.map(shot => shot.id));

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
    assert.equal(result?.id, listed && allowed ? feature.id : undefined);
    if (result) assert.strictEqual(result.roles, feature.roles, "Wording changes cannot alter the route permission matrix");
    if (result) validPages++;
  }
  assert.equal(validPages, 50);
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
  for (const feature of guideFeatures.filter(feature => feature.screenshotIds.includes("project-settings"))) assert.deepEqual(feature.roles, ["superuser"]);
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
  for (const feature of guideRoles.flatMap(role => role.featureIds.map(id => getGuideFeature(role.id, id)!))) {
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

test("guest reading and member preparation do not instruct the reader to write or save", () => {
  for (const [role, ids] of [["guest", ["projects", "tasks", "submissions", "attachments", "personal"]], ["member", ["preparation"]]] as const) {
    for (const id of ids) {
      const feature = getGuideFeature(role, id)!;
      assert.equal(feature.readingOnly, true, `${role}/${id}`);
      assert.doesNotMatch(feature.title, /쓰기|남기기|등록하기/);
      for (const step of feature.steps) assert.doesNotMatch(step.title, /작성하세요|등록하세요|저장하세요|수정하세요|입력하세요|완료하세요/);
      assert.doesNotMatch(feature.checks.join(" "), /제출했는지|필수 항목을 채웠|저장 후.*변경한/);
    }
  }
  assert.equal(getGuideFeature("guest", "submissions")!.title, "제출물·댓글·이력 읽기");
  assert(!getGuideFeature("guest", "bugs")!.readingOnly, "Guests can still write their own bug reports");
  assert(!getGuideFeature("team_leader", "preparation")!.readingOnly, "Leaders retain their editable preparation instructions");
  assert.match(JSON.stringify(getGuideFeature("guest", "submissions")), /새로 등록하거나 수정하지 않/);
});

test("writer instructions use actual task, submission, preparation and report button labels", () => {
  assert.doesNotMatch(JSON.stringify([guideRoles, guideFeatures, guideGettingStarted]), /업무 목록/);
  const submissions = JSON.stringify(getGuideFeature("member", "submissions"));
  for (const label of ["업무 상세", "제출물 등록…", "새 제출 내용", "공개 범위", "제출 등록", "본문은 필수", "파일은 선택"]) assert(submissions.includes(label), label);
  const preparation = JSON.stringify(getGuideFeature("team_leader", "preparation"));
  for (const label of ["팀 준비표 · 메뉴·활동 준비", "준비표 편집", "준비 항목 추가", "준비표 저장"]) assert(preparation.includes(label), label);
  const reports = JSON.stringify(getGuideFeature("project_admin", "reports"));
  for (const label of ["관리자 → 프로젝트 관리", "활동 보고서", "미리보기", "보고서 생성", "DOCX 다운로드", "PPTX 다운로드"]) assert(reports.includes(label), label);
  assert.match(JSON.stringify(getGuideFeature("member", "review")), /팀장 지정만으로 검토 요청 권한이 생기지는 않/);
});

test("UTC report inputs include a date rollover without converting preparation calendar dates", () => {
  const report = JSON.stringify(getGuideFeature("superuser", "reports"));
  assert.match(report, /한국 10월 25일 00:00은 UTC 10월 24일 15:00/);
  assert.equal(new Date("2026-10-25T00:00:00+09:00").toISOString(), "2026-10-24T15:00:00.000Z");
  assert.match(report, /준비표의 달력 날짜·24시간제 시각은 그대로 입력/);
});


test("reviewed screenshots retain bytes, version provenance and complete guide coverage", () => {
  assert.equal(guideScreenshots.length, 20);
  assert.equal(new Set(guideScreenshots.map(s => s.id)).size, 20);
  const used = new Set(["main-home", ...guideFeatures.flatMap(f => f.screenshotIds)]);
  assert.deepEqual([...used].sort(), [...screenshotIds].sort());
  for (const shot of guideScreenshots) {
    const source = reviewed.screenshots.find(s => s.id === shot.id)!;
    const bytes = readFileSync(new URL(`../../public${shot.src}`, import.meta.url));
    assert.equal(bytes.length, source.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256);
    assert.equal(shot.captureRole, "envSU"); assert(shot.synthetic);
    assert(shot.alt.length >= 8 && shot.caption.includes(`v${shot.captureVersion}`));
    assert(shot.capturedAt && shot.usageNotes && shot.width > 0 && shot.height > 0);
    assert.match(shot.src, /^\/guide\/screenshots\/v(?:23|28)-\d{8}\/[a-z0-9-]+\.jpg$/);
  }
  for (const excluded of reviewed.excludedSources) assert(!guideScreenshots.some(s => s.src.endsWith(excluded.sourceFilename)));
});

test("media instructions separate management scope and member or guest reading", () => {
  for (const role of ["member", "guest"] as const) {
    const feature = getGuideFeature(role, "media")!;
    assert(feature.readingOnly); assert.match(feature.title, /읽고 내려받기/);
    assert.doesNotMatch(feature.steps.map(s => s.body).join(" "), /미디어 저장.*누릅니다/);
  }
  const manager = JSON.stringify(getGuideFeature("project_admin", "media"));
  for (const term of ["지정 프로젝트", "슈퍼관리자", "인터넷 전체 공개", "8 MiB", "20 MiB", "소속이 해제"]) assert(manager.includes(term), term);
  assert.equal(getGuideFeature("team_leader", "media")?.readingOnly, undefined);
});
