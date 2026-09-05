/**
 * 테스트 실행 환경 정의.
 *
 * 테스트는 fixture 를 위해 테이블을 비우므로, 개발/운영 DB 를 절대 가리키지 않도록
 * 이름 규칙(`*_test`)을 강제한다. 값은 `docker-compose.test.yml` 기본값과 일치하며
 * `TEST_DB_*` 환경 변수로만 덮어쓸 수 있다. `.env*` 는 읽지 않는다.
 */

export type TestDatabaseEnv = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

export const testDatabaseEnv: TestDatabaseEnv = {
  host: process.env.TEST_DB_HOST ?? "127.0.0.1",
  port: process.env.TEST_DB_PORT ?? "3307",
  user: process.env.TEST_DB_USER ?? "root",
  password: process.env.TEST_DB_PASSWORD ?? "test_password",
  database: process.env.TEST_DB_NAME ?? "wbs_app_test",
};

export const TEST_SUPERUSER_EMAIL = "superuser@example.test";

/** 실수로 개발 DB 를 비우는 일이 없도록 하는 마지막 방어선. */
export function assertTestDatabaseName(name: string) {
  if (!name.endsWith("_test")) {
    throw new Error(
      `테스트 DB 이름은 반드시 '_test' 로 끝나야 합니다. 현재 값: ${name}. 개발 DB 를 가리키고 있지 않은지 확인하십시오.`,
    );
  }
}

/**
 * 애플리케이션 모듈이 읽는 `DB_*` / auth env 를 테스트 값으로 고정한다.
 * `getRuntimeEnv()` 가 첫 호출 결과를 캐시하므로 어떤 src 모듈보다 먼저 실행되어야 한다.
 */
export function applyTestEnv() {
  assertTestDatabaseName(testDatabaseEnv.database);

  process.env.DB_HOST = testDatabaseEnv.host;
  process.env.DB_PORT = testDatabaseEnv.port;
  process.env.DB_USER = testDatabaseEnv.user;
  process.env.DB_PASSWORD = testDatabaseEnv.password;
  process.env.DB_NAME = testDatabaseEnv.database;
  process.env.DB_CONNECTION_LIMIT = "5";
  process.env.DB_CONNECT_TIMEOUT_MS = "5000";

  process.env.SUPERUSER_EMAIL = TEST_SUPERUSER_EMAIL;
  process.env.NEXTAUTH_SECRET = "test-secret-not-a-real-credential";
  process.env.NEXTAUTH_URL = "http://127.0.0.1:3000";

  process.env.UPLOAD_DIR = process.env.TEST_UPLOAD_DIR ?? "./.test-artifacts/uploads";
  process.env.LOG_DIR = process.env.TEST_LOG_DIR ?? "./.test-artifacts/logs";
}
