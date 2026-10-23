# Scheduled Project Digest & Report Export 실행 계획

이 문서는 **D0–D5의 설계·선행 조건·인수 계약**을 소유한다. 현재 진행 상태/열린 ID는 [TODO](TODO.md), 현재 코드 구조는 [ARCHITECTURE](ARCHITECTURE.md)를 본다.

> 상태: **D0–D4 소스·양 DB·compiled 인수 완료, 실제 화면/운영 외부 게이트 미완료**. D5 외부 전달은 별도 승인 대기다. 코드 존재·로컬 검증·운영 활성화를 구분한다.

> 목표: 외부 Python agent 없이 Next.js Route Handler + MariaDB + 배포 환경 scheduler로 digest를 재실행 가능하게 생성하고, 같은 snapshot에서 DOCX/PPTX를 내보낸다.

## 1. 범위와 현재 사실

채택 패턴은 수집 → 정규화 snapshot → 렌더 → 저장 → 명시적 전달이다. 앱 프로세스 timer를 두지 않고 Synology Task Scheduler/cron이 인증된 HTTP endpoint를 호출한다. preview와 delivery를 분리하며 최초 운영 모드는 `dryRun=true`, `audienceMode=public_only`, `deliveryMode=none`이다.

현재 schema에는 task 상태/완료 mode·완료자/시각과 event, 프로젝트 참여자·활동팀·접근 mode, 제출 revision이 있다. `native-migration-v1`부터의 versioned runner와 schema identity 분리도 이미 존재한다. 이를 없는 구조로 가정해 새 runner나 중복 업무 이력을 만들지 않는다. 실제 모델/표는 코드가 소유하고 전체 DDL을 이 문서에 복제하지 않는다.

D0 snapshot은 기존 사실만 수집한다: 프로젝트/업무 계층·기간·담당자·현재 상태/완료 mode, 인가된 제출/댓글/첨부 metadata와 기간 내 활동이다. 각100행·텍스트512자·최대31일 범위와 잘림/경고를 명시하며 sourceCounts는 포함된 행 수다. 과거 완료 시각/진척률/변경 이력을 추측하거나 기한 경과를 확정 지연으로 해석하지 않는다. 현재 구현/미검증 범위는 TODO와 HARNESS_MAP에서 갱신한다.

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

현재 프로젝트 범위의 admin/SU UI(구현·통합 인수 중)
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

FSD 구현은 `docs/ARCHITECTURE.md#fsd-의존-경계`의 `shared → entities → features → widgets → app page` 순서와 boundary gate를 따른다. 기능 구현과 기존 코드 구조 이동을 한 변경에 섞지 않는다. `scripts/run-project-digest.ts` CLI는 HTTP trigger의 필수 대안이 아니며 실제 NAS 운영 방식이 CLI로 결정될 때만 추가한다.

## 3. MariaDB schema·권한 계약

Native는 기존 불변 migration/lock/checksum/postcondition runner와 별도 schema identity를 재사용한다. 준비 중인 v14와 D1 `drizzle/0017_project_report_ledger.sql`은 `project_report_schedules`, `project_report_runs`, `project_report_artifacts`3표만 additive로 추가한다. 기존 자료·role/private·revision/file을 재작성하지 않으며 D1 SQL을 MariaDB에 적용하지 않는다. 표/인덱스/제약의 명세는 실제 migration이 소유한다. D5 delivery 표·외부 발송은 추가하지 않는다.

Native의 준비/재실행/복구 계약은 [Native 운영](NATIVE_DATABASE_MIGRATIONS.md)을 따른다. 새 schema의 로컬 결과가 실제 NAS/Sites 적용이나 운영 계정 권한 검증을 뜻하지 않는다.

### DB 계정/GRANT

- 정상 앱/scheduler 런타임 계정: 대상 DB에 `SELECT, INSERT, UPDATE, DELETE`만 부여한다. schema 생성/변경 권한과 전역 권한은 주지 않는다.
- migration/admin 계정: 승인된 migration 실행 시간에만 대상 schema의 `CREATE, ALTER, INDEX, REFERENCES`(rollback이 필요하면 `DROP`)를 부여한다. `CREATE DATABASE`가 필요한 최초 bootstrap은 별도 관리자 계정으로 제한한다.
- 기존 runtime `DB_*`와 명시 migration의 `DB_SCHEMA_*` 분리를 재사용한다. 누락된 schema identity를 runtime으로 대체하지 않으며 secret 원문을 UI/로그에 노출하지 않는다. 실제 runtime DDL 거부는 별도 실증 전 완료로 쓰지 않는다.
- 검증: runtime 계정으로 CRUD/ledger는 성공하고 `CREATE/ALTER/DROP`은 실패해야 하며, migration 계정은 승인 migration만 성공해야 한다. `SHOW GRANTS` 결과는 비밀값 없이 운영 체크리스트에 기록한다.

