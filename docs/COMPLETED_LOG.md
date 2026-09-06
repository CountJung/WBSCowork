# WBS 태스크 — 완료 기록

> **누적 문서** — 완료된 항목만 담는다. 진행 중인 일은 [TODO.md](TODO.md)에 있다.
> 최종 갱신: 2026-09-06

여기에는 **나중에 다시 참조할 가치가 있는 것만** 남긴다. 판단 기준은 "이 결정을 모르는 사람이 같은 실수를 반복할 수 있는가"다. 단순 작업(오타, 포맷, 의존성 범프)은 git 이력으로 충분하므로 옮기지 않는다.

각 항목은 [TODO.md](TODO.md)와 같은 ID 체계를 쓰며, 번호는 완료 후에도 바뀌지 않는다.

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

### T-001 — ESLint 기준선 확보

**완료** 2026-08-09 · 분류 품질·운영

오류 10건·경고 7건을 해소해 `npm run lint`를 0/0 기준선으로 만들었다.

남길 가치가 있는 부분은 **무엇을 검사 대상에서 뺐고 왜인가**이다. `eslint.config.mjs`에서 제외한 것은 세 종류다.

- `**/._*` — 저장소가 외장 볼륨(exFAT)에 있어 생기는 AppleDouble 잔재. 소스가 아니다.
- `.github/skills/**` — 벤더 스크립트. 이 저장소의 규칙을 적용할 대상이 아니다.
- 생성물·fixture — 의도적으로 규칙을 위반하는 입력이다.

문서 생성용 CommonJS 스크립트에는 `sourceType: "commonjs"` override를 적용했다. 이 제외 목록을 모르면 "lint가 왜 이 파일을 안 잡지"를 반복해서 조사하게 된다.

---

### T-002 — Feature-Sliced Design 구조 정리 (8단계)

**완료** 2026-08-12 · 분류 구조

`src/shared → src/entities → src/features → src/widgets` 4레이어로 이동을 마쳤다. 단계별 파일 매핑은 [FSD_MIGRATION_PLAN.md](FSD_MIGRATION_PLAN.md)에 있다.

이후 작업에 계속 영향을 주는 결정 세 가지:

1. **루트 `app/`을 옮기지 않았다.** App Router 엔트리로 유지하고 `src/app`, `src/pages`는 만들지 않는다. 라우팅 규약과 레이어 규약을 섞지 않기 위해서다.
2. **의존 방향과 구축 순서는 반대다.** 허용 방향은 `app → widgets → features → entities → shared`이고, 만들거나 옮기는 순서는 `shared → … → app`이다.
3. **경계를 문서가 아니라 게이트로 고정했다.** `scripts/check-fsd-boundaries.ts`가 `layer-direction`, `cross-slice`, `deep-import`, `unknown-layer`, `client-server`를 오류로 막는다. 검사기가 조용히 망가진 채 통과하는 것을 막으려고 fixture self-test 5건을 저장소 검사보다 먼저 실행한다.

`cross-slice`가 오류라는 점이 특히 자주 걸린다. 같은 레이어의 다른 슬라이스를 직접 참조할 수 없으므로, 두 entity가 공유해야 하는 것은 `shared`로 내리거나 상위 레이어에서 조립해야 한다. T-003의 `IdScope`가 `src/shared/server/query-scope`에 놓인 이유가 이것이다.

검증: `npm run check:fsd`, `typecheck`, `lint`, `build` 통과.

---

### T-003 — 비공개 제출물의 파생 데이터가 client payload로 노출

**완료** 2026-09-05 · 분류 보안 · 심각도 P0

**증상.** `app/tasks/page.tsx`가 제출물 목록에만 `SubmissionVisibilityFilter`를 적용하고, 댓글·첨부는 `listCommentsByProject`/`listAttachmentsByProject`로 프로젝트 전체를 조회한 뒤 그룹화 결과 **전체**를 client widget props로 넘겼다. 조회 권한이 없는 비공개 제출물의 댓글 본문, 작성자 이메일, 첨부 파일명, 저장 경로가 RSC payload에 실려 브라우저까지 도달했다. 화면에 카드가 보이지 않을 뿐이었다.

**원인 패턴.** 가시성을 **부모 자원(제출물)에만** 적용하고 파생 자원(댓글·첨부)에는 적용하지 않았다. UI에서 안 보이는 것을 보호되는 것으로 착각한 전형적인 경우다.

**조치.** 두 repository 함수에 **필수** `IdScope` 인자를 추가하고, 페이지가 가시 제출물 id 집합으로 질의를 제한하게 했다. 범위 helper는 `src/shared/server/query-scope`다.

같은 실수가 반복되지 않게 한 설계 선택 두 가지:

- **안전한 기본값을 두지 않았다.** 인자가 선택적이었다면 새 호출부가 조용히 전체 조회로 돌아간다. 필수로 만들어 타입 검사에서 걸리게 했다. 같은 이유로 `listSubmissionsByProject/ByTask`의 기존 기본값 `{ canSeeAll: true }`도 제거했다.
- **빈 범위와 전체 조회를 구분했다.** `{ ids: [] }`를 "조건 없음"으로 처리하면 프로젝트 전체가 새어 나간다. `isEmptyIdScope`가 이 경우를 질의 생략으로 돌린다. 파기·삭제처럼 진짜 전체가 필요한 관리 경로만 `{ unrestricted: true }`를 명시한다.

**회귀 방지.** `tests/visibility.e2e.test.ts`의 1번·5번 블록. `IdScope`를 무시하도록 되돌려 확인했고 6건이 실패했다.

---

### T-004 — 제출물·댓글 mutation에 작성자 ownership 검사 없음

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

### T-005 — 단건 조회 `getSubmissionById`가 unscoped

**완료** 2026-09-05 · 분류 보안 · 심각도 P1

**증상.** 단건 조회에 공개 범위가 적용되지 않았다. 당시 두 attachment route는 조회 후 `canViewSubmission`으로 막고 있어 다운로드 경로 자체는 닫혀 있었지만, 새 소비자가 이 사후 검사를 빠뜨리기 쉬운 형태였다.

**조치.** `getSubmissionByIdForViewer(id, filter)`를 추가해 공개 범위를 질의에 적용하고, 두 route를 사후 검사에서 이 함수로 교체했다. 볼 수 없는 제출물은 없는 제출물과 같이 `null`로 돌아온다.

`SubmissionVisibilityFilter`에 `viewerEmail`을 추가했다. 화면 경로는 DB 사용자 id를 이미 갖고 있지만 route handler는 세션 이메일만 갖는데, 이것 때문에 handler마다 사용자 조회를 한 번 더 하는 것은 낭비다. 이메일 비교는 `LOWER(users.email)`로 하므로 대소문자·공백에 좌우되지 않는다.

`getSubmissionById`는 지우지 않고 남겼다. actor 권한을 이미 검증한 mutation 경로에는 필요하다. 대신 **그 용도 전용임을 JSDoc으로 못박았다.**

**회귀 방지.** `tests/visibility.e2e.test.ts`의 2번·4번·5번 블록. 특히 4번은 "볼 수 없는 자원"과 "없는 자원"의 응답이 상태 코드와 본문 모두 동일한지 확인한다.

---

### T-006 — 로그 metadata에 저장 파일 경로가 남음

**완료** 2026-09-05 · 분류 보안 · 심각도 P2

**증상.** 첨부 정리 실패 로그가 `filePath`를 그대로 기록했다. 비공개 산출물의 저장 경로와 업로드 디렉터리 구조가 로그로 새어 나갔다.

**조치.** 호출부를 하나씩 고치는 대신 **기록 지점 한 곳**에서 막았다. `src/shared/server/logging`이 `REDACTED_METADATA_KEYS`(`filePath`, `storedFilePath`, `absolutePath`, `uploadDir`, `path`)를 `[redacted]` 또는 `[redacted]:<확장자>`로 축약한다.

호출부가 아니라 기록 지점을 고른 이유는, 앞으로 추가되는 action에도 자동으로 적용되기 때문이다. 확장자만 남기는 것은 장애 조사에 필요한 최소 단서와 비식별화를 절충한 것이다. `fileName`은 감사 목적상 유지한다.

**회귀 방지.** `tests/log-redaction.test.ts`. 실제로 로그 파일을 쓰고 다시 읽어, 축약된 값에 디렉터리 구조나 원본 파일명 조각이 남지 않는지 확인한다.

---

### T-007 — `/tasks` 프로젝트 CRUD server action이 쓰기 역할만 확인

**완료** 2026-09-05 · 분류 보안 · 심각도 P1

**증상.** `app/tasks/actions.ts`가 `createProjectAction`, `updateProjectAction`, `deleteProjectAction`을 export한다. `/tasks` 화면에는 이 폼이 없지만 구현부는 `canWriteTaskContent`만 확인했다. `member`가 프로젝트를 cascade 삭제(태스크·제출물·댓글·저장 파일)할 수 있었다.

**여기서 얻을 교훈이 핵심이다.** `"use server"` 모듈에서 export된 함수는 **화면에 폼이 없어도** 호출 가능한 엔드포인트로 등록된다. "UI에서 도달할 수 없으니 안전하다"는 추론은 Server Action에 성립하지 않는다. 새 action을 추가할 때는 화면 노출 여부와 무관하게 권한을 확인해야 한다.

**조치.** `requireProjectAdminSession`(`canAccessAdminPanel`)으로 막았다. 프로젝트 관리는 `/admin/projects` 전용이라는 기존 문서상 정책과 코드를 일치시킨 것이다.

**남은 부채.** 이 조치는 권한 구멍만 막았고 중복 자체는 남겼다. → T-010

**회귀 방지.** `tests/visibility.e2e.test.ts` 3번 블록의 "프로젝트 CRUD server action은 관리자 이상만 호출할 수 있다".

---

### T-008 — `[DEP0205] module.register()` deprecation 경고 해소

**완료** 2026-09-05 · 분류 품질·운영

`npm run build`와 `npm run check:fsd`에 Node v26의 deprecation 경고가 남아 있었다. 원인은 `tsx@4.21.0` 로더였고 4.23.13으로 올려 사라졌다.

기록해 둘 만한 것은 **경고의 출처가 이 저장소 코드가 아니라 실행 도구였다는 점**이다. 비슷한 경고가 다시 보이면 소스보다 로더·툴체인 버전을 먼저 본다.

---

### T-009 — 가시성·권한 회귀 테스트 하네스 도입

**완료** 2026-09-06 · 분류 품질·운영

[HARNESS_MAP.md](HARNESS_MAP.md) 6절에 사양으로만 있던 fixture를 실행 가능한 게이트로 만들었다. `npm test` — 단위 14건 + 가시성 e2e 33건.

설계 결정과 그 이유:

- **러너는 Node 내장 `node:test`.** 새 테스트 의존성을 추가하지 않았다.
- **인가 로직은 production 코드를 그대로 실행한다.** `tests/helpers/bootstrap.ts`가 `next-auth`의 `getServerSession`만 대체해 세션을 주입한다. guard를 테스트용으로 다시 구현하면 검증 대상이 사라진다.
- **스키마는 앱의 `initializeDatabaseSchema()`를 호출한다.** 테스트가 별도 DDL을 들고 있으면 운영 스키마와 조용히 어긋난다.
- **fixture는 테스트마다 재시드한다.** 어떤 테스트가 자원을 지워도 다음 테스트의 전제가 흔들리지 않는다.
- **Server Action 결과는 `NEXT_REDIRECT` digest를 파싱해 판정한다.** action이 성공·실패를 모두 `redirect()`로 끝내기 때문이다.

**하네스 자체를 검증했다.** 통과만으로는 아무것도 보장하지 않으므로, T-003과 T-004의 수정을 일부러 되돌려 테스트가 실제로 깨지는지 확인했다(각각 6건·2건 실패). 이후 복구하고 다시 전부 통과시켰다. 새 테스트를 추가할 때도 같은 방식으로 확인하는 편이 좋다.

**환경 관련 실측.** 이 머신에서는 Docker Hub 이미지 수신이 극히 느리다(3MB 이미지도 150초 내 실패, MariaDB 481MB는 약 40분). 그래서 `scripts/test-database.ts`가 백엔드를 자동 선택한다 — docker 이미지가 있으면 compose, 없으면 Homebrew MariaDB. 접속 계약은 양쪽 모두 `127.0.0.1:3307 / wbs_app_test`로 같고, 개발용(3306)과 포트·DB 이름이 분리되어 있다. `_test`로 끝나지 않는 DB 이름은 하네스가 거부한다. 두 백엔드 모두 실제로 실행해 47건 통과를 확인했다(Homebrew 12.3.3, Docker 11.4.13).

**부수적으로 발견한 것.** `src/shared/server/logging/logging.server.ts`가 `server-only`을 import하는데 패키지가 설치되어 있지 않았다. Next 번들러가 자체 alias로 가려주고 있어 빌드는 통과했지만, 평범한 Node 실행에서는 해석되지 않는다. 의존성으로 추가했다.

**검증 범위 밖.** HTTP 계층(미들웨어·OAuth 로그인)과 캐시 무효화(`revalidatePath`는 no-op으로 대체)는 확인하지 않는다. 자세한 한계는 [HARNESS_MAP.md](HARNESS_MAP.md) 6절에 있다.

---

## 참고 문서

- [TODO.md](TODO.md) — 진행 중인 항목과 ID 규칙
- [ARCHITECTURE.md](ARCHITECTURE.md) — 인증·인가·가시성·데이터 경계
- [HARNESS_MAP.md](HARNESS_MAP.md) — 실행·검증 하네스
- [FSD_MIGRATION_PLAN.md](FSD_MIGRATION_PLAN.md) — 8단계 구조 이동 계약
