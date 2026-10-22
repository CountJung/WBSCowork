# WBSCowork 에이전트 진입점

이 파일은 작업 규칙과 문서 등록부를 소유한다. `CLAUDE.md`와 도구별 안내는 이 파일을 가리킨다. 운영 문서는 `docs/`에 둔다.

## 읽기 순서와 문서 책임

작업 시작 시 **이 파일 → TODO → PROJECT_MAP → 관련 ARCHITECTURE/운영 계약**, 검증 전 HARNESS_MAP을 읽는다. 사용자 기능의 설명은 사용자 가이드에서 확인한다. 아래가 유일한 문서 등록부다.

| 질문/역할 | 정본 | 범위 |
| --- | --- | --- |
| 무엇을 만들고 무엇을 제외하나 | [PRODUCT_SPEC](docs/PRODUCT_SPEC.md) | 제품 범위·용어, 상태/DDL 사본 없음 |
| 어떤 순서와 완료 기준으로 진행하나 | [MASTER_PLAN](docs/MASTER_PLAN.html) | 단계·게이트; 현재 진행률은 TODO |
| 현재 상태·미해결·다음 행동은 무엇인가 | [TODO](docs/TODO.md) | 현재 요약과 열린 작업만, 세부 미래 설계는 계획으로 링크 |
| 왜 그렇게 결정했고 어떻게 연결되나 | [ARCHITECTURE](docs/ARCHITECTURE.md) | 결정 색인·구조·보안/트랜잭션 계약 |
| 코드는 어디에 있나 | [PROJECT_MAP](docs/PROJECT_MAP.md) | 경로·라우트·구현 진입점, 검증 수치 없음 |
| 무엇으로 검증하고 무엇이 미확인인가 | [HARNESS_MAP](docs/HARNESS_MAP.md) | 실제 명령·게이트·환경별 검증 기준선 |
| 끝난 일의 고유 근거는 무엇인가 | [COMPLETED_LOG](docs/COMPLETED_LOG.md) | 간결한 결정/검증/게시·복구 이력 |
| 배포·스키마·브랜치는 어떻게 운영하나 | [NAS_UPDATE_GUIDE](docs/NAS_UPDATE_GUIDE.md) | NAS/Sites 분리, 게시/복구, 네트워크·archive 태그 |
| Native migration의 세부 계약은 무엇인가 | [NATIVE_DATABASE_MIGRATIONS](docs/NATIVE_DATABASE_MIGRATIONS.md) | 불변 명세·credential·재개/rollback 한계 |
| 버그 제보·보존·권한 계약은 무엇인가 | [BUG_REPORTS](docs/BUG_REPORTS.md) | 스크린샷을 포함한 하나의 도메인 정본 |
| 아직 구현하지 않은 digest를 어떻게 설계하나 | [PROJECT_DIGEST_REPORT_PLAN](docs/PROJECT_DIGEST_REPORT_PLAN.md) | D0–D5 설계·선행 조건; 실행 사실 아님 |
| 팀 업무를 어떻게 사용하나 | [TEAM_WORKFLOW_GUIDE](docs/TEAM_WORKFLOW_GUIDE.md) | 작성·검토·검색·알림 사용 순서 |
| 사용자 교육 자료는 무엇인가 | [HTML 설명서](docs/manual/USER_MANUAL.html), [빠른 참조](docs/manual/QUICK_REFERENCE.md), [제작 안내](docs/manual/USER_MANUAL.md) | 기존 사용자/발표 자료 보존; 기술 정본 대체 아님 |
| 과거 T 번호를 어떻게 해석하나 | [TASK_ID_MAP](docs/TASK_ID_MAP.md) | 영구 ID 대응; 현재 다음 번호는 TODO |

## 항상 지킬 경계

1. `.env*`·실제 credential을 AI 컨텍스트로 열거나 출력하지 않는다. 사용자 데이터·계정·권한·보안 설정·운영 migration/삭제·배포는 현재 요청의 명시 범위를 따른다.
2. 페이지 노출과 별개로 모든 action/handler가 세션·현재 DB 역할·상위 project/task/submission 관계와 ownership을 재검사한다. public 제출물은 인증 사용자, private는 작성자/admin/SU만 조회한다. 담당자/검토자 지정은 조회권을 늘리지 않는다.
3. 제출물 목록은 `SubmissionVisibilityFilter`, 파생 댓글/첨부는 필수 `IdScope`와 viewer filter, 단건은 viewer-aware API를 사용한다. 현재와 버전 당시 가시성을 SQL에서 함께 검사하고 unauthorized/missing은 같은 404로 처리한다.
4. `canAccessAdminPanel`/`canManageAllSubmissions`/`canWriteTaskContent`를 재사용한다. `/admin/database`, `/admin/logs`, `/admin/settings`는 SU 전용; admin은 `/admin/users`에서 guest/member만 부여한다. 모든 기존 역할의 본인 버그 제보 권한은 업무 쓰기 권한과 별개다.
5. `app → widgets → features → entities → shared`와 slice public API를 지킨다. 루트 app을 옮기지 않고 구조 이동과 기능 변경을 분리한다. src 변경은 `check:fsd`, 가시성/권한 변경은 `npm test`를 포함해 HARNESS_MAP 게이트를 실행한다.
6. 원문·버전·검토는 transaction 안의 version/token/bytes fingerprint로 보존한다. 첨부 제외는 새 버전이며 과거 파일 삭제가 아니다. project 종료일 자동 파기는 없고 공유 계정은 별도 수명주기다. 실패/불확정/커밋 후 후속 오류를 성공과 구분한다.
7. main은 NAS/native, sites는 Worker/D1/R2다. 기본 build 차이를 보존하고 공통 patch를 선별 반영한다. 사용자에게 이번 작업의 게시 요청이 명시된 경우에만 Sites 게시를 수행한다. 브랜치 ref 정리는 배포가 아니다.
8. 합성 브라우저는 loopback만 허용한다. 운영에 합성 session을 보내거나 proxy/NO_PROXY/인증서/플랫폼 정책을 바꾸어 제한을 우회하지 않는다.
9. digest는 현재 미구현이며 dry-run/download-only 기본, 동일 versioned snapshot, viewer filter·machine token·idempotency ledger 없이 활성화하지 않는다. DOCX는 docx, runtime PPTX는 pptxgenjs 직접 생성이며 외부 발송은 별도 동의/승인이다.
10. 경고·오류를 무시하거나 blanket disable로 숨기지 않는다. 미해결 오류는 TODO, 실행 결과/미실행 사유는 HARNESS_MAP, 재발 방지 판단은 ARCHITECTURE 또는 COMPLETED_LOG에 남긴다. 실제 확인하지 않은 Google 로그인·UI·운영 게시를 로컬 성공으로 추정하지 않는다.

## 문서 운영

- 새 기능마다 새 파일·날짜별 완료 보고서를 만들지 않는다. 바뀐 사실을 소유하는 기존 정본 하나를 고치고 나머지는 링크한다. 새 문서는 질문이 겹치지 않을 때만 이 등록부에 역할·필요성을 추가한다.
- 계획은 게이트, TODO는 현재 값/열린 작업, ARCHITECTURE는 이유/계약, PROJECT_MAP은 위치, HARNESS_MAP은 방법/기준선, COMPLETED_LOG는 고유 과거 근거를 소유한다. 완료한 항목을 TODO에 반복하지 않는다.
- 기존 Native 운영·버그 도메인·미구현 digest·ID 호환표·사용자 자료는 위 표에 등록한 예외다. 사용자 가이드는 독자를 위해 절차를 반복할 수 있다. 숨은 설정/기술 규칙의 새 정본으로 쓰지 않는다.
- 삭제 전 고유 근거와 복구 정보를 해당 정본에 통합하고 Git 원본 commit/path를 남긴다. 미추적 사용자 자료는 정리 대상이 아니다. docs 링크·읽기 경로·필수 역할·명령은 `node scripts/check-docs.mjs`로 확인한다.
- 개인 docs-canon 스킬이 제공되는 환경에서는 해당 SKILL.md를 읽고 구현·검증 담당과 문서 담당의 범위를 나눈다. 원본 형식 검사와 내용 검토를 구분하고, 스킬/검사기 미제공 시 대체 검사만 수행했다고 밝힌다. 앞선 간소화 회차의 원본 미실행 근거는 COMPLETED_LOG가 보존한다. 외부 프로젝트 규칙을 대신 가져오지 않는다.

## 도구별 안내

TypeScript/Next/UI 작업은 `.github/instructions/nextjs-stack.instructions.md`, 품질 게이트는 `.github/instructions/quality-gates.instructions.md`를 경로별로 읽는다. digest 작업은 `.github/skills/wbs-project-digest-report/SKILL.md`를 읽는다. 작업 범위·권한·DB 영향을 기록할 때는 [기존 작업 템플릿](tasks/TASK_TEMPLATE.md)을 사용한다. 이 파일들이 행동 규칙을 복제하면 이 진입점과 책임 정본으로 합친다.

Next.js16의 변경된 API는 코드 작성 전 설치된 `node_modules/next/dist/docs/`를 확인한다. Serena는 권한·schema·다중 handler의 실제 참조 추적, Graphify는 일반 검색으로 풀리지 않는 구조 리팩터링에만 선택한다. 환경에 없는 도구를 필수 단계로 가정하지 않는다.