## 4. timezone·기간 계약

- schedule timezone은 IANA 이름(`Asia/Seoul`)으로 저장하고 입력 시 `Intl.DateTimeFormat`으로 유효성을 검증한다. 약어/KST 문자열과 서버 로컬 timezone을 사용하지 않는다.
- 외부 scheduler가 occurrence를 계산해 `scheduledFor`를 RFC 3339 UTC(`...Z`)로 보낸다. route가 cron을 다시 해석하지 않는다.
- connection checkout마다 session timezone을 UTC로 고정할 수 있는지 MariaDB 설정을 확인한다. `DATETIME`은 timezone 변환 정보를 보존하지 않으므로 DB의 기존 `created_at` 의미가 UTC인지 테스트 DB에서 확인하기 전 과거 데이터를 임의 변환하지 않는다.
- ledger의 timestamp/`snapshotAt`/period instant는 UTC 기준으로 저장·직렬화한다. `tasks.start_date/end_date`는 DATE이므로 schedule timezone의 calendar date로 비교하고 UTC 자정으로 오해하지 않는다.
- 기간은 `[periodStart, periodEnd)` 반개구간이며 `snapshotAt >= periodEnd`를 강제한다. 모든 activity query는 같은 `snapshotAt`과 경계를 사용한다.
- DST 검증은 spring gap/fall overlap timezone fixture와 `Asia/Seoul` non-DST fixture를 포함한다.

## 5. visibility·권한 계약

