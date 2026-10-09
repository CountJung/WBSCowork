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
