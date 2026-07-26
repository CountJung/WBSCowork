# Scheduled Project Digest & Report Export 실행 계획

> 상태: architecture contract/backlog · **런타임 route, schema, snapshot, renderer, scheduler, delivery는 모두 미구현**

> 목표: 외부 Python agent 없이 Next.js Route Handler + MariaDB + 배포 환경 scheduler로 digest를 재실행 가능하게 생성하고, 같은 snapshot에서 DOCX/PPTX를 내보낸다.

## 1. 범위와 현재 사실

채택 패턴은 수집 → 정규화 snapshot → 렌더 → 저장 → 명시적 전달이다. 앱 프로세스 timer를 두지 않고 Synology Task Scheduler/cron이 인증된 HTTP endpoint를 호출한다. preview와 delivery를 분리하며 최초 운영 모드는 `dryRun=true`, `audienceMode=public_only`, `deliveryMode=none`이다.

현재 `lib/database-admin.ts`의 managed schema에는 `projects`, `tasks`, `submissions`, `submission_attachments`, `comments`, `users`만 있다. task 상태/완료율/수정 시각, project membership/owner, report/run table은 없다. v1이 표현할 수 있는 사실은 다음뿐이다.

- 프로젝트 기간, 태스크 수/계층/담당자, 예정 시작/종료
- 기준 지역 날짜에서 `end_date < localDate`인 **기한 경과 태스크**(미완료/지연 확정 아님)
- 기간 내 `created_at` 기준 신규 제출물·댓글·첨부
- 다음 기간에 시작/종료 예정인 태스크
- 담당자/설명 등 데이터 누락

`완료`, `진척률`, `변경됨`, `지연 확정`은 스키마/감사 이력이 생기기 전 생성하거나 암시하지 않는다.

## 2. 목표 흐름과 구현 위치

```text
Synology scheduler/cron
  → POST /api/internal/project-digests/run
  → bearer token + JSON 검증
  → MariaDB idempotency claim
  → visibility-aware bounded query(snapshotAt/range)
  → versioned DigestSnapshot
  → summary + DOCX/PPTX renderer
  → REPORT_DIR atomic write + artifact metadata
  → deliveryMode=none (v1)
  → run ledger + redacted structured log

admin/superuser UI
  → root app page에서 동일 use-case 직접 호출(내부 HTTP 호출 금지)
  → 권한 검사 후 artifact download route
```

| 목표 파일 | 책임 |
| --- | --- |
| `app/api/internal/project-digests/run/route.ts` | machine trigger adapter |
| `app/api/project-reports/[artifactId]/route.ts` | session/audience 확인 후 stream |
| `app/admin/projects/[projectId]/reports/page.tsx` | preview/history page adapter |
| `src/entities/project-report/model/` | versioned snapshot/run/artifact DTO |
| `src/entities/project-report/api/*.server.ts` | bounded query와 ledger repository |
| `src/features/project-digest-generate/server/` | collect → render → persist orchestration |
| `src/features/project-report-export/server/` | DOCX/PPTX Buffer 및 storage |
| `src/features/project-digest-deliver/server/` | D5 승인 후 adapter; D0~D4에는 만들 필요 없음 |
| `src/widgets/project-report-admin/` | preview/history/download UI |

FSD 구현은 `docs/FSD_MIGRATION_PLAN.md`의 `shared → entities → features → widgets → app page` 순서와 boundary gate를 따른다. 기능 구현과 기존 코드 구조 이동을 한 변경에 섞지 않는다. `scripts/run-project-digest.ts` CLI는 HTTP trigger의 필수 대안이 아니며 실제 NAS 운영 방식이 CLI로 결정될 때만 추가한다.

## 3. MariaDB schema·권한 계약

현재는 migration runner가 없고 `lib/database-admin.ts`가 전체 managed schema를 생성/보정한다. report table을 곧바로 “migration 완료”로 표시하지 않는다. D3에서 먼저 **재실행 가능한 versioned migration script/기록 방식**을 정하고, 기존 DB와 빈 DB 양쪽에서 적용/rollback 절차를 검증한다.

### 목표 테이블

- `project_digest_schedules`: `id`, `project_id` FK, `created_by` FK, `enabled`, `timezone` IANA, `cron_expression`, `lookback_hours`, `formats` JSON, `audience_mode`, `delivery_mode`, timestamps
- `project_digest_runs`: `id`, nullable `schedule_id`, `project_id`, nullable `requested_by`, `trigger_type`, `dry_run`, `scheduled_for`, `period_start`, `period_end`, `snapshot_at`, `schema_version`, `idempotency_key CHAR(64) UNIQUE`, status/error/timestamps, `snapshot_json`
- `project_report_artifacts`: `id`, `run_id` FK, format, server-generated relative `storage_key`, filename/MIME/size/SHA-256, audience, expiry, timestamp, unique `(run_id, format)`
- `project_digest_deliveries`: D5에서만 추가. run/channel/recipient hash/attempt/status/provider id/error/timestamps와 중복 방지 unique key

`created_by`는 schedule 생성자이지 현재 스키마에 없는 “project owner”가 아니다. 목표 인덱스 `tasks(project_id,end_date)`, `submissions(task_id,created_at)`, `comments(submission_id,created_at)`는 representative data의 `EXPLAIN`으로 확인한 뒤 별도 migration에서 추가한다.

### DB 계정/GRANT

- 정상 앱/scheduler 런타임 계정: 대상 DB에 `SELECT, INSERT, UPDATE, DELETE`만 부여한다. schema 생성/변경 권한과 전역 권한은 주지 않는다.
- migration/admin 계정: 승인된 migration 실행 시간에만 대상 schema의 `CREATE, ALTER, INDEX, REFERENCES`(rollback이 필요하면 `DROP`)를 부여한다. `CREATE DATABASE`가 필요한 최초 bootstrap은 별도 관리자 계정으로 제한한다.
- 현재 `DB_*` 한 세트가 `initializeDatabaseSchema()`와 runtime pool에 함께 쓰이는 구조는 최소권한 분리를 지원하지 않는다. D3 전에 migration credential의 실행 경로를 분리하되 secret 원문을 UI/로그에 노출하지 않는다.
- 검증: runtime 계정으로 CRUD/ledger는 성공하고 `CREATE/ALTER/DROP`은 실패해야 하며, migration 계정은 승인 migration만 성공해야 한다. `SHOW GRANTS` 결과는 비밀값 없이 운영 체크리스트에 기록한다.

## 4. timezone·기간 계약

- schedule timezone은 IANA 이름(`Asia/Seoul`)으로 저장하고 입력 시 `Intl.DateTimeFormat`으로 유효성을 검증한다. 약어/KST 문자열과 서버 로컬 timezone을 사용하지 않는다.
- 외부 scheduler가 occurrence를 계산해 `scheduledFor`를 RFC 3339 UTC(`...Z`)로 보낸다. route가 cron을 다시 해석하지 않는다.
- connection checkout마다 session timezone을 UTC로 고정할 수 있는지 MariaDB 설정을 확인한다. `DATETIME`은 timezone 변환 정보를 보존하지 않으므로 DB의 기존 `created_at` 의미가 UTC인지 테스트 DB에서 확인하기 전 과거 데이터를 임의 변환하지 않는다.
- ledger의 timestamp/`snapshotAt`/period instant는 UTC 기준으로 저장·직렬화한다. `tasks.start_date/end_date`는 DATE이므로 schedule timezone의 calendar date로 비교하고 UTC 자정으로 오해하지 않는다.
- 기간은 `[periodStart, periodEnd)` 반개구간이며 `snapshotAt >= periodEnd`를 강제한다. 모든 activity query는 같은 `snapshotAt`과 경계를 사용한다.
- DST 검증은 spring gap/fall overlap timezone fixture와 `Asia/Seoul` non-DST fixture를 포함한다.

## 5. visibility·권한 계약

- manual preview/export, schedule CRUD, 전체 run history는 `canAccessAdminPanel(role,isSuperuser)`의 admin/superuser만 허용한다.
- machine route는 NextAuth cookie를 쓰지 않는다. `DIGEST_SCHEDULER_TOKEN` 미설정/빈 값이면 503으로 비활성화하고, bearer token은 길이 차이를 안전하게 처리한 constant-time 비교 후 불일치는 401이다.
- `public_only`: public submission 및 그 submission에 속한 댓글/첨부 metadata만 포함한다.
- `owner_scope`라는 이름은 project owner가 없는 현재 모델에서 오해를 부르므로 목표 값은 `requester_scope`로 한다. schedule의 `created_by`를 기존 `SubmissionVisibilityFilter`의 viewer로 사용해 public + 본인 private를 포함하며, admin/superuser의 `canManageAllSubmissions` 규칙도 그대로 적용한다.
- `requester_scope` artifact는 생성 요청자와 `canManageAllSubmissions` 사용자만 다운로드한다. `public_only`도 인증된 admin/superuser report UI 범위로 시작하며 공개 URL로 노출하지 않는다.
- 첨부 binary는 embed하지 않는다. audience query를 통과한 첨부의 허용 metadata만 표시한다. 기존 attachment repository의 project 단위 조회는 visibility filter를 받지 않으므로 그대로 재사용하지 말고 submission visibility와 join한 전용 bounded query를 구현/테스트한다.
- token, private body, recipient 원문을 로그/error_message에 남기지 않는다. `storage_key`는 DB 값도 신뢰하지 않고 `REPORT_DIR` resolve/prefix 검사 후 사용한다.

## 6. idempotency·상태·복구 계약

- scheduled key 원문은 `scheduleId\nscheduledForUTC\nprojectId\nschemaVersion\nsortedFormats\naudienceMode\ndryRun`이고 UTF-8 SHA-256 hex를 저장한다. 정규화된 payload만 hash한다.
- manual 요청은 서버가 발급한 request id를 사용한다. 클라이언트 재시도를 dedupe해야 할 때는 검증된 `Idempotency-Key`와 requester/project/formats를 함께 hash한다.
- 짧은 transaction에서 run row를 `INSERT`하고 unique 충돌 시 기존 row를 조회한다. 렌더링/파일 I/O 동안 DB transaction이나 row lock을 유지하지 않는다.
- 신규 claim만 `queued → running`으로 CAS 전이한다. 같은 key 재요청은 기존 run/status/artifact를 반환하며 새 렌더/전달을 시작하지 않는다.
- status는 `queued|running|rendered|failed|skipped`; D5 전에는 `delivered`를 사용하지 않는다. dry-run 성공은 `skipped`가 아니라 artifact 없는 `rendered`와 명시적 `dry_run=true`로 표현한다.
- `heartbeat_at`/lease 만료를 두고 stale `running`은 별도 recovery가 CAS로 재점유한다. 최대 attempt를 넘으면 `failed`로 종료한다. 이 정책과 cleanup job이 구현되기 전 자동 복구 완료로 표시하지 않는다.
- format별 artifact unique key로 부분 성공 재시도 시 이미 검증된 파일을 재사용한다. temp 파일은 동일 filesystem의 `REPORT_DIR` 아래 만들고 rename 후 hash/size를 재검증한 다음 DB row를 기록한다.

## 7. trigger·output·delivery contract

### Trigger request

`POST /api/internal/project-digests/run`, `Content-Type: application/json`, bearer token. 목표 JSON:

```json
{
  "scheduleId": 12,
  "scheduledFor": "2026-07-26T00:00:00Z",
  "dryRun": true
}
```

project/timezone/formats/audience는 enabled schedule row에서 읽어 payload 변조를 막는다. 요청 body 크기 제한, unknown key 거부, integer/RFC3339 검증을 적용한다.

### Trigger response

항상 `application/json`; secret/path/private content는 반환하지 않는다.

```json
{
  "runId": 34,
  "status": "running",
  "deduplicated": false,
  "dryRun": true,
  "artifactIds": []
}
```

- 신규 claim: `202`
- 기존 동일 run: `200`과 `deduplicated=true`
- malformed payload `400`, token 불일치 `401`, token/기능 미설정 `503`, disabled/missing schedule `404` 또는 정책 충돌 `409`
- claim 뒤 실패는 ledger를 `failed`로 기록하고 안정된 `errorCode`만 반환한다. 예외 문자열/stack/private data는 응답하지 않는다.

### Artifact/download output

