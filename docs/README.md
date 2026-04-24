# README — WBS 태스크 협업 시스템

Next.js App Router 기반 태스크 중심 WBS 협업 시스템입니다.

프로젝트·태스크 CRUD, 간트 시각화, 태스크별 Markdown 제출물, 공개/비공개 제출물, 파일 첨부, 댓글, 관리자 패널, 홈 대시보드 요약을 포함합니다.

---

## 빠른 시작

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

`.env`에 `APP_PORT`를 설정하면 지정 포트로 실행됩니다. `build`와 `start` 스크립트 모두 동일한 env 파일을 사용합니다.

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
- 쓰기 권한 사용자(`member`, 관리자, 슈퍼관리자)는 프로젝트 카드에서 직접 삭제할 수 있습니다.
- 각 태스크에는 Markdown 제출물·댓글·첨부파일 영역이 포함됩니다.
- 제출물에 공개/비공개를 설정할 수 있습니다. 비공개 제출물은 작성자 본인과 관리자만 조회 가능합니다.

---

## 인증 및 관리자 접근

- Google OAuth를 통해 NextAuth로 로그인합니다.
- `.env`에 `SUPERUSER_EMAIL`을 설정하면 해당 Google 계정이 슈퍼관리자로 동작합니다.
- 새 Google 로그인은 기본적으로 `guest` 권한으로 저장됩니다.
- 슈퍼관리자 또는 관리자는 `/admin/users`에서 사용자 역할(관리자/일반사용자/게스트)을 변경할 수 있습니다.
- `/admin/database`는 슈퍼관리자 전용 DB 관리 화면입니다.
- `/admin/logs`와 `/admin/settings`는 슈퍼관리자 전용입니다.

---

## 환경 설정

`env.example`의 변수를 `.env`로 복사하고 실제 값을 입력합니다.

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

관리자 UI에서도 슈퍼관리자가 DB와 핵심 테이블(`users`, `projects`, `tasks`, `submissions`, `comments`)을 직접 생성할 수 있습니다.

---

## 검증 명령

```bash
npm run lint          # ESLint 검사
npm run build         # 프로덕션 빌드
npm run db:check      # DB 연결 테스트
npm run dev:debug     # Node 인스펙터 포함 dev 서버
```
