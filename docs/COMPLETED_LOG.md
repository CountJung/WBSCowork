# WBS 태스크 — 완료 기록

> **누적 문서** — 완료된 항목만 담는다. 진행 중인 일은 [TODO.md](TODO.md)에 있다.
> 최종 갱신: 2026-10-09

여기에는 **나중에 다시 참조할 가치가 있는 것만** 남긴다. 판단 기준은 "이 결정을 모르는 사람이 같은 실수를 반복할 수 있는가"다. 단순 작업(오타, 포맷, 의존성 범프)은 git 이력으로 충분하므로 옮기지 않는다.

각 항목은 [TODO.md](TODO.md)와 같은 ID 체계를 쓰며, 번호는 완료 후에도 바뀌지 않는다.

---

## 완료 목록

표기는 [TODO.md](TODO.md)의 「진행 표기 범례」를 따른다. 여기 있는 항목은 모두 완료이므로 전부 `- [x]`다. 되돌아가는 항목이 생기면 TODO.md로 옮기면서 번호를 유지한 채 표기를 `[~]`나 `[!]`로 바꾼다.

- [x] **[QLT-001](#qlt-001--eslint-기준선-확보)** ESLint 기준선 확보 · 2026-08-09
- [x] **[QLT-002](#qlt-002--feature-sliced-design-구조-정리-8단계)** Feature-Sliced Design 구조 정리(8단계) · 2026-08-12
- [x] **[QLT-003](#qlt-003--비공개-제출물의-파생-데이터가-client-payload로-노출)** 비공개 제출물의 파생 데이터가 client payload로 노출 · 2026-09-05 · 보안 P0
- [x] **[QLT-004](#qlt-004--제출물댓글-mutation에-작성자-ownership-검사-없음)** 제출물·댓글 mutation에 작성자 ownership 검사 없음 · 2026-09-05 · 보안 P1
- [x] **[QLT-005](#qlt-005--단건-조회-getsubmissionbyid가-unscoped)** 단건 조회 `getSubmissionById`가 unscoped · 2026-09-05 · 보안 P1
- [x] **[QLT-006](#qlt-006--로그-metadata에-저장-파일-경로가-남음)** 로그 metadata에 저장 파일 경로가 남음 · 2026-09-05 · 보안 P2
- [x] **[QLT-007](#qlt-007--tasks-프로젝트-crud-server-action이-쓰기-역할만-확인)** `/tasks` 프로젝트 CRUD server action이 쓰기 역할만 확인 · 2026-09-05 · 보안 P1
- [x] **[QLT-008](#qlt-008--dep0205-moduleregister-deprecation-경고-해소)** `[DEP0205]` deprecation 경고 해소 · 2026-09-05
- [x] **[QLT-009](#qlt-009--가시성권한-회귀-테스트-하네스-도입)** 가시성·권한 회귀 테스트 하네스 도입 · 2026-09-06
- [x] **[QLT-010](#qlt-010--프로젝트-crud-단일화-2026-10-09)** 프로젝트 CRUD 단일화 · 2026-10-09
- [x] **[QLT-011](#qlt-011--날짜계층첨부역할-회귀-확장-2026-10-09)** 날짜·계층·첨부·역할 회귀 확장 · 2026-10-09
- [x] **[QLT-012](#qlt-012--native-versioned-migration-2026-10-09)** native versioned migration · 2026-10-09
- [x] **[QLT-014](#qlt-014--필요한-next-타입-유지와-잔재-제외-2026-10-09)** 필요한 Next 타입 유지와 잔재 제외 · 2026-10-09

---

## 1. ID 체계 도입 이전에 인도된 기능

아래는 항목 단위 추적을 시작하기 전에 완료된 단계다. 번호를 소급 부여하지 않는다.

| 단계 | 범위 | 결과물 |
| --- | --- | --- |
| 1 | Next.js 16 + TypeScript + MUI + NextAuth 기반 | `app/layout.tsx`, `src/shared/config/theme`, `src/entities/user` |
| 2 | MariaDB 연결, User/Project 모델, 슈퍼관리자 DB 관리 | `src/shared/server/{database,runtime-env,database-admin}`, `/admin/database` |
| 3 | 태스크(WBS) CRUD + 게스트/멤버 쓰기 정책 | `src/entities/task`, `/tasks` |
| 4 | frappe-gantt 간트 차트 연동 | `src/widgets/project-gantt` |
| 5 | 제출물 기능 | `src/entities/submission` |
| 6 | 댓글 기능 | `src/entities/comment` |
| 7 | 파일 업로드·다운로드 | `src/entities/submission/api/submission-files.server.ts`, 2개 attachment route |
| 역할 확장 | 4단계 역할 + 제출물 public/private | `src/entities/user`, `SubmissionVisibilityFilter` |
| 운영 | 롤링 파일 로그, 구조화 행동 로그, 관리자 로그/세팅 화면, APP_PORT 하네스 | `src/shared/server/logging`, `/admin/logs`, `/admin/settings`, `scripts/run-next.ts` |
| 개인정보 | `/privacy` 안내, 관리자 명시 확인 기반 프로젝트 파기 | `app/privacy`, `/admin/projects` |

---

## 2. 완료 항목

<a id="t-001--eslint-기준선-확보"></a>

### QLT-001 — ESLint 기준선 확보

**완료** 2026-08-09 · 분류 품질·운영

오류 10건·경고 7건을 해소해 `npm run lint`를 0/0 기준선으로 만들었다.

남길 가치가 있는 부분은 **무엇을 검사 대상에서 뺐고 왜인가**이다. `eslint.config.mjs`에서 제외한 것은 세 종류다.

- `**/._*` — 저장소가 외장 볼륨(exFAT)에 있어 생기는 AppleDouble 잔재. 소스가 아니다.
- `.github/skills/**` — 벤더 스크립트. 이 저장소의 규칙을 적용할 대상이 아니다.
- 생성물·fixture — 의도적으로 규칙을 위반하는 입력이다.

문서 생성용 CommonJS 스크립트에는 `sourceType: "commonjs"` override를 적용했다. 이 제외 목록을 모르면 "lint가 왜 이 파일을 안 잡지"를 반복해서 조사하게 된다.

---

<a id="t-002--feature-sliced-design-구조-정리-8단계"></a>

### QLT-002 — Feature-Sliced Design 구조 정리 (8단계)

**완료** 2026-08-12 · 분류 구조

`src/shared → src/entities → src/features → src/widgets` 4레이어로 이동을 마쳤다. 단계별 파일 매핑은 [FSD_MIGRATION_PLAN.md](FSD_MIGRATION_PLAN.md)에 있다.

이후 작업에 계속 영향을 주는 결정 세 가지:

1. **루트 `app/`을 옮기지 않았다.** App Router 엔트리로 유지하고 `src/app`, `src/pages`는 만들지 않는다. 라우팅 규약과 레이어 규약을 섞지 않기 위해서다.
2. **의존 방향과 구축 순서는 반대다.** 허용 방향은 `app → widgets → features → entities → shared`이고, 만들거나 옮기는 순서는 `shared → … → app`이다.
3. **경계를 문서가 아니라 게이트로 고정했다.** `scripts/check-fsd-boundaries.ts`가 `layer-direction`, `cross-slice`, `deep-import`, `unknown-layer`, `client-server`를 오류로 막는다. 검사기가 조용히 망가진 채 통과하는 것을 막으려고 fixture self-test 5건을 저장소 검사보다 먼저 실행한다.

`cross-slice`가 오류라는 점이 특히 자주 걸린다. 같은 레이어의 다른 슬라이스를 직접 참조할 수 없으므로, 두 entity가 공유해야 하는 것은 `shared`로 내리거나 상위 레이어에서 조립해야 한다. QLT-003의 `IdScope`가 `src/shared/server/query-scope`에 놓인 이유가 이것이다.

검증: `npm run check:fsd`, `typecheck`, `lint`, `build` 통과.

---

<a id="t-003--비공개-제출물의-파생-데이터가-client-payload로-노출"></a>

### QLT-003 — 비공개 제출물의 파생 데이터가 client payload로 노출

**완료** 2026-09-05 · 분류 보안 · 심각도 P0

**증상.** `app/tasks/page.tsx`가 제출물 목록에만 `SubmissionVisibilityFilter`를 적용하고, 댓글·첨부는 `listCommentsByProject`/`listAttachmentsByProject`로 프로젝트 전체를 조회한 뒤 그룹화 결과 **전체**를 client widget props로 넘겼다. 조회 권한이 없는 비공개 제출물의 댓글 본문, 작성자 이메일, 첨부 파일명, 저장 경로가 RSC payload에 실려 브라우저까지 도달했다. 화면에 카드가 보이지 않을 뿐이었다.

**원인 패턴.** 가시성을 **부모 자원(제출물)에만** 적용하고 파생 자원(댓글·첨부)에는 적용하지 않았다. UI에서 안 보이는 것을 보호되는 것으로 착각한 전형적인 경우다.

**조치.** 두 repository 함수에 **필수** `IdScope` 인자를 추가하고, 페이지가 가시 제출물 id 집합으로 질의를 제한하게 했다. 범위 helper는 `src/shared/server/query-scope`다.

같은 실수가 반복되지 않게 한 설계 선택 두 가지:

- **안전한 기본값을 두지 않았다.** 인자가 선택적이었다면 새 호출부가 조용히 전체 조회로 돌아간다. 필수로 만들어 타입 검사에서 걸리게 했다. 같은 이유로 `listSubmissionsByProject/ByTask`의 기존 기본값 `{ canSeeAll: true }`도 제거했다.
- **빈 범위와 전체 조회를 구분했다.** `{ ids: [] }`를 "조건 없음"으로 처리하면 프로젝트 전체가 새어 나간다. `isEmptyIdScope`가 이 경우를 질의 생략으로 돌린다. 파기·삭제처럼 진짜 전체가 필요한 관리 경로만 `{ unrestricted: true }`를 명시한다.

**회귀 방지.** `tests/visibility.e2e.test.ts`의 1번·5번 블록. `IdScope`를 무시하도록 되돌려 확인했고 6건이 실패했다.

---

<a id="t-004--제출물댓글-mutation에-작성자-ownership-검사-없음"></a>

### QLT-004 — 제출물·댓글 mutation에 작성자 ownership 검사 없음

**완료** 2026-09-05 · 분류 보안 · 심각도 P1

**증상.** `updateSubmissionAction`, `deleteSubmissionAction`, `updateCommentAction`, `deleteCommentAction`이 `requireWritableSession`(쓰기 역할)만 확인했다. 임의의 `member`가 타인의 제출물·댓글을 수정·삭제할 수 있었다. `updateSubmissionAction`은 `visibility`도 함께 덮어쓰므로 **타인의 비공개 제출물을 공개로 바꾸는 경로**가 됐다. `updateCommentAction`은 대상 댓글이 폼에 담긴 submission/project에 실제로 속하는지도 확인하지 않았다.

**원인 패턴.** "쓸 수 있는가"(역할)와 "이것을 쓸 수 있는가"(소유권)를 구분하지 않았다. 그리고 상위 관계를 폼이 보낸 값 그대로 신뢰했다.

**조치.** `src/features/task-workspace/server/actions.ts`에 세 단계 guard를 두었다.

| guard | 하는 일 |
| --- | --- |
| `requireVisibleSubmission` | 폼이 주장한 project → task → submission 관계를 서버에서 재확인하고 뷰어 공개 범위도 적용 |
| `requireOwnedSubmission` | 위 + 작성자 본인이거나 `canManageAllSubmissions` actor일 것 |
| `requireOwnedComment` | 위 + 댓글이 그 제출물에 실제로 속하고 작성자 본인이거나 관리자일 것 |

create 경로(`createSubmissionAction`, `createCommentAction`)도 상위 관계를 재확인한다. 볼 수 없는 자원은 "권한 없음"이 아니라 **존재하지 않는 자원과 같은 오류**로 처리해 id 열거로 존재 여부를 알아내지 못하게 했다.

**주의할 구현 제약.** Next의 `redirect()`는 `NEXT_REDIRECT` digest를 가진 오류를 던진다. 따라서 redirect를 하는 인증 guard는 `try` 블록 **밖**에서 호출해야 하고, 평범한 오류를 던지는 소유권 검사는 안에서 호출해야 한다. 순서를 바꾸면 로그인 리다이렉트가 오류 메시지로 둔갑한다.

**회귀 방지.** `tests/visibility.e2e.test.ts`의 3번 블록. 소유권 검사를 제거해 확인했고 2건이 실패했다.

---

<a id="t-005--단건-조회-getsubmissionbyid가-unscoped"></a>

### QLT-005 — 단건 조회 `getSubmissionById`가 unscoped

**완료** 2026-09-05 · 분류 보안 · 심각도 P1

**증상.** 단건 조회에 공개 범위가 적용되지 않았다. 당시 두 attachment route는 조회 후 `canViewSubmission`으로 막고 있어 다운로드 경로 자체는 닫혀 있었지만, 새 소비자가 이 사후 검사를 빠뜨리기 쉬운 형태였다.

**조치.** `getSubmissionByIdForViewer(id, filter)`를 추가해 공개 범위를 질의에 적용하고, 두 route를 사후 검사에서 이 함수로 교체했다. 볼 수 없는 제출물은 없는 제출물과 같이 `null`로 돌아온다.

`SubmissionVisibilityFilter`에 `viewerEmail`을 추가했다. 화면 경로는 DB 사용자 id를 이미 갖고 있지만 route handler는 세션 이메일만 갖는데, 이것 때문에 handler마다 사용자 조회를 한 번 더 하는 것은 낭비다. 이메일 비교는 `LOWER(users.email)`로 하므로 대소문자·공백에 좌우되지 않는다.

`getSubmissionById`는 지우지 않고 남겼다. actor 권한을 이미 검증한 mutation 경로에는 필요하다. 대신 **그 용도 전용임을 JSDoc으로 못박았다.**

**회귀 방지.** `tests/visibility.e2e.test.ts`의 2번·4번·5번 블록. 특히 4번은 "볼 수 없는 자원"과 "없는 자원"의 응답이 상태 코드와 본문 모두 동일한지 확인한다.

---

<a id="t-006--로그-metadata에-저장-파일-경로가-남음"></a>

### QLT-006 — 로그 metadata에 저장 파일 경로가 남음

**완료** 2026-09-05 · 분류 보안 · 심각도 P2

**증상.** 첨부 정리 실패 로그가 `filePath`를 그대로 기록했다. 비공개 산출물의 저장 경로와 업로드 디렉터리 구조가 로그로 새어 나갔다.

**조치.** 호출부를 하나씩 고치는 대신 **기록 지점 한 곳**에서 막았다. `src/shared/server/logging`이 `REDACTED_METADATA_KEYS`(`filePath`, `storedFilePath`, `absolutePath`, `uploadDir`, `path`)를 `[redacted]` 또는 `[redacted]:<확장자>`로 축약한다.

호출부가 아니라 기록 지점을 고른 이유는, 앞으로 추가되는 action에도 자동으로 적용되기 때문이다. 확장자만 남기는 것은 장애 조사에 필요한 최소 단서와 비식별화를 절충한 것이다. `fileName`은 감사 목적상 유지한다.

**회귀 방지.** `tests/log-redaction.test.ts`. 실제로 로그 파일을 쓰고 다시 읽어, 축약된 값에 디렉터리 구조나 원본 파일명 조각이 남지 않는지 확인한다.

---

<a id="t-007--tasks-프로젝트-crud-server-action이-쓰기-역할만-확인"></a>

### QLT-007 — `/tasks` 프로젝트 CRUD server action이 쓰기 역할만 확인

**완료** 2026-09-05 · 분류 보안 · 심각도 P1

**증상.** `app/tasks/actions.ts`가 `createProjectAction`, `updateProjectAction`, `deleteProjectAction`을 export한다. `/tasks` 화면에는 이 폼이 없지만 구현부는 `canWriteTaskContent`만 확인했다. `member`가 프로젝트를 cascade 삭제(태스크·제출물·댓글·저장 파일)할 수 있었다.

**여기서 얻을 교훈이 핵심이다.** `"use server"` 모듈에서 export된 함수는 **화면에 폼이 없어도** 호출 가능한 엔드포인트로 등록된다. "UI에서 도달할 수 없으니 안전하다"는 추론은 Server Action에 성립하지 않는다. 새 action을 추가할 때는 화면 노출 여부와 무관하게 권한을 확인해야 한다.

**조치.** `requireProjectAdminSession`(`canAccessAdminPanel`)으로 막았다. 프로젝트 관리는 `/admin/projects` 전용이라는 기존 문서상 정책과 코드를 일치시킨 것이다.

**남은 부채.** 이 조치는 권한 구멍만 막았고 중복 자체는 남겼다. → QLT-010

**회귀 방지.** `tests/visibility.e2e.test.ts` 3번 블록의 "프로젝트 CRUD server action은 관리자 이상만 호출할 수 있다".

---

<a id="t-008--dep0205-moduleregister-deprecation-경고-해소"></a>

### QLT-008 — `[DEP0205] module.register()` deprecation 경고 해소

**완료** 2026-09-05 · 분류 품질·운영

`npm run build`와 `npm run check:fsd`에 Node v26의 deprecation 경고가 남아 있었다. 원인은 `tsx@4.21.0` 로더였고 4.23.13으로 올려 사라졌다.

기록해 둘 만한 것은 **경고의 출처가 이 저장소 코드가 아니라 실행 도구였다는 점**이다. 비슷한 경고가 다시 보이면 소스보다 로더·툴체인 버전을 먼저 본다.

---

<a id="t-009--가시성권한-회귀-테스트-하네스-도입"></a>

### QLT-009 — 가시성·권한 회귀 테스트 하네스 도입

**완료** 2026-09-06 · 분류 품질·운영

[HARNESS_MAP.md](HARNESS_MAP.md) 6절에 사양으로만 있던 fixture를 실행 가능한 게이트로 만들었다. `npm test` — 단위 14건 + 가시성 e2e 33건.

설계 결정과 그 이유:

- **러너는 Node 내장 `node:test`.** 새 테스트 의존성을 추가하지 않았다.
- **인가 로직은 production 코드를 그대로 실행한다.** `tests/helpers/bootstrap.ts`가 `next-auth`의 `getServerSession`만 대체해 세션을 주입한다. guard를 테스트용으로 다시 구현하면 검증 대상이 사라진다.
- **스키마는 앱의 `initializeDatabaseSchema()`를 호출한다.** 테스트가 별도 DDL을 들고 있으면 운영 스키마와 조용히 어긋난다.
- **fixture는 테스트마다 재시드한다.** 어떤 테스트가 자원을 지워도 다음 테스트의 전제가 흔들리지 않는다.
- **Server Action 결과는 `NEXT_REDIRECT` digest를 파싱해 판정한다.** action이 성공·실패를 모두 `redirect()`로 끝내기 때문이다.

**하네스 자체를 검증했다.** 통과만으로는 아무것도 보장하지 않으므로, QLT-003과 QLT-004의 수정을 일부러 되돌려 테스트가 실제로 깨지는지 확인했다(각각 6건·2건 실패). 이후 복구하고 다시 전부 통과시켰다. 새 테스트를 추가할 때도 같은 방식으로 확인하는 편이 좋다.

**환경 관련 실측.** 이 머신에서는 Docker Hub 이미지 수신이 극히 느리다(3MB 이미지도 150초 내 실패, MariaDB 481MB는 약 40분). 그래서 `scripts/test-database.ts`가 백엔드를 자동 선택한다 — docker 이미지가 있으면 compose, 없으면 Homebrew MariaDB. 접속 계약은 양쪽 모두 `127.0.0.1:3307 / wbs_app_test`로 같고, 개발용(3306)과 포트·DB 이름이 분리되어 있다. `_test`로 끝나지 않는 DB 이름은 하네스가 거부한다. 두 백엔드 모두 실제로 실행해 47건 통과를 확인했다(Homebrew 12.3.3, Docker 11.4.13).

**부수적으로 발견한 것.** `src/shared/server/logging/logging.server.ts`가 `server-only`을 import하는데 패키지가 설치되어 있지 않았다. Next 번들러가 자체 alias로 가려주고 있어 빌드는 통과했지만, 평범한 Node 실행에서는 해석되지 않는다. 의존성으로 추가했다.

**검증 범위 밖.** HTTP 계층(미들웨어·OAuth 로그인)과 캐시 무효화(`revalidatePath`는 no-op으로 대체)는 확인하지 않는다. 자세한 한계는 [HARNESS_MAP.md](HARNESS_MAP.md) 6절에 있다.

---

## 참고 문서

- [TODO.md](TODO.md) — 진행 중인 항목과 ID 규칙
- [ARCHITECTURE.md](ARCHITECTURE.md) — 인증·인가·가시성·데이터 경계
- [HARNESS_MAP.md](HARNESS_MAP.md) — 실행·검증 하네스
- [FSD_MIGRATION_PLAN.md](FSD_MIGRATION_PLAN.md) — 8단계 구조 이동 계약


## OPS-022 — Sites Worker 전환 및 공개 게시 (2026-10-08)

기존 Google/NextAuth·MUI·역할 정책을 보존하여 D1/R2로 전환했다. 공식 save/deploy 결과 version1 terminal succeeded와 공개 URL을 확인했다. Node 단위14, Worker auth18, D1/R2 57, 실제 Worker HTTP92건 통과. 배포 SHA9938b584c08f805f1321061643a1b3fb6339260e. main과 이전 컨테이너 실측은 보존했다. 사용자 브라우저에서 로그인 성공이 보고됐고, 보호 화면 및 지정 계정 실환경 작업은 OPS-023/OPS-024로 따로 추적한다. [배포/디스크 기록](SITES_PUBLICATION_2026-10-08.md).

## OPS-025 — hosted 관리자 runtime 표시 정정 (2026-10-08)

- D1 대상 undefined, MariaDB/파일 로그/로컬 설정 안내 잔재를 runtime별로 분리했다. 로그의 날짜·보존 기간·저장 단위 설명과 ordinary admin/superuser 소개를 실제 동작에 맞췄다. 인가·설정·저장소 동작은 바꾸지 않았다.
- unit 17 / D1-R2 57 / Worker HTTP 112 / auth 18, lint/typecheck/FSD/build 통과. 독립 읽기 전용 리뷰 통과.
- commit `8fc2cc69cdc8548739ae9ae2ed208ebc6fe47ce7`, tree `684bd70633a73fe21aacdc8b4155e8570db4582a` GitHub push 및 Site source 일치. version 2 / deployment `appgdep_6ac79a4f82888191b8617754bdb85177` 13:27:53 UTC succeeded, 환경 revision 11 유지.
- 같은 소유자 세션에서 /admin 새로고침 후 D1/R2·슈퍼관리자·Sites 설정·감사 보존 안내를 직접 확인했다.

## OPS-026 — 격리 Worker 업무 흐름 회귀 검증 (2026-10-08)

- 실제 빌드 workerd에 합성 JWT와 로컬 D1/R2를 사용하여 프로젝트 생성·수정·파기 확인, 부모/자식 task 생성·수정·삭제 후 재루팅, private 제출 및 동일 파일명 추가업로드·조회·삭제, 댓글 CRUD를 검사했다. 다른 멤버의 private 조회·수정·댓글 금지, guest task 삭제 금지, member project 생성 금지를 직접 HTTP Server Action으로 검증했다.
- 새 계약 37개를 포함해 `npm run test:sites:http` 149개 통과. 기존 57개 storage 계약은 중단/실패 업로드·보상 실패·삭제 복구/backoff를 포함해 재검증했다.
- 첫 테스트의 edit action 추출은 Client dialog가 action을 RSC reference로 전달하는 구조 때문에 실패했다. UI에서 제공된 serialized reference도 해석하도록 테스트를 바로잡고 재실행했다. 제품 코드 결함은 발견하지 않았다.
- 모든 생성/삭제는 격리 Miniflare 합성 데이터다. 실서비스 생성·수정·업로드·삭제 검증으로 계산하지 않는다. 테스트-only 변경이므로 배포된 앱 코드는 OPS-025 버전을 유지한다.

## OPS-023 — 인증 후 보호 화면 실환경 브라우저 검증 (2026-10-08)

소유자가 직접 로그인한 클라우드 브라우저로 /tasks, /admin, /admin/database, /admin/settings, /admin/logs를 확인했다. 별도 승인된 합성 프로젝트에서 생성·수정·업로드·다운로드 및 1180px/502px 표시를 검증했다. [상세 근거와 한계](SITES_LIVE_QA_2026-10-08.md). 실환경 다른 사용자 계정/role 변경, 강제 장애 주입, 영구 파기는 수행하지 않았다. 삭제는 OPS-024에서 별도 확인한다.

## OPS-024 — 승인된 실환경 QA 데이터 정리 (2026-10-08)

실환경 CRUD/다운로드 검증 후 사용자에게 project 1 / tasks 1·2 / submissions 1·2 / comment 1 / attachments 1·2·3의 영구 파기를 확인받았다. 14:04 UTC 정리 직전에 대상 변동이 없음을 재확인하고 정상 관리 UI로 파기했다. 성공 안내 및 5개 데이터 테이블·정리 ledger 0건, 사용자 1명(admin)과 감사 기록 보존을 확인했다. [실환경 QA 기록](SITES_LIVE_QA_2026-10-08.md). 이 승인은 미래의 임의 데이터 삭제에 대한 포괄 승인으로 사용하지 않는다.

## OPS-027 — 비공개 버그 제보·리뷰 게시 (2026-10-08)

- guest 포함 인증 사용자의 본인 제보, admin/superuser 검토, 원문 보존과 append-only 처리 기록, SQL 조회 범위와 원자적 version/idempotency 검사, D1/Node additive schema를 구현했다. 외부 전송/알림/첨부/자동 실행/일반 삭제 기능은 추가하지 않았다.
- 원격 commit `f294edd620bee5cc557989a690e95dddfefb1354`, exact tree `da81b6eadfe58f61dfc6a9a2853840c46eb92e85`. [검증 계약](BUG_REPORTS.md).
- version 3 `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_7648d00bc3448191be2a284d814dc067`, deployment `appgdep_6ac7a743cd608191882d9a80fc0d84dd` 14:23:10 UTC succeeded. public/환경 revision 11 유지.
- 실제 owner 세션으로 /bugs, /admin/bugs 메뉴·검색·필터·empty state와 1181px/503px form layout을 확인했다. 수평 overflow 없음, desktop 창 복원. D1 두 신규 테이블은 비어 있고 기존 사용자·감사 기록은 유지된다. 현재 실제 제보 쓰기는 OPS-029 승인 대기이며 local 합성 Worker 검증과 구분한다. Native MariaDB 실행은 OPS-028에서 별도로 추적한다.

## OPS-028 — Node/MariaDB 동시 검토 및 테스트 로더 호환성 (2026-10-08)

- 수정 commit `f31f9dc18ca9848e648035ed602cba5b9731d9f1`의 실제 saved-cloud 재검증 결과: Node26.11.1/npm11.20/MariaDB11.4.13/connector3.5.2. 외부 NODE_OPTIONS 없이 `npm test -- --require-db` unit30+DB33 PASS, skip0; lint/typecheck/FSD5 PASS; native bug17와 retry boundary23 PASS.
- 별도 동시성160회에서 API 결과·state/history 계약 PASS. 서로 다른 token/같은 version은 40회 모두 승자1+정상 stale1; 같은 token/같은 version은 40회 모두 양쪽 성공+event1. 생성40회 성공80, same-token/different-version40회 성공64/stale16. 노출된 SQL 오류나 외부 요청 재시도 없음.
- 내부 deadlock 268건은 없어지지 않았으며 제한된 rollback-confirmed 재시도가 처리했다. 최대3회, 1205/SQL/auth/connection/uncertain commit/rollback·release 실패는 재시도하지 않는다. boundary23은 mock connection 테스트이며 실제 네트워크 fault injection이 아니다.
- synthetic DB451reports/817events에서 version/count/max-version mismatch·duplicate version·orphan 0. fixture DB는 정지 보존했고 원본 측정 환경/기존57개 증거 hash는 바꾸지 않았다는 해당 작업 보고를 받았다.
- 위 exact commit은 React19.2.6이다. 이후 19.2.8 security patch의 native 전체 실행 결과로 확대 해석하지 않는다. Sites D1 계약은 별도 검증이다.

## OPS-030 — 실제 Worker RSC decoder 보안 패치 (2026-10-08)

- React/react-dom/react-server-dom-webpack만 19.2.8로 고정하여 GHSA-wx67-qw84-cm4g를 수정했다. direct-package alias와 active artifact fingerprint를 독립 검토했다. [범위·근거](SECURITY_PATCH_2026-10-08.md).
- 원격/게시 commit `9a5367d607ce9a515b794d9a963a673a404a00f9`, tree `7b860f4dc247b4582ee8c2c2cbac1b13994068de`.
- version4 `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_1e4ba05b765c8191b8fa314649acf891`, deployment `appgdep_6ac7b2f65b08819184da0c608035c5f8` 15:13:05 UTC succeeded. public/환경 revision11 유지.
- unit30, actual WorkerHTTP185/auth18, D1bug26/storage57, lint/types/FSD/build 및 static decoder checker 통과. 기존 소유자 세션과 승인된 실제 report 작성/검토 흐름도 확인했다. 전체 의존성 advisory 해소는 OPS-032와 구분한다.

## OPS-029 — 버그 제보·리뷰 실환경 쓰기 검증 (2026-10-08)

승인된 합성 report1 한 건으로 제보→추가 설명→검토 중→해결, 원문 보존, Git SHA 기록, 검색/상태 필터를 실제 브라우저에서 확인했다. version4와 events1–4를 native read-only DB 도구로 확인했다. [상세](SITES_BUG_QA_2026-10-08.md). 기존 사용자/역할/운영 데이터 변경 없음. 삭제는 실행하지 않았으며 OPS-031에서 지원 경로와 별도 승인을 결정한다.


## QLT-010 — 프로젝트 CRUD 단일화 (2026-10-09)

사용자 요청에 따라 미사용 `task-workspace` 프로젝트 생성·수정·삭제 action 3개와 `/tasks` adapter 3개를 제거했다. 호출처 조사에서 실제 UI는 `/admin/projects`의 `project-manage` action만 사용했다. task/submission/comment 기능, 관리자 확인·로그·파일 정리와 `/tasks`, `/admin/projects` URL은 그대로다. 이전 QLT-007에서 막은 중복 권한 경로까지 정리했다.

회귀: canonical route에서 anonymous/guest/member의 3가지 action 거부 9건, admin/SU의 파기 확인 누락 거부 2건을 DB 없는 테스트로 추가했다. 기존 native 가시성 suite의 프로젝트 거부 검사를 canonical adapter로 옮겼다. 독립 참조/인가 검토에서 결함 없음.

검증: lint 0/0, typecheck, FSD self-test 5 및 경계, unit 41, Worker build 통과. native MariaDB suite는 이 dot 환경의 127.0.0.1:3307 ECONNREFUSED로 미실행이며 통과로 계산하지 않는다. Worker 인증/decoder 검사 결과는 HARNESS_MAP 최신 항목에 기록한다. 운영 데이터 파기나 역할 변경은 수행하지 않았다.


## QLT-014 — 필요한 Next 타입 유지와 잔재 제외 (2026-10-09)

`next-env.d.ts`는 Next가 생성하고 Git에서는 제외하는 정상 타입 진입점이다. 설치된 Next16 공식 문서(`01-app/03-api-reference/05-config/02-typescript.md`)도 gitignore와 tsconfig include를 동시에 요구한다. 따라서 파일·include를 삭제하지 않았다. 사용자 요청의 “불필요하면 정리”에 따라 AppleDouble `**/._*`만 tsconfig exclude에 추가해 기존 Git/lint/FSD 제외와 맞췄다. 실제 사용자 파일을 삭제하지 않았다.

함께 확인된 `types/next-auth.d.ts`의 제거된 `@/models/user` 참조는 현재 public API `@/src/entities/user`로 교정했다. typecheck, lint 0/0, Sites Worker build 통과. Node/Next native build는 이번 체크포인트에서 미실행이며 필요 타입을 유지하는 결정을 빌드 삭제 실험으로 대체하지 않는다.


## QLT-011 — 날짜·계층·첨부·역할 회귀 확장 (2026-10-09)

- 날짜: action과 repository에서 실제 YYYY-MM-DD·윤년·1000~9999년·동일일·역전 범위를 검증한다. D1 TEXT에 잘못된 날짜가 저장되는 문제를 수정했다.
- 계층: task 수정의 projectId/taskId 관계 검사를 추가했다. 실제 Worker에서 3단계 생성, self/descendant/cross-project 부모 거부, subtree 이동·분리와 depth/order 보존을 확인했다. order_index는 고유 ID가 아닌 정렬 키이며 기존 created_at/id tie-breaker를 유지한다. 동시 구조 재편의 직렬화나 새 배정 정책은 이번 범위가 아니다.
- 첨부: native 경로도 빈/절대/역슬래시/점 세그먼트/제어문자 key를 거부한다. 한글·위험 파일명 정리, 빈/초과 크기, 20개/21개 및 개별·합계20MiB 경계, 잘못된 edit의 원본 보존을 검사했다. 두 다운로드 route의 MIME inline allowlist·RFC5987 파일명·private/no-store·nosniff·sandbox를 통일하고, legacy route의 오래된 DB 크기 사용을 실제 저장 크기로 수정했다.
- 역할: 실제 Worker의 anonymous/guest/member 거부, admin의 guest/member 허용 및 admin/위조값 거부, SU의 허용 역할, 없는 사용자·보호 SU 대상 거부를 로컬 합성 계정으로 검사했다. 운영 계정/권한은 변경하지 않았다.

검증: unit69, 실제 Worker quality375, lint0/0, typecheck, FSD5/경계, Worker build PASS. 독립 리뷰의 정상 edit 대조군 누락 2개를 보강한 뒤 재검증했다. HTTP375는 로컬 서명 JWT와 ephemeral D1/R2로 실행했으며 Google OAuth 또는 live 다중 계정 검증을 뜻하지 않는다. Worker가 streaming Content-Length를 제거할 수 있어 HTTP는 실제 bytes/헤더를, 직접 route 테스트는 오래된 metadata999와 실제3byte 구분을 검사한다.

`npm run test:sites:quality`는 delete/purge/기존 destructive fixture를 실행하지 않는다. 공식 Miniflare `cf:false`로 외부 cf.json 메타데이터 조회도 제거했다. native MariaDB DB 회귀는 QLT-012의 전용 additive 하네스 결과와 별도로 구분한다.


## QLT-012 — native versioned migration (2026-10-09)

기존 mutable 초기화 경로를 불변 v1 명세, version/name/checksum/applied_at ledger, DB별 연결 lock과 postcondition 검증으로 전환했다. 명시적인 schema 연결만 DDL을 수행하고 일반 runtime/readiness는 별도다. D1 게시 migration은 변경하지 않았다.

실제 MariaDB11.4.13 / Node26.11.1 / npm11.20, lockfile와 React19.2.8이 일치하는 `cecce92e06c0b042441352445f4ce9856c6bc87e`에서 전용 additive 하네스 **27 PASS**. fresh 설치, legacy core/pre-lifecycle upgrade, 원문·private·admin/member role·이력 보존, fresh 동시 runner, DDL 후 ledger 전 중단/재개, autocommit0 ledger 내구성, 대문자/공백 role·prefix index·charset·checksum 오류 거부를 확인했다. 독립 리뷰에서 지적된 schema 오류정보 비노출과 보존 조건도 반영했다.

첫 실행은 DB 미기동으로 SQL 전에 실패했으나, 사용자 승인 후 새 격리 영속 DB/테스트 계정으로 재실행했다. 생성한 합성 DB10개/테이블100개는 모두 보존했고 정지·재기동 전후 schema/data snapshot이 일치했다. 기존 DB 파일719개와 artifact21개는 그대로이며 마지막에는 DB를 정지해 loopback3307 listener가 없다. 기존 destructive fixture·purge나 운영 DB를 사용하지 않았다.

복구 계약은 [Native 운영](NATIVE_DATABASE_MIGRATIONS.md)에 있다. MariaDB DDL의 implicit commit 때문에 자동 down/transaction rollback을 제공하지 않는다. 현재 상태 확인 후 idempotent 재개/forward fix, 필요 시 승인된 백업 복원을 사용하며 ledger를 강제로 수정하지 않는다. 실제 운영 schema 적용과 runtime 최소권한 변경은 이번 완료에 포함되지 않고 QLT-013에서 별도로 추적한다.


# 팀 업무 P0 완료 (2026-10-09)

게시 source `82d7d516ef34ed8718dbfe09d6189b7f81cacfe8` / version9. 상세 증거·실환경 합성 ID·미실행 범위는 [P0 인수 결과](P0_ACCEPTANCE_2026-10-09.md)에 있다. 기능 완료와 모든 가능한 경합/실계정 검증 완료를 혼동하지 않는다.

## PRD-033 — 일반 팀원의 프로젝트 전환 (2026-10-09)

모든 인증 사용자가 기존 조회 범위에서 프로젝트를 선택한다. 관리자 관리 버튼은 기존 권한을 유지하고 프로젝트 전환 시 이전 taskId를 제거한다. Worker의 두 프로젝트/5역할/직접 링크와 실제 모바일 두 프로젝트 전환·Back 복귀를 확인했다.

인수 범위(원래 체크리스트 보존):

- member/guest는 조회 권한이 있는 프로젝트를 화면에서 전환할 수 있고, 생성·수정·파기 버튼은 기존 관리자 정책을 따른다.
- 프로젝트 2개가 있는 계정으로 전환·직접 링크·뒤로 가기를 확인한다. 담당 카드와 선택 프로젝트가 일치하며, 향후 PRD-035의 범위 제한도 동일 조회에 적용한다.

## PRD-034 — 주제 목표와 카드별 완료 기준 (2026-10-09)

프로젝트 목표·성공 기준, 업무 기대 산출물·완료 기준·선택 검토 방식을 추가했다. 2,000자 plain-text 제한과 기존 빈 draft/생략 update 보존을 유지하며, 완료 시 필요한 기준은 상태·검토 transaction에서 검사한다. D1 추가 컬럼과 native v2 보존 migration을 검증했다.

인수 범위(원래 체크리스트 보존):

- 기존 프로젝트에 주제의 목적/성공 기준을, 카드에 기대 산출물과 확인 가능한 완료 기준을 작성·조회할 수 있다. 별도 주제 계층을 중복 생성하지 않는다.
- 예시 주제를 3개의 하위 카드로 나누면 각 카드에 책임·기한·제출 형식·검토 필요 여부가 명확하다. 기존 레코드의 값 없음과 새 카드 필수값 정책을 구분하여 기존 데이터를 보존한다.

## PRD-035 — 수행 가능한 담당자와 책임 분담 (2026-10-09)

현재 수행 가능한 member/admin/SU만 신규 담당자·검토자가 된다. 기존 member의 내용 편집 정책과 담당자/admin/SU의 상태 전이를 구분하고 재배정 이력을 남긴다. 역할 승급이나 private 열람 확대는 하지 않는다. 원자적 token/version 및 현재 actor/대상 자격, 5역할/교차 사용자 경계를 검증했다.

인수 범위(원래 체크리스트 보존):

- 담당자 후보와 서버 검증이 실제 수행 권한을 확인한다. 배정으로 계정 역할을 자동 승급하지 않고, 권한이 부족한 배정은 사유를 안내한다.
- 우선 주담당 1명+사람별 하위 카드로 분담하고, 공동 작업이 필요한 경우 기여자/검토자의 책임과 제출·상태 변경 범위를 명시한다. 재배정 이력과 이전 담당자의 접근 정책을 검증한다.
- 앱 역할과 프로젝트/업무 역할의 권한표를 확정한다. 현재 전체 인증 사용자 공개 범위 유지 vs 프로젝트 참여자 범위 도입을 구현 전에 결정한다. 기존 private 제출물을 공동 담당자/검토자에게 자동 공개하지 않는다.
- 두 member, guest, admin/SU의 다른 담당 카드·위조 ID·직접 action·첨부 접근을 권한표대로 검사한다. 실제 계정 역할/공개 범위 변경은 별도 승인 범위다.

## PRD-036 — 업무 상태와 실제 진척 (2026-10-09)

예정·진행·차단·검토 대기·수정 요청·완료와 근거/이력을 구현했다. 간트는 leaf 완료/전체 leaf를 집계하고 parent 관계를 선행조건으로 쓰지 않는다. no-review 완료는 담당자 제출·기대 산출물·완료 기준·근거가 필요하다. 실제 UI에서 완료1/3(33%)·남은 업무2와 개인 큐 제외를 확인했다.

인수 범위(원래 체크리스트 보존):

- 대기/진행/차단/검토 대기/완료의 상태·전이 계약과 권한·사유·시각을 정의한다. 기본 상태 변경은 여기서 인수하고, 제출/승인과 연결된 전이는 이 계약을 사용해 PRD-038에서 인수한다.
- 기간 경과를 업무 완료율로 표시하지 않는다. 기한 지난 미완료·미래의 당일 작업·차단 상태가 자동 100% 완료가 되지 않는다. 일정 경과율을 남기면 이름을 분명히 구분한다.
- 처음에는 주제별 남은 업무·상태별 카드 수·완료 카드 수 등 이해 가능한 기본 요약을 쓰고 부모/자식 중복 집계 규칙을 정한다. WBS `parentId`를 실제 선행조건으로 표현하는 현재 간트 매핑도 분리/명시하고, 진짜 의존성은 PRD-040에서 다룬다.

## PRD-037 — 원본이 남는 산출물 버전 (2026-10-09)

현재 projection과 불변 버전 snapshot/첨부/event를 같은 transaction으로 저장한다. 이전 본문·파일·자료 링크·변경 요약과 버전별 댓글을 보존하고 현재+과거 private 범위를 SQL마다 검사한다. 실제 v1/v2 업로드와 v2 이후 v1 다운로드 hash가 원본과 같았다. 버전 도입 이전 자료는 남아 있는 원문만 snapshot하고 과거 편집자를 꾸미지 않는다. 별도 차단된 동적 정리 경합은 QLT-015에 남겨 두며 이 완료에 포함하지 않는다.

인수 범위(원래 체크리스트 보존):

- 한 카드의 산출물에 v1/v2, 작성자·시각·변경 요약을 남기고, 이전 본문/파일과 최신본을 구분해 조회·다운로드한다. 기존 자료도 손실 없이 첫 버전으로 연결한다.
- 파일·자료 링크·혼합 제출의 지원 규칙을 명시한다. Markdown 링크 입력을 이미 가능한 기능으로 인정하고, 독립 링크 제출 UX와 안전한 URL 검증을 보완한다. 임의 외부 URL을 서버가 자동 조회하지 않는다.
- 댓글/검토가 어느 버전에 대한 것인지 남으며 수정으로 과거 승인 근거가 덮어써지지 않는다. 반복 클릭·업로드 중단·재시도·동시 수정에도 중복 버전이나 깨진 파일 참조가 생기지 않는다.
- 이전 파일을 포함해 기존 비공개 R2 접근 및 크기 제한/실패 정리 계약을 유지하고, 버전 보존·삭제 정책을 문서화한다.

## PRD-038 — 제출 검토 보완 재제출 승인 (2026-10-09)

현재 담당자의 특정 현재 버전 요청→지정 검토자의 보완→새 버전→승인 및 취소/재오픈을 구현했다. self-approval은 admin/SU도 거부하고 사유/원문 이력은 보존한다. 새 버전·재배정 등으로 현재 승인을 무효화하며 비공개 사유는 공개 task DTO에 넣지 않는다. 두 member의 정상 흐름·동시 판정·replay·rollback을 격리 Worker/MariaDB에서 확인했다. 실제 Google 다중 계정 흐름은 미실행이다.

인수 범위(원래 체크리스트 보존):

- 검토 필요한 카드에서 제출 → 검토 대기 → 사유 있는 보완 요청 → 새 버전 재제출 → 특정 버전 승인 흐름이 작동한다. 작성자/검토자·시각·판정 이력을 남긴다.
- 검토자 후보는 그 제출물을 실제로 조회할 권한이 있어야 한다. 검토자 지정만으로 private 접근이 늘지 않는다. 자체 승인·승인 취소·재오픈 정책을 확정하고 서버에서 검사한다.
- 승인된 제출 버전은 내용을 덮어쓰지 않고 변경 시 새 버전으로 생성한다. 새 버전은 이전 승인을 자동 상속하지 않으며, 동시 승인/보완 요청과 반복 제출은 최신 버전·중복 방지 계약으로 처리한다.
- 검토 불필요 카드는 허용된 담당자가 완료 기준과 근거를 남겨 완료한다. 단순 파일 업로드 횟수를 완료로 계산하지 않는다.

## PRD-039 — 내 업무와 내 검토 대기 (2026-10-09)

내 담당·내 기여·내 검토 대기를 프로젝트 전체에서 조회하고 실제 상태/기한 초과·20개 pagination으로 필터한다. count/list/link에 같은 현재 역할/visibility 조건을 사용하며 댓글 작성만으로 parent private 열람권을 부여하지 않는다. 양성 검토 대기1건과 정확한 version link는 Worker에서, 실제 모바일 담당 큐/완료 필터/선택 위치 복귀는 게시 UI에서 확인했다.

인수 범위(원래 체크리스트 보존):

- 여러 프로젝트의 내 담당/기여 업무를 한 화면에서 조회하고 기한·상태·지연·보완 요청·내 검토 대기로 좁힐 수 있다. 할 일이 없을 때와 접근 권한이 없을 때를 안내한다.
- 항목에서 정확한 프로젝트/카드/제출 버전으로 이동하고, 작업 후 필터와 선택 위치를 유지한다. 일반 member가 관리자 화면이나 수동 URL 입력 없이 사용한다.
- 목록·건수·페이지네이션·직접 링크는 같은 권한 필터를 사용한다. 모바일에서도 다음 행동을 찾을 수 있다.

## PRD-044 — 팀 업무 전체 흐름 인수 검증 (2026-10-09)

주제/업무3개/구성원2명/파일+링크/v1→보완→v2→승인/잔여 업무의 통합 합성 시나리오를 실제 Worker에서 확인했다. native additive 보존77, unit112, workflow412, quality375, mock auth18 및 lint/types/FSD/build를 통과했다. 실제 HTTPS에서는 기존 로그인1명으로 프로젝트2개·업무3개·v1/v2·다운로드 원본·댓글·no-review 완료·492px/light/dark를 검사했다. 실제 다중 Google 로그인, 별도 native 강등 interleaving, 차단된 cleanup 경합은 미실행이다. 첫 fixture503 후 재실행412 PASS의 차이는 QLT-016에 남겼다.

인수 범위(원래 체크리스트 보존):

- [전체 시나리오](TEAM_WORKFLOW_PLAN.md#팀-업무-인수-시나리오): 주제 1개 → 카드 3개 → 구성원 2명 분담 → 내 업무 → 파일+링크 v1 → 보완 요청 → v2 재제출/승인 → 남은 업무 요약을 합성 자료로 재현한다.
- guest/member/admin/SU, 다른 사용자 private 자료, 역할 갱신·세션 만료, 직접 링크·위조 action, 반복/중단 업로드·동시 검토를 검사한다. 격리 테스트와 실제 다중 계정 검증의 수행 여부를 별도로 기록한다.
- 날짜만 경과한 카드가 완료되지 않고 승인한 버전과 최종 자료가 일치한다. 한 화면의 성공 메시지뿐 아니라 DB 상태·이력·다운로드 원본과 권한을 확인한다.
- 각 구현 작업의 필수 lint/types/FSD/build 및 영향 회귀를 통과시키고, 완료된 전체 ID는 기존 규약대로 COMPLETED_LOG로 이동한다. 실환경 검증은 승인된 합성 대상과 계정 범위를 기록하고 운영 자료에 영향을 주지 않는다.


## PRD-040 — 주제 현황과 선후행 차단 (2026-10-09)

주제 현황/실제 선행 관계와 graph CAS, 완료 전 차단을 구현했다. 기존 WBS 계층과 분리하고 재오픈 시 후행 이력을 보존한다. 최종 D1/Worker와 native99+관계복원4, 독립 검토를 통과하고 version10에 게시했다. [인수 결과와 검증 한계](P1_ACCEPTANCE_2026-10-09.md)를 따른다. 실제 여러 Google 계정의 채워진 UI 검증과 로컬 템플릿 클릭 인수는 미실행이다.

인수 범위(원래 체크리스트 보존):

- PRD-036의 기본 상태 요약을 확장하여 미배정·지연·선후행 차단을 함께 보여주고 각 숫자에서 해당 카드로 이동한다.
- 업무 분해 계층과 “A가 끝나야 B 시작”을 별도로 표현한다. 실제 의존성은 순환/다른 프로젝트의 무권한 참조를 거부하고 차단 사유·해제 근거를 보여준다.
- 날짜 변경/완료/재오픈 후 요약이 일치한다. 초기 범위에서는 복잡한 가중치·자동 일정 재배치를 넣지 않는다.

## PRD-041 — 주제별 업무 분해 템플릿 (2026-10-09)

수동 예시 템플릿의 편집 가능한 미리보기·담당/날짜/제외·원자적 한 번 생성과 실패 복구를 구현했다. 기존 파일/권한을 복제하지 않는다. 최종 D1/Worker와 native99+관계복원4, 독립 검토를 통과하고 version10에 게시했다. [인수 결과와 검증 한계](P1_ACCEPTANCE_2026-10-09.md)를 따른다. 실제 여러 Google 계정의 채워진 UI 검증과 로컬 템플릿 클릭 인수는 미실행이다.

인수 범위(원래 체크리스트 보존):

- 예시 주제 템플릿에 업무 계층·설명·기대 산출물·완료 기준·상대 기한을 담고, 생성 전 미리보기에서 담당자/날짜/불필요 카드를 수정할 수 있다.
- 복제 후 원본 템플릿 변경이 생성된 업무를 바꾸지 않으며, 기존 사용자/비공개 파일·권한을 무심코 복제하지 않는다. 반복 실행 시 의도치 않은 중복 생성도 막는다.
- AI 자동 분해·자동 배정 없이 수동 템플릿만으로 인수한다. AI 보조는 이후 명시적으로 요청될 때 별도 검토한다.

## PRD-042 — 업무와 산출물 검색 (2026-10-09)

업무·제출 본문/파일명/작성자 검색과 범위/필터/pagination을 구현했다. count/list/snippet 전에 현재 역할 및 현재/과거 공개 범위를 적용한다. 최종 D1/Worker와 native99+관계복원4, 독립 검토를 통과하고 version10에 게시했다. [인수 결과와 검증 한계](P1_ACCEPTANCE_2026-10-09.md)를 따른다. 실제 여러 Google 계정의 채워진 UI 검증과 로컬 템플릿 클릭 인수는 미실행이다.

인수 범위(원래 체크리스트 보존):

- 업무 제목·설명, 제출 본문·파일명·작성자와 프로젝트/담당자/기한/상태 필터를 지원한다. 최신본/승인본/이전 버전의 검색 포함 규칙을 표시한다.
- 결과·snippet·건수·페이지네이션을 SQL 조회 단계에서 권한에 맞게 제한한다. 볼 수 없는 private 자료와 조회 권한 없는 프로젝트의 존재가 검색으로 드러나지 않는다.
- 먼저 저장된 텍스트/파일명 검색을 구현한다. 파일 내용 OCR·외부 문서 수집·벡터 검색은 필수 범위가 아니다.

## PRD-043 — 행동이 필요한 인앱 알림 (2026-10-09)

기존 배정·검토·댓글 event에서 수신자별 알림을 파생하고 읽음 receipt만 저장한다. 중복/재배정/검토 취소/권한 변경을 반영하며 외부 발송은 없다. 최종 D1/Worker와 native99+관계복원4, 독립 검토를 통과하고 version10에 게시했다. [인수 결과와 검증 한계](P1_ACCEPTANCE_2026-10-09.md)를 따른다. 실제 여러 Google 계정의 채워진 UI 검증과 로컬 템플릿 클릭 인수는 미실행이다.

인수 범위(원래 체크리스트 보존):

- 배정·검토 요청·보완 요청·승인/관련 피드백에 대해 대상자별 읽지 않은 알림과 해당 카드/버전 링크가 있다. 전체 변경을 모두에게 뿌리지 않는다.
- 중복 이벤트 재처리에도 같은 알림이 쌓이지 않는다. 재배정/권한 회수 이후에는 알림 제목·요약·직접 링크로 이전 자료가 노출되지 않는다.
- 알림과 보존할 업무 검토 이력을 구분한다. 외부 발송·정기 digest·새 OAuth 권한은 이 작업에서 활성화하지 않고 기존 RPT-020과 별도 승인 계약을 따른다.