- 이 절은 구현 중인 digest의 인수 계약이며 [현재 권한 정책](ARCHITECTURE.md#권한-정책)을 완화하지 않는다. manual preview/export·schedule/run 조회의 역할 helper는 후보 판정일 뿐이며 SU 전역/현재 지정 프로젝트 admin scope와 자원 가시성을 SQL에서 교차해야 한다.
- machine route는 NextAuth cookie를 쓰지 않는다. `DIGEST_SCHEDULER_ENABLED=1`과 유효한 `DIGEST_SCHEDULER_TOKEN`이 없으면503으로 비활성화한다. non-dry-run 산출물은 별도 `DIGEST_ALLOW_ARTIFACTS=1` 허용 전 거부하며 운영 설정은 바꾸지 않는다. bearer token은 길이 차이를 안전하게 처리한 constant-time 비교 후 불일치는 401이다.
- `public_only`: public submission 및 그 submission에 속한 댓글/첨부 metadata만 포함한다.
- `owner_scope`라는 이름은 project owner가 없는 현재 모델에서 오해를 부르므로 목표 값은 `requester_scope`로 한다. schedule의 `created_by`를 기존 `SubmissionVisibilityFilter`의 viewer로 사용해 public + 본인 private를 포함하며, 관리자 예외는 현재 지정 프로젝트 admin 또는 SU만 적용한다. `canManageAllSubmissions`만으로 전역 private 범위를 만들지 않는다.
- artifact는 요청자/역할 helper만으로 다운로드를 허용하지 않는다. 현재 project scope·원본 가시성 재인가와 소속 해제 후 과거 자료 차단 계약을 D0에서 반영한 뒤 활성화한다. `public_only`도 익명 공개나 전역 admin 예외를 만들지 않는다.
- 첨부 binary는 embed하지 않는다. audience query를 통과한 첨부의 허용 metadata만 표시한다. 기존 attachment repository의 `IdScope`와 현재 viewer/project guard를 확인하고 digest에서도 submission visibility와 교차하는 bounded query를 구현/테스트한다.
- token, private body, recipient 원문을 로그/error_message에 남기지 않는다. `storage_key`는 DB 값도 신뢰하지 않고 `REPORT_DIR` resolve/prefix 검사 후 사용한다.

## 6. idempotency·상태·복구 계약

- scheduled key 원문은 `scheduleId\nscheduledForUTC\nprojectId\nschemaVersion\nsortedFormats\naudienceMode\ndryRun`이고 UTF-8 SHA-256 hex를 저장한다. 정규화된 payload만 hash한다.
- manual 요청은 서버가 발급한 request id를 사용한다. 클라이언트 재시도를 dedupe해야 할 때는 검증된 `Idempotency-Key`와 requester/project/formats를 함께 hash한다.
- 짧은 transaction에서 run row를 `INSERT`하고 unique 충돌 시 기존 row를 조회한다. 렌더링/파일 I/O 동안 DB transaction이나 row lock을 유지하지 않는다.
- 신규 claim만 `queued → running`으로 CAS 전이한다. 같은 key 재요청은 기존 run/status/artifact를 반환하며 새 렌더/전달을 시작하지 않는다.
- status는 `queued|running|rendered|failed|skipped`; D5 전에는 `delivered`를 사용하지 않는다. dry-run 성공은 `skipped`가 아니라 artifact 없는 `rendered`와 명시적 `dry_run=true`로 표현한다.
- `heartbeat_at`/lease 만료를 두고 stale `running`은 별도 recovery가 CAS로 재점유한다. 최대 attempt를 넘으면 `failed`로 종료한다. 이 정책과 cleanup job이 구현되기 전 자동 복구 완료로 표시하지 않는다.
- 파일 IO 전에 format별 unique artifact의 key/hash/size를 staged로 예약하고, rename/size/hash 검증 후 ready로 CAS한다. staged 다운로드·run 완료는 거부하며 쓰기 결과 불명에서 무조건 quarantine하거나 임의 덮어쓰지 않는다. 재시도는 verified bytes를 재사용하고 물리 파일이 없어 재렌더한 bytes가 예약 fingerprint와 다르면 fail-closed다. OOXML 비결정성으로 자동 복구가 제한될 수 있고 stale Native tmp/lock을 자동 삭제하지 않는다.
- 만료 staged도 확인 후 가역 quarantine 대상으로 삼되 파일이 없으면 실패로 남긴다. 보고서 기록의 project/user FK는 RESTRICT로 보호하며 별도 보존 정책 전 해당 원본의 영구 삭제를 차단한다.

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
- download는 권한 재검사 후 `Content-Disposition: attachment`의 RFC 5987 안전 filename, 정확한 `Content-Length`(wire에 유지될 경우), `ETag`(SHA-256 기반), `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`를 설정한다.
- missing/unauthorized는 리소스 열거를 줄이도록 동일 404 정책을 사용하고 expired artifact는 정책을 확정해 404 또는 410 중 하나로 테스트한다.
- Vinext TransformStream이 길이 헤더를 제거한 wire는 chunked 전송을 허용하되 실제 bytes/size/SHA·보안/MIME 헤더를 검사한다. 원 route의 길이 설정과 플랫폼 framing을 구분한다.
- D0~D4의 delivery output은 앱 내 artifact metadata/download뿐이다. email/webhook은 recipient/membership/consent, secret 관리, webhook HTTPS allowlist·DNS/IP 재검증·redirect 제한, 재시도/중복 방지 threat model이 별도 승인된 D5에서만 구현한다.

## 8. DOCX/PPTX skill 재사용 범위

- 구현 전에 `.github/skills/document-skills/docx/SKILL.md`와 `.github/skills/document-skills/pptx/SKILL.md`를 읽어 OOXML 구조, semantic DOCX 구성, PPTX palette/가독성/overflow 원칙을 재사용한다.
- DOCX runtime은 production dependency `docx`9.6.1의 `Packer.toBuffer()`를 사용한다.
- PPTX authoring skill의 기본 `html2pptx.js`/Playwright workflow는 브라우저 의존성이므로 runtime에서 호출하지 않는다. palette/layout 원칙만 재사용하고 runtime은 production dependency `pptxgenjs`4.0.1 API로 직접 Buffer를 만든다.
- 두 renderer 패키지는 production `dependencies`와 lockfile에 반영했다. 코드/compiled 인수와 실제 Office 시각 검증·운영 활성화는 별개다.
- 두 renderer는 동일한 `DigestSnapshot`만 입력받고 DB를 조회하지 않는다. 공통 섹션은 표지, 기간/기준, 사실 기반 수치, 기한 경과(완료 판정 아님), 최근 활동, 다음 일정, 데이터 품질/부록이다.

## 9. 단계별 backlog와 검증

### D0 — snapshot contract/fixture
- versioned DTO와 비식별 fixture, deterministic ordering(날짜→id)을 만든다.
- **검증**: schema validation, `[start,end)` 경계, UTC/DATE/DST fixture, `public_only`에 private 본문/댓글/첨부가 0건, 현재 없는 지표가 schema에 없음.

### D1 — manual JSON preview
- 현재 project scope 안의 관리자/SU preview만 구현하며 파일/schedule/delivery는 없다.
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
