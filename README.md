# README — WBS 태스크 협업 시스템

Next.js App Router 기반 태스크 중심 WBS 협업 시스템입니다.

프로젝트 목표·업무 카드·담당자·내 업무, 간트, 산출물 버전·검토/보완/완료, 공개/비공개 파일·댓글, 선후행 의존성, 수동 템플릿, 권한 기반 검색·인앱 알림, 버그 제보·관리자 검토를 포함합니다.

---

## 실행 환경과 NAS 업데이트

`main`은 기존 **Node/Next.js + MariaDB + 로컬 파일** 환경을 기본으로 사용합니다. 기존 NAS 업데이트·백업·v1–v8 migration·수동 P0/P1 인수 순서는 [NAS 업데이트 안내](docs/NAS_UPDATE_GUIDE.md)를 따릅니다. NAS 자체 배포/운영 DB 검증은 수동으로 수행합니다.

- `npm run build` 또는 `npm run build:native` → `npm run start`: native production 실행. 기존 `build:next` 별칭도 유지합니다.
- `npm run build:sites` → `npm run start:sites`: 별도 Sites Worker 로컬 실행. feature 브랜치의 기본 `build`는 Vinext를 유지합니다.
- Sites는 D1/R2와 배포 환경 설정, native는 MariaDB/로컬 파일/기존 환경 설정을 사용합니다. 데이터를 자동으로 서로 이전하지 않습니다.
- 기존 공개 서비스: https://wbscowork.cometgnome.chatgpt.site . main 반영만으로 이 Site를 재게시하지 않습니다.
- [Sites 게시 기록](docs/SITES_PUBLICATION_2026-10-08.md), [최신 P1 검증 범위](docs/P1_ACCEPTANCE_2026-10-09.md), [하네스 명령](docs/HARNESS_MAP.md).

## 빠른 시작

```bash
npm ci --include=dev
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

`.env`에 `APP_PORT`를 설정하면 지정 포트로 실행됩니다. Node용 `build`/`build:native`/`build:next`와 `start` 스크립트는 동일한 env 파일을 사용합니다. 전체 lockfile 설치에는 Node22.12 이상이 필요하며 실제 NAS 플랫폼에서 확인해야 합니다.

---

## VS Code 디버깅

- `npm run dev:debug`: Node 인스펙터가 활성화된 개발 서버를 시작합니다.
- `.vscode/launch.json`에서 `Next.js: debug full stack`을 선택하면 Chrome 디버깅 창이 자동으로 열립니다.
- 서버가 이미 실행 중이면 `Next.js: debug client-side`로 브라우저 디버거만 연결합니다.

---

## 앱 셸

- 전역 MUI 앱바가 기본 내비게이션 역할을 합니다.
- 역할에 따라 관리자 메뉴가 분기됩니다:
  - **슈퍼관리자**: 관리 개요, 로그, 세팅, 사용자 관리, DB 관리
  - **관리자**: 관리 개요, 사용자 관리
- `system`, `light`, `dark` 테마 모드를 앱 셸에서 선택할 수 있으며 로컬스토리지에 저장됩니다.
- Google 로그인/로그아웃은 앱바의 세션 버튼에서 처리합니다.
- 모바일과 데스크톱 레이아웃을 모두 지원합니다.

---

## 프로젝트 워크스페이스

- `/`: 인증 사용자에게 선택 프로젝트 간트와 태스크 목록을 간략히 보여줍니다.
- `/tasks`: 프로젝트·태스크 CRUD, 간트 검토, 태스크 집중 라우팅, 제출물 관리 메인 공간입니다.
- 프로젝트 생성·수정·삭제는 관리자와 슈퍼관리자만 실행할 수 있습니다. member는 태스크·제출물·댓글 쓰기 권한을 갖습니다.
- 각 태스크에는 Markdown 제출물·댓글·첨부파일 영역이 포함됩니다.
- 제출물에 공개/비공개를 설정할 수 있습니다. 비공개 제출물은 작성자 본인과 관리자만 조회 가능합니다.

---

## 인증 및 관리자 접근

- Google OAuth를 통해 NextAuth로 로그인합니다.
- `.env`에 `SUPERUSER_EMAIL`을 설정하면 해당 Google 계정이 슈퍼관리자로 동작합니다.
- 새 Google 로그인은 기본적으로 `guest` 권한으로 저장됩니다.
- `/admin/users`에서 슈퍼관리자는 admin/member/guest, 일반 관리자는 member/guest만 부여할 수 있습니다.
- `/admin/database`는 슈퍼관리자 전용 DB 관리 화면입니다.
- `/admin/logs`와 `/admin/settings`는 슈퍼관리자 전용입니다.

---

## 환경 설정

신규 설치에서는 `env.example`을 참고해 설정합니다. 기존 설치는 `.env`·서비스 주입 설정을 보존하고 예제로 덮어쓰지 않습니다.

### 필수 MariaDB 변수

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_CONNECTION_LIMIT`, `DB_CONNECT_TIMEOUT_MS`

