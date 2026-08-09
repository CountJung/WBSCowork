/**
 * FSD import boundary checker.
 *
 * docs/FSD_MIGRATION_PLAN.md 4절의 최소 사양을 실행 가능한 게이트로 구현한다.
 *
 *   npm run check:fsd              저장소 전체 검사
 *   npm run check:fsd -- --self-test   fixture 로 검사기 자체를 검증
 *   npm run check:fsd -- --json    기계 판독용 출력
 *
 * 허용 의존 방향은 app → widgets → features → entities → shared 이며
 * 구현/이동 순서(shared → ... → app)와는 반대다.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const LAYERS = ["shared", "entities", "features", "widgets"] as const;

type Layer = (typeof LAYERS)[number];

/** 낮은 값일수록 하위 레이어다. app 은 src 밖에 있지만 최상위 소비자로 취급한다. */
const LAYER_RANK: Record<Layer | "app", number> = {
  shared: 0,
  entities: 1,
  features: 2,
  widgets: 3,
  app: 4,
};

/** 이동 대상이지만 아직 남아 있는 레거시 위치. src 슬라이스가 이쪽을 참조하면 되돌아가는 것이다. */
const LEGACY_DIRS = ["components", "lib", "models"];

/** client 그래프에 들어오면 안 되는 런타임 모듈. */
const SERVER_ONLY_MODULES = new Set([
  "mariadb",
  "server-only",
  "fs",
  "node:fs",
  "fs/promises",
  "node:fs/promises",
  "child_process",
  "node:child_process",
  "net",
  "node:net",
  "dns",
  "node:dns",
]);

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const SKIP_DIRECTORIES = new Set(["node_modules", ".next", ".git", "out", "build"]);

export type ViolationCode =
  | "layer-direction"
  | "cross-slice"
  | "deep-import"
  | "unknown-layer"
  | "client-server"
  | "legacy-import";

export type Severity = "error" | "warn";

export type Violation = {
  code: ViolationCode;
  severity: Severity;
  file: string;
  line: number;
  specifier: string;
  message: string;
};

type ImportRef = {
  specifier: string;
  line: number;
  /** `import type` / `export type` 는 컴파일 시 지워지므로 client 번들 경계에 영향이 없다. */
  typeOnly: boolean;
};

type ModuleInfo = {
  /** 검사 루트 기준 POSIX 상대 경로. */
  rel: string;
  absolute: string;
  layer: Layer | "app" | "legacy" | "other";
  /** entities/features/widgets 의 슬라이스 이름. shared 와 그 외에는 null. */
  slice: string | null;
  /** shared 의 공개 단위(`shared/<segment>/<unit>`). 그 외에는 null. */
  sharedUnit: string | null;
  isClientEntry: boolean;
  isServerOnly: boolean;
  /** `"use server"` 모듈은 client 에서 참조해도 네트워크 경계로 대체되므로 그래프 탐색을 멈춘다. */
  isServerAction: boolean;
  imports: ImportRef[];
};

const SEVERITY_BY_CODE: Record<ViolationCode, Severity> = {
  "layer-direction": "error",
  "cross-slice": "error",
  "deep-import": "error",
  "unknown-layer": "error",
  "client-server": "error",
  // 이동 중에는 src 슬라이스가 레거시 위치를 참조할 수 있다. 게이트를 막지는 않되 남은 부채로 드러낸다.
  "legacy-import": "warn",
};

function toPosix(value: string) {
  return value.split(sep).join(posix.sep);
}

function readDirectoryEntries(directory: string) {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function listSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readDirectoryEntries(directory)) {
    // 외장 macOS 볼륨의 AppleDouble 파일은 소스가 아니다.
    if (entry.name.startsWith("._")) {
      continue;
    }

    const absolute = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) {
        continue;
      }

      files.push(...listSourceFiles(absolute));
      continue;
    }

    if (SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(absolute);
    }
  }

  return files.sort();
}

