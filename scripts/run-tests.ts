/**
 * 테스트 하네스.
 *
 *   npm test              전체. DB 가 없으면 DB 의존 suite 는 사유를 남기고 건너뛴다.
 *   npm test -- --unit    DB 없이 도는 suite 만
 *   npm test -- --require-db   DB 가 없으면 건너뛰지 않고 실패시킨다 (CI 용)
 *
 * DB 의존 suite 는 `docker-compose.test.yml` 의 테스트 전용 MariaDB(포트 3307, `wbs_app_test`)를
 * 사용한다. 개발/운영 DB 를 건드리지 않도록 `.env*` 를 읽지 않고 `TEST_DB_*` 만 본다.
 * HARNESS_MAP.md 규칙대로, 실행하지 못한 것을 통과로 위장하지 않는다.
 */
import { spawn } from "node:child_process";
import { createConnection } from "mariadb";
import { applyTestEnv, testDatabaseEnv } from "../tests/helpers/test-env";

const UNIT_TESTS = ["tests/policy.test.ts", "tests/query-scope.test.ts", "tests/log-redaction.test.ts"];
const DATABASE_TESTS = ["tests/visibility.e2e.test.ts"];

applyTestEnv();

async function probeDatabase(): Promise<{ ok: true; version: string } | { ok: false; reason: string }> {
  try {
    const connection = await createConnection({
      host: testDatabaseEnv.host,
      port: Number(testDatabaseEnv.port),
      user: testDatabaseEnv.user,
      password: testDatabaseEnv.password,
      connectTimeout: 3000,
    });

    try {
      const rows = (await connection.query("SELECT VERSION() AS version")) as Array<{ version: string }>;

      return { ok: true, version: rows[0].version };
    } finally {
      await connection.end();
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function runNodeTest(files: string[]) {
  return new Promise<number>((resolve) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--test", "--experimental-test-module-mocks", "--test-reporter=spec", ...files],
      { stdio: "inherit", env: process.env },
    );

    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const unitOnly = process.argv.includes("--unit");
  const requireDatabase = process.argv.includes("--require-db");

  console.log("· 단위/정책 suite 실행");

  const unitExitCode = await runNodeTest(UNIT_TESTS);
  let databaseExitCode = 0;

  if (unitOnly) {
    console.log("\n· DB suite 미실행 — --unit 으로 호출됨");
  } else {
    const probe = await probeDatabase();

    if (probe.ok) {
      console.log(
        `\n· DB suite 실행 — MariaDB ${probe.version} @ ${testDatabaseEnv.host}:${testDatabaseEnv.port}/${testDatabaseEnv.database}`,
      );
      databaseExitCode = await runNodeTest(DATABASE_TESTS);
    } else {
      const message = [
        `\n· DB suite 미실행 — ${testDatabaseEnv.host}:${testDatabaseEnv.port} 에 연결할 수 없음`,
        `  사유: ${probe.reason}`,
        "  기동: npm run test:db:up",
      ].join("\n");

      if (requireDatabase) {
        console.error(`${message}\n  --require-db 가 지정되어 실패로 처리합니다.`);
        databaseExitCode = 1;
      } else {
        console.warn(message);
        console.warn("  이 실행은 가시성 계약을 검증하지 않았습니다.");
      }
    }
  }

  process.exitCode = unitExitCode || databaseExitCode;
}

void main();
