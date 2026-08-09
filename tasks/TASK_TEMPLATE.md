# 작업 제목

## 0. 메타데이터

- 담당자/에이전트:
- 상태: `planned | in-progress | blocked | review | done`
- 우선순위: `P0 | P1 | P2`
- 관련 이슈/문서:
- 작업 브랜치:
- commit/push 허용 여부:

## 1. 목표

한 문장으로 사용자/운영 결과를 적는다.

## 2. 범위

### 포함

-

### 제외

-

## 3. 시작 상태(반드시 기록)

```text
git status --short:
branch:
remote:
기존 사용자 변경:
```

기존 변경을 삭제·stash·format하지 않는다. `.env*`, 로그, 업로드 파일의 실제 값/내용은 수집하지 않는다.

## 4. 조사 근거

- route/page/action:
- model/policy:
- repository/SQL:
- schema (`lib/database-admin.ts`):
- package script/config:
- 관련 기존 문서:

## 5. 요구사항 및 수용 기준

- [ ] 요구사항 1
- [ ] 요구사항 2
- [ ] UI가 아니라 서버 경계에서도 권한을 검사한다.
- [ ] private 제출물의 댓글·첨부·download가 부모 visibility를 따른다(관련 시).
- [ ] 코드/문서/실제 package script가 일치한다.

## 6. 권한·데이터 매트릭스(관련 시 필수)

| 행위/리소스 | anonymous | guest | member(본인) | member(타인) | admin | superuser |
| --- | --- | --- | --- | --- | --- | --- |
| 조회 | | | | | | |
| 생성 | | | | | | |
| 수정 | | | | | | |
| 삭제 | | | | | | |
| 첨부 다운로드 | | | | | | |

- 대상 리소스 ownership:
- `public/private` 처리:
- unauthorized/missing 응답 정책:
- 감사 로그/redaction:

## 7. DB/파일 영향(관련 시 필수)

- 테이블/컬럼/인덱스/FK:
- fresh DB 경로:
- existing DB upgrade/backfill:
- rollback/backup:
- DB row와 파일 lifecycle:
- 최소권한 credential 영향:

## 8. 구현 계획

1.
2.
3.

FSD 구조 이동은 `shared → entities → features → widgets → root app` 순서로 하고 기능/SQL/권한 변경과 섞지 않는다.

### 도구 사용 판단

- Serena 필요 여부/이유: 역할·권한, DB schema/repository, 다중 route 리팩터링의 심볼 영향 추적일 때만 `예`.
- Graphify 필요 여부/이유: 일반 검색으로 해결되지 않는 예외적 의존 그래프/순환 분석일 때만 `예`.

## 9. 검증 계획과 실제 결과

| 명령/검증 | 기대 | 실제 결과 | 상태 |
| --- | --- | --- | --- |
| `npm run lint` | ESLint 통과 | | |
| `npm run build` | Next build 통과 | | |
| `npm run db:check -- --validate-only` | DB env 검증 | | N/A 가능 |
| `npm run db:check` | 실제 MariaDB 연결 | | N/A 가능 |
| route/role/visibility smoke | matrix 충족 | | |
| `git diff --check` | whitespace error 없음 | | |

존재하지 않는 test script를 만들지 않고 실행했다고 쓰지 않는다. 미실행은 이유를 적는다.

## 10. 완료 보고

- 변경 파일(절대경로):
- 동작/설계 변경 요약:
- 실행 결과:
- 기존부터 있던 오류/경고:
- 남은 위험/후속 작업:
- 최종 `git status --short`:
- commit/push 수행 여부:
