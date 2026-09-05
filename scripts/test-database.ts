/**
 * 테스트 전용 MariaDB 기동/종료.
 *
 *   npm run test:db:up      사용 가능한 백엔드로 기동하고 준비될 때까지 대기
 *   npm run test:db:down    종료 (데이터는 전부 버린다)
 *   npm run test:db:status  현재 상태
 *
 * 백엔드는 이 머신에서 실제로 쓸 수 있는 것을 자동 선택한다.
 *   1. docker  — `docker-compose.test.yml` (이미지를 받을 수 있는 환경)
 *   2. local   — Homebrew MariaDB 를 저장소 밖 임시 datadir 로 띄운다
 *
 * 어느 쪽이든 접속 계약은 같다: 127.0.0.1:3307 / root / test_password / wbs_app_test.
 * 개발·운영 DB(기본 3306)와 포트와 DB 이름이 모두 다르다.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "mariadb";
import { testDatabaseEnv } from "../tests/helpers/test-env";

const COMPOSE_FILE = "docker-compose.test.yml";

/**
 * local 백엔드 상태는 저장소 밖 로컬 임시 디렉터리에 둔다.
 * 저장소가 외장 볼륨에 있을 수 있고, InnoDB datadir 은 로컬 디스크에서 다루는 편이 안전하다.
 * `mariadb-install-db` 는 상대 경로를 basedir 기준으로 해석하므로 절대 경로여야 한다.
 */
const LOCAL_STATE_DIR = join(tmpdir(), "wbs-mariadb-test");
const LOCAL_DATA_DIR = join(LOCAL_STATE_DIR, "data");
const LOCAL_PID_FILE = join(LOCAL_STATE_DIR, "mariadbd.pid");
const LOCAL_SOCKET = join(LOCAL_STATE_DIR, "mariadbd.sock");
const LOCAL_LOG_FILE = join(LOCAL_STATE_DIR, "mariadbd.log");
const HOMEBREW_BIN = "/opt/homebrew/opt/mariadb/bin";

function run(command: string, args: string[], options: { quiet?: boolean } = {}) {
  return spawnSync(command, args, { stdio: options.quiet ? "pipe" : "inherit", encoding: "utf8" });
}

function commandExists(command: string) {
  return run("command", ["-v", command], { quiet: true }).status === 0 || existsSync(command);
}

function dockerUsable() {
  if (run("docker", ["info", "--format", "{{.ServerVersion}}"], { quiet: true }).status !== 0) {
    return false;
  }

  // 이미지를 받을 수 없는 네트워크에서는 docker 가 떠 있어도 이 백엔드를 쓸 수 없다.
  const images = run("docker", ["images", "--format", "{{.Repository}}:{{.Tag}}"], { quiet: true });

  return (images.stdout ?? "").split("\n").some((line) => line.startsWith("mariadb:"));
}

function localBinary(name: string) {
  const homebrewPath = `${HOMEBREW_BIN}/${name}`;

  return existsSync(homebrewPath) ? homebrewPath : name;
}

function localUsable() {
  return existsSync(`${HOMEBREW_BIN}/mariadbd`) || commandExists("mariadbd");
}

async function waitForPort(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const connection = await createConnection({
        host: testDatabaseEnv.host,
        port: Number(testDatabaseEnv.port),
        user: testDatabaseEnv.user,
        password: testDatabaseEnv.password,
        connectTimeout: 2000,
      });

      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${testDatabaseEnv.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      const rows = (await connection.query("SELECT VERSION() AS version")) as Array<{ version: string }>;

      await connection.end();

      return rows[0].version;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`테스트 DB 가 준비되지 않았습니다: ${lastError}`);
}

async function readLocalPid() {
  try {
    const pid = Number((await readFile(LOCAL_PID_FILE, "utf8")).trim());

    if (!Number.isInteger(pid) || pid <= 0) {
      return null;
    }

    process.kill(pid, 0);

    return pid;
  } catch {
    return null;
  }
}