/** 블록/라인 주석을 공백으로 바꿔 주석 안의 import 문자열을 오탐하지 않게 한다. */
function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, prefix: string) => prefix + " ".repeat(match.length - prefix.length));
}

const STATIC_IMPORT_PATTERN = /(?:^|[\s;}])(?:import|export)\s[^;'"]*?from\s*["']([^"']+)["']/g;
const BARE_IMPORT_PATTERN = /(?:^|[\s;}])import\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const REQUIRE_PATTERN = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

function collectImports(source: string): ImportRef[] {
  const cleaned = stripComments(source);
  const found = new Map<string, ImportRef>();

  for (const pattern of [STATIC_IMPORT_PATTERN, BARE_IMPORT_PATTERN, DYNAMIC_IMPORT_PATTERN, REQUIRE_PATTERN]) {
    pattern.lastIndex = 0;

    let match = pattern.exec(cleaned);

    while (match !== null) {
      const specifier = match[1];
      const line = cleaned.slice(0, match.index).split("\n").length;
      const key = `${specifier}@${line}`;

      if (!found.has(key)) {
        found.set(key, { specifier, line, typeOnly: /\b(?:import|export)\s+type\s/.test(match[0]) });
      }

      match = pattern.exec(cleaned);
    }
  }

  return [...found.values()].sort((left, right) => left.line - right.line);
}

function hasDirective(source: string, directive: "use client" | "use server") {
  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();

    if (line === "" || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
      continue;
    }

    return line === `"${directive}";` || line === `'${directive}';` || line === `"${directive}"` || line === `'${directive}'`;
  }

  return false;
}

function classify(rel: string): Pick<ModuleInfo, "layer" | "slice" | "sharedUnit"> {
  const segments = publicApiPath(rel).split(posix.sep);

  if (segments[0] === "src") {
    const layer = segments[1] as Layer | undefined;

    if (!layer || !LAYERS.includes(layer)) {
      return { layer: "other", slice: null, sharedUnit: null };
    }

    if (layer === "shared") {
      // shared 는 슬라이스가 아니라 세그먼트 구조다. 공개 단위는 `shared/<segment>/<unit>` 까지다.
      const unit = segments.slice(2, 4).join(posix.sep);

      return { layer, slice: null, sharedUnit: unit === "" ? null : unit };
    }

    return { layer, slice: segments[2] ?? null, sharedUnit: null };
  }

  if (segments[0] === "app") {
    return { layer: "app", slice: null, sharedUnit: null };
  }

  if (LEGACY_DIRS.includes(segments[0])) {
    return { layer: "legacy", slice: null, sharedUnit: null };
  }

  return { layer: "other", slice: null, sharedUnit: null };
}

function isServerOnlyPath(rel: string) {
  return /\.server\.tsx?$/.test(rel) || rel.startsWith("src/shared/server/");
}

function readModule(root: string, absolute: string): ModuleInfo {
  const source = readFileSync(absolute, "utf8");
  const rel = toPosix(relative(root, absolute));

  return {
    rel,
    absolute,
    ...classify(rel),
    isClientEntry: hasDirective(source, "use client") || /\.client\.tsx?$/.test(rel),
    isServerOnly: isServerOnlyPath(rel),
    isServerAction: hasDirective(source, "use server"),
    imports: collectImports(source),
  };
}

type Resolution =
  | { kind: "external"; name: string }
  | { kind: "internal"; rel: string }
  | { kind: "unresolved"; rel: string };

