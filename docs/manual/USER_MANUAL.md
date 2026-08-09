# WBSCowork 사용설명서 — 슬라이드 제작·발표 가이드

> 대상 문서: [`USER_MANUAL.html`](USER_MANUAL.html) (22 슬라이드) · [`QUICK_REFERENCE.md`](QUICK_REFERENCE.md) (1장 요약).
> 테마: Teal & Coral (#277884 / #5EA8A7 / #FE4447)

이 문서는 사용자 교육용 슬라이드 데크를 **보고, 변환하고, 수정하고, 발표하는 방법**을 하나로 모은 가이드입니다. 제품 사용법 자체는 슬라이드와 빠른 참조 카드에 있습니다.

---

## 1. 매뉴얼 구성

| 파일 | 형식 | 용도 | 소요 |
| --- | --- | --- | --- |
| [`USER_MANUAL.html`](USER_MANUAL.html) | standalone HTML | 브라우저 슬라이드 쇼, PPTX 변환 소스 | 발표 30~40분 |
| [`USER_MANUAL.md`](USER_MANUAL.md) | Markdown | 이 문서 — 변환·커스터마이징·발표 가이드 | 10분 |
| [`QUICK_REFERENCE.md`](QUICK_REFERENCE.md) | Markdown | 인쇄용 1장 요약, 온보딩 핸드아웃 | 2~3분 |
| [`../../scripts/convert-manual-to-pptx.js`](../../scripts/convert-manual-to-pptx.js) | Node 스크립트 | PPTX 생성 | — |
| [`../../scripts/generate-manual-docx.js`](../../scripts/generate-manual-docx.js) | Node 스크립트 | DOCX 생성 | — |

빠르게 열기:

```bash
open docs/manual/USER_MANUAL.html
```

---

## 2. 슬라이드 구성

| 슬라이드 | 제목 | 내용 |
| --- | --- | --- |
| 1 | 제목 | WBSCowork 사용설명서 — 소개 |
| 2 | 핵심 개념 | 게시판/일반 협업툴이 아닌 태스크 기반 산출물 시스템 |
| 3 | 기술 스택 | Next.js, TypeScript, MUI, MariaDB, NextAuth |
| 4 | 역할 시스템 | 슈퍼관리자 / 관리자 / 일반사용자 / 게스트 |
| 5 | 제출물 공개 범위 | public / private visibility |
| 6 | 메인 화면 | 홈 (Gantt + 태스크 목록) |
| 7~8 | 태스크 관리 | 생성·편집·상세 |
| 9 | 산출물 제출 | Markdown 제출물 |
| 10 | 파일 첨부 | 업로드·다운로드 |
| 11 | 댓글 및 협업 | 제출물 단위 피드백 |
| 12 | 관리자 패널 | `/admin` 구성 |
| 13 | DB 관리 | `/admin/database` (슈퍼관리자) |
| 14 | 로깅·모니터링 | `/admin/logs` (슈퍼관리자) |
| 15 | 환경 설정 | `/admin/settings` (슈퍼관리자) |
| 16 | 권한 관리 | `/admin/users` |
| 17~18 | 팁·모범 사례 | 운영 권장 사항 |
| 19 | FAQ | 자주 묻는 질문 |
| 20 | 지원 | 문의 경로 |
| 21~22 | 요약·마무리 | 핵심 정리 |

### 파트 구분

- **파트 1 (1~6)** 소개: 개념·스택·역할·화면
- **파트 2 (7~11)** 사용법: 태스크·산출물·협업
- **파트 3 (12~16)** 관리 기능
- **파트 4 (17~22)** 실전·요약

---

## 3. 디자인 사양

### 색상 팔레트 (Teal & Coral)

| 색상 | Hex | 용도 |
| --- | --- | --- |
| 진한 티알 | `#277884` | 헤더, 제목 |
| 밝은 티알 | `#5EA8A7` | 부제목, 구분선 |
| 코랄 | `#FE4447` | 액센트, 강조 |
| 화이트 | `#FFFFFF` | 배경 |
| 라이트 그레이 | `#f5f5f5` | 배경 하이라이트 |
| 그레이 | `#333`, `#999` | 본문·캡션 |

### 시각 요소

- 슬라이드 헤더: 그래디언트 (진한 티알 → 밝은 티알)
- 제목 36~52pt 굵음, 본문 16pt, 캡션 12~14pt
- 하이라이트 박스: 코랄 왼쪽 테두리 + 연한 배경
- 역할 뱃지: 진한 티알 배경 + 흰색 텍스트
- 슬라이드 비율 16:9, 여백 0.5인치

### 자산 규칙

`USER_MANUAL.html`은 외부 CDN·폰트·이미지를 참조하지 않는 standalone 문서로 유지합니다. 이미지가 필요하면 data URI로 인라인합니다.

---

## 4. PPTX / DOCX 생성

저장소 안의 스크립트를 사용합니다. 출력물은 항상 `scripts/outputs/`에 씁니다.

```bash
node scripts/convert-manual-to-pptx.js   # → scripts/outputs/WBSCowork_Manual.pptx
node scripts/generate-manual-docx.js     # → scripts/outputs/WBSCowork_UserManual.docx
```

- 의존성 `pptxgenjs`, `docx`는 이미 devDependencies에 있습니다. 전역 설치는 필요 없습니다.
- 두 스크립트는 `docs/screenshots/` 아래 스크린샷을 선택적으로 참조합니다. 해당 경로는 git에서 제외되므로 없으면 스크린샷 없이 생성됩니다.
- 슬라이드 텍스트를 바꾸면 HTML과 스크립트 양쪽을 함께 갱신해야 결과가 일치합니다.

---

## 5. 커스터마이징

### 색상 변경

HTML의 색상 클래스를 수정합니다.

```html
.bg-teal-dark { background: #277884; }
.coral { color: #FE4447; }
```

스크립트 쪽 `COLORS` 상수도 동일한 값으로 맞춥니다.

### 슬라이드 추가

```html
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

## 6. 발표 가이드

### 세션별 추천 구성

| 대상 | 슬라이드 | 시간 | 초점 |
| --- | --- | --- | --- |
| 신입 온보딩 | 1~11, 21~22 | 20분 | 기본 사용법 |
| 전체 팀 | 1~11, 21~22 | 30분 | 기본 + Q&A |
| 관리자 | 12~16 | 15분 | 관리 기능 |
| 심화 | 13~16, 19~20 | 20분 | 운영·문제 해결 |
| 경영진 | 1~3, 21~22 | 10분 | 개념 요약 |

### 30분 진행 시나리오

1. **도입 3분** (1~2): 문제 정의와 태스크 중심 접근
2. **개념 7분** (3~6): 스택, 역할, 공개 범위, 화면 구성
3. **사용법 12분** (7~11): 라이브 데모 권장
4. **관리 5분** (12~16): 관리자 대상일 때만
5. **마무리 3분** (21~22): 요약과 Q&A

### 발표자 노트

슬라이드마다 **왜 / 언제 / 어떻게 / 예시** 네 줄을 준비하면 데모 없이도 흐름이 끊기지 않습니다.

### 체크리스트

#### 발표 전

- [ ] 대상 브라우저에서 HTML 슬라이드 확인
- [ ] PPTX 변환 결과 확인
- [ ] 화면 해상도·프로젝터 확인
- [ ] 데모 계정과 샘플 프로젝트 준비

#### 배포 전

- [ ] 문서 내 링크 유효성 확인
- [ ] 실제 권한 정책과 슬라이드 설명 일치 확인
- [ ] 오탈자 검사
- [ ] 팀 피드백 반영

#### 교육 운영

- [ ] `QUICK_REFERENCE.md` 인쇄본 배포
- [ ] 역할별 실습 환경(게스트/일반사용자) 준비
- [ ] FAQ 공유

---

## 7. 문제 해결

| 증상 | 확인 |
| --- | --- |
| HTML이 열리지 않음 | 최신 브라우저 사용, 파일 경로 확인 |
| PPTX 생성 실패 | `npm install` 후 재실행, `scripts/outputs/` 쓰기 권한 확인 |
| 색상이 다르게 보임 | HTML과 스크립트 `COLORS` 상수 불일치 여부 확인 |
| 스크린샷이 빠짐 | `docs/screenshots/` 경로에 이미지 배치 (git 제외 경로) |

---

## 8. 관련 문서

- [`../PRODUCT_SPEC.md`](../PRODUCT_SPEC.md) — 제품 정의·MVP 범위·DB 설계
- [`../MASTER_PLAN.html`](../MASTER_PLAN.html) — 운영 마스터 플랜
- [`../TODO.md`](../TODO.md) — 현재 진행 태스크
- [`../../AGENTS.md`](../../AGENTS.md) — 에이전트 가이드·권한 시스템
