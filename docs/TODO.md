# WBS 태스크 — 진행 목록

> **살아있는 문서** — 단계 범위, 검증 절차, 블로커가 바뀔 때마다 업데이트하십시오.

---

## 완료된 단계

- [x] 1단계: Next.js + TypeScript 워크스페이스 초기화
- [x] 1단계: MUI 테마 기반 구성
- [x] 1단계: NextAuth 기반 설정
- [x] 2단계: MariaDB 연결 모듈 및 환경변수 검증 추가
- [x] 2단계: User·Project 도메인 모델 정의
- [x] 2단계: Google 인증 사용자를 MariaDB에 자동 저장
- [x] 2단계: 슈퍼관리자 로그인 및 관리자 전용 DB 관리 라우트
- [x] 3단계: 태스크(WBS) CRUD + 게스트/멤버 쓰기 정책 적용
- [x] 4단계: frappe-gantt 간트 차트 연동
- [x] 5단계: 제출물 기능 구현
- [x] 6단계: 댓글 기능 구현
- [x] 7단계: 파일 업로드 플로우 구현
- [x] 워크플로: APP_PORT 기반 빌드/시작 스크립트
- [x] 워크플로: 반응형 앱셸, 라우트 내비게이션, 3모드 테마 스위칭
- [x] 워크플로: 구조화 사용자 행동 로깅 + 관리자 로그 검토
- [x] 워크플로: 홈 태스크 카드에서 집중 태스크 라우팅
- [x] 역할 확장: 4단계(슈퍼관리자/관리자/일반사용자/게스트) + 제출물 공개/비공개
- [x] 문서 정리: /docs/ 디렉터리 구조화, AGENTS.md 재작성

---

## 현재 진행

없음.

---

## 다음 작업

- [ ] 8단계: Feature-Sliced Design(FSD) 기반 프론트엔드 구조 정리
  - 실행 계약과 현재 파일별 매핑은 [FSD_MIGRATION_PLAN.md](FSD_MIGRATION_PLAN.md)를 따른다.
  - 루트 `app/`은 App Router 엔트리로 유지한다. 구축/이동은 `src/shared → src/entities → src/features → src/widgets → root app pages` 순이며 중복 책임의 `src/app`, `src/pages`는 만들지 않는다.
  - [ ] M0: `scripts/check-fsd-boundaries.ts` + `npm run check:fsd` 경계 하네스
  - [ ] M1: 범용 UI/config/server utility를 shared로 이동하고 호환 re-export 유지
  - [ ] M2: 모델/정책과 repository를 entity로 나누어 이동
  - [ ] M3: Server Action mutation을 feature use-case로 추출
  - [ ] M4: UI를 widget 단위로 이동
  - [ ] M5: root app page/route adapter를 마지막 전환하고 호환 레이어 제거
- [ ] 9단계: Scheduled project digest + DOCX/PPTX report export
  - 상세 계약과 D0~D5 게이트는 [PROJECT_DIGEST_REPORT_PLAN.md](PROJECT_DIGEST_REPORT_PLAN.md)를 따른다.
  - [ ] D0: 현재 DB 사실만 담는 versioned `DigestSnapshot` + privacy fixture
  - [ ] D1: admin/superuser용 manual JSON preview
  - [ ] D2: 동일 snapshot 기반 DOCX/PPTX export + 권한 다운로드
  - [ ] D3: scheduler token, dry-run, MariaDB versioned migration·최소권한·run ledger/idempotency
  - [ ] D4: download-only 운영 + artifact retention
  - [ ] D5: membership/recipient consent와 threat model 승인 후 delivery 검토
- [ ] 10단계: Synology NAS 배포 준비

---

## 미해결 블로커

- 2026-07-26 검수에서 `npm run lint` 실패(이번 문서 변경과 무관한 기존 범위): 외장 드라이브 AppleDouble `._next-env.d.ts` parse error, `.github/skills/document-skills/pptx/scripts/html2pptx.js`·`scripts/convert-manual-to-pptx.js`·`scripts/generate-manual-docx.js`의 CommonJS import/unused 경고. 다음 코드 품질 작업에서 generated/AppleDouble 제외 정책과 authoring script lint 범위 또는 ESM 전환을 결정한 뒤 17건(오류 10, 경고 7)을 해소한다.
- 같은 검수의 `npm run build`는 성공했으나 Node `[DEP0205] module.register()` deprecation warning이 발생했다. `tsx`/Node/Next.js 조합의 upstream 또는 버전 호환성을 확인하고 경고가 사라지는 조합에서 재검증한다.

---

## 참고 문서

- [docs/MasterPlan.md](MasterPlan.md) — 전체 제품 계획
- [docs/PROJECT_MAP.md](PROJECT_MAP.md) — 실행 맵 (커맨드 하네스)
- [AGENTS.md](../AGENTS.md) — AI 에이전트 가이드