### 필수 인증 변수

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SUPERUSER_EMAIL`

### 필수 앱/런타임 변수

- `APP_PORT`, `UPLOAD_DIR`, `UPLOAD_MAX_FILE_SIZE_MB`

### 로그 변수

- `LOG_DIR`, `LOG_RETENTION_DAYS`, `LOG_MAX_FILE_SIZE_MB`

---

## DB 연결 검증

```bash
# env 변수만 검증 (실제 연결 없음)
npm run db:check -- --validate-only

# 실제 MariaDB 연결 테스트
npm run db:check
```

`npm run db:migrate -- --status`는 native migration 상태를 읽습니다. 명시적 `--apply` 또는 SU DB 관리 action은 별도 `DB_SCHEMA_USER/DB_SCHEMA_PASSWORD`를 사용해 v1–v8을 적용합니다. schema 키는 웹 설정 폼에서 읽거나 편집하지 않습니다. 적용 전 백업·쓰기 중지와 [native migration 계약](docs/NATIVE_DATABASE_MIGRATIONS.md)을 확인하십시오. 계정/권한은 자동 생성·변경하지 않습니다.

---

## 검증 명령

```bash
npm run lint          # ESLint 검사
npm run typecheck     # tsc --noEmit
npm run check:fsd     # FSD import 경계 검사 (fixture self-test + 저장소 검사)
npm run build         # main: native Next 프로덕션 빌드
npm run build:sites   # 별도 Sites Worker 빌드
npm run db:check      # DB 연결 테스트
npm run dev:debug     # Node 인스펙터 포함 dev 서버
```

---

## 문서

루트에는 진입점만 두고 나머지 문서는 모두 [`docs/`](docs/)에 있습니다.

| 문서 | 내용 |
| --- | --- |
| [docs/TODO.md](docs/TODO.md) | 열린 항목(`QLT/RPT/OPS/PRD-###`), 상태, 선행 관계 |
| [docs/COMPLETED_LOG.md](docs/COMPLETED_LOG.md) | 완료 항목의 배경과 회귀 방지 수단 |
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | 제품 정의, MVP 범위, DB 설계 |
| [docs/MASTER_PLAN.html](docs/MASTER_PLAN.html) | 운영 로드맵 (브라우저에서 열기) |
| [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) | 코드 탐색 지도 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 인증·인가, 가시성, 데이터 경계 |
| [docs/NAS_UPDATE_GUIDE.md](docs/NAS_UPDATE_GUIDE.md) | 기존 NAS 업데이트·백업·migration·수동 인수 |
| [docs/HARNESS_MAP.md](docs/HARNESS_MAP.md) | 실행·검증 명령과 기준선 |
| [docs/manual/](docs/manual/) | 사용자 교육 슬라이드와 빠른 참조 카드 |
| [AGENTS.md](AGENTS.md) | AI 에이전트 작업 규칙 |
