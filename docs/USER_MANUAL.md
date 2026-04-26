# WBSCowork 사용설명서 — 슬라이드 발표 자료 가이드

> **생성일:** 2026년 4월  
> **형식:** HTML Slide Deck (22개 슬라이드) + PowerPoint 변환 가이드  
> **테마:** Teal & Coral (티알 #5EA8A7 / #277884, 코랄 #FE4447)

---

## 개요

`USER_MANUAL.html` 은 WBSCowork 프로젝트의 종합 사용설명서를 22개 슬라이드 형식으로 구성한 HTML 문서입니다.

**주요 내용:**

1. 핵심 개념 (WBSCowork의 정의 및 특징)
2. 기술 스택 소개
3. 역할 시스템 및 권한 관리
4. 제출물 공개 범위 설정
5. 메인 화면 및 Gantt 차트 사용법
6. 태스크 관리 (생성, 편집, 상세 보기)
7. 산출물 제출 및 파일 첨부
8. 댓글 및 팀 협업
9. 관리자 패널 기능
10. 데이터베이스 및 로깅 관리
11. 환경 설정 및 권한 관리
12. 사용 팁 및 모범 사례
13. 자주 묻는 질문 및 지원

---

## 슬라이드 구성

| 슬라이드 | 제목 | 내용 |
|---------|------|------|
| 1 | 제목 | WBSCowork 사용설명서 - 소개 |
| 2 | 핵심 개념 | 게시판/협업툴이 아닌 태스크 기반 시스템 |
| 3 | 기술 스택 | Next.js, TypeScript, MariaDB 등 |
| 4 | 역할 시스템 | 슈퍼관리자, 관리자, 일반사용자, 게스트 |
| 5 | 제출물 공개 범위 | public/private visibility 설정 |
| 6 | 메인 화면 | 홈 (Gantt + 태스크 목록) |
| 7-8 | 태스크 관리 | 생성, 편집, 상세 보기 |
| 9 | 산출물 제출 | 태스크에 결과물 등록 |
| 10 | 파일 첨부 | 첨부 방법 및 지원 타입 |
| 11 | 댓글 및 협업 | 팀원 소통 및 피드백 |
| 12 | 관리자 패널 | /admin 대시보드 |
| 13 | DB 관리 | 데이터베이스 초기 설정 |
| 14 | 로깅 모니터링 | 시스템 로그 조회 |
| 15 | 환경 설정 | /admin/settings |
| 16 | 권한 관리 | 사용자 역할 변경 |
| 17-18 | 팁 & 모범사례 | 효율적 사용법 |
| 19 | FAQ | 자주 묻는 질문 |
| 20 | 연락처 & 지원 | 문제 해결 |
| 21 | 핵심 요약 | 4가지 단계 정리 |
| 22 | 감사의 말 | 마무리 |

---

## 디자인 특징

### 색상 팔레트 (Teal & Coral)

```
주색상:
  - 진한 티알 #277884  (헤더, 텍스트 강조)
  - 밝은 티알 #5EA8A7 (부제목, 구분선)
  - 코랄 #FE4447     (강조, 액센트)
  - 화이트 #FFFFFF    (배경)

보조색상:
  - 라이트 그레이 #f5f5f5 (배경)
  - 어두운 회색 #333, #999 (본문 텍스트)
```

### 시각 요소

- **슬라이드 헤더:** 그래디언트 배경 (진한 티알 → 밝은 티알)
- **제목:** 진한 티알 (36pt, 굵음)
- **하이라이트 박스:** 코랄 왼쪽 테두리 + 연한 배경
- **역할 뱃지:** 진한 티알 배경 + 흰색 텍스트
- **단계 번호:** 원형 코랄 배경 + 숫자

---

## PowerPoint 변환 방법

### 방법 1: Claude Code 사용 (권장)

```bash
# 1. 저장소 설정 (처음 1회만)
cd /path/to/claude-office-skills
npm install
python -m venv venv
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows
pip install -r requirements.txt

# 2. 변환
node public/pptx/scripts/html2pptx.js /path/to/USER_MANUAL.html -o WBSCowork_Manual.pptx
```

### 방법 2: 수동 변환 (Node.js)

```javascript
// convert-to-pptx.js
const pptxgen = require('pptxgenjs');
const html2pptx = require('./public/pptx/scripts/html2pptx');
const fs = require('fs');

async function convert() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'WBSCowork Team';
    pptx.title = 'WBSCowork 사용설명서';

    const htmlFile = '/path/to/USER_MANUAL.html';
    const { slide } = await html2pptx(htmlFile, pptx);

    await pptx.writeFile({ fileName: 'WBSCowork_Manual.pptx' });
    console.log('✓ 변환 완료: WBSCowork_Manual.pptx');
}

convert().catch(console.error);
```

실행:
```bash
node convert-to-pptx.js
```

### 방법 3: 온라인 도구

여러 온라인 HTML-to-PPTX 변환 도구 사용 가능 (검색: "html to powerpoint online")

---

## 파일 위치 및 관리

**저장 위치:**
```
docs/
  ├── USER_MANUAL.html          # 슬라이드 HTML 소스
  ├── USER_MANUAL.md            # 이 문서
  ├── MasterPlan.md             # 프로젝트 계획
  ├── PROJECT_MAP.md            # 실행 맵
  └── TODO.md                   # 작업 목록
```

**생성 위치 (PowerPoint 변환 후):**
```
outputs/
  └── WBSCowork-Manual/
      ├── WBSCowork_Manual.pptx # 최종 발표 자료
      └── thumbnails.jpg         # 미리보기
```

---

## 커스터마이징 가이드

### 색상 변경

HTML 파일의 `:root` 스타일에서 색상 변수 수정:

```html
<!-- 색상 클래스 수정 -->
.bg-teal-dark { background: #277884; }  /* 변경 원하는 색상 입력 */
.coral { color: #FE4447; }              /* 변경 원하는 색상 입력 */
```

### 텍스트 내용 수정

각 슬라이드의 `<h2>`, `<p>`, `<li>` 요소 편집:

```html
<h3>새로운 제목</h3>
<p>새로운 내용...</p>
```

### 슬라이드 추가/삭제

```html
<!-- 새 슬라이드 추가 -->
<div class="slide">
    <div class="slide-header">
        <div class="slide-title">새로운 제목</div>
        <div class="slide-subtitle">부제목</div>
    </div>
    <div class="slide-content content-full">
        <!-- 콘텐츠 -->
    </div>
</div>
```

---

## 발표 팁

### 프레젠테이션 흐름

1. **슬라이드 1-3:** 상황 설정 (WBSCowork란? 기술)
2. **슬라이드 4-6:** 개념 이해 (역할, 공개범위, 화면 구성)
3. **슬라이드 7-11:** 사용법 (태스크, 산출물, 협업)
4. **슬라이드 12-16:** 관리자 기능 (패널, DB, 설정)
5. **슬라이드 17-20:** 실제 사용 (팁, FAQ, 지원)
6. **슬라이드 21-22:** 마무리 (요약, 감사)

### 발표 시간 가이드

- **전체 발표:** 약 30-40분
- 각 슬라이드: 약 1.5-2분 (Q&A 제외)

### 추천 세션

| 대상 | 슬라이드 | 시간 |
|------|---------|------|
| 전체 팀 | 1-11 + 21-22 | 20분 |
| 관리자 | 12-16 | 15분 |
| 신입 | 1-11 | 15분 |
| 심화 | 13-16 | 15분 |

---

## 참고 문서

- `docs/MasterPlan.md` — 프로젝트 전체 계획
- `docs/PROJECT_MAP.md` — 실행 맵 및 검증 명령
- `docs/TODO.md` — 현재 진행 태스크
- `AGENTS.md` — 에이전트 가이드 및 권한 시스템

---

## 질문 및 피드백

슬라이드 내용이나 구성에 대한 피드백은:

1. GitHub Issues에 등록
2. 시스템 관리자에게 문의
3. `docs/` 폴더의 다른 문서 참조

---

**마지막 업데이트:** 2026년 4월 26일
