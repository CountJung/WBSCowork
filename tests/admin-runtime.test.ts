import { test } from "node:test";
import assert from "node:assert/strict";
import { getAdminRuntimePresentation } from "../src/shared/config/admin-runtime";

test("hosted admin copy identifies D1/R2 and managed settings without MariaDB env", () => {
  const copy = getAdminRuntimePresentation({ hosted: true, databaseConfigured: true });
  assert.equal(copy.databaseLabel, "DB 대상: Sites D1 (DB)");
  assert.match(copy.summary, /D1.*R2.*D1 감사 로그/);
  assert.match(copy.missingTablesMessage, /migration/);
  assert.match(copy.settingsDescription, /소유자가 Sites 설정/);
  assert.match(copy.logsDescription, /보존 기간/);
  assert.doesNotMatch(Object.values(copy).join(" "), /undefined|MariaDB|파일 로그|초기화|영구/);
});

test("native admin copy retains MariaDB, local storage and file-log management", () => {
  const copy = getAdminRuntimePresentation({ hosted: false, databaseConfigured: true, databaseName: "wbs_test" });
  assert.equal(copy.databaseLabel, "DB 대상: MariaDB (wbs_test)");
  assert.match(copy.summary, /MariaDB.*로컬 첨부파일.*파일 로그/);
  assert.match(copy.missingTablesMessage, /초기화/);
  assert.match(copy.settingsDescription, /앱 포트.*env/);
  assert.doesNotMatch(Object.values(copy).join(" "), /Sites|R2|D1/);
});

test("missing native database configuration never renders undefined", () => {
  assert.equal(getAdminRuntimePresentation({ hosted: false, databaseConfigured: false }).databaseLabel, "MariaDB env 미설정");
  assert.doesNotMatch(getAdminRuntimePresentation({ hosted: false, databaseConfigured: true }).databaseLabel, /undefined/);
});