function resolveModulePath(root: string, candidate: string): string | null {
  const attempts = [
    candidate,
    ...SOURCE_EXTENSIONS.map((extension) => `${candidate}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(candidate, `index${extension}`)),
  ];

  for (const attempt of attempts) {
    try {
      if (statSync(attempt).isFile()) {
        return attempt;
      }
    } catch {
      // 다음 후보로 넘어간다.
    }
  }

  return null;
}

function resolveSpecifier(root: string, fromFile: string, specifier: string): Resolution {
  let candidate: string | null = null;

  if (specifier.startsWith("@/")) {
    candidate = join(root, specifier.slice(2));
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    candidate = resolve(dirname(fromFile), specifier);
  }

  if (candidate === null) {
    return { kind: "external", name: specifier };
  }

  const resolved = resolveModulePath(root, candidate);
  const rel = toPosix(relative(root, resolved ?? candidate));

  return resolved === null ? { kind: "unresolved", rel } : { kind: "internal", rel };
}

/** `src/shared/ui/button/index.ts` → `src/shared/ui/button` 처럼 공개 API 경로만 남긴다. */
function publicApiPath(rel: string) {
  return rel.replace(/\/index\.tsx?$/, "").replace(/\.tsx?$/, "");
}

function sliceRoot(info: Pick<ModuleInfo, "layer" | "slice">) {
  return info.slice === null ? null : `src/${info.layer}/${info.slice}`;
}

function checkDependencyRules(root: string, modules: ModuleInfo[]): Violation[] {
  const violations: Violation[] = [];
  const add = (code: ViolationCode, file: string, ref: ImportRef, message: string) => {
    violations.push({
      code,
      severity: SEVERITY_BY_CODE[code],
      file,
      line: ref.line,
      specifier: ref.specifier,
      message,
    });
  };

  for (const unit of modules) {
    for (const ref of unit.imports) {
      const resolution = resolveSpecifier(root, unit.absolute, ref.specifier);

      // 외부 패키지와 TS 모듈이 아닌 자원(css, 이미지 등)은 경계 규칙 대상이 아니다.
      if (resolution.kind !== "internal") {
        continue;
      }

      const target = classify(resolution.rel);
      const targetIsSrc = resolution.rel.startsWith("src/");

      if (targetIsSrc && target.layer === "other") {
        add(
          "unknown-layer",
          unit.rel,
          ref,
          `src 하위는 ${LAYERS.join(", ")} 레이어만 사용한다: ${resolution.rel}`,
        );
        continue;
      }

      // 1) 공개 API 규칙: 다른 슬라이스는 public index 로만 참조한다.
      if (targetIsSrc) {
        const sameSlice =
          unit.layer === target.layer &&
          ((unit.slice !== null && unit.slice === target.slice) ||
            (unit.layer === "shared" && unit.sharedUnit !== null && unit.sharedUnit === target.sharedUnit));

        if (!sameSlice) {
          const expected =
            target.layer === "shared"
              ? target.sharedUnit === null
                ? null
                : `src/shared/${target.sharedUnit}`
              : sliceRoot(target);
          const actual = publicApiPath(resolution.rel);
          // 슬라이스 공개 API 는 `index` 와, server 전용 소비자를 위한 `index.server` 두 개다.
          const allowed = expected === null ? [] : [expected, `${expected}/index.server`];

          if (expected !== null && !allowed.includes(actual)) {
            add(
              "deep-import",
              unit.rel,
              ref,
              `공개 API 를 우회한 deep import 다. ${expected} 를 사용한다.`,
            );
          }
        }
      }

      // 2) 레이어 방향과 동일 레이어 슬라이스 격리.
      if (unit.layer in LAYER_RANK) {
        const fromRank = LAYER_RANK[unit.layer as Layer | "app"];

        if (target.layer === "app") {
          if (unit.layer !== "app") {
            add("layer-direction", unit.rel, ref, "src 코드는 루트 app 엔트리를 참조할 수 없다.");
          }
        } else if (target.layer !== "other" && target.layer !== "legacy") {
          const toRank = LAYER_RANK[target.layer];

          if (toRank > fromRank) {
            add(
              "layer-direction",
              unit.rel,
              ref,
              `역방향 의존이다. 허용 방향은 ${Object.keys(LAYER_RANK).reverse().join(" → ")} 뿐이다.`,
            );
          } else if (toRank === fromRank && unit.layer !== "app" && target.slice !== unit.slice) {
            add(
              "cross-slice",
              unit.rel,
              ref,
              `같은 레이어의 다른 슬라이스(${target.slice})를 직접 참조했다. 상위 레이어에서 조립한다.`,
            );
          }
        } else if (target.layer === "legacy" && unit.layer !== "app") {
          add(
            "legacy-import",
            unit.rel,
            ref,
            `src 슬라이스가 레거시 위치(${resolution.rel})를 참조한다. 해당 모듈을 먼저 이동해야 한다.`,
          );
        }
      }
    }
  }

  return violations;
}

/**
 * client 진입점에서 도달 가능한 그래프에 server 전용 모듈이 섞였는지 확인한다.
 * 직접 import 뿐 아니라 re-export 를 통한 전이 경로도 잡는다.
 */
function checkClientServerBoundary(root: string, modules: ModuleInfo[]): Violation[] {
  const violations: Violation[] = [];
  const byRel = new Map(modules.map((unit) => [unit.rel, unit]));
  const reported = new Set<string>();

  for (const entry of modules.filter((unit) => unit.isClientEntry)) {
    const visited = new Set<string>([entry.rel]);
    const queue: Array<{ unit: ModuleInfo; chain: string[] }> = [{ unit: entry, chain: [entry.rel] }];

    while (queue.length > 0) {
      const { unit, chain } = queue.shift()!;

      for (const ref of unit.imports) {
        if (ref.typeOnly) {
          continue;
        }

        const resolution = resolveSpecifier(root, unit.absolute, ref.specifier);
        const via = chain.length > 1 ? ` (경유: ${chain.join(" → ")})` : "";

        if (resolution.kind === "unresolved") {
          continue;
        }

        if (resolution.kind === "external") {
          if (!SERVER_ONLY_MODULES.has(resolution.name)) {
            continue;
          }

          const key = `${unit.rel}:${ref.line}:${resolution.name}`;

          if (!reported.has(key)) {
            reported.add(key);
            violations.push({
              code: "client-server",
              severity: SEVERITY_BY_CODE["client-server"],
              file: unit.rel,
              line: ref.line,
              specifier: ref.specifier,
              message: `client 그래프에서 server 전용 모듈 ${resolution.name} 을 참조한다${via}.`,
            });
          }

          continue;
        }

        const targetModule = byRel.get(resolution.rel);

        // Server Action 모듈은 client 번들에 서버 코드를 끌어오지 않는다. 여기서 탐색을 멈춘다.
        if (targetModule?.isServerAction) {
          continue;
        }

        if (isServerOnlyPath(resolution.rel)) {
          const key = `${unit.rel}:${ref.line}:${resolution.rel}`;

          if (!reported.has(key)) {
            reported.add(key);
            violations.push({
              code: "client-server",
              severity: SEVERITY_BY_CODE["client-server"],
              file: unit.rel,
              line: ref.line,
              specifier: ref.specifier,
              message: `client 그래프에서 server 전용 모듈 ${resolution.rel} 을 참조한다${via}.`,
            });
          }

          continue;
        }

        if (targetModule && !visited.has(targetModule.rel)) {
          visited.add(targetModule.rel);
          queue.push({ unit: targetModule, chain: [...chain, targetModule.rel] });
        }
      }
    }
  }

  return violations;
}

export function analyzeFsdBoundaries(root: string): Violation[] {
  const files = [...listSourceFiles(join(root, "src")), ...listSourceFiles(join(root, "app"))];
  const legacyFiles = LEGACY_DIRS.flatMap((directory) => listSourceFiles(join(root, directory)));
  const modules = [...files, ...legacyFiles].map((absolute) => readModule(root, absolute));

  return [...checkDependencyRules(root, modules), ...checkClientServerBoundary(root, modules)].sort(
    (left, right) => left.file.localeCompare(right.file) || left.line - right.line,
  );
}

function formatViolation(violation: Violation) {
  const label = violation.severity === "error" ? "error" : "warn ";

  return `  ${label}  ${violation.file}:${violation.line}  [${violation.code}] ${violation.message}\n           import "${violation.specifier}"`;
}

type SelfTestCase = {
  fixture: string;
  expected: ViolationCode[];
};

const SELF_TEST_CASES: SelfTestCase[] = [
  { fixture: "valid", expected: [] },
  { fixture: "invalid-layer-direction", expected: ["layer-direction"] },
  { fixture: "invalid-cross-slice", expected: ["cross-slice"] },
  { fixture: "invalid-deep-import", expected: ["deep-import"] },
  { fixture: "invalid-client-server", expected: ["client-server"] },
];

function runSelfTest(repoRoot: string) {
  const fixtureRoot = join(repoRoot, "scripts", "fixtures", "fsd");
  let failed = 0;

  for (const testCase of SELF_TEST_CASES) {
    const violations = analyzeFsdBoundaries(join(fixtureRoot, testCase.fixture));
    const errorCodes = violations.filter((violation) => violation.severity === "error").map((violation) => violation.code);
    const missing = testCase.expected.filter((code) => !errorCodes.includes(code));
    const unexpected = errorCodes.filter((code) => !testCase.expected.includes(code));
    const ok = missing.length === 0 && unexpected.length === 0;

    if (!ok) {
      failed += 1;
    }

    console.log(`${ok ? "PASS" : "FAIL"}  ${testCase.fixture}  기대 [${testCase.expected.join(", ")}] 실제 [${[...new Set(errorCodes)].join(", ")}]`);

    if (!ok) {
      for (const violation of violations) {
        console.log(formatViolation(violation));
      }
    }
  }

  if (failed > 0) {
    console.error(`\nFSD 경계 검사기 self-test 실패: ${failed}건`);
    return 1;
  }

  console.log(`\nFSD 경계 검사기 self-test 통과: ${SELF_TEST_CASES.length}건`);
  return 0;
}

function runRepositoryCheck(repoRoot: string, asJson: boolean) {
  const violations = analyzeFsdBoundaries(repoRoot);
  const errors = violations.filter((violation) => violation.severity === "error");
  const warnings = violations.filter((violation) => violation.severity === "warn");

  if (asJson) {
    console.log(JSON.stringify({ errors, warnings }, null, 2));
    return errors.length > 0 ? 1 : 0;
  }

  if (violations.length === 0) {
    console.log("FSD 경계 위반 없음 (src/, app/, 레거시 재export 포함).");
    return 0;
  }

  if (errors.length > 0) {
    console.error(`FSD 경계 위반 ${errors.length}건:`);
    for (const violation of errors) {
      console.error(formatViolation(violation));
    }
  }

  if (warnings.length > 0) {
    console.warn(`${errors.length > 0 ? "\n" : ""}이동 대기 경고 ${warnings.length}건:`);
    for (const violation of warnings) {
      console.warn(formatViolation(violation));
    }
  }

  return errors.length > 0 ? 1 : 0;
}

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");

  // 기본 실행은 fixture self-test 를 먼저 통과해야 한다. 검사기가 조용히 망가진 채로 통과하는 것을 막는다.
  if (args.includes("--only-repo")) {
    process.exitCode = runRepositoryCheck(repoRoot, asJson);
    return;
  }

  const selfTestExitCode = asJson ? 0 : runSelfTest(repoRoot);

  if (selfTestExitCode !== 0) {
    process.exitCode = selfTestExitCode;
    return;
  }

  if (args.includes("--self-test")) {
    process.exitCode = 0;
    return;
  }

  if (!asJson) {
    console.log("");
  }

  process.exitCode = runRepositoryCheck(repoRoot, asJson);
}

main();