- DOCX MIME: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- PPTX MIME: `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- download는 권한 재검사 후 `Content-Disposition: attachment`의 RFC 5987 안전 filename, 정확한 `Content-Length`, `ETag`(SHA-256 기반), `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`를 설정한다.
- missing/unauthorized는 리소스 열거를 줄이도록 동일 404 정책을 사용하고 expired artifact는 정책을 확정해 404 또는 410 중 하나로 테스트한다.
- D0~D4의 delivery output은 앱 내 artifact metadata/download뿐이다. email/webhook은 recipient/membership/consent, secret 관리, webhook HTTPS allowlist·DNS/IP 재검증·redirect 제한, 재시도/중복 방지 threat model이 별도 승인된 D5에서만 구현한다.

## 8. DOCX/PPTX skill 재사용 범위

- 구현 전에 `.github/skills/document-skills/docx/SKILL.md`와 `.github/skills/document-skills/pptx/SKILL.md`를 읽어 OOXML 구조, semantic DOCX 구성, PPTX palette/가독성/overflow 원칙을 재사용한다.
- DOCX runtime은 현재 devDependency인 `docx`의 `Packer.toBuffer()`를 사용한다.
- PPTX authoring skill의 기본 `html2pptx.js`/Playwright workflow는 브라우저 의존성이므로 runtime에서 호출하지 않는다. palette/layout 원칙만 재사용하고 runtime은 현재 devDependency인 `pptxgenjs` API로 직접 Buffer를 만든다.
- renderer 구현 시 두 패키지를 production `dependencies`로 옮기고 lockfile 변화를 포함한다. 지금은 renderer가 없으므로 dependency 이동을 완료로 표시하지 않는다.
- 두 renderer는 동일한 `DigestSnapshot`만 입력받고 DB를 조회하지 않는다. 공통 섹션은 표지, 기간/기준, 사실 기반 수치, 기한 경과(완료 판정 아님), 최근 활동, 다음 일정, 데이터 품질/부록이다.

## 9. 단계별 backlog와 검증

### D0 — snapshot contract/fixture
- versioned DTO와 비식별 fixture, deterministic ordering(날짜→id)을 만든다.
- **검증**: schema validation, `[start,end)` 경계, UTC/DATE/DST fixture, `public_only`에 private 본문/댓글/첨부가 0건, 현재 없는 지표가 schema에 없음.

### D1 — manual JSON preview
- admin/superuser preview만 구현하며 파일/schedule/delivery는 없다.
- **검증**: 역할×audience matrix, bounded query/row cap, attachment visibility join, representative `EXPLAIN`, lint/build.

### D2 — DOCX/PPTX export/download
- fixture renderer, atomic storage, 권한 download를 구현한다.
- **검증**: ZIP signature/unzip CRC, `[Content_Types].xml`, DOCX `word/document.xml`, PPTX `ppt/presentation.xml`과 slide XML, SHA-256/size, traversal/symlink escape, MIME/headers, 두 포맷 text parity. LibreOffice가 설치된 검증 환경에서만 headless PDF/thumbnail 시각 smoke test를 추가하고 없으면 미실행 사유를 기록한다.

### D3 — scheduled dry-run/ledger
- versioned schema migration, 최소권한 계정 경로, token route, idempotency/lease를 구현한다.
- **검증**: migration fresh/existing DB, runtime DDL 거부, bad/unset token, 동일 payload 병렬 호출 run 1개, canonical key vector, stale recovery/max attempt, DST, redaction, lint/build.

### D4 — download-only 운영
- scheduler artifact 생성과 retention cleanup을 opt-in한다. 외부 delivery는 없다.
- **검증**: cleanup dry-run/실행, expired policy, requester 교차 접근 거부, 실제 NAS의 전용 `REPORT_DIR` owner/mode/free-space/atomic rename 점검.

### D5 — delivery(별도 승인)
- recipient/membership/consent와 채널별 threat model 승인 후만 구현한다.
- **검증**: recipient별 visibility, unsubscribe/audit, webhook SSRF/redirect/DNS rebinding, retry/backoff/provider id/deduplication. 승인 전 TODO는 미완료로 유지한다.

공통 실행 명령은 현재 실제 script인 `npm run lint`, `npm run build`, `npm run db:check -- --validate-only`이다. focused test 명령은 해당 D-stage에서 package script를 실제 추가한 뒤 문서에 기록하며, 존재하지 않는 명령을 현재 검증 명령처럼 제시하지 않는다.

## 10. 구현 시 환경 계약

- `DIGEST_SCHEDULER_TOKEN`: machine secret; 미설정 시 route 503/fail closed
- `REPORT_DIR`: artifact 전용 절대 경로, `UPLOAD_DIR`와 분리
- `REPORT_RETENTION_DAYS`, `REPORT_MAX_ROWS`

환경 파일은 AI 컨텍스트로 열지 않는다. 설정 UI/readiness에는 configured 여부만 노출한다. scheduler 한 호출은 schedule 하나만 실행하므로 `REPORT_MAX_PROJECTS_PER_RUN`은 batch endpoint가 실제 설계될 때까지 추가하지 않는다.