async function startLocal() {
  if (await readLocalPid()) {
    console.log("· local MariaDB 이미 실행 중");

    return waitForPort();
  }

  // 매 기동마다 완전히 새 datadir 로 시작한다. 테스트 DB 에 남은 상태를 신뢰하지 않는다.
  await rm(LOCAL_STATE_DIR, { recursive: true, force: true });
  await mkdir(LOCAL_DATA_DIR, { recursive: true });

  console.log("· local MariaDB datadir 초기화");

  const install = run(localBinary("mariadb-install-db"), [
    `--datadir=${LOCAL_DATA_DIR}`,
    "--auth-root-authentication-method=normal",
  ], { quiet: true });

  if (install.status !== 0) {
    throw new Error(`mariadb-install-db 실패:\n${install.stderr ?? ""}`);
  }

  console.log(`· local MariaDB 기동 (port ${testDatabaseEnv.port})`);

  const server = spawn(
    localBinary("mariadbd"),
    [
      `--datadir=${LOCAL_DATA_DIR}`,
      `--port=${testDatabaseEnv.port}`,
      `--socket=${LOCAL_SOCKET}`,
      "--bind-address=127.0.0.1",
      "--skip-name-resolve",
      "--skip-networking=0",
    ],
    { detached: true, stdio: ["ignore", "ignore", "ignore"] },
  );

  server.unref();
  await writeFile(LOCAL_PID_FILE, String(server.pid), "utf8");

  // 초기 root 는 비밀번호가 없고 소켓/localhost 로만 잡힌다.
  // `--skip-name-resolve` 환경에서는 TCP 접속 host 가 '127.0.0.1' 리터럴이므로 계정을 따로 만들어야
  // docker 백엔드와 같은 접속 계약(127.0.0.1:3307 / root / test_password)이 성립한다.
  const deadline = Date.now() + 60_000;

  for (;;) {
    const result = run(
      localBinary("mariadb"),
      [
        `--socket=${LOCAL_SOCKET}`,
        "-u",
        "root",
        "-e",
        // `mariadb-install-db` 가 loopback host 계정을 이미 만들어 두므로 CREATE 가 아니라 ALTER 여야 한다.
        // CREATE ... IF NOT EXISTS 는 조용히 무시되어 비밀번호가 설정되지 않는다.
        `CREATE USER IF NOT EXISTS 'root'@'127.0.0.1'; ` +
          `ALTER USER 'root'@'localhost' IDENTIFIED BY '${testDatabaseEnv.password}'; ` +
          `ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '${testDatabaseEnv.password}'; ` +
          `GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION; ` +
          `CREATE DATABASE IF NOT EXISTS \`${testDatabaseEnv.database}\`; FLUSH PRIVILEGES;`,
      ],
      { quiet: true },
    );

    if (result.status === 0) {
      break;
    }

    if (Date.now() > deadline) {
      throw new Error(`local MariaDB 초기화 실패. 로그: ${LOCAL_LOG_FILE}\n${result.stderr ?? ""}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return waitForPort();
}

async function stopLocal() {
  const pid = await readLocalPid();

  if (pid) {
    console.log(`· local MariaDB 종료 (pid ${pid})`);
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // 이미 종료됨
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  await rm(LOCAL_STATE_DIR, { recursive: true, force: true });
}

async function up() {
  if (dockerUsable()) {
    console.log("· backend: docker");
    if (run("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d", "--wait"]).status !== 0) {
      throw new Error("docker compose up 실패");
    }
  } else if (localUsable()) {
    console.log("· backend: local (Homebrew MariaDB)");
    await startLocal();
    console.log(`\n테스트 DB 준비 완료: ${testDatabaseEnv.host}:${testDatabaseEnv.port}/${testDatabaseEnv.database}`);

    return;
  } else {
    throw new Error(
      [
        "사용 가능한 테스트 DB 백엔드가 없습니다.",
        `  docker: 데몬이 꺼져 있거나 mariadb 이미지를 받을 수 없습니다 (docker compose -f ${COMPOSE_FILE} pull).`,
        "  local : brew install mariadb 로 설치하십시오.",
      ].join("\n"),
    );
  }

  const version = await waitForPort();

  console.log(`\n테스트 DB 준비 완료: MariaDB ${version} @ ${testDatabaseEnv.host}:${testDatabaseEnv.port}/${testDatabaseEnv.database}`);
}

async function down() {
  if (run("docker", ["info"], { quiet: true }).status === 0) {
    run("docker", ["compose", "-f", COMPOSE_FILE, "down", "-v"], { quiet: true });
  }

  await stopLocal();
  console.log("테스트 DB 종료 완료");
}

async function status() {
  try {
    const version = await waitForPort(3000);

    console.log(`up — MariaDB ${version} @ ${testDatabaseEnv.host}:${testDatabaseEnv.port}`);
  } catch {
    console.log(`down — ${testDatabaseEnv.host}:${testDatabaseEnv.port} 응답 없음`);
    process.exitCode = 1;
  }
}

const command = process.argv[2] ?? "up";
const commands: Record<string, () => Promise<void>> = { up, down, status };

if (!commands[command]) {
  console.error(`알 수 없는 명령: ${command}. up | down | status 중 하나여야 합니다.`);
  process.exitCode = 1;
} else {
  commands[command]().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
