# 🧠 프로젝트 마스터플랜  
## WBS 기반 협업 & 산출물 공유 시스템 (Next.js + TypeScript)

---

# 📌 1. 프로젝트 정의

## 🎯 목표
- WBS/간트 기반으로 주간 업무를 관리
- Task 단위로 산출물 제출 및 공유
- 팀원 간 피드백 및 협업 지원

## 🧩 핵심 개념
> 게시판 ❌  
> 협업툴 ❌  
👉 **Task 기반 산출물 관리 시스템**

---

# 🧱 2. 기술 스택

## Frontend + Backend (통합)
- :contentReference[oaicite:0]{index=0} (App Router)
- TypeScript (필수)
- React
- MUI (Material UI)

## 인증
- :contentReference[oaicite:1]{index=1} (Google OAuth)

## DB
- MariaDB

## 기타
- TanStack Query
- frappe-gantt (간트 차트)

---

# 📁 3. 프로젝트 구조

```bash
.
├── app/
│   ├── (auth)/
│   ├── dashboard/
│   ├── project/
│   │   └── [id]/
│   │       ├── page.tsx
│   │       ├── gantt/
│   │       └── task/
│   ├── api/
│   │   ├── auth/
│   │   ├── task/
│   │   ├── submission/
│   │   └── upload/
│   └── layout.tsx
│
├── components/
│   ├── gantt/
│   ├── task/
│   ├── submission/
│   └── common/
│
├── lib/
│   ├── db.ts
│   ├── auth.ts
│   └── utils.ts
│
├── models/
│   ├── project.ts
│   ├── task.ts
│   ├── submission.ts
│   └── user.ts
│
├── styles/
├── public/
├── .env
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

# 🗄️ 4. DB 설계 (MariaDB)

## Project
```sql
projects (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255),
  start_date DATE,
  end_date DATE,
  created_at DATETIME
)
```

## User
```sql
users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255),
  name VARCHAR(255),
  role ENUM('admin','member'),
  created_at DATETIME
)
```

## Task (WBS)
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

## Submission
```sql
submissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  task_id BIGINT,
  author_id BIGINT,
  content TEXT,
  file_path VARCHAR(500),
  created_at DATETIME
)
```

## Comment
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

# 🔐 5. 환경변수 (.env)

## 필수 정책
- 모든 설정값은 `.env` 사용
- 코드 내 하드코딩 금지

## .env.example
```env
# App
NEXT_PUBLIC_APP_NAME=DraftFlow

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=wbs_app

# Auth (Google)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# File Upload
UPLOAD_DIR=/volume1/project-files
```

---

# 🚫 6. .gitignore

```gitignore
node_modules
.next
.env
.env.local
.env.*.local
dist
coverage
uploads
```

---

# ⚙️ 7. 핵심 기능 설계

## 1. 인증
- Google OAuth 로그인
- 최초 로그인 시 user 생성

---

## 2. 프로젝트 관리
- 프로젝트 생성
- 멤버 초대 (관리자만)

---

## 3. WBS (Task)
- 트리 구조 (parent_id 기반)
- 드래그 정렬
- 담당자 지정

---

## 4. 간트 차트
- Task 기반 자동 렌더링
- 기간 시각화

---

## 5. 산출물 제출
- Markdown 작성
- 파일 업로드
- Task에 귀속

---

## 6. 피드백
- Submission 기반 댓글

---

# 📊 8. UI 구조

## Dashboard
- 프로젝트 목록
- 진행률

## Project Detail
- 좌측: WBS Tree
- 우측: 간트 차트

## Task Detail
- Task 정보
- Submission 목록
- 댓글

---

# 🧪 9. 개발 단계 (Agent Workflow)

## 1단계
- Next.js + TypeScript 세팅
- MUI 테마 구성
- NextAuth 설정

## 2단계
- DB 연결 (MariaDB)
- User / Project 모델

## 3단계
- Task (WBS) CRUD

## 4단계
- 간트 차트 연동

## 5단계
- Submission 기능

## 6단계
- 댓글 기능

## 7단계
- 파일 업로드

## 8단계
- 배포 (Synology NAS)

---

# 🧠 10. 핵심 설계 원칙

- 단순함 유지
- Task 중심 구조 유지
- 기능 확장 금지 (MVP 기준)
- 모든 설정은 .env로 관리

---

# 🔥 최종 한줄 정의

> “Task 단위로 산출물을 누적하고 공유하는 WBS 기반 협업 시스템”