# 프로젝트 마스터플랜
## WBS 기반 협업 & 산출물 공유 시스템 (Next.js + TypeScript)

---

# 1. 프로젝트 정의

## 목표
- WBS/간트 기반으로 주간 업무를 관리
- 태스크 단위로 산출물 제출 및 공유
- 팀원 간 피드백 및 협업 지원

## 핵심 개념
> 게시판이 아닙니다  
> 일반 협업툴이 아닙니다  
→ **태스크 기반 산출물 관리 시스템**

---

# 2. 기술 스택

## 프론트엔드 + 백엔드 (통합)
- Next.js 16 App Router
- TypeScript
- React
- MUI (Material UI)

## 인증
- NextAuth v4 (Google OAuth)

## 데이터베이스
- MariaDB

## 기타 라이브러리
- TanStack Query
- frappe-gantt (간트 차트)

---

# 3. 실제 프로젝트 구조

```
app/           Next.js App Router 라우트
  api/         Route Handlers
  admin/       관리자 페이지
  tasks/       메인 WBS 태스크 워크스페이스
components/
  AppShell.tsx 전역 앱바 + 역할별 관리자 메뉴
  gantt/       frappe-gantt 래퍼
  task/        태스크 제출물 패널
lib/
  auth.ts      NextAuth 설정
  db.ts        MariaDB 풀
  repositories/ DB 접근 계층
models/        도메인 타입
docs/          프로젝트 문서
```

---

# 4. DB 설계 (MariaDB)

## 프로젝트(projects)
```sql
projects (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255),
  start_date DATE,
  end_date DATE,
  created_at DATETIME
)
```

## 사용자(users)
```sql
users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255),
  name VARCHAR(255),
  role ENUM('admin','member','guest'),
  created_at DATETIME
)
```

### 역할 체계
- **슈퍼관리자**: `SUPERUSER_EMAIL` env와 일치하는 계정, 모든 권한
- **관리자(admin)**: `/admin`, `/admin/users` 접근, 모든 제출물 조회·관리
- **일반사용자(member)**: 태스크·제출물·댓글 CRUD, 본인 비공개 제출물 조회
- **게스트(guest)**: 공개 제출물 읽기 전용

## 태스크(tasks)
```sql
tasks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT,
  parent_id BIGINT NULL,
  title VARCHAR(255),
  description TEXT,
  start_date DATE,
  end_date DATE,
  depth INT,
  order_index INT,
  assignee_id BIGINT,
  created_at DATETIME
)
```

## 제출물(submissions)
```sql
submissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  task_id BIGINT,
  author_id BIGINT,
  content TEXT,
  file_path VARCHAR(500),
  visibility ENUM('public','private') NOT NULL DEFAULT 'public',
  created_at DATETIME
)
```

## 댓글(comments)
```sql
comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  submission_id BIGINT,
  author_id BIGINT,
  content TEXT,
  created_at DATETIME
)
```

---

# 5. 환경변수

## 필수 정책
- 모든 설정값은 `.env` 사용
- 코드 내 하드코딩 금지
- `.env*` 파일은 AI 작업 컨텍스트에서 제외

## env.example 구성
```env
# 앱
NEXT_PUBLIC_APP_NAME=WBS Task
APP_PORT=3000

# 데이터베이스
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=wbs_app
DB_CONNECTION_LIMIT=5
DB_CONNECT_TIMEOUT_MS=10000

# 인증 (Google)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
SUPERUSER_EMAIL=admin@example.com

# 파일 업로드
UPLOAD_DIR=./uploads
UPLOAD_MAX_FILE_SIZE_MB=200

# 로그
LOG_DIR=./logs
LOG_RETENTION_DAYS=5
LOG_MAX_FILE_SIZE_MB=100
```

---

# 6. 핵심 기능 설계

## 인증
- Google OAuth 로그인
- 최초 로그인 시 사용자 생성 (기본 `guest` 권한)
- `SUPERUSER_EMAIL`과 일치하는 계정은 슈퍼관리자로 처리

## 프로젝트 관리
- 프로젝트 생성·삭제 (쓰기 권한 사용자)

## WBS (태스크)
- 트리 구조 (parent_id 기반)
- 담당자 지정
- 간트 차트 연동

## 간트 차트
- 태스크 기반 자동 렌더링
- frappe-gantt 타임라인

## 산출물 제출
- Markdown 작성 + 파일 업로드
- 공개/비공개 설정
- 태스크에 귀속

## 피드백
- 제출물 기반 댓글 스레드

---

# 7. UI 구조

## 홈 (/)
- 선택 프로젝트 간트 + 태스크 목록

## 작업 공간 (/tasks)
- 프로젝트/태스크 CRUD
- 간트 시각화
- 태스크별 제출물·댓글

## 관리자 패널 (/admin)
- 슈퍼관리자: 관리 개요, 로그, 세팅, 사용자 관리, DB 관리
- 관리자: 관리 개요, 사용자 관리

---

# 8. 개발 단계

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 1단계 | Next.js + TypeScript + MUI + NextAuth 세팅 | 완료 |
| 2단계 | MariaDB 연결, User/Project 모델 | 완료 |
| 3단계 | 태스크(WBS) CRUD | 완료 |
| 4단계 | 간트 차트 연동 | 완료 |
| 5단계 | 제출물 기능 | 완료 |
| 6단계 | 댓글 기능 | 완료 |
| 7단계 | 파일 업로드 | 완료 |
| 역할 확장 | 4단계 역할 + 제출물 공개/비공개 | 완료 |
| 8단계 | Synology NAS 배포 | 예정 |

---

# 9. 핵심 설계 원칙

- 단순함 유지
- 태스크 중심 구조 유지
- MVP 범위 밖 기능 확장 금지
- 모든 설정은 `.env`로 관리
- 간트 타임라인이 제품의 시그니처 화면

---
